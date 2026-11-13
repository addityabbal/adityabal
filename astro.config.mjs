// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // remoteBindings: Vectorize (used by the PDF RAG demo) has no local simulation,
  // so local dev/preview proxies it to the real remote index instead.
  adapter: cloudflare({ remoteBindings: true }),
  // Emit /projects.html (served at /projects) instead of /projects/index.html, so deep links have no trailing slash.
  build: { format: 'file' },
});