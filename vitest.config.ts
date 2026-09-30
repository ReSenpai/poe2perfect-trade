import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    // Vitest stubs CSS modules to empty strings; the kit CSS is read as text and checked by tests.
    css: { include: [/src\/ui\/kit\/styles\//] },
  },
});
