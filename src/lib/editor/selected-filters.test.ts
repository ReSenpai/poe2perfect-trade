import { describe, expect, it, vi } from 'vitest';
import { buildFilterRegistry } from '@/lib/catalog/filter-registry';
import { createFakeClient } from '../../../tests/fixtures/fake-client';
import { loadCatalog } from '../../../tests/fixtures/load';
import { compile, fromTradeQuery } from './document';
import { planRequirementLimits, readFilter, selectedFilters, writeFilter } from './selected-filters';
import { createEditorStore } from './store';

// Step 41 B (the unified filters design §4, §6, §12): the compact filters of the query — read, written,
// listed in the order they were added; Can equip as one change.

const REGISTRY = buildFilterRegistry(loadCatalog('filters'));
const def = (id: string) => REGISTRY.find((definition) => definition.id === id)!;
const CORRUPTED = def('property.corrupted');
const ILVL = def('property.item_level');
const LISTED = def('trade.listed');
const ACCOUNT = def('trade.account');

describe('reading and writing a filter', () => {
  it('keeps No as a condition of its own: false is written, and read back as false', () => {
    const doc = writeFilter(fromTradeQuery({}), CORRUPTED, { kind: 'boolean', value: false });
    expect(compile(doc)).toMatchObject({ filters: { misc_filters: { filters: { corrupted: { option: 'false' } } } } });
    expect(readFilter(doc, CORRUPTED)).toEqual({ kind: 'boolean', value: false });
  });

  it('removes a filter as no condition at all — never as Yes', () => {
    const doc = writeFilter(writeFilter(fromTradeQuery({}), CORRUPTED, { kind: 'boolean', value: false }), CORRUPTED, null);
    expect(readFilter(doc, CORRUPTED)).toBeNull();
    expect(JSON.stringify(compile(doc))).not.toContain('corrupted');
  });

  it('writes 0 as a bound, an empty range as nothing', () => {
    const zero = writeFilter(fromTradeQuery({}), ILVL, { kind: 'range', min: 0, max: null });
    expect(readFilter(zero, ILVL)).toEqual({ kind: 'range', min: 0, max: null });
    const empty = writeFilter(zero, ILVL, { kind: 'range', min: null, max: null });
    expect(readFilter(empty, ILVL)).toBeNull();
    expect(JSON.stringify(compile(empty))).not.toContain('ilvl');
  });

  it('writes a choice and a text; an empty one is nothing', () => {
    const doc = writeFilter(writeFilter(fromTradeQuery({}), LISTED, { kind: 'enum', value: '1day' }), ACCOUNT, { kind: 'text', value: 'Seller#1' });
    expect(readFilter(doc, LISTED)).toEqual({ kind: 'enum', value: '1day' });
    expect(readFilter(doc, ACCOUNT)).toEqual({ kind: 'text', value: 'Seller#1' });
    expect(readFilter(writeFilter(doc, ACCOUNT, { kind: 'text', value: '  ' }), ACCOUNT)).toBeNull();
  });
});

describe('the list of selected filters', () => {
  const QUERY = {
    filters: {
      type_filters: { filters: { category: { option: 'accessory.ring' }, ilvl: { min: 80 } } },
      misc_filters: { filters: { corrupted: { option: 'false' }, future_filter: { option: 'x' } } },
      trade_filters: { filters: { price: { max: 50 } } },
      brand_new_section: { filters: { thing: { min: 1 } } },
    },
  };

  it('lists what is set, the pinned ones (category, price) left to the top of the panel, unknown fields kept apart', () => {
    const { known, unknown } = selectedFilters(fromTradeQuery(QUERY), REGISTRY, []);
    expect(known.map((each) => each.definition.id)).toEqual(['property.item_level', 'property.corrupted']); // the schema's order
    expect(unknown.map((each) => `${each.section}.${each.key}`)).toEqual(['misc_filters.future_filter', 'brand_new_section.thing']);
  });

  it('puts the ones added now in the order they were added, after the rest', () => {
    const { known } = selectedFilters(fromTradeQuery(QUERY), REGISTRY, ['property.corrupted']);
    expect(known.map((each) => each.definition.id)).toEqual(['property.item_level', 'property.corrupted']);
    const again = selectedFilters(fromTradeQuery(QUERY), REGISTRY, ['property.corrupted', 'property.item_level']);
    expect(again.known.map((each) => each.definition.id)).toEqual(['property.corrupted', 'property.item_level']);
  });
});

describe('Can equip', () => {
  it('turns the limits typed into at-most requirements, telling what is added and what is updated', () => {
    const doc = fromTradeQuery({ filters: { req_filters: { filters: { lvl: { min: 40, max: 90 } } } } });
    const plan = planRequirementLimits(doc, REGISTRY, { level: '70', strength: '100', dexterity: '', intelligence: '60' });
    expect(plan.errors).toEqual({});
    expect(plan.added).toBe(2);
    expect(plan.updated).toBe(1);
    expect(plan.minimumRemoved).toEqual(['Required level']);
    expect(plan.changes.map((change) => [change.definition.id, change.max])).toEqual([
      ['requirement.level', 70],
      ['requirement.strength', 100],
      ['requirement.intelligence', 60],
    ]);
  });

  it('keeps 0 as a limit, and refuses what is not a whole number, changing nothing', () => {
    const doc = fromTradeQuery({});
    expect(planRequirementLimits(doc, REGISTRY, { strength: '0' }).changes.map((change) => change.max)).toEqual([0]);
    const wrong = planRequirementLimits(doc, REGISTRY, { level: '70', strength: 'abc', dexterity: '1.5' });
    expect(wrong.errors).toEqual({ strength: 'Enter a whole number', dexterity: 'Enter a whole number' });
    expect(wrong.changes).toEqual([]);
  });
});

describe('editor store: compact filters', () => {
  const setup = (query: unknown = {}) => {
    const fake = createFakeClient('normal');
    return createEditorStore({ client: { search: vi.fn(fake.search), fetchListings: vi.fn(fake.fetchListings) }, league: 'Forbidden Rites', query });
  };

  it('sets and removes a filter as one change each, Undo bringing it back, and remembers the order they came in', () => {
    const store = setup();
    store.setFilter(ILVL, { kind: 'range', min: 80, max: null });
    store.setFilter(CORRUPTED, { kind: 'boolean', value: false });
    expect(store.getState().filterOrder).toEqual(['property.item_level', 'property.corrupted']);
    store.setFilter(CORRUPTED, null);
    expect(readFilter(store.getState().draft, CORRUPTED)).toBeNull();
    expect(store.getState().filterOrder).toEqual(['property.item_level']);
    store.undo();
    expect(readFilter(store.getState().draft, CORRUPTED)).toEqual({ kind: 'boolean', value: false });
  });

  it('applies Can equip all at once or not at all, with Undo', () => {
    const store = setup({ filters: { req_filters: { filters: { str: { min: 20 } } } } });
    expect(store.applyRequirementLimits(REGISTRY, { strength: '1x' })).toBe(false);
    expect(readFilter(store.getState().draft, def('requirement.strength'))).toEqual({ kind: 'range', min: 20, max: null });
    expect(store.applyRequirementLimits(REGISTRY, { level: '70', strength: '100' })).toBe(true);
    expect(readFilter(store.getState().draft, def('requirement.level'))).toEqual({ kind: 'range', min: null, max: 70 });
    expect(readFilter(store.getState().draft, def('requirement.strength'))).toEqual({ kind: 'range', min: null, max: 100 });
    store.undo();
    expect(readFilter(store.getState().draft, def('requirement.level'))).toBeNull();
    expect(readFilter(store.getState().draft, def('requirement.strength'))).toEqual({ kind: 'range', min: 20, max: null });
  });

  it('keeps fields of a link it does not know while another filter is edited', () => {
    const store = setup({ filters: { misc_filters: { filters: { future_filter: { option: 'x' } } } } });
    store.setFilter(CORRUPTED, { kind: 'boolean', value: true });
    expect(compile(store.getState().draft)).toMatchObject({ filters: { misc_filters: { filters: { future_filter: { option: 'x' }, corrupted: { option: 'true' } } } } });
  });
});
