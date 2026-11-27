-- Q6 · Funnel: visit → project → demo → contact (visitor-days), last 30 days.
-- Run: npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q6-funnel.sql
SELECT
  COUNT(DISTINCT day || visitor) AS visitors,
  COUNT(DISTINCT CASE WHEN event = 'page_view' AND path LIKE '/projects/%' THEN day || visitor END) AS saw_project,
  COUNT(DISTINCT CASE WHEN event = 'demo_open' THEN day || visitor END) AS opened_demo,
  COUNT(DISTINCT CASE WHEN event = 'demo_result' AND detail = 'ok' THEN day || visitor END) AS demo_worked,
  COUNT(DISTINCT CASE WHEN event = 'contact_click' THEN day || visitor END) AS made_contact
FROM events
WHERE day >= date('now','+330 minutes','-30 days');
