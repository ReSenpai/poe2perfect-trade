import { describe, expect, it } from 'vitest';
import { loadListings } from '../../../tests/fixtures/load';
import { DEFAULT_STATUS, normalizeQuery, queryKey, sameQuery } from './normalize';

const LIFE = 'explicit.stat_3299347043';

describe('normalizeQuery', () => {
  it('gives an empty query for anything that is not an object', () => {
    for (const raw of [null, undefined, 'x', 42, []]) {
      expect(normalizeQuery(raw)).toEqual({ status: { option: DEFAULT_STATUS }, stats: [], filters: {} });
    }
  });

  it('turns the page-state status string into the API form', () => {
    expect(normalizeQuery({ status: 'online' }).status).toEqual({ option: 'online' });
    expect(normalizeQuery({ status: { option: 'any' } }).status).toEqual({ option: 'any' });
    expect(normalizeQuery({ status: { option: null } }).status).toEqual({ option: DEFAULT_STATUS });
  });

  it('reads the fixture queries the same way whatever the status form', () => {
    const online = normalizeQuery(loadListings('listings-online').request.query);
    expect(online).toEqual({
      status: { option: 'online' },
      stats: [{ type: 'and', filters: [{ id: LIFE, value: { min: 70 } }] }],
      filters: { type_filters: { filters: { category: { option: 'armour.gloves' }, rarity: { option: 'rare' } } } },
    });
  });

  it('drops empty stat groups, filters without an id and empty values', () => {
    const query = normalizeQuery({
      stats: [
        { type: 'and', filters: [] },
        {
          type: 'and',
          filters: [
            { id: LIFE, value: { min: 70, max: null } },
            { id: 'explicit.stat_1', value: { min: '', max: undefined } },
            { value: { min: 1 } },
            { id: 'explicit.stat_2', disabled: false },
          ],
        },
      ],
    });
    expect(query.stats).toEqual([
      { type: 'and', filters: [{ id: LIFE, value: { min: 70 } }, { id: 'explicit.stat_1' }, { id: 'explicit.stat_2' }] },
    ]);
  });

  it('keeps logic groups with their own value, weights, options and disabled flags', () => {
    const groups = [
      { type: 'count', value: { min: 2 }, filters: [{ id: 'a', value: { min: 30 } }, { id: 'b', disabled: true }] },
      { type: 'weight', value: { min: 100 }, disabled: true, filters: [{ id: 'c', value: { weight: 2.5 } }] },
      { type: 'not', filters: [{ id: 'd', value: { option: 12 } }] },
    ];
    expect(normalizeQuery({ stats: groups }).stats).toEqual(groups);
  });

  it('reads numbers written as strings and falls back to an and group for unknown types', () => {
    expect(normalizeQuery({ stats: [{ type: 'xor', filters: [{ id: 'a', value: { min: '30', max: '4.5' } }] }] }).stats).toEqual([
      { type: 'and', filters: [{ id: 'a', value: { min: 30, max: 4.5 } }] },
    ]);
  });

  it('drops "Any" options, empty ranges and empty sections of fixed filters', () => {
    const query = normalizeQuery({
      filters: {
        type_filters: { filters: { category: { option: null }, rarity: { option: 'rare' }, ilvl: { min: 80, max: '' } } },
        misc_filters: { filters: { corrupted: { option: '' } } },
        trade_filters: { disabled: true, filters: { price: { option: 'divine', max: 5 }, account: { input: '' } } },
        req_filters: { filters: {} },
      },
    });
    expect(query.filters).toEqual({
      type_filters: { filters: { rarity: { option: 'rare' }, ilvl: { min: 80 } } },
      trade_filters: { disabled: true, filters: { price: { option: 'divine', max: 5 } } },
    });
  });

  it('keeps boolean options the site writes as strings', () => {
    const query = normalizeQuery({ filters: { misc_filters: { filters: { corrupted: { option: 'false' } } } } });
    expect(query.filters.misc_filters?.filters.corrupted).toEqual({ option: 'false' });
  });

  it('keeps name, type and fields it does not know about', () => {
    const query = normalizeQuery({ name: 'Andvarius', type: { option: 'Gold Ring', discriminator: 'x' }, term: 'ring', future: { a: 1 } });
    expect(query).toMatchObject({ name: 'Andvarius', type: { option: 'Gold Ring', discriminator: 'x' }, term: 'ring', future: { a: 1 } });
    expect(normalizeQuery({ name: '', type: '  ' })).not.toHaveProperty('name');
    expect(normalizeQuery({ name: '', type: '  ' })).not.toHaveProperty('type');
  });
});

describe('queryKey / sameQuery', () => {
  it('ignores key order and the status form', () => {
    const a = { status: 'online', filters: { type_filters: { filters: { rarity: { option: 'rare' }, ilvl: { min: 80 } } } } };
    const b = { filters: { type_filters: { filters: { ilvl: { min: 80 }, rarity: { option: 'rare' } } } }, status: { option: 'online' } };
    expect(queryKey(normalizeQuery(a))).toBe(queryKey(normalizeQuery(b)));
    expect(sameQuery(a, b)).toBe(true);
  });

  it('notices a changed value and the order of stat filters', () => {
    const base = { stats: [{ type: 'and', filters: [{ id: 'a', value: { min: 1 } }, { id: 'b' }] }] };
    expect(sameQuery(base, { stats: [{ type: 'and', filters: [{ id: 'a', value: { min: 2 } }, { id: 'b' }] }] })).toBe(false);
    expect(sameQuery(base, { stats: [{ type: 'and', filters: [{ id: 'b' }, { id: 'a', value: { min: 1 } }] }] })).toBe(false);
  });

  it('treats an empty group and no groups as the same query', () => {
    expect(sameQuery({ stats: [{ type: 'and', filters: [] }] }, {})).toBe(true);
  });
});
