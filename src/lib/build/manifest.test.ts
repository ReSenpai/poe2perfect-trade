import { describe, expect, it } from 'vitest';
import { FIREFOX_ID, manifestFor } from './manifest';

describe('manifestFor', () => {
  it('gives the Firefox build its lasting id, the Firefox it needs and no data collection', () => {
    expect(manifestFor('firefox').browser_specific_settings).toEqual({
      gecko: { id: FIREFOX_ID, strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } },
    });
    expect(FIREFOX_ID).toBe('poe2perfect-trade@resenpai');
  });

  it('keeps the same name, permissions and extension files in every browser, Chrome without Firefox settings', () => {
    const chrome = manifestFor('chrome');
    const firefox = manifestFor('firefox');
    expect(chrome.browser_specific_settings).toBeUndefined();
    for (const manifest of [chrome, firefox]) {
      expect(manifest.name).toBe('poe2perfect trade');
      expect(manifest.permissions).toEqual(['storage']);
      expect(manifest.web_accessible_resources).toEqual([{ resources: ['data/base-stats.json', 'category/*'], matches: ['https://www.pathofexile.com/*', 'https://pathofexile.com/*'] }]);
    }
  });
});

describe('source for store review', () => {
  it('never sets innerHTML: addons.mozilla.org flags it, and markup is built as elements', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
      }
    };
    walk('src');
    expect(files.filter((file) => /\.innerHTML\s*=|dangerouslySetInnerHTML/.test(readFileSync(file, 'utf8')))).toEqual([]);
  });
});
