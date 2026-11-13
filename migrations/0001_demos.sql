-- Live demo bookkeeping. Apply with:
--   npx wrangler d1 migrations apply adityabal-demos --local    (dev)
--   npx wrangler d1 migrations apply adityabal-demos --remote   (production)

-- Per-demo kill switch and daily request cap. Change without redeploying, e.g.:
--   npx wrangler d1 execute adityabal-demos --remote --command "UPDATE demo_settings SET enabled = 0 WHERE demo = 'yoga-doc'"
CREATE TABLE IF NOT EXISTS demo_settings (
  demo       TEXT PRIMARY KEY,
  enabled    INTEGER NOT NULL DEFAULT 1,
  daily_cap  INTEGER NOT NULL DEFAULT 300
);
INSERT OR IGNORE INTO demo_settings (demo, enabled, daily_cap) VALUES ('yoga-doc', 1, 300);

-- Requests served per demo per UTC day (enforces daily_cap).
CREATE TABLE IF NOT EXISTS demo_usage (
  demo   TEXT NOT NULL,
  day    TEXT NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (demo, day)
);

-- Anonymous request log: no prompts, no raw IPs (salted hash only).
CREATE TABLE IF NOT EXISTS demo_requests (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  demo     TEXT NOT NULL,
  ip_hash  TEXT NOT NULL,
  detail   TEXT,
  status   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_demo_requests_ts ON demo_requests (ts);
