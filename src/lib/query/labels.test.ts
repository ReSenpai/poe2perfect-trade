import { describe, expect, it } from 'vitest';
import { loadCatalog, loadListings } from '../../../tests/fixtures/load';
import { activeFilters, createFilterLabels, formatRange, shortStatLabel } from './labels';
import { normalizeQuery } from './normalize';

const labels = createFilterLabels(loadCatalog('stats'), loadCatalog('filters'));

describe('shortStatLabel', () => {
  it.each([
    ['# to maximum Life', 'Life'],
    ['#% to Fire Resistance', 'Fire Res'],
    ['+#% total to Fire Resistance', 'Total Fire Res'],
    ['+#% total Elemental Resistance', 'Total Elemental Res'],
    ['+# total maximum Energy Shield', 'Total Energy Shield'],
    ['+# total to Strength', 'Total Strength'],
    ['#% increased Attack Speed', 'Increased Attack Speed'],
    ['# to maximum Energy Shield (Local)', 'Energy Shield'],
    ['#% to Maximum Fire Resistance', 'Maximum Fire Res'],
    ['# Prefix Modifiers', 'Prefix Modifiers'],
    ['Damage Penetrates #% Fire Resistance', 'Damage Penetrates Fire Res'],
    ['Allocates Barbaric Strength', 'Allocates Barbaric Strength'],
  ])('%s → %s', (text, label) => {
    expect(shortStatLabel(text)).toBe(label);
  });

  it('gives every stat of the catalog a readable label', () => {
    const bad = loadCatalog('stats')
      .result.flatMap((group) => group.entries)
      .map((entry) => shortStatLabel(entry.text))
      .filter((label) => label === '' || label.includes('#') || label !== label.trim());
    expect(bad).toEqual([]);
  });
});

describe('formatRange', () => {
  it.each([
    [{ min: 70 }, '70+'],
    [{ max: 50 }, '≤50'],
    [{ min: 30, max: 50 }, '30–50'],
    [{ min: 5, max: 5 }, '5'],
    [{}, ''],
  ])('%j → %s', (value, text) => {
    expect(formatRange(value)).toBe(text);
  });
});

describe('createFilterLabels', () => {
  it('finds stats by id with their full text and type', () => {
    expect(labels.stat('explicit.stat_3299347043')).toEqual({ text: '# to maximum Life', type: 'explicit', label: 'Life' });
    expect(labels.stat('pseudo.pseudo_total_fire_resistance')?.label).toBe('Total Fire Res');
    expect(labels.stat('explicit.nope')).toBeUndefined();
  });

  it('finds fixed filters by section and key', () => {
    expect(labels.fixed('type_filters', 'rarity')).toMatchObject({ text: 'Item Rarity', label: 'Rarity' });
    expect(labels.fixed('type_filters', 'ilvl')).toMatchObject({ text: 'Item Level', label: 'Item Level' });
    expect(labels.fixed('type_filters', 'rarity')?.options?.get('rare')).toBe('Rare');
    expect(labels.fixed('nope', 'x')).toBeUndefined();
  });
});

describe('activeFilters', () => {
  it('describes the fixture search as chips', () => {
    const query = normalizeQuery(loadListings('listings-online').request.query);
    expect(activeFilters(query, labels)).toEqual([
      { key: 'fixed:type_filters:category', text: 'Category: Gloves', title: 'Item Category: Gloves' },
      { key: 'fixed:type_filters:rarity', text: 'Rarity: Rare', title: 'Item Rarity: Rare' },
      { key: 'stat:0:0', text: 'Life: 70+', title: '# to maximum Life: 70+' },
    ]);
  });

  it('marks stat types other than explicit and pseudo, and negated groups', () => {
    const query = normalizeQuery({
      stats: [
        { type: 'and', filters: [{ id: 'implicit.stat_3299347043', value: { min: 10 } }, { id: 'pseudo.pseudo_total_life', value: { min: 90 } }] },
        { type: 'not', filters: [{ id: 'explicit.stat_3372524247' }] },
      ],
    });
    expect(activeFilters(query, labels).map((chip) => chip.text)).toEqual(['Life (implicit): 10+', 'Total Life: 90+', 'Not Fire Res']);
  });

  it('describes ranges, yes/no options, price with currency and seller input', () => {
    const query = normalizeQuery({
      filters: {
        type_filters: { filters: { ilvl: { min: 80 }, quality: { min: 10, max: 20 } } },
        misc_filters: { filters: { corrupted: { option: 'false' } } },
        trade_filters: { filters: { price: { option: 'divine', max: 5 }, account: { input: 'Someone' } } },
      },
    });
    expect(activeFilters(query, labels).map((chip) => chip.text)).toEqual([
      'Item Level: 80+',
      'Item Quality: 10–20',
      'Corrupted: No',
      'Buyout Price: ≤5 Divine Orb',
      'Seller Account: Someone',
    ]);
  });

  it('starts with the item name and base, as chips of their own', () => {
    const query = normalizeQuery({ name: 'Andvarius', type: 'Gold Ring', filters: { type_filters: { filters: { rarity: { option: 'unique' } } } } });
    expect(activeFilters(query, labels).map((chip) => [chip.key, chip.text])).toEqual([
      ['item:name', 'Item: Andvarius'],
      ['item:type', 'Base: Gold Ring'],
      ['fixed:type_filters:rarity', 'Rarity: Unique'],
    ]);
    expect(activeFilters(normalizeQuery({ type: { option: 'Gold Ring', discriminator: 'x' } }), labels)[0]).toMatchObject({ text: 'Base: Gold Ring' });
  });

  it('skips disabled filters, groups and sections', () => {
    const query = normalizeQuery({
      stats: [
        { type: 'and', filters: [{ id: 'explicit.stat_3299347043', value: { min: 1 }, disabled: true }] },
        { type: 'and', disabled: true, filters: [{ id: 'explicit.stat_3299347043', value: { min: 2 } }] },
      ],
      filters: { type_filters: { disabled: true, filters: { rarity: { option: 'rare' } } } },
    });
    expect(activeFilters(query, labels)).toEqual([]);
  });

  it('falls back to ids for stats and filters it does not know', () => {
    const query = normalizeQuery({
      stats: [{ type: 'and', filters: [{ id: 'explicit.stat_1', value: { min: 3 } }] }],
      filters: { new_filters: { filters: { thing: { option: 'x' } } } },
    });
    expect(activeFilters(query, labels).map((chip) => chip.text)).toEqual(['thing: x', 'explicit.stat_1: 3+']);
  });
});
