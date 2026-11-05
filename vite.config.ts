/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { experienceConfig } from './src/config/experience.config';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * Fills index.html from the central config (single source of truth for URLs and texts) and, for
 * production builds, injects the Content-Security-Policy (docs/ARCHITECTURE.md §5).
 */
function gatewayHtml(): Plugin {
  const games = new URL(experienceConfig.gamesPortfolioUrl).origin;
  const csp = [
    `default-src 'self' ${games}`,
    `script-src 'self'`,
    `style-src 'self'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${games}`,
    `media-src 'none'`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'none'`,
  ].join('; ');
  const values: Record<string, string> = {
    GV_TITLE: experienceConfig.text.title,
    GV_TAGLINE: experienceConfig.text.tagline,
    GV_TEXT_LOADING: experienceConfig.text.loading,
    GV_ENTRY_URL: experienceConfig.entryUrl,
    GV_PORTFOLIO_URL: experienceConfig.gamesPortfolioUrl,
  };
  let isBuild = false;
  return {
    name: 'gv-gateway-html',
    configResolved(c) {
      isBuild = c.command === 'build';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let out = html.replace(/%(GV_[A-Z0-9_]+)%/g, (m, key: string) => {
          const v = values[key];
          if (v === undefined) throw new Error(`Unknown HTML placeholder ${m}`);
          return escapeHtml(v);
        });
        // the dev server injects inline styles for HMR, so the CSP is applied to builds only
        out = out.replace('<!--GV_CSP-->', isBuild ? `<meta http-equiv="Content-Security-Policy" content="${csp}">` : '');
        return out;
      },
    },
  };
}

export default defineConfig({
  base: '/gamers-room/',
  plugins: [gatewayHtml()],
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap')) return 'gsap';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
