// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare(),
  // Emit /projects.html (served at /projects) instead of /projects/index.html, so deep links have no trailing slash.
  build: { format: 'file' },
});