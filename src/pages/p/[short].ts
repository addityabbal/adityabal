// Short links for social posts: /p/<shortSlug> -> 301 -> /projects/<slug>.
// The map comes from `shortSlug` in the projects collection, so a new project gets its
// short link automatically. The query string (utm_source etc.) is carried over.
// Each hit logs a server-side shortlink_hit (no JavaScript needed, so ad blockers can't hide it).
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { notFoundResponse, redirectResponse } from "../../data/redirects";
import { logServerEvent } from "../../lib/analytics";

export const prerender = false;

export const ALL: APIRoute = async ({ params, url, request }) => {
  const short = (params.short ?? "").toLowerCase();
  const projects = await getCollection("projects");
  const project = projects.find((entry) => entry.data.shortSlug === short);
  if (!project) return notFoundResponse(url);
  logServerEvent(request, { event: "shortlink_hit", target: short }, { project: project.data.slug });
  return redirectResponse(`/projects/${project.data.slug}`, url.search);
};
