-- Q9 · Demo health, last 7 days: calls, status and average latency per demo.
-- Run: npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q9-demo-health.sql
SELECT target AS demo, detail AS status, COUNT(*) AS calls, ROUND(AVG(value)) AS avg_ms
FROM events WHERE event = 'demo_result' AND day >= date('now','+330 minutes','-7 days')
GROUP BY 1, 2 ORDER BY 1, calls DESC;
