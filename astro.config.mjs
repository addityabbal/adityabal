// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import ogImages from './src/integrations/og-images.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://adityabal.com',
  // Generates link-preview images into public/og before each build.
  integrations: [ogImages()],
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
