import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import filters from '../../../tests/fixtures/data/filters.json';
import { categoryArtPath, categoryArtUrl, setAssetUrl, extensionAssetUrl } from './category-art';

type Catalog = { result: { id: string; filters: { id: string; option?: { options: { id: string | null }[] } }[] }[] };
const CATEGORY_IDS = (filters as unknown as Catalog).result
  .find((group) => group.id === 'type_filters')!
  .filters.find((filter) => filter.id === 'category')!
  .option!.options.flatMap((option) => (option.id ? [option.id] : []));

afterEach(() => setAssetUrl((path) => path));

describe('category art', () => {
  it('gives every category of the trade site a picture that ships with the extension', () => {
    expect(CATEGORY_IDS.length).toBeGreaterThan(50);
    for (const id of CATEGORY_IDS) {
      const path = categoryArtPath(id)!;
      expect(path, id).toMatch(/^category\/[a-z-]+\.(png|svg)$/);
      expect(existsSync(`public/${path}`), path).toBe(true); // vitest runs from the project root
    }
  });

  it('shares a family picture between kinds, and shows a neutral box for a category without one', () => {
    expect(categoryArtPath('accessory.ring')).toBe('category/ring.png');
    expect(categoryArtPath('weapon.twosword')).toBe('category/sword.png');
    expect(categoryArtPath('weapon')).toBe('category/sword.png'); // Any Weapon
    expect(categoryArtPath('flask.mana')).toBe('category/flask.png');
    expect(categoryArtPath('currency.idol')).toBe('category/unknown.svg');
    expect(categoryArtPath(null)).toBeNull();
  });

  it('turns a picture into the address the extension serves it at', () => {
    setAssetUrl((path) => `chrome-extension://abc/${path}`);
    expect(categoryArtUrl('armour.helmet')).toBe('chrome-extension://abc/category/helmet.png');
    expect(categoryArtUrl(null)).toBeNull();
  });
});

describe('extensionAssetUrl', () => {
  it('addresses any extension file the way category pictures are', () => {
    expect(extensionAssetUrl('category/ring-large.png')).toBe('category/ring-large.png');
  });
});
