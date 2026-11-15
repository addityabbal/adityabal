# adityabal.com

Portfolio of Aditya Hemant Bal. Astro on Cloudflare Workers. Pushing to `main` deploys.

## Commands

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at `localhost:4321` |
| `npm run build` | Production build to `./dist/` (also generates link-preview images) |
| `npm run preview` | Build, then serve the production build locally |
| `npm run deploy` | Build and deploy with Wrangler |

Local demos need `.dev.vars` (copy `.dev.vars.example`) and, once, the local database tables:

```sh
npx wrangler d1 migrations apply adityabal-demos --local
```

## Pages

| URL | Serves |
| :-- | :-- |
| `/` | Hero, AI projects, numbers, Jio platforms, recognition, contact |
| `/projects` | All projects, AI first, filter by type (`?type=ai`, `?type=platform`) |
| `/projects/<slug>` | One project. Anchors: `#overview #problem #approach #architecture #demo #results #learnings` |
| `/about` | Bio, experience, education, recognition, talks, certifications, patent, skills |
| `/contact` | Email, LinkedIn, phone |
| `/p/<shortSlug>` | Short link, 301 to `/projects/<slug>`, query string kept |
| `/demos/yoga-doc`, `/demos/pdf-rag` | Live demos (rendered on demand) |
| `/api/yoga`, `/api/rag` | Demo APIs |
| `/sitemap.xml`, `/robots.txt` | For crawlers |

Old single-page routes (`/products`, `/experience`, `/case-studies`, `/casestudies`) redirect with a 301. The map is in `src/data/redirects.ts`. Old `/#hash` links are forwarded by a small script on the homepage.

## Add a project

Add one markdown file to `src/content/projects/`. Nothing else.

```md
---
title: "My Project"
slug: "my-project"        # /projects/my-project — never change once live
shortSlug: "mine"         # /p/mine — never change once live
tagline: "One line that says what it does."
type: "ai"                # ai | platform
status: "live"            # live | shipped | archived
year: "2026"
role: "Personal project"
stack: ["Astro", "Workers AI"]
metrics:
  - value: "10K"
    label: "users"
demoUrl: "/demos/my-project"   # optional
repoUrl: "https://github.com/…" # optional
pressUrl: "https://…"           # optional
order: 7
featured: true            # show on the homepage
---

## Overview
## Problem
## Approach
## Architecture
## Demo
## Results
## Learnings
```

All seven headings are required, in that order; the build fails with a clear message otherwise. The project page, index entry, short link, sitemap entry and 1200×630 link-preview image are generated from the file.

A blockquote starting with `**TODO (Aditya):**` renders as a highlighted note. Search for `TODO (Aditya)` to find content still to write.

## Where things live

- `src/styles/tokens.css` — colour, type scale, spacing, radius. Change the look here.
- `src/components/` — `Nav`, `Hero`, `SectionHeader`, `ProjectTile`, `StatRow`, `Footer`, `Seo`, `ThemeToggle`.
- `src/data/site.ts` — name, contact details, Person structured data.
- `src/data/about.ts` — experience, education, recognition, talks, certifications, patent, skills.
- `src/integrations/og-images.mjs` — link-preview image generator (output is git-ignored).
- `src/pages/demos`, `src/pages/api`, `src/lib/demo-guard.ts`, `migrations/`, `scripts/` — live demos and their backend.

## Notes

- Mail links are plain `mailto:` wrapped in `<!--email_off-->` comments, because Cloudflare email obfuscation breaks them.
- Canonical URLs are lowercase, hyphenated, with no trailing slash.
