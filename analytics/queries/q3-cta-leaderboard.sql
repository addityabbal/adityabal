-- Q3 · CTA leaderboard, last 30 days. target is the cta_id (data-cta, or zone.link_text).
-- Run: npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q3-cta-leaderboard.sql
SELECT target AS cta_id, zone, COUNT(*) AS clicks, COUNT(DISTINCT day || visitor) AS visitors
FROM events
WHERE event IN ('cta_click', 'contact_click', 'demo_open', 'outbound_click')
  AND day >= date('now','+330 minutes','-30 days')
GROUP BY target, zone ORDER BY clicks DESC LIMIT 30;
