import { describe, expect, it } from 'vitest';
import filters from '../../../tests/fixtures/data/filters.json';
import { buildMoreFilters, type MoreFilterGroup, visibleFilters } from './more-filters';

const GROUPS = buildMoreFilters(filters as never);
const keys = (groups: MoreFilterGroup[]) => groups.flatMap((group) => group.filters.map((filter) => `${filter.section}.${filter.key}`));
const shown = (category: string | null) => keys(visibleFilters(GROUPS, category));

describe('more filters', () => {
  it('takes the groups of the site in its order, named shortly, without the filters of the main panel', () => {
    expect(GROUPS.map((group) => group.title)).toEqual(['Item', 'Equipment', 'Requirements', 'Endgame', 'Miscellaneous', 'Trade']);
    const all = keys(GROUPS);
    for (const main of ['type_filters.category', 'type_filters.rarity', 'trade_filters.price', 'status_filters.status']) expect(all).not.toContain(main);
    expect(all).toContain('type_filters.ilvl');
    expect(all).toContain('misc_filters.corrupted');
    expect(all).toContain('trade_filters.account');
  });

  it('knows each kind of control, with the texts of the site', () => {
    const find = (key: string) => GROUPS.flatMap((group) => group.filters).find((filter) => `${filter.section}.${filter.key}` === key)!;
    expect(find('req_filters.lvl')).toMatchObject({ kind: 'range', text: 'Level' });
    expect(find('misc_filters.corrupted')).toMatchObject({ kind: 'yes-no', text: 'Corrupted' });
    expect(find('trade_filters.indexed')).toMatchObject({ kind: 'option', text: 'Listed' });
    expect(find('trade_filters.indexed').options![0]).toEqual({ id: '', text: 'Any Time' });
    expect(find('trade_filters.account')).toMatchObject({ kind: 'text', text: 'Seller Account' });
    expect(find('trade_filters.collapse')).toMatchObject({ kind: 'option' });
  });

  it('shows what fits the category, everything without one', () => {
    const ring = shown('accessory.ring');
    expect(ring).toContain('req_filters.lvl');
    expect(ring).toContain('misc_filters.corrupted');
    expect(ring).toContain('trade_filters.indexed');
    expect(ring).not.toContain('equipment_filters.pdps');
    expect(ring).not.toContain('equipment_filters.ar');
    expect(ring).not.toContain('map_filters.map_tier');
    expect(ring).not.toContain('misc_filters.gem_level');

    expect(shown('weapon.bow')).toContain('equipment_filters.pdps');
    expect(shown('weapon.bow')).not.toContain('equipment_filters.ar');
    expect(shown('armour.helmet')).toContain('equipment_filters.es');
    expect(shown('map.waystone')).toContain('map_filters.map_tier');
    expect(shown('map.waystone')).not.toContain('req_filters.lvl');
    expect(shown('gem.activegem')).toContain('misc_filters.gem_level');
    expect(shown('currency.omen')).toContain('misc_filters.stack_size');
    expect(shown(null)).toEqual(keys(GROUPS));
  });
});
