// POST /api/rag — server-side proxy for the PDF RAG chatbot live demo.
// Knowledge base is fixed and precomputed (scripts/rag-ingest.mjs ingests
// data/rag/vedas-geeta-study-guide.md into Vectorize + D1) — visitors ask
// questions, they never upload files, so there is no upload surface to secure.
// Embedding + generation both run on Workers AI; no third-party API key.
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

const DEMO = "pdf-rag";
const COOKIE = "rag_session";
const MAX_BODY_BYTES = 2048;
const MAX_QUESTION_CHARS = 400;
const TOP_K = 5;
const MIN_SCORE = 0.45;

const SYSTEM_PROMPT = `You are a document assistant answering questions about one fixed source: "The Vedas and the Geeta: A Synthesis and Study Guide." Follow these rules strictly:

1. Answer using ONLY the context excerpts provided below. If the answer is not contained in them, say so plainly — do not guess or use outside knowledge.
2. Every factual claim must cite its section, in the form (Section: <heading>).
3. Be concise. Synthesize, don't repeat the excerpts verbatim.
4. If excerpts conflict or the guide itself flags uncertainty, say so rather than picking a side silently.`;

type RagChunk = { id: number; heading: string; text: string; score: number };

function buildPrompt(question: string, chunks: RagChunk[]): string {
  const context = chunks
    .map((c) => `[Section: ${c.heading}, relevance=${c.score.toFixed(2)}]\n${c.text}`)
    .join("\n\n---\n\n");
  return `Context excerpts:\n\n${context}\n\n---\n\nQuestion: ${question}`;
}

/** Yields text chunks from a Workers AI SSE stream (OpenAI-style `choices` or legacy `response` shape). */
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
  let body: { question?: unknown; token?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_json" });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_QUESTION_CHARS) return json(400, { error: "bad_question" });

  // 3. Per-IP rate limit (also covers captcha attempts).
  if (!(await rateLimitOk(`${DEMO}:${ip}`))) {
    await logRequest(DEMO, ip, "rate_limited");
    demoResult("rate_limited");
    return json(429, { error: "rate_limited" }, { "retry-after": "60" });
  }

  // 4. Human check: valid session cookie, or a fresh Turnstile token.
  let setCookie: string | null = null;
  if (!(await hasValidSession(request, COOKIE))) {
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) return json(403, { error: "captcha_required" });
    if (!(await verifyTurnstile(token, ip, DEMO))) {
      await logRequest(DEMO, ip, "captcha_failed");
      demoResult("turnstile_failed");
      return json(403, { error: "captcha_required" });
    }
    setCookie = await sessionCookie(COOKIE, "/api/rag");
  }

  // 5. Kill switch + daily cap (protects the shared Workers AI free allowance).
  const quota = await consumeDailyQuota(DEMO);
  if (quota !== "ok") {
    await logRequest(DEMO, ip, quota);
    demoResult(quota);
    return json(503, { error: quota }, setCookie ? { "set-cookie": setCookie } : {});
  }

  // 6. Embed the question, retrieve top-k chunks from Vectorize, read their text from D1.
  let chunks: RagChunk[] = [];
  let topScore = 0;
  try {
    const embedding = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [question] });
    const vector = (embedding as { data: number[][] }).data[0];
    const matches = await env.RAG_INDEX.query(vector, { topK: TOP_K });
    topScore = matches.matches[0]?.score ?? 0;
    const ids = matches.matches.map((m) => Number(m.id)).filter((id) => Number.isInteger(id));
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const rows = await env.DB.prepare(`SELECT id, heading, text FROM rag_chunks WHERE id IN (${placeholders})`)
        .bind(...ids)
        .all<{ id: number; heading: string; text: string }>();
      const byId = new Map(rows.results.map((r) => [r.id, r]));
      chunks = matches.matches
        .map((m) => {
          const row = byId.get(Number(m.id));
          return row ? { ...row, score: m.score } : null;
        })
        .filter((c): c is RagChunk => c !== null);
    }
  } catch (err) {
    console.error("rag demo: retrieval error", err);
    await logRequest(DEMO, ip, "retrieval_error");
    demoResult("retrieval_error");
    return json(502, { error: "retrieval_unavailable" }, setCookie ? { "set-cookie": setCookie } : {});
  }
  await logRequest(DEMO, ip, "ok");

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      send({ type: "sources", chunks: chunks.map((c) => ({ heading: c.heading, score: c.score })), confident: topScore >= MIN_SCORE });

      if (!chunks.length) {
        send({ type: "text", text: "I couldn't find anything relevant to that question in the study guide." });
        demoResult("no_match");
        controller.close();
        return;
      }
      try {
        const model = (env.RAG_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast") as keyof AiModels;
        const sse = (await env.AI.run(model, {
          stream: true,
          max_tokens: 700,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(question, chunks) },
          ],
        } as never)) as unknown as ReadableStream<Uint8Array>;
        for await (const text of readSseText(sse)) send({ type: "text", text });
        demoResult("ok");
      } catch (err) {
        console.error("rag demo: Workers AI generation error", err);
        demoResult("error");
        send({ type: "text", text: "\n[[unavailable]]" });
      }
      controller.close();
    },
  });

  const headers = new Headers({
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  if (setCookie) headers.set("set-cookie", setCookie);
  return new Response(out, { status: 200, headers });
};
