// One-off ingestion script for the PDF RAG live demo.
// Chunks data/rag/vedas-geeta-study-guide.md, embeds each chunk with Workers AI
// (@cf/baai/bge-base-en-v1.5), and upserts into the adityabal-rag Vectorize index.
// Chunk text/source/heading is stored in D1 (rag_chunks) since Vectorize itself
// only holds vectors + small metadata, not full chunk text.
//
// Run with: node scripts/rag-ingest.mjs
// Needs: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or `cf auth login` profile)
// envs are not used here; this shells out to `cf` and `wrangler d1` instead, so it
// only needs `cf auth login` to already be done.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SRC_FILE = path.resolve("data/rag/vedas-geeta-study-guide.md");
const VECTORIZE_INDEX = "adityabal-rag";
const D1_DATABASE_ID = "2ac8d598-bc8b-446e-98dc-7b1b2c4a2f52"; // adityabal-demos
const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 150;
const EMBED_BATCH = 90; // bge-base-en-v1.5 accepts up to 100 texts per call
const D1_INSERT_BATCH = 8; // keep each `cf d1 query` command line short

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 });
}

// Call the `cf` CLI's real JS entry point with `node` directly (args as an array, no
// shell) instead of the cf.cmd/cf.ps1 shim, so quoting of SQL text etc. stays exact
// on Windows. Resolve it next to the cf.cmd shim on PATH rather than hardcoding npm's
// global prefix, which varies per machine.
function resolveCfBin() {
  const shimDir = path.dirname(sh("where", ["cf.cmd"]).trim().split(/\r?\n/)[0]);
  return path.join(shimDir, "node_modules", "cf", "bin", "cf");
}
const CF_BIN = resolveCfBin();
function cf(args) {
  return sh(process.execPath, [CF_BIN, ...args]);
}

// ---- 1. Split the markdown into (heading, text) sections, then chunk each ----
function splitSections(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let heading = "Introduction";
  let buf = [];
  for (const line of lines) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) {
      if (buf.length) sections.push({ heading, text: buf.join("\n").trim() });
      heading = m[2].trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) sections.push({ heading, text: buf.join("\n").trim() });
  return sections.filter((s) => s.text.length > 0);
}

function splitText(text, size, overlap) {
  if (text.length <= size) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      const snap = text.indexOf(" ", end);
      if (snap !== -1 && snap - end < 100) end = snap;
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

const markdown = readFileSync(SRC_FILE, "utf8");
const sections = splitSections(markdown);
const chunks = [];
for (const section of sections) {
  const pieces = splitText(section.text, CHUNK_SIZE, CHUNK_OVERLAP);
  pieces.forEach((text, i) => {
    chunks.push({
      id: `${chunks.length}`,
      heading: section.heading.slice(0, 120),
      text,
    });
  });
}
console.log(`Split into ${chunks.length} chunks from ${sections.length} sections.`);

// ---- 2. Embed in batches via `cf ai run` ----
const tmp = mkdtempSync(path.join(tmpdir(), "rag-ingest-"));
const vectors = [];
for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
  const batch = chunks.slice(i, i + EMBED_BATCH);
  const bodyPath = path.join(tmp, `embed-${i}.json`);
  writeFileSync(bodyPath, JSON.stringify({ text: batch.map((c) => c.text) }));
  const out = cf(["ai", "run", EMBED_MODEL, "--body", `@${bodyPath}`]);
  const parsed = JSON.parse(out);
  const data = parsed.data;
  if (!Array.isArray(data) || data.length !== batch.length) {
    throw new Error(`Embedding batch ${i}: expected ${batch.length} vectors, got ${data?.length}`);
  }
  batch.forEach((c, j) => vectors.push({ id: c.id, values: data[j] }));
  console.log(`Embedded ${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length}`);
}

// ---- 3. Upsert vectors into Vectorize (NDJSON file, one vector per line) ----
const ndjsonPath = path.join(tmp, "vectors.ndjson");
writeFileSync(ndjsonPath, vectors.map((v) => JSON.stringify(v)).join("\n") + "\n");
cf(["vectorize", "upsert", VECTORIZE_INDEX, "--file", ndjsonPath]);
console.log(`Upserted ${vectors.length} vectors into ${VECTORIZE_INDEX}.`);

// ---- 4. Store chunk text/heading in D1, keyed by the same ids (small batches so
//         each `cf d1 query` call line stays well under the OS command-line limit) ----
cf(["d1", "query", D1_DATABASE_ID, "--sql", "DELETE FROM rag_chunks;"]);
for (let i = 0; i < chunks.length; i += D1_INSERT_BATCH) {
  const batch = chunks.slice(i, i + D1_INSERT_BATCH);
  const sql = batch
    .map((c) => `INSERT INTO rag_chunks (id, heading, text) VALUES (${c.id}, ${sqlQuote(c.heading)}, ${sqlQuote(c.text)});`)
    .join(" ");
  cf(["d1", "query", D1_DATABASE_ID, "--sql", sql]);
  console.log(`Stored ${Math.min(i + D1_INSERT_BATCH, chunks.length)}/${chunks.length} chunk rows`);
}
console.log(`Stored ${chunks.length} chunk rows in D1 (rag_chunks).`);

function sqlQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

console.log("Done.");
