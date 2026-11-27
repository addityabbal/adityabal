-- Q4 · Homepage section reach: share of homepage views that saw each section, last 30 days.
-- Run: npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q4-home-section-reach.sql
WITH home AS (
  SELECT DISTINCT page_id FROM events
  WHERE event = 'page_view' AND path = '/' AND day >= date('now','+330 minutes','-30 days')
)
SELECT e.target AS section, COUNT(DISTINCT e.page_id) AS views,
       ROUND(100.0 * COUNT(DISTINCT e.page_id) / (SELECT COUNT(*) FROM home), 1) AS pct_of_home_views,
       (SELECT ROUND(AVG(t.value), 1) FROM events t
         WHERE t.event = 'section_time' AND t.target = e.target AND t.page_id IN (SELECT page_id FROM home)) AS avg_seconds
FROM events e JOIN home h USING (page_id)
WHERE e.event = 'section_view'
GROUP BY e.target ORDER BY pct_of_home_views DESC;
