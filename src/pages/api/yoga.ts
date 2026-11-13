// POST /api/yoga — server-side proxy for the Yoga-Doc live demo.
// The browser sends only a body-zone id from a fixed list; the prompt is built here,
// so visitors can't inject instructions and the Anthropic key never leaves the server.
import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "cloudflare:workers";
import {
  clientIp,
  consumeDailyQuota,
  hasValidSession,
  json,
  logRequest,
  originAllowed,
  rateLimitOk,
  sessionCookie,
  verifyTurnstile,
} from "../../lib/demo-guard";

export const prerender = false;

const DEMO = "yoga-doc";
const COOKIE = "yd_session";
const MAX_BODY_BYTES = 4096;

const ZONES: Record<string, string> = {
  head: "head / jaw",
  neck: "neck",
  shoulder: "shoulders",
  chest: "chest",
  "upper-back": "upper back",
  core: "core / abdomen",
  "lower-back": "lower back",
  hip: "hips",
  thigh: "thighs",
  knee: "knees",
  calf: "calves",
  foot: "feet / ankles",
  arm: "arms / elbows",
  wrist: "wrists / hands",
};

const SYSTEM_PROMPT =
  "You are a gentle, safety-minded yoga therapist. Suggest only beginner-friendly poses, " +
  "remind the user to stop if they feel sharp pain, and reply only in the exact format requested.";

function buildPrompt(zoneLabel: string): string {
  return `The user has pain in their ${zoneLabel}. Suggest exactly 3 yoga poses to help relieve this pain.

For each pose use exactly this format:

POSE: [pose name]
HOW: [2-3 clear sentences of instruction]
BREATH: [one breathing note]

Separate each pose with a blank line. No extra text.`;
}

export const POST: APIRoute = async ({ request }) => {
  const ip = clientIp(request);

  // 1. Our own pages only.
  if (!originAllowed(request)) return json(403, { error: "forbidden" });

  // 2. Small JSON bodies only.
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return json(415, { error: "unsupported_media_type" });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too_large" });
  let body: { zone?: unknown; token?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_json" });
  }
  const zone = typeof body.zone === "string" ? body.zone : "";
  if (!Object.hasOwn(ZONES, zone)) return json(400, { error: "bad_zone" });

  // 3. Per-IP rate limit (also covers captcha attempts).
  if (!(await rateLimitOk(`${DEMO}:${ip}`))) {
    await logRequest(DEMO, ip, "rate_limited", zone);
    return json(429, { error: "rate_limited" }, { "retry-after": "60" });
  }

  // 4. Human check: valid session cookie, or a fresh Turnstile token.
  let setCookie: string | null = null;
  if (!(await hasValidSession(request, COOKIE))) {
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) return json(403, { error: "captcha_required" });
    if (!(await verifyTurnstile(token, ip, DEMO))) {
      await logRequest(DEMO, ip, "captcha_failed", zone);
      return json(403, { error: "captcha_required" });
    }
    setCookie = await sessionCookie(COOKIE, "/api/yoga");
  }

  // 5. Kill switch + global daily cap (protects the API bill).
  const quota = await consumeDailyQuota(DEMO);
  if (quota !== "ok") {
    await logRequest(DEMO, ip, quota, zone);
    return json(503, { error: quota }, setCookie ? { "set-cookie": setCookie } : {});
  }
  await logRequest(DEMO, ip, "ok", zone);

  // 6. Call Claude and stream plain text back.
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 30_000 });
  const stream = client.messages.stream({
    model: env.YOGA_MODEL || "claude-haiku-5-5",
    max_tokens: 2000,
    output_config: { effort: "low" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildPrompt(ZONES[zone]) }],
  });

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n[[unavailable]]"));
      } catch (err) {
        if (err instanceof Anthropic.APIError) console.error("yoga demo: Anthropic error", err.status);
        else console.error("yoga demo: stream error", err);
        controller.enqueue(encoder.encode("\n[[unavailable]]"));
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });

  const headers = new Headers({
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  if (setCookie) headers.set("set-cookie", setCookie);
  return new Response(out, { status: 200, headers });
};
