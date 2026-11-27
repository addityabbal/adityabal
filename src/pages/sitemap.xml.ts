// /sitemap.xml, built from the real pages and the projects collection.
import type { APIRoute } from "astro";
import { getProjects, projectPath } from "../lib/projects";
import { absoluteUrl } from "../data/site";

export const GET: APIRoute = async () => {
  const projects = await getProjects();
  const paths = ["/", "/projects", ...projects.map(projectPath), "/about", "/contact", "/privacy", "/demos/yoga-doc", "/demos/pdf-rag"];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paths.map((path) => `  <url><loc>${absoluteUrl(path)}</loc></url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
