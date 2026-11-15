// Helpers over the projects collection, shared by pages, the short-link route and the sitemap.
import { getCollection, type CollectionEntry } from "astro:content";

export type Project = CollectionEntry<"projects">;

/** Fixed section anchors every project page must have, in order. Deep links depend on these. */
export const PROJECT_SECTIONS = ["overview", "problem", "approach", "architecture", "demo", "results", "learnings"] as const;

export const typeLabels: Record<Project["data"]["type"], string> = {
  ai: "AI project",
  platform: "Platform",
};

export const statusLabels: Record<Project["data"]["status"], string> = {
  live: "Live",
  shipped: "Shipped",
  archived: "Archived",
};

/** All projects, AI first, then by `order`. Fails the build on duplicate slugs or short slugs. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection("projects");
  for (const key of ["slug", "shortSlug"] as const) {
    const seen = new Set<string>();
    for (const project of projects) {
      const value = project.data[key];
      if (seen.has(value)) throw new Error(`Duplicate project ${key}: "${value}"`);
      seen.add(value);
    }
  }
  return projects.sort((a, b) => {
    if (a.data.type !== b.data.type) return a.data.type === "ai" ? -1 : 1;
    return a.data.order - b.data.order;
  });
}

export const projectPath = (project: Project) => `/projects/${project.data.slug}`;
export const shortPath = (project: Project) => `/p/${project.data.shortSlug}`;
export const ogImagePath = (project: Project) => project.data.ogImage ?? `/og/${project.data.slug}.png`;
