import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../../../tests/fixtures/load';
import { buildFilterRegistry, filterApplies, findFilters } from './filter-registry';

// Step 41 A (the unified filters design §12): every filter of the site's schema, once, with a name people
// use, a line saying what it is, the words it is found by, and where it lives.

const SCHEMA = loadCatalog('filters');
const REGISTRY = buildFilterRegistry(SCHEMA);
const byId = (id: string) => REGISTRY.find((definition) => definition.id === id)!;

describe('filter registry', () => {
  it('covers every filter of the site schema exactly once', () => {
    const schema = SCHEMA.result.flatMap((group) => group.filters.map((filter) => `${group.id}.${filter.id}`));
    const bound = REGISTRY.map((definition) => `${definition.binding.section}.${definition.binding.key}`);
    expect([...bound].sort()).toEqual([...schema].sort());
    expect(new Set(REGISTRY.map((definition) => definition.id)).size).toBe(REGISTRY.length);
  });

  it('keeps what the top of the panel already edits pinned there: category, rarity, price, seller status', () => {
    const pinned = REGISTRY.filter((definition) => definition.placement === 'pinned').map((definition) => definition.id);
    expect(pinned.sort()).toEqual(['item.category', 'item.rarity', 'trade.price', 'trade.status'].sort());
  });

  it('tells a stat from a requirement, and the item level from the level to equip', () => {
    expect(byId('requirement.strength')).toMatchObject({ label: 'Required Strength', description: 'Requirement · Strength needed to equip', section: 'requirements', defaultBound: 'max' });
    expect(byId('requirement.level')).toMatchObject({ label: 'Required level', description: 'Requirement · Character level needed to equip', section: 'requirements' });
    expect(byId('property.item_level')).toMatchObject({ label: 'Item level', description: 'Item property · Level of the item', section: 'properties' });
    expect(byId('property.item_level').defaultBound).toBe('min');
  });

  it('knows the kind of value each takes', () => {
    expect(byId('property.corrupted')).toMatchObject({ valueKind: 'boolean', binding: { section: 'misc_filters', key: 'corrupted' }, iconKey: 'corrupted' });
    expect(byId('property.item_level')).toMatchObject({ valueKind: 'range', iconKey: 'itemLevel' });
    expect(byId('trade.account')).toMatchObject({ valueKind: 'text', iconKey: 'seller' });
    const listed = byId('trade.listed');
    expect(listed).toMatchObject({ valueKind: 'enum', iconKey: 'listedTime' });
    expect(listed.options!.map((option) => option.id)).not.toContain(''); // Any is no filter, not a choice
  });

  it('finds a filter by its name, its words and what the site calls it', () => {
    const first = (text: string) => findFilters(REGISTRY, text)[0]?.id;
    expect(first('ilvl')).toBe('property.item_level');
    expect(first('req level')).toBe('requirement.level');
    expect(first('pdps')).toBe('property.physical_dps');
    expect(findFilters(REGISTRY, 'str').map((definition) => definition.id)).toContain('requirement.strength');
    expect(findFilters(REGISTRY, 'corrupt').map((definition) => definition.id)).toEqual(expect.arrayContaining(['property.corrupted', 'property.twice_corrupted']));
    expect(findFilters(REGISTRY, 'Waystone Tier').map((definition) => definition.id)).toContain('property.map_tier');
    expect(findFilters(REGISTRY, 'zzz')).toEqual([]);
  });

  it('says whether a filter fits the item, and does not claim anything without one', () => {
    expect(filterApplies(byId('requirement.strength'), 'accessory.ring')).toBe(true);
    expect(filterApplies(byId('property.physical_dps'), 'accessory.ring')).toBe(false);
    expect(filterApplies(byId('property.physical_dps'), null)).toBeNull();
    expect(filterApplies(byId('property.corrupted'), 'accessory.ring')).toBe(true);
  });
});
