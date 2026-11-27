// POST /api/yoga — server-side proxy for the Yoga-Doc live demo.
// The browser sends only a body-zone id from a fixed list; the prompt is built here,
// so visitors can't inject instructions. Inference runs on Cloudflare Workers AI
// (free daily allowance) through the AI binding — no third-party API key involved.
import type { APIRoute } from "astro";
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
import { logServerEvent } from "../../lib/analytics";

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

/** Yields text chunks from a Workers AI SSE stream (legacy `response` or OpenAI-style `choices` shape). */
async function* readSseText(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const evt = JSON.parse(data);
        const text = evt.choices?.[0]?.delta?.content || evt.response;
        if (typeof text === "string" && text) yield text;
      } catch {
        /* skip malformed event */
      }
    }
  }
}

export const POST: APIRoute = async ({ request }) => {
  const ip = clientIp(request);
  // Analytics: one demo_result per call, with status and latency. Never the question or answer.
  const started = Date.now();
  const demoResult = (status: string) =>
    logServerEvent(request, { event: "demo_result", target: DEMO, detail: status, value: Date.now() - started });

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
    demoResult("rate_limited");
    return json(429, { error: "rate_limited" }, { "retry-after": "60" });
  }

  // 4. Human check: valid session cookie, or a fresh Turnstile token.
  let setCookie: string | null = null;
  if (!(await hasValidSession(request, COOKIE))) {
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) return json(403, { error: "captcha_required" });
    if (!(await verifyTurnstile(token, ip, DEMO))) {
      await logRequest(DEMO, ip, "captcha_failed", zone);
      demoResult("turnstile_failed");
      return json(403, { error: "captcha_required" });
    }
    setCookie = await sessionCookie(COOKIE, "/api/yoga");
  }

  // 5. Kill switch + global daily cap (protects the API bill).
  const quota = await consumeDailyQuota(DEMO);
  if (quota !== "ok") {
    await logRequest(DEMO, ip, quota, zone);
    demoResult(quota);
    return json(503, { error: quota }, setCookie ? { "set-cookie": setCookie } : {});
  }
  await logRequest(DEMO, ip, "ok", zone);

  // 6. Run the model on Workers AI and stream plain text back.
  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const model = (env.YOGA_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast") as keyof AiModels;
        const sse = (await env.AI.run(model, {
          stream: true,
          max_tokens: 700,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(ZONES[zone]) },
          ],
        } as never)) as unknown as ReadableStream<Uint8Array>;
        for await (const text of readSseText(sse)) controller.enqueue(encoder.encode(text));
        demoResult("ok");
      } catch (err) {
        // Includes running out of the free daily Workers AI allowance.
        console.error("yoga demo: Workers AI error", err);
        demoResult("error");
        controller.enqueue(encoder.encode("\n[[unavailable]]"));
      }
      controller.close();
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
