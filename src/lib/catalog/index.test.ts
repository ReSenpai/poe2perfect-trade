import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../../../tests/fixtures/load';
import { buildFilterIndex, FILTER_GROUPS } from './index';

const index = buildFilterIndex(loadCatalog('stats'), loadCatalog('filters'));

describe('buildFilterIndex', () => {
  it('holds every stat once, keyed like the chips', () => {
    const ids = new Set(loadCatalog('stats').result.flatMap((group) => group.entries.map((entry) => entry.id)));
    expect(index.entries.filter((entry) => entry.kind === 'stat')).toHaveLength(ids.size);
    expect(index.get('stat:explicit.stat_3299347043')).toMatchObject({
      kind: 'stat',
      id: 'explicit.stat_3299347043',
      text: '# to maximum Life',
      type: 'explicit',
      typeLabel: 'Explicit',
      label: 'Life',
      group: 'core',
    });
    expect(index.get('stat:rune.stat_2280525771')).toMatchObject({ type: 'augment', typeLabel: 'Augment' });
  });

  it('keeps the other wording of a stat that appears twice', () => {
    const entry = index.get('stat:explicit.stat_689816330');
    expect(entry?.kind === 'stat' && [entry.text, ...entry.aliases]).toEqual([
      'Area has #% increased chance to contain Shrines',
      'Map has #% increased chance to contain Shrines',
    ]);
  });

  it('describes fixed filters with their control and options, without the status filter', () => {
    expect(index.get('fixed:type_filters:ilvl')).toMatchObject({ kind: 'fixed', label: 'Item Level', control: 'range', group: 'type_filters' });
    expect(index.get('fixed:type_filters:rarity')).toMatchObject({ label: 'Rarity', control: 'option' });
    const rarity = index.get('fixed:type_filters:rarity');
    expect(rarity?.kind === 'fixed' && rarity.options.map((option) => option.id)).toContain('rare');
    expect(rarity?.kind === 'fixed' && rarity.options.map((option) => option.id)).not.toContain(null);
    expect(index.get('fixed:trade_filters:price')).toMatchObject({ control: 'option-range' });
    expect(index.get('fixed:trade_filters:account')).toMatchObject({ control: 'input' });
    expect(index.get('fixed:status_filters:status')).toBeUndefined();
  });

  it('counts filters per group, stat groups first, then site sections', () => {
    expect(FILTER_GROUPS.map((group) => group.id)).toEqual([
      'core',
      'resistances',
      'attributes',
      'defensive',
      'special',
      'type_filters',
      'equipment_filters',
      'req_filters',
      'map_filters',
      'misc_filters',
      'trade_filters',
    ]);
    const counts = index.counts();
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(index.entries.length);
    for (const group of FILTER_GROUPS) expect(counts[group.id]).toBeGreaterThan(0);
    expect(counts.type_filters).toBe(4);
  });

  it('names site sections without the "Filters" suffix', () => {
    expect(FILTER_GROUPS.find((group) => group.id === 'type_filters')?.title).toBe('Type');
    expect(FILTER_GROUPS.find((group) => group.id === 'map_filters')?.title).toBe('Endgame');
  });
});
