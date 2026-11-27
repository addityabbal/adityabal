-- Q5 · The 10-second hold: homepage views with a click, or the stats section (#scale) seen, inside 10 s.
-- Run: npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q5-ten-second-hold.sql
WITH home AS (
  SELECT page_id FROM events
  WHERE event = 'page_view' AND path = '/' AND day >= date('now','+330 minutes','-30 days')
),
held AS (
  SELECT DISTINCT page_id FROM events
  WHERE page_id IN (SELECT page_id FROM home) AND value <= 10000
    AND (event IN ('cta_click', 'contact_click', 'demo_open', 'outbound_click')
         OR (event = 'section_view' AND target = 'scale'))
)
SELECT COUNT(*) AS home_views, (SELECT COUNT(*) FROM held) AS held_10s,
       ROUND(100.0 * (SELECT COUNT(*) FROM held) / MAX(COUNT(*), 1), 1) AS hold_rate_pct
FROM home;
