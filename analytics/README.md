# Analytics

First-party, cookieless analytics for adityabal.com, on Cloudflare only. The question it answers
first: **contact actions per 100 visitors, by source.**

| Layer | What | Where |
| --- | --- | --- |
| Baseline | Cloudflare Web Analytics (dashboard toggle) | Cloudflare dashboard |
| Events | `public/a.js` tracker → `POST /api/e` → D1 `adityabal-analytics` | `src/lib/analytics.ts`, `src/pages/api/e.ts` |
| Server events | `shortlink_hit` (`/p/*`), `demo_result` (`/api/yoga`, `/api/rag`) | same helper, `logServerEvent()` |
| Reporting | Saved SQL, nightly rollup, Monday digest email | `analytics/queries/`, `workers/analytics-cron/` |

## One-time setup (Cloudflare dashboard and terminal)

1. **Web Analytics:** Cloudflare dashboard → Analytics & Logs → Web Analytics → add `adityabal.com` (automatic setup).
2. **Database:** done on 2026-11-27. `adityabal-analytics` exists (id in both `wrangler.jsonc` files) and
   `0001_events.sql` was applied with `d1 execute --remote`. A later `npx wrangler d1 migrations apply
   adityabal-analytics --remote` would re-run it harmlessly (every statement is IF NOT EXISTS / OR IGNORE).
3. **Deploy the site** as usual (`npm run deploy`). Events start arriving on the next page view.
4. **Email digest:** turn on Email Routing for adityabal.com (it adds MX records; skip if another mail
   provider already uses the domain), verify `addityabbal@gmail.com` as a destination, then:
   ```sh
   npx wrangler deploy -c workers/analytics-cron/wrangler.jsonc
   ```
5. **Your own devices:** open `https://adityabal.com/?notrack=1` once on each phone and laptop
   (`?notrack=0` undoes it).
6. Optional: add the site to Google Search Console and submit `/sitemap.xml`.

## Controls (no deploy needed)

```sh
# Kill switch: stop all writes / start again
npx wrangler d1 execute adityabal-analytics --remote --command "UPDATE settings SET value = '0' WHERE key = 'enabled'"
npx wrangler d1 execute adityabal-analytics --remote --command "UPDATE settings SET value = '1' WHERE key = 'enabled'"
# Daily row cap (IST day), default 50,000
npx wrangler d1 execute adityabal-analytics --remote --command "UPDATE settings SET value = '20000' WHERE key = 'daily_cap'"
```
Settings are cached for up to a minute per Worker instance.

Guardrails in code: origin allowlist (`ANALYTICS_ORIGINS`), `ANALYTICS_LIMITER` (120 beacons per IP
per minute), 8 KB and 50 events per beacon, event-name allowlist, bot user agents dropped, strings
trimmed to 200 characters. Only `adityabal.com` and `www` requests write: `npm run dev`, `astro preview`
and `*.workers.dev` preview deploys never touch production (dev prints events to the console).

## Privacy

No cookies or visitor storage (the only `localStorage` key is your own `ab_notrack`). No IPs:
`visitor` is `SHA-256(daily salt + IP + user agent + "adityabal.com")`, first 16 hex. The salt
rotates at IST midnight and the cron deletes old salts, so visitors can't be linked across days.
No content: no demo prompts or answers, email addresses, phone numbers or query strings (only
`utm_*`). Visitors who send Global Privacy Control, and automation (`navigator.webdriver`), are
skipped. Raw events are deleted after 400 days; `rollup_daily` is kept. `/privacy` says this in
plain words: keep it in step with any change here.

Adding the LinkedIn Insight Tag or any ad pixel changes this: it needs a consent banner first.

## Events

Every row has `day` (IST), `visitor`, `page_id`, `path`, `project`, `ref_host`, `utm_*`,
`country`/`region`/`city`, `device`/`browser`/`os`, `org` (network), `theme`.

| Event | Fires when | target | zone | detail | value |
| --- | --- | --- | --- | --- | --- |
| `page_view` | page load (sent at once) | project or demo | | page type | |
| `cta_click` | any other link or button | cta_id | zone | internal, hash, button | ms since load |
| `contact_click` | mailto, tel, LinkedIn profile, /contact | cta_id | zone | email, phone, linkedin, page | ms |
| `demo_open` | link to /demos/* or a demo subdomain | cta_id | zone | demo | ms |
| `outbound_click` | link to another site | cta_id | zone | host | ms |
| `copy_link` | "Copy link" on a project | cta_id | zone | project | ms |
| `filter_use` | projects filter | cta_id | zone | filter value | ms |
| `theme_toggle` | theme switch | cta_id | zone | new theme | ms |
| `section_view` | section ≥50% visible (or half the screen) for 1 s, once | section id | position | | ms since load |
| `section_time` | page hidden | section id | | | seconds in view |
| `scroll_depth` | 25/50/75/100% reached | depth | | | depth |
| `page_engaged` | page hidden | | | max scroll % | engaged (visible) seconds, cumulative |
| `not_found` | 404 page shown | | | | |
| `demo_query` | a demo is asked something | demo | body zone | body_zone, chip, typed | |
| `demo_result` | demo API answers (server) | demo | | ok, rate_limited, turnstile_failed, cap_reached, disabled, retrieval_error, no_match, error | latency ms |
| `shortlink_hit` | any `/p/*` hit, before the 301 (server) | short slug | | | |

**cta_id** is the element's `data-cta` if set (key CTAs have one, so rewording keeps history),
otherwise `zone.link_text`. **zone** is the nearest `data-zone`, then nav, footer, the
`data-track-section` / `section[aria-labelledby]` id. New links are tracked automatically; add
`data-cta` to keep an id stable, or `data-no-track` to skip an element.

## Demo subdomains (scorecard, solar)

Add to each site's HTML (their origins are already allowed in `ANALYTICS_ORIGINS`):
```html
<script defer src="https://adityabal.com/a.js"></script>
```
and, where a visitor asks the demo something:
```js
window.abTrack?.('demo_query', { target: 'scorecard', detail: 'typed' })   // never the text itself
```
If a subdomain sends a Content-Security-Policy, allow `https://adityabal.com` in `script-src` and
`connect-src`. The visitor hash includes the registrable domain, so moving between the main site
and a subdomain stays one visitor.

## Reporting

- **Queries:** `analytics/queries/q1…q9.sql`. Run in the D1 console, or
  `npx wrangler d1 execute adityabal-analytics --remote --file analytics/queries/q2-sources-that-convert.sql`.
- **Cron** (`workers/analytics-cron/`): 00:30 IST daily rollup + pruning; 09:00 IST Monday digest
  with week-on-week change. Test locally:
  `npx wrangler dev -c workers/analytics-cron/wrangler.jsonc --test-scheduled`, then open
  `http://localhost:8787/__scheduled?cron=30+3+*+*+1` (the email is written to a local .eml file).
- **Private dashboard** (`/admin/analytics` behind Cloudflare Access): planned after a month of data.

## UTM convention

Lowercase, hyphens, one campaign per post, shared through a `/p/` short link:
`https://adityabal.com/p/rag?utm_source=linkedin&utm_medium=post&utm_campaign=2026-12-rag-launch`.
Sources: linkedin, x, whatsapp, email, resume, github, naukri, instahyre, wellfound, talk.
Mediums: post, comment, dm, profile, featured, signature, pdf, readme, qr.
