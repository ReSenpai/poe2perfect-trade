import { describe, expect, it } from 'vitest';
import { FIREFOX_ID, firefoxVersion, manifestFor } from './manifest';

describe('manifestFor', () => {
  it('gives the Firefox build its lasting id, the Firefox it needs and no data collection', () => {
    expect(manifestFor('firefox').browser_specific_settings).toEqual({
      gecko: { id: FIREFOX_ID, strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } },
    });
    // poe2perfect-trade@resenpai belonged to an add-on deleted on addons.mozilla.org: AMO never gives a deleted id again.
    expect(FIREFOX_ID).toBe('poe2perfect-trade@resenpai.dev');
  });

  it('is the id the release workflows submit to addons.mozilla.org', async () => {
    const { readFileSync } = await import('node:fs');
    for (const workflow of ['release', 'store-check']) {
      const text = readFileSync(`.github/workflows/${workflow}.yml`, 'utf8');
      expect(text).toContain(`--firefox-extension-id "${FIREFOX_ID}"`);
    }
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

describe('firefoxVersion', () => {
  it('keeps a release as it is', () => {
    expect(firefoxVersion('1.1.0')).toBe('1.1.0');
    expect(firefoxVersion('2.0.3')).toBe('2.0.3');
  });

  it('numbers a pre-release just below its release, digits only as addons.mozilla.org requires', () => {
    expect(firefoxVersion('1.1.0-beta.1')).toBe('1.0.999.1');
    expect(firefoxVersion('1.1.0-beta.12')).toBe('1.0.999.12');
    expect(firefoxVersion('1.2.3-rc.2')).toBe('1.2.2.2');
    expect(firefoxVersion('2.0.0-beta.1')).toBe('1.999.999.1');
  });

  it('orders every beta before its release and after the release before it', () => {
    const order = ['1.0.0', '1.1.0-beta.1', '1.1.0-beta.2', '1.1.0', '1.1.1-beta.1', '1.1.1'].map((version) => firefoxVersion(version));
    const compare = (a: string, b: string) => {
      const [x, y] = [a, b].map((v) => v.split('.').map(Number));
      for (let i = 0; i < 4; i++) if ((x![i] ?? 0) !== (y![i] ?? 0)) return (x![i] ?? 0) - (y![i] ?? 0);
      return 0;
    };
    expect([...order].sort(compare)).toEqual(order);
  });

  it('refuses a version it cannot number', () => {
    expect(() => firefoxVersion('1.1')).toThrow();
    expect(() => firefoxVersion('1.1.0-beta')).toThrow();
  });

  // While a release waits for review, Firefox users get the same code signed unlisted — and AMO takes each number
  // once, so that package sits just above the release and below the next one.
  it('numbers a signed build of a release above it, below the next one', () => {
    expect(firefoxVersion('1.1.1', 1)).toBe('1.1.1.1');
    expect(firefoxVersion('1.1.1', 2)).toBe('1.1.1.2');
    expect(firefoxVersion('1.1.0-beta.1', 1)).toBe('1.0.999.1');
  });
});

describe('the Firefox manifest version', () => {
  it('comes from the package version; Chrome keeps it with its version_name', () => {
    expect(manifestFor('firefox', '1.1.0-beta.1').version).toBe('1.0.999.1');
    expect(manifestFor('chrome', '1.1.0-beta.1').version).toBeUndefined();
  });

  it('carries the build number of a signed package through to Firefox only', () => {
    expect(manifestFor('firefox', '1.1.1', 2).version).toBe('1.1.1.2');
    expect(manifestFor('chrome', '1.1.1', 2).version).toBeUndefined();
  });
});

describe('the signing workflow', () => {
  it('builds the package with the build number it is given and attaches it to the release', async () => {
    const { readFileSync } = await import('node:fs');
    const text = readFileSync('.github/workflows/sign-xpi.yml', 'utf8');
    expect(text).toContain('FIREFOX_BUILD: ${{ inputs.build }}');
    expect(text).toContain('--channel unlisted');
    expect(text).toContain('gh release upload');
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
