// Old single-page routes that must keep working. Served as 301s by src/pages/[legacy].ts,
// with the query string (utm_* etc.) carried over. Keys: lowercase path, no trailing slash, no .html.
// /about and /contact are real pages now, so they are not listed here.
export const legacyRedirects: Record<string, string> = {
  "/products": "/#products",
  "/experience": "/about#experience",
  "/awards": "/about#recognition",
  "/talks": "/about#talks",
  "/skills": "/about#skills",
  "/case-studies": "/projects",
  "/casestudies": "/projects",
};

/** Build a 301 that keeps the incoming query string and puts any #fragment last. */
export function redirectResponse(target: string, search: string): Response {
  const [path, hash] = target.split("#");
  const location = `${path}${search}${hash ? `#${hash}` : ""}`;
  return new Response(null, {
    status: 301,
    headers: { location, "cache-control": "public, max-age=3600" },
  });
}

/** 404 response that shows the site's prerendered "Page not found" page. */
export async function notFoundResponse(url: URL): Promise<Response> {
  try {
    const { env } = await import("cloudflare:workers");
    const page = await env.ASSETS.fetch(new URL("/404", url));
    if (page.ok) {
      return new Response(page.body, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
    }
  } catch {
    /* fall through to a plain response */
  }
  return new Response("Page not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}
