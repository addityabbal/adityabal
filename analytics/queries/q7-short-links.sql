-- Q7 · Short links (/p/*) by campaign, last 90 days. Counted server-side, so ad blockers can't hide them.
-- Run: npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q7-short-links.sql
SELECT target AS short, utm_source, utm_medium, utm_campaign, COUNT(*) AS hits,
       COUNT(DISTINCT day || visitor) AS visitors
FROM events WHERE event = 'shortlink_hit' AND day >= date('now','+330 minutes','-90 days')
GROUP BY 1, 2, 3, 4 ORDER BY hits DESC;
