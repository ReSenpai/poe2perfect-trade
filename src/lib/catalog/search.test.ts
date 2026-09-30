import { describe, expect, it } from 'vitest';
import { loadCatalog, loadWorkspaceData } from '../../../tests/fixtures/load';
import { buildFilterIndex, type FilterEntry } from './index';
import { commonFilters, searchFilters, suggestedPseudoFilters } from './search';

const index = buildFilterIndex(loadCatalog('stats'), loadCatalog('filters'));
const keys = (entries: FilterEntry[]) => entries.map((entry) => entry.key);

describe('searchFilters', () => {
  it('puts the plain explicit stat first and the pseudo total close behind', () => {
    const found = keys(searchFilters(index, 'life'));
    expect(found[0]).toBe('stat:explicit.stat_3299347043');
    expect(found.slice(0, 5)).toContain('stat:pseudo.pseudo_total_life');
  });

  it('shows explicit and pseudo stats before implicit ones, and those before crafted and others', () => {
    const tiers = searchFilters(index, 'life').map((entry) =>
      entry.kind === 'fixed' || ['explicit', 'pseudo'].includes(entry.type) ? 0 : entry.type === 'implicit' ? 1 : 2,
    );
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  it('matches word starts in any order and ignores #, + and %', () => {
    const found = keys(searchFilters(index, 'res fire'));
    expect(found.slice(0, 3)).toEqual(expect.arrayContaining(['stat:explicit.stat_3372524247', 'stat:pseudo.pseudo_total_fire_resistance']));
    expect(keys(searchFilters(index, '+#% to fire resistance'))[0]).toBe('stat:explicit.stat_3372524247');
  });

  it.each([
    ['item level', 'fixed:type_filters:ilvl'],
    ['rarity', 'fixed:type_filters:rarity'],
    ['price', 'fixed:trade_filters:price'],
    ['corrupted', 'fixed:misc_filters:corrupted'],
  ])('finds the fixed filter for "%s" first', (text, key) => {
    expect(keys(searchFilters(index, text))[0]).toBe(key);
  });

  it('finds a stat by its other wording and by a substring', () => {
    expect(keys(searchFilters(index, 'map has shrines'))).toContain('stat:explicit.stat_689816330');
    expect(keys(searchFilters(index, 'egeneration'))).not.toHaveLength(0);
  });

  it('returns nothing for a blank query and honours the limit', () => {
    expect(searchFilters(index, '   ')).toEqual([]);
    expect(searchFilters(index, 'damage', { limit: 7 })).toHaveLength(7);
  });

  it('Simple mode keeps to explicit, pseudo, implicit and fixed filters', () => {
    const types = new Set(searchFilters(index, 'life', { mode: 'simple', limit: 500 }).map((entry) => (entry.kind === 'stat' ? entry.type : 'fixed')));
    expect([...types].sort()).toEqual(['explicit', 'implicit', 'pseudo']);
  });

  it('can be limited to one group', () => {
    const found = searchFilters(index, 'fire', { group: 'resistances', limit: 500 });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((entry) => entry.group === 'resistances')).toBe(true);
  });
});

describe('searchFilters with the item in mind', () => {
  const rings = loadWorkspaceData().possible!.forItem('accessory.ring')!;

  it('puts what surely rolls on the item first, then what the game data does not know, then what cannot roll', () => {
    const gloves = loadWorkspaceData().possible!.forItem('armour.gloves')!;
    const found = searchFilters(index, 'fire res', { possible: gloves, limit: 200 });
    const order = { yes: 0, unknown: 1, no: 2 };
    const ranks = found.map((entry) => (entry.kind === 'fixed' ? 0 : order[gloves.status(entry.id)]));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks).toContain(1);
  });

  it('puts what can roll on the item before what cannot, keeping the order otherwise', () => {
    const found = searchFilters(index, 'spirit', { possible: rings, limit: 200 });
    const flags = found.map((entry) => entry.kind === 'fixed' || rings.has(entry.id));
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    expect(flags).toContain(false);
    expect(found.find((entry) => entry.key === 'stat:explicit.stat_3981240776')).toBeDefined();
  });
});

describe('picker lists', () => {
  it('Common filters exist in the catalog', () => {
    const common = commonFilters(index);
    expect(common.map((entry) => entry.label)).toEqual([
      'Life',
      'Fire Res',
      'Cold Res',
      'Lightning Res',
      'Chaos Res',
      'Energy Shield',
      'Mana',
      'Increased Movement Speed',
      'Item Level',
    ]);
  });

  it('Suggested pseudo filters exist in the catalog', () => {
    expect(suggestedPseudoFilters(index).map((entry) => entry.label)).toEqual([
      'Total Elemental Res',
      'Total Res',
      'Total Life',
      'Total Energy Shield',
      'Total all Attributes',
    ]);
  });
});
