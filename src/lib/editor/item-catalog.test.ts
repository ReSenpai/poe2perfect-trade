import { describe, expect, it } from 'vitest';
import { loadWorkspaceData } from '../../../tests/fixtures/load';
import { createItemCatalog } from './item-catalog';

const DATA = loadWorkspaceData();
const catalog = createItemCatalog(DATA);

describe('item catalog', () => {
  it('lists the categories of the trade site', () => {
    expect(catalog.categories.find((option) => option.id === 'accessory.ring')?.text).toBe('Ring');
    expect(catalog.rarities.map((option) => option.text)).toEqual(['Normal', 'Magic', 'Rare', 'Unique', 'Unique (Foil)', 'Any Non-Unique']);
  });

  it('knows which base belongs to which category, and says when it does not know', () => {
    expect(catalog.baseFits('accessory.ring', 'Ruby Ring')).toBe(true);
    expect(catalog.baseFits('accessory.ring', 'Doubled Gauntlets')).toBe(false);
    expect(catalog.baseFits('armour.gloves', 'Doubled Gauntlets')).toBe(true);
    expect(catalog.baseFits(null, 'Ruby Ring')).toBeNull();
    expect(catalog.baseFits('accessory.ring', 'No Such Base')).toBe(false);
    expect(createItemCatalog({ ...DATA, possible: null }).baseFits('accessory.ring', 'Doubled Gauntlets')).toBeNull();

    expect(catalog.categoryOfBase('Ruby Ring')).toBe('accessory.ring');
    expect(catalog.categoryOfBase('Doubled Gauntlets')).toBe('armour.gloves');
    expect(catalog.categoryOfBase('No Such Base')).toBeNull();
  });

  it('finds bases and uniques by words in any order, labelled as such', () => {
    const found = catalog.search('ring ruby');
    expect(found[0]).toEqual({ kind: 'base', text: 'Ruby Ring', type: 'Ruby Ring' });
    const andvarius = catalog.search('andvarius');
    expect(andvarius).toEqual([{ kind: 'unique', text: 'Andvarius Gold Ring', name: 'Andvarius', type: 'Gold Ring' }]);
    expect(catalog.search('')).toEqual([]);
  });

  it('keeps to the chosen category: its bases, and the uniques whose base it is (or is not known)', () => {
    const rings = catalog.search('ring', 'accessory.ring', 50);
    expect(rings.some((choice) => choice.kind === 'base' && choice.type === 'Ruby Ring')).toBe(true);
    expect(rings.every((choice) => catalog.categoryOfBase(choice.type) === 'accessory.ring' || catalog.categoryOfBase(choice.type) === null)).toBe(true);
    expect(catalog.search('gauntlets', 'accessory.ring')).toEqual([]);
  });

  it('turns a choice into an item context change', () => {
    expect(catalog.choose({ kind: 'base', text: 'Ruby Ring', type: 'Ruby Ring' })).toEqual({ type: 'Ruby Ring', name: null });
    expect(catalog.choose({ kind: 'unique', text: 'Andvarius Gold Ring', name: 'Andvarius', type: 'Gold Ring' })).toEqual({
      name: 'Andvarius',
      type: 'Gold Ring',
      rarity: 'unique',
      category: 'accessory.ring',
    });
    // A unique whose base the game data cannot place keeps the category as it is.
    expect(catalog.choose({ kind: 'unique', text: 'X Mystery', name: 'X', type: 'Mystery' })).toEqual({ name: 'X', type: 'Mystery', rarity: 'unique' });
  });
});
