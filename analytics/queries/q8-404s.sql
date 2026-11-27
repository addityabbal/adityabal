-- Q8 · 404s with their referrers, last 30 days: fix or redirect the top ones.
-- Run: npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q8-404s.sql
SELECT path, ref_host, COUNT(*) AS hits
FROM events WHERE event = 'not_found' AND day >= date('now','+330 minutes','-30 days')
GROUP BY path, ref_host ORDER BY hits DESC;
