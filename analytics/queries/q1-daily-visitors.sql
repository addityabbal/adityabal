-- Q1 · Daily visitors and page views, last 30 IST days.
-- Run: npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q1-daily-visitors.sql
SELECT day, COUNT(DISTINCT visitor) AS visitors, SUM(event = 'page_view') AS page_views
FROM events
WHERE day >= date('now','+330 minutes','-30 days')
GROUP BY day ORDER BY day;
