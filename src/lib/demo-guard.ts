// Shared protection for live demo API routes (/api/*).
// Layers, in order: origin check -> per-IP rate limit -> human check (Turnstile, then a
// short-lived signed session cookie) -> per-demo kill switch + daily cap in D1.
import { env } from "cloudflare:workers";

const SESSION_TTL_SECONDS = 30 * 60;
const encoder = new TextEncoder();

export function json(status: number, body: Record<string, unknown>, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "0.0.0.0";
}

/** Only accept browser requests coming from our own pages. */
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

export async function rateLimitOk(key: string): Promise<boolean> {
  const { success } = await env.DEMO_LIMITER.limit({ key });
  return success;
}

// ── Signed session cookie ────────────────────────────────────────────────────
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function hasValidSession(request: Request, cookieName: string): Promise<boolean> {
  const value = readCookie(request, cookieName);
  if (!value) return false;
  const [version, exp, sig] = value.split(".");
  if (version !== "v1" || !exp || !sig) return false;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return timingSafeEqual(sig, await hmac(`v1.${exp}.${cookieName}`));
}

export async function sessionCookie(cookieName: string, path: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const value = `v1.${exp}.${await hmac(`v1.${exp}.${cookieName}`)}`;
  return `${cookieName}=${value}; Max-Age=${SESSION_TTL_SECONDS}; Path=${path}; HttpOnly; Secure; SameSite=Strict`;
}

// ── Cloudflare Turnstile ─────────────────────────────────────────────────────
export async function verifyTurnstile(token: string, ip: string, expectedAction: string): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean; action?: string; hostname?: string };
  if (!data.success) return false;

  // Cloudflare's public test keys (used in local dev) report placeholder action/hostname values.
  const isTestKey = env.TURNSTILE_SECRET_KEY.startsWith("1x0000") || env.TURNSTILE_SECRET_KEY.startsWith("2x0000");
  if (isTestKey) return true;

  const allowedHosts = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => {
      try {
        return new URL(o.trim()).hostname;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return data.action === expectedAction && !!data.hostname && allowedHosts.includes(data.hostname);
}

// ── D1: kill switch, daily cap, anonymous log ────────────────────────────────
export type CapResult = "ok" | "disabled" | "cap_reached";

export async function consumeDailyQuota(demo: string): Promise<CapResult> {
  const settings = await env.DB.prepare("SELECT enabled, daily_cap FROM demo_settings WHERE demo = ?1")
    .bind(demo)
    .first<{ enabled: number; daily_cap: number }>();
  if (!settings || !settings.enabled || settings.daily_cap <= 0) return "disabled";

  const day = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare(
    `INSERT INTO demo_usage (demo, day, count) VALUES (?1, ?2, 1)
     ON CONFLICT (demo, day) DO UPDATE SET count = count + 1 WHERE count < ?3
     RETURNING count`,
  )
    .bind(demo, day, settings.daily_cap)
    .first<{ count: number }>();
  return row ? "ok" : "cap_reached";
}

export async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${env.SESSION_SECRET}:${ip}`));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function logRequest(demo: string, ip: string, status: string, detail = ""): Promise<void> {
  try {
    await env.DB.prepare("INSERT INTO demo_requests (ts, demo, ip_hash, detail, status) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(Date.now(), demo, await hashIp(ip), detail.slice(0, 64), status)
      .run();
  } catch (err) {
    console.error("demo log failed", err);
  }
}
