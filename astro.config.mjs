// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://adityabal.com',
  // Canonical URLs have no trailing slash: /projects/yoga-doc
  trailingSlash: 'never',
  adapter: cloudflare({
    // remoteBindings: Vectorize (used by the PDF RAG demo) has no local simulation,
    // so local dev/preview proxies it to the real remote index instead.
    remoteBindings: true,
    // Optimise images at build time (sharp); every page that uses images is prerendered.
    imageService: 'compile',
  }),
  // Emit /projects.html (served at /projects) instead of /projects/index.html, so deep links have no trailing slash.
  build: { format: 'file' },
});
