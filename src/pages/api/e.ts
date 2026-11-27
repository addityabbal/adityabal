// POST /api/e: first-party analytics beacon. The tracker (public/a.js) sends small batches with
// navigator.sendBeacon; this route checks them and writes them to D1 after the response is sent.
// The path is short on purpose: ad-block lists target paths like /analytics, /track or /collect.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { CLIENT_EVENTS, clean, cleanNumber, isBot, logEvents, type EventInput, type EventName } from "../../lib/analytics";

export const prerender = false;

const MAX_BODY_BYTES = 8 * 1024;
const MAX_EVENTS = 50;

function allowedOrigins(): string[] {
  return (env.ANALYTICS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/** The page's origin: the Origin header, or the Referer's origin when a browser leaves Origin out. */
function requestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") return origin;
  try {
    return new URL(request.headers.get("referer") ?? "").origin;
  } catch {
    return null;
  }
}

function originOk(origin: string | null): boolean {
  if (!origin) return false;
  if (import.meta.env.DEV && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return allowedOrigins().includes(origin);
}

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin || !originOk(origin)) return { "cache-control": "no-store" };
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
    "cache-control": "no-store",
  };
}

const empty = (status: number, headers: HeadersInit = {}) => new Response(null, { status, headers });

export const OPTIONS: APIRoute = ({ request }) => empty(204, corsHeaders(requestOrigin(request)));

interface Payload {
  pid?: unknown;
  path?: unknown;
  project?: unknown;
  ref?: unknown;
  utm?: Record<string, unknown>;
  theme?: unknown;
  events?: unknown;
}

export const POST: APIRoute = async ({ request }) => {
  const origin = requestOrigin(request);
  const headers = corsHeaders(origin);
  if (!originOk(origin)) return empty(403, headers);

  const ua = request.headers.get("user-agent") ?? "";
  if (isBot(ua)) return empty(204, headers);

  const ip = request.headers.get("cf-connecting-ip") ?? "0.0.0.0";
  try {
    const { success } = await env.ANALYTICS_LIMITER.limit({ key: ip });
    if (!success) return empty(429, headers);
  } catch {
    /* limiter unavailable (local dev): carry on */
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return empty(413, headers);
  let body: Payload;
  try {
    body = JSON.parse(raw);
  } catch {
    return empty(400, headers);
  }
  if (!body || !Array.isArray(body.events)) return empty(400, headers);

  const events: EventInput[] = [];
  for (const item of body.events.slice(0, MAX_EVENTS)) {
    if (!item || typeof item !== "object") continue;
    const { e, t, z, d, n } = item as Record<string, unknown>;
    if (typeof e !== "string" || !CLIENT_EVENTS.has(e)) continue;
    events.push({ event: e as EventName, target: clean(t), zone: clean(z, 80), detail: clean(d), value: cleanNumber(n) });
  }

  const utm = body.utm && typeof body.utm === "object" ? body.utm : {};
  const lower = (value: unknown) => clean(typeof value === "string" ? value.toLowerCase() : null, 100);
  logEvents(
    request,
    {
      pageId: clean(body.pid, 32),
      // Path only: never a query string or fragment.
      path: clean(typeof body.path === "string" ? body.path.split(/[?#]/)[0] : null),
      project: clean(body.project, 80),
      refHost: lower(body.ref),
      utm: {
        utm_source: lower(utm.source),
        utm_medium: lower(utm.medium),
        utm_campaign: lower(utm.campaign),
        utm_content: lower(utm.content),
      },
      theme: clean(body.theme, 10),
    },
    events,
  );
  return empty(204, headers);
};
