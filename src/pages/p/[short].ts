// Short links for social posts: /p/<shortSlug> -> 301 -> /projects/<slug>.
// The map comes from `shortSlug` in the projects collection, so a new project gets its
// short link automatically. The query string (utm_source etc.) is carried over.
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { notFoundResponse, redirectResponse } from "../../data/redirects";

export const prerender = false;

export const ALL: APIRoute = async ({ params, url }) => {
  const short = (params.short ?? "").toLowerCase();
  const projects = await getCollection("projects");
  const project = projects.find((entry) => entry.data.shortSlug === short);
  if (!project) return notFoundResponse(url);
  return redirectResponse(`/projects/${project.data.slug}`, url.search);
};
