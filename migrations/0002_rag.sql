-- PDF RAG demo: chunk storage, plus rebalancing the shared Workers AI free
-- daily allowance (10,000 neurons/account/day) now that two demos use it.
-- Apply with: cf d1 migrations apply <adityabal-demos database id>

-- Precomputed chunks of data/rag/vedas-geeta-study-guide.md. Populated by
-- scripts/rag-ingest.mjs, which also upserts the matching vectors (same
-- integer id) into the adityabal-rag Vectorize index.
CREATE TABLE IF NOT EXISTS rag_chunks (
  id      INTEGER PRIMARY KEY,
  heading TEXT NOT NULL,
  text    TEXT NOT NULL
);

INSERT OR IGNORE INTO demo_settings (demo, enabled, daily_cap) VALUES ('pdf-rag', 1, 70);
-- yoga-doc's embedding call is free-standing text generation only; pdf-rag adds an
-- embedding call per request too, so both are capped lower to share the allowance.
UPDATE demo_settings SET daily_cap = 70 WHERE demo = 'yoga-doc';
