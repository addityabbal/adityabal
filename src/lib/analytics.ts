// First-party, cookieless analytics. Shared by the /api/e endpoint (browser events) and by
// server routes that log their own events (short links, demo APIs).
//
// Privacy rules (see /privacy and analytics/README.md):
//   - no cookies, no IP addresses stored: the visitor id is a hash with a salt that rotates at
//     IST midnight and is deleted the next night, so a visitor cannot be linked across days;
//   - no content: no prompts, answers, emails, phone numbers or query strings (only utm_* keys);
//   - bots and automation are dropped before anything is written.
//
// Every write goes through logEvents(), which never throws: analytics can never break a page,
// a short link or a demo.
import { env, waitUntil } from "cloudflare:workers";

export const EVENT_NAMES = [
  "page_view",
  "cta_click",
  "section_view",
  "section_time",
  "scroll_depth",
  "page_engaged",
  "outbound_click",
  "contact_click",
  "demo_open",
  "demo_query",
  "demo_result",
  "copy_link",
  "filter_use",
  "theme_toggle",
  "shortlink_hit",
  "not_found",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Events the browser may send. demo_result and shortlink_hit are logged by the server only. */
export const CLIENT_EVENTS = new Set<string>(EVENT_NAMES.filter((name) => name !== "demo_result" && name !== "shortlink_hit"));

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
type UtmKey = (typeof UTM_KEYS)[number];

const MAX_STRING = 200;
const SCHEMA_VERSION = 1;
const PRODUCTION_HOSTS = new Set(["adityabal.com", "www.adityabal.com"]);
const encoder = new TextEncoder();

/** Fields shared by every event in one request (one page view, one short-link hit, one demo call). */
export interface EventContext {
  pageId?: string | null;
  path?: string | null;
  project?: string | null;
  refHost?: string | null;
  utm?: Partial<Record<UtmKey, string | null>>;
  theme?: string | null;
}

export interface EventInput {
  event: EventName;
  target?: string | null;
  zone?: string | null;
  detail?: string | null;
  value?: number | null;
}

// ── Small helpers ────────────────────────────────────────────────────────────

/** Trim to a short plain string, or null. */
export function clean(value: unknown, max = MAX_STRING): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function cleanNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
}

/** Today's date in IST (UTC+05:30), YYYY-MM-DD. */
export function istDay(ms = Date.now()): string {
  return new Date(ms + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** Host of a referrer URL, or null. Our own hosts count as no referrer. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    return host === "adityabal.com" ? null : clean(host);
  } catch {
    return null;
  }
}

/** Only the utm_* keys of a query string, lowercased. */
export function utmFrom(search: URLSearchParams): Partial<Record<UtmKey, string | null>> {
  const utm: Partial<Record<UtmKey, string | null>> = {};
  for (const key of UTM_KEYS) utm[key] = clean(search.get(key)?.toLowerCase(), 100);
  return utm;
}

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|scrape|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|pingdom|uptime|monitor|curl\/|wget|python|httpclient|okhttp|java\/|go-http|node-fetch|axios|preview|facebookexternalhit|embedly|whatsapp\/|telegrambot|discordbot|slackbot|linkedinbot|^$/i;

export function isBot(userAgent: string): boolean {
  return BOT_UA.test(userAgent);
}

/** Coarse device, browser and OS from the user agent. No library, no fingerprinting. */
export function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? "tablet" : /mobi|iphone|ipod|android/i.test(ua) ? "mobile" : "desktop";
  const browser = /edg\//i.test(ua)
    ? "edge"
    : /opr\/|opera/i.test(ua)
      ? "opera"
      : /samsungbrowser/i.test(ua)
        ? "samsung"
        : /linkedinapp/i.test(ua)
          ? "linkedin-app"
          : /fbav|fban|instagram/i.test(ua)
            ? "meta-app"
            : /firefox|fxios/i.test(ua)
              ? "firefox"
              : /chrome|crios/i.test(ua)
                ? "chrome"
                : /safari/i.test(ua)
                  ? "safari"
                  : "other";
  const os = /windows/i.test(ua)
    ? "windows"
    : /iphone|ipad|ipod/i.test(ua)
      ? "ios"
      : /android/i.test(ua)
        ? "android"
        : /mac os x|macintosh/i.test(ua)
          ? "macos"
          : /cros/i.test(ua)
            ? "chromeos"
            : /linux/i.test(ua)
              ? "linux"
              : "other";
  return { device, browser, os };
}

/** True when this request may write to the production database (not a preview deploy, not dev). */
export function isProductionRequest(request: Request): boolean {
  if (import.meta.env.DEV) return false;
  try {
    return PRODUCTION_HOSTS.has(new URL(request.url).hostname);
  } catch {
    return false;
  }
}

// ── Settings, salt, visitor hash ─────────────────────────────────────────────

let settingsCache: { at: number; enabled: boolean; dailyCap: number } | null = null;

async function readSettings(): Promise<{ enabled: boolean; dailyCap: number }> {
  if (settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache;
  const { results } = await env.ANALYTICS_DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const map = new Map(results.map((row) => [row.key, row.value]));
  settingsCache = {
    at: Date.now(),
    enabled: map.get("enabled") === "1",
    dailyCap: Number(map.get("daily_cap") ?? "50000") || 0,
  };
  return settingsCache;
}

let saltCache: { day: string; salt: string } | null = null;

async function saltFor(day: string): Promise<string> {
  if (saltCache?.day === day) return saltCache.salt;
  const fresh = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const row = await env.ANALYTICS_DB.prepare(
    `INSERT INTO daily_salt (day, salt) VALUES (?1, ?2)
     ON CONFLICT (day) DO UPDATE SET salt = salt
     RETURNING salt`,
  )
    .bind(day, fresh)
    .first<{ salt: string }>();
  const salt = row?.salt ?? fresh;
  saltCache = { day, salt };
  return salt;
}

/** First 16 hex chars of SHA-256(salt + IP + user agent + registrable domain). The IP is never stored. */
async function visitorHash(day: string, ip: string, userAgent: string): Promise<string> {
  const salt = await saltFor(day);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${salt}|${ip}|${userAgent}|adityabal.com`));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Reserve room for `count` rows under today's cap. False once the cap is reached. */
async function reserveRows(day: string, count: number, cap: number): Promise<boolean> {
  if (cap <= 0) return false;
  const row = await env.ANALYTICS_DB.prepare(
    `INSERT INTO daily_usage (day, rows) VALUES (?1, ?2)
     ON CONFLICT (day) DO UPDATE SET rows = rows + ?2 WHERE rows + ?2 <= ?3
     RETURNING rows`,
  )
    .bind(day, count, cap)
    .first<{ rows: number }>();
  return !!row && row.rows <= cap;
}

// ── Writing ──────────────────────────────────────────────────────────────────

const INSERT_SQL = `INSERT INTO events (
  ts, day, event, visitor, page_id, path, project, target, zone, detail, value, ref_host,
  utm_source, utm_medium, utm_campaign, utm_content, country, region, city, device, browser, os, org, theme, v
) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)`;

async function writeEvents(request: Request, context: EventContext, events: EventInput[]): Promise<void> {
  const settings = await readSettings();
  if (!settings.enabled) return;

  const now = Date.now();
  const day = istDay(now);
  if (!(await reserveRows(day, events.length, settings.dailyCap))) return;

  const ua = request.headers.get("user-agent") ?? "";
  const ip = request.headers.get("cf-connecting-ip") ?? "0.0.0.0";
  const visitor = await visitorHash(day, ip, ua);
  const { device, browser, os } = parseUserAgent(ua);
  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
  const utm = context.utm ?? {};

  const statement = env.ANALYTICS_DB.prepare(INSERT_SQL);
  await env.ANALYTICS_DB.batch(
    events.map((item) =>
      statement.bind(
        now,
        day,
        item.event,
        visitor,
        clean(context.pageId, 32),
        clean(context.path),
        clean(context.project, 80),
        clean(item.target),
        clean(item.zone, 80),
        clean(item.detail),
        cleanNumber(item.value),
        clean(context.refHost),
        utm.utm_source ?? null,
        utm.utm_medium ?? null,
        utm.utm_campaign ?? null,
        utm.utm_content ?? null,
        clean(cf?.country as string | undefined, 8),
        clean(cf?.region as string | undefined, 80),
        clean(cf?.city as string | undefined, 80),
        device,
        browser,
        os,
        clean(cf?.asOrganization as string | undefined, 120),
        clean(context.theme, 10),
        SCHEMA_VERSION,
      ),
    ),
  );
}

/**
 * Log events without delaying the response. Never throws.
 * In `npm run dev` and on preview deploys the events are printed instead of written.
 */
export function logEvents(request: Request, context: EventContext, events: EventInput[]): void {
  if (events.length === 0) return;
  try {
    if (isBot(request.headers.get("user-agent") ?? "")) return;
    if (!isProductionRequest(request)) {
      if (import.meta.env.DEV) console.log("[analytics]", JSON.stringify({ context, events }));
      return;
    }
    waitUntil(
      writeEvents(request, context, events).catch((err) => {
        console.error("analytics write failed", err);
      }),
    );
  } catch (err) {
    console.error("analytics log failed", err);
  }
}

/** One server-side event, with the request's own path, referrer and utm_* keys. */
export function logServerEvent(request: Request, event: EventInput, context: EventContext = {}): void {
  try {
    const url = new URL(request.url);
    logEvents(
      request,
      {
        path: url.pathname,
        refHost: referrerHost(request.headers.get("referer")),
        utm: utmFrom(url.searchParams),
        ...context,
      },
      [event],
    );
  } catch (err) {
    console.error("analytics log failed", err);
  }
}
