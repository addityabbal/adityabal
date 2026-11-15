// Catch-all for single-segment paths that are not a real page or static file.
// Redirects the old single-page routes (see src/data/redirects.ts); everything else is a 404.
import type { APIRoute } from "astro";
import { legacyRedirects, notFoundResponse, redirectResponse } from "../data/redirects";

export const prerender = false;

export const ALL: APIRoute = ({ params, url }) => {
  const key = `/${(params.legacy ?? "").toLowerCase().replace(/\.html$/, "")}`;
  const target = legacyRedirects[key];
  if (target) return redirectResponse(target, url.search);
  return notFoundResponse(url);
};
