import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';
import { readFileSync } from 'node:fs';
import { manifestFor } from './src/lib/build/manifest';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  srcDir: 'src',
  // One manifest for Chrome and Firefox; Firefox adds its id and settings (src/lib/build/manifest.ts).
  manifest: ({ browser }) => manifestFor(browser, version),
  // Manifest V3 in Firefox too (WXT builds MV2 for it by default): the same manifest rules in both browsers.
  manifestVersion: 3,
  // The sources ZIP for addons.mozilla.org review: what builds the extension, not design material or notes.
  zip: { excludeSources: ['store/**', 'docs/**', 'coverage/**'] },
  // Dev build is loaded manually into the everyday Chrome: the trade API needs the user's session.
  webExt: { disabled: true },
  // 3000 belongs to poe2perfect's dev server; both can run side by side.
  dev: { server: { port: 3010 } },
  hooks: {
    // The popup only hosts dev tools (fixture export) for now.
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.mode !== 'production') return;
      const popup = entrypoints.findIndex((entrypoint) => entrypoint.name === 'popup');
      if (popup !== -1) entrypoints.splice(popup, 1);
    },
  },
  vite: () => ({
    plugins: [preact()],
  }),
});
