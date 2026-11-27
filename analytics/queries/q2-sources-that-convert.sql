-- Q2 · Sources and campaigns that convert (first touch per visitor per day), last 30 days.
-- Engaged = 10+ s engaged, a 50% scroll, or any click. contacts_per_100 is the headline number.
-- Run: npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q2-sources-that-convert.sql
WITH touches AS (
  SELECT day, visitor,
         COALESCE(utm_source, ref_host, 'direct') AS source,
         COALESCE(utm_campaign, '-') AS campaign,
         ROW_NUMBER() OVER (PARTITION BY day, visitor ORDER BY ts, id) AS rn
  FROM events
  WHERE event IN ('shortlink_hit', 'page_view') AND day >= date('now','+330 minutes','-30 days')
),
outcomes AS (
  SELECT day, visitor,
         MAX((event = 'page_engaged' AND value >= 10) OR (event = 'scroll_depth' AND value >= 50)
             OR event IN ('cta_click', 'contact_click', 'demo_open')) AS engaged,
         MAX(event = 'demo_open') AS demo,
         MAX(event = 'contact_click') AS contact
  FROM events
  WHERE day >= date('now','+330 minutes','-30 days')
  GROUP BY day, visitor
)
SELECT t.source, t.campaign, COUNT(*) AS visitors, SUM(o.engaged) AS engaged,
       SUM(o.demo) AS demo_opens, SUM(o.contact) AS contacts,
       ROUND(100.0 * SUM(o.contact) / COUNT(*), 1) AS contacts_per_100
FROM touches t JOIN outcomes o USING (day, visitor)
WHERE t.rn = 1
GROUP BY t.source, t.campaign
ORDER BY contacts DESC, engaged DESC;
