// Projects content collection. To add a project, add one markdown file to src/content/projects/.
// Everything else (index, project page, short link, sitemap, link-preview image) is derived from it.
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const projects = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    /** Canonical URL segment: /projects/<slug>. Never change once live. */
    slug: z.string().regex(slugPattern),
    /** Short link segment: /p/<shortSlug>. Never change once live. */
    shortSlug: z.string().regex(slugPattern),
    tagline: z.string(),
    type: z.enum(["ai", "platform"]),
    status: z.enum(["live", "shipped", "archived"]),
    year: z.string(),
    role: z.string(),
    stack: z.array(z.string()).default([]),
    metrics: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    demoUrl: z.string().optional(),
    repoUrl: z.url().optional(),
    pressUrl: z.url().optional(),
    pressLabel: z.string().optional(),
    /** Override for the generated 1200x630 link-preview image. */
    ogImage: z.string().optional(),
    order: z.number(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { projects };
