-- First-party analytics (D1 database adityabal-analytics, binding ANALYTICS_DB).
-- Cookieless and anonymous: no IP addresses, no prompts, no query strings except utm_* keys.
-- Apply with:
--   npx wrangler d1 migrations apply adityabal-analytics --local    (dev)
--   npx wrangler d1 migrations apply adityabal-analytics --remote   (production)

-- One flat table for every event. Days are cut at IST midnight.
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,   -- server time, ms
  day          TEXT    NOT NULL,   -- YYYY-MM-DD, IST
  event        TEXT    NOT NULL,
  visitor      TEXT    NOT NULL,   -- daily-rotating hash, 16 hex chars
  page_id      TEXT,               -- random per page load, ties one view's events
  path         TEXT,
  project      TEXT,
  target       TEXT,               -- cta_id, section_id, demo or short slug
  zone         TEXT,
  detail       TEXT,               -- page type, channel, host, status, input type, filter or theme value
  value        REAL,               -- ms since load (clicks, section_view), seconds, %, latency ms
  ref_host     TEXT,
  utm_source   TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT,
  country      TEXT, region TEXT, city TEXT,
  device       TEXT, browser TEXT, os TEXT,
  org          TEXT,               -- network organisation (Cloudflare asOrganization)
  theme        TEXT,
  v            INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_events_day_event ON events (day, event);
CREATE INDEX IF NOT EXISTS idx_events_day_visitor ON events (day, visitor);

-- Random salt per IST day for the visitor hash. The cron Worker deletes yesterday's salt,
-- so nobody can link a visitor across days.
CREATE TABLE IF NOT EXISTS daily_salt (day TEXT PRIMARY KEY, salt TEXT NOT NULL);

-- Kill switch and daily row cap. Change without redeploying, e.g.:
--   npx wrangler d1 execute adityabal-analytics --remote --command "UPDATE settings SET value = '0' WHERE key = 'enabled'"
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO settings (key, value) VALUES ('enabled', '1'), ('daily_cap', '50000');

-- Rows written per IST day (enforces daily_cap).
CREATE TABLE IF NOT EXISTS daily_usage (day TEXT PRIMARY KEY, rows INTEGER NOT NULL DEFAULT 0);

-- Nightly rollup written by workers/analytics-cron. Kept for good; raw events are pruned at 400 days.
CREATE TABLE IF NOT EXISTS rollup_daily (
  day TEXT NOT NULL, event TEXT NOT NULL, path TEXT NOT NULL DEFAULT '', target TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '', utm_campaign TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '',
  events INTEGER NOT NULL, visitors INTEGER NOT NULL,
  PRIMARY KEY (day, event, path, target, utm_source, utm_campaign, country, device)
);
