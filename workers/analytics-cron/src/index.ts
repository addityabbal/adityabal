// adityabal-analytics-cron: two scheduled jobs on the adityabal-analytics D1 database.
//   0 19 * * *   (00:30 IST daily)   roll yesterday into rollup_daily; delete old salts and usage
//                                     counters; delete raw events older than 400 days.
//   30 3 * * 1   (09:00 IST Monday)  email the weekly digest, each number with week-on-week change.
import { EmailMessage } from "cloudflare:email";

interface Env {
  ANALYTICS_DB: D1Database;
  DIGEST_EMAIL: SendEmail;
  DIGEST_FROM: string;
  DIGEST_TO: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RAW_RETENTION_DAYS = 400;

/** IST calendar day, offset by whole days from now. */
function istDay(offsetDays = 0, now = Date.now()): string {
  return new Date(now + 330 * 60 * 1000 + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

// ── Nightly rollup ───────────────────────────────────────────────────────────

async function rollup(env: Env, now: number): Promise<void> {
  const yesterday = istDay(-1, now);
  const today = istDay(0, now);
  await env.ANALYTICS_DB.batch([
    env.ANALYTICS_DB.prepare("DELETE FROM rollup_daily WHERE day = ?1").bind(yesterday),
    env.ANALYTICS_DB.prepare(
      `INSERT INTO rollup_daily (day, event, path, target, utm_source, utm_campaign, country, device, events, visitors)
       SELECT day, event, COALESCE(path, ''), COALESCE(target, ''), COALESCE(utm_source, ''), COALESCE(utm_campaign, ''),
              COALESCE(country, ''), COALESCE(device, ''), COUNT(*), COUNT(DISTINCT visitor)
       FROM events WHERE day = ?1
       GROUP BY 1, 2, 3, 4, 5, 6, 7, 8`,
    ).bind(yesterday),
    // Salts older than today are never needed again; deleting them makes old hashes unlinkable.
    env.ANALYTICS_DB.prepare("DELETE FROM daily_salt WHERE day < ?1").bind(today),
    env.ANALYTICS_DB.prepare("DELETE FROM daily_usage WHERE day < ?1").bind(istDay(-30, now)),
    env.ANALYTICS_DB.prepare("DELETE FROM events WHERE day < ?1").bind(istDay(-RAW_RETENTION_DAYS, now)),
  ]);
}

// ── Weekly digest ────────────────────────────────────────────────────────────

interface Week {
  from: string;
  to: string;
}

interface Headline {
  visitors: number;
  engaged: number;
  contacts: number;
  homeViews: number;
  held: number;
  demoCalls: number;
  demoOk: number;
}

async function headline(env: Env, w: Week): Promise<Headline> {
  const visitors = await env.ANALYTICS_DB.prepare(
    `WITH v AS (
       SELECT day, visitor,
              MAX((event = 'page_engaged' AND value >= 10) OR (event = 'scroll_depth' AND value >= 50)
                  OR event IN ('cta_click', 'contact_click', 'demo_open')) AS engaged,
              MAX(event = 'contact_click') AS contact
       FROM events WHERE day BETWEEN ?1 AND ?2 AND event NOT IN ('demo_result')
       GROUP BY day, visitor
     )
     SELECT COUNT(*) AS visitors, COALESCE(SUM(engaged), 0) AS engaged, COALESCE(SUM(contact), 0) AS contacts FROM v`,
  )
    .bind(w.from, w.to)
    .first<{ visitors: number; engaged: number; contacts: number }>();
  const hold = await env.ANALYTICS_DB.prepare(
    `WITH home AS (
       SELECT page_id FROM events WHERE event = 'page_view' AND path = '/' AND day BETWEEN ?1 AND ?2
     ),
     held AS (
       SELECT DISTINCT page_id FROM events
       WHERE page_id IN (SELECT page_id FROM home) AND value <= 10000
         AND (event IN ('cta_click', 'contact_click', 'demo_open', 'outbound_click')
              OR (event = 'section_view' AND target = 'scale'))
     )
     SELECT (SELECT COUNT(*) FROM home) AS home_views, (SELECT COUNT(*) FROM held) AS held`,
  )
    .bind(w.from, w.to)
    .first<{ home_views: number; held: number }>();
  const demos = await env.ANALYTICS_DB.prepare(
    `SELECT COUNT(*) AS calls, COALESCE(SUM(detail = 'ok'), 0) AS ok
     FROM events WHERE event = 'demo_result' AND day BETWEEN ?1 AND ?2`,
  )
    .bind(w.from, w.to)
    .first<{ calls: number; ok: number }>();
  return {
    visitors: visitors?.visitors ?? 0,
    engaged: visitors?.engaged ?? 0,
    contacts: visitors?.contacts ?? 0,
    homeViews: hold?.home_views ?? 0,
    held: hold?.held ?? 0,
    demoCalls: demos?.calls ?? 0,
    demoOk: demos?.ok ?? 0,
  };
}

async function topSources(env: Env, w: Week) {
  const { results } = await env.ANALYTICS_DB.prepare(
    `WITH touches AS (
       SELECT day, visitor, COALESCE(utm_source, ref_host, 'direct') AS source, COALESCE(utm_campaign, '-') AS campaign,
              ROW_NUMBER() OVER (PARTITION BY day, visitor ORDER BY ts, id) AS rn
       FROM events WHERE event IN ('shortlink_hit', 'page_view') AND day BETWEEN ?1 AND ?2
     ),
     outcomes AS (
       SELECT day, visitor,
              MAX((event = 'page_engaged' AND value >= 10) OR (event = 'scroll_depth' AND value >= 50)
                  OR event IN ('cta_click', 'contact_click', 'demo_open')) AS engaged,
              MAX(event = 'contact_click') AS contact
       FROM events WHERE day BETWEEN ?1 AND ?2 GROUP BY day, visitor
     )
     SELECT t.source, t.campaign, COUNT(*) AS visitors, SUM(o.engaged) AS engaged, SUM(o.contact) AS contacts
     FROM touches t JOIN outcomes o USING (day, visitor) WHERE t.rn = 1
     GROUP BY t.source, t.campaign ORDER BY contacts DESC, engaged DESC, visitors DESC LIMIT 5`,
  )
    .bind(w.from, w.to)
    .all<{ source: string; campaign: string; visitors: number; engaged: number; contacts: number }>();
  return results;
}

async function topCtas(env: Env, w: Week) {
  const { results } = await env.ANALYTICS_DB.prepare(
    `SELECT target AS cta, COUNT(*) AS clicks FROM events
     WHERE event IN ('cta_click', 'contact_click', 'demo_open', 'outbound_click') AND day BETWEEN ?1 AND ?2
     GROUP BY target ORDER BY clicks DESC LIMIT 5`,
  )
    .bind(w.from, w.to)
    .all<{ cta: string; clicks: number }>();
  return results;
}

async function new404s(env: Env, w: Week) {
  const { results } = await env.ANALYTICS_DB.prepare(
    `SELECT path, COUNT(*) AS hits FROM events
     WHERE event = 'not_found' AND day BETWEEN ?1 AND ?2
       AND path NOT IN (SELECT DISTINCT path FROM events WHERE event = 'not_found' AND day < ?1 AND day >= ?3 AND path IS NOT NULL)
     GROUP BY path ORDER BY hits DESC LIMIT 10`,
  )
    .bind(w.from, w.to, istDay(-30, Date.parse(w.from)))
    .all<{ path: string; hits: number }>();
  return results;
}

const pct = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : 0);

function change(now: number, before: number, unit = ""): string {
  if (before === 0 && now === 0) return "no change";
  if (before === 0) return "new";
  const diff = now - before;
  if (unit === "pts") return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts`;
  const rel = (100 * diff) / before;
  return `${rel >= 0 ? "+" : ""}${rel.toFixed(0)}%`;
}

async function buildDigest(env: Env, now: number): Promise<{ subject: string; text: string; html: string }> {
  const thisWeek = { from: istDay(-7, now), to: istDay(-1, now) };
  const lastWeek = { from: istDay(-14, now), to: istDay(-8, now) };
  const [a, b, sources, ctas, notFound] = await Promise.all([
    headline(env, thisWeek),
    headline(env, lastWeek),
    topSources(env, thisWeek),
    topCtas(env, thisWeek),
    new404s(env, thisWeek),
  ]);

  const per100 = (h: Headline) => pct(h.contacts, h.visitors);
  const rows: [string, string, string][] = [
    ["Contact actions per 100 visitors", per100(a).toFixed(1), change(per100(a), per100(b), "pts")],
    ["Visitors", String(a.visitors), change(a.visitors, b.visitors)],
    ["Engaged visitors", `${a.engaged} (${pct(a.engaged, a.visitors).toFixed(0)}%)`, change(pct(a.engaged, a.visitors), pct(b.engaged, b.visitors), "pts")],
    ["Contact actions", String(a.contacts), change(a.contacts, b.contacts)],
    ["Homepage 10-second hold", `${pct(a.held, a.homeViews).toFixed(0)}% of ${a.homeViews} views`, change(pct(a.held, a.homeViews), pct(b.held, b.homeViews), "pts")],
    ["Demo success rate", a.demoCalls ? `${pct(a.demoOk, a.demoCalls).toFixed(0)}% of ${a.demoCalls} calls` : "no calls", change(pct(a.demoOk, a.demoCalls), pct(b.demoOk, b.demoCalls), "pts")],
  ];

  const subject = `adityabal.com week of ${thisWeek.from}: ${per100(a).toFixed(1)} contacts per 100 visitors (${change(per100(a), per100(b), "pts")})`;
  const lines = [
    `Week ${thisWeek.from} to ${thisWeek.to} (IST), compared with the week before.`,
    "",
    ...rows.map(([label, value, delta]) => `${label}: ${value} (${delta})`),
    "",
    "Top sources and campaigns (first touch):",
    ...(sources.length ? sources.map((s) => `  ${s.source} / ${s.campaign}: ${s.visitors} visitors, ${s.engaged} engaged, ${s.contacts} contacts`) : ["  none yet"]),
    "",
    "Top CTAs:",
    ...(ctas.length ? ctas.map((c) => `  ${c.cta}: ${c.clicks} clicks`) : ["  none yet"]),
    "",
    "New 404s:",
    ...(notFound.length ? notFound.map((n) => `  ${n.path}: ${n.hits}`) : ["  none"]),
    "",
    "More detail: run the queries in analytics/queries/ in the D1 console.",
  ];

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const table = (head: string[], body: (string | number)[][]) =>
    `<table cellpadding="6" style="border-collapse:collapse;font:14px system-ui,sans-serif">
<tr>${head.map((h) => `<th align="left" style="border-bottom:1px solid #ccc">${esc(h)}</th>`).join("")}</tr>
${body.map((r) => `<tr>${r.map((c) => `<td style="border-bottom:1px solid #eee">${esc(String(c))}</td>`).join("")}</tr>`).join("\n")}
</table>`;
  const html = `<div style="font:14px system-ui,sans-serif;color:#111">
<p>Week ${esc(thisWeek.from)} to ${esc(thisWeek.to)} (IST), compared with the week before.</p>
${table(["Metric", "This week", "Change"], rows)}
<h3>Top sources and campaigns</h3>
${sources.length ? table(["Source", "Campaign", "Visitors", "Engaged", "Contacts"], sources.map((s) => [s.source, s.campaign, s.visitors, s.engaged, s.contacts])) : "<p>None yet.</p>"}
<h3>Top CTAs</h3>
${ctas.length ? table(["CTA", "Clicks"], ctas.map((c) => [c.cta, c.clicks])) : "<p>None yet.</p>"}
<h3>New 404s</h3>
${notFound.length ? table(["Path", "Hits"], notFound.map((n) => [n.path, n.hits])) : "<p>None.</p>"}
<p style="color:#666">More detail: the queries in analytics/queries/ in the D1 console.</p>
</div>`;
  return { subject, text: lines.join("\n"), html };
}

function mime(from: string, to: string, subject: string, text: string, html: string): string {
  const boundary = `b${crypto.randomUUID().replace(/-/g, "")}`;
  const encodedSubject = `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`;
  return [
    `From: adityabal.com digest <${from}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@adityabal.com>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

async function sendDigest(env: Env, now: number): Promise<void> {
  const { subject, text, html } = await buildDigest(env, now);
  await env.DIGEST_EMAIL.send(new EmailMessage(env.DIGEST_FROM, env.DIGEST_TO, mime(env.DIGEST_FROM, env.DIGEST_TO, subject, text, html)));
}

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    if (controller.cron === "30 3 * * 1") await sendDigest(env, controller.scheduledTime);
    else await rollup(env, controller.scheduledTime);
  },
} satisfies ExportedHandler<Env>;
