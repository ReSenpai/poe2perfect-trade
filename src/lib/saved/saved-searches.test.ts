import { describe, expect, it } from 'vitest';
import { addSavedSearch, freeName, readSavedSearches, removeSavedSearch, replaceSavedSearch, SAVED_LIMIT, type SavedSearch, savedByName } from './saved-searches';

const NOW = Date.parse('2026-09-24T12:00:00Z');
const QUERY = { status: { option: 'online' }, stats: [{ type: 'weight', value: { min: 5 }, filters: [{ id: 'explicit.stat_1', value: { weight: 2 } }] }], unknownField: { kept: true } };
const input = (name: string) => ({ name, league: 'Forbidden Rites', query: QUERY, sort: { price: 'asc' as const } });

describe('saved searches', () => {
  it('keeps a search as it is, unknown fields included, newest first', () => {
    const first = addSavedSearch([], input('Rings'), NOW, 'a');
    const both = addSavedSearch(first, input('Gloves'), NOW + 1000, 'b');
    expect(both.map((entry) => entry.name)).toEqual(['Gloves', 'Rings']);
    expect(both[1]).toEqual({ id: 'a', name: 'Rings', version: 1, league: 'Forbidden Rites', query: QUERY, sort: { price: 'asc' }, savedAt: NOW });
  });

  it('never overwrites quietly: adding keeps a search of the same name', () => {
    const list = addSavedSearch([], input('Rings'), NOW, 'a');
    expect(addSavedSearch(list, input('Rings'), NOW + 1, 'b').map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('finds a search by its name, any case, any spaces around', () => {
    const list = addSavedSearch(addSavedSearch([], input('Rings'), NOW, 'a'), input('Gloves'), NOW + 1, 'b');
    expect(savedByName(list, ' rings ')?.id).toBe('a');
    expect(savedByName(list, 'Boots')).toBeUndefined();
  });

  it('replaces a chosen search, moving it to the top', () => {
    const list = addSavedSearch(addSavedSearch([], input('Rings'), NOW, 'a'), input('Gloves'), NOW + 1, 'b');
    const again = replaceSavedSearch(list, 'a', { ...input(' rings '), league: 'Standard' }, NOW + 2, 'c');
    expect(again.map((entry) => [entry.id, entry.name, entry.league])).toEqual([
      ['c', 'rings', 'Standard'],
      ['b', 'Gloves', 'Forbidden Rites'],
    ]);
  });

  it('offers a free name next to a taken one: Rings (2), then Rings (3)', () => {
    let list = addSavedSearch([], input('Rings'), NOW, 'a');
    expect(freeName(list, 'Rings')).toBe('Rings (2)');
    list = addSavedSearch(list, input('Rings (2)'), NOW + 1, 'b');
    expect(freeName(list, 'rings')).toBe('rings (3)');
  });

  it('keeps at most the limit, dropping the oldest', () => {
    let list: SavedSearch[] = [];
    for (let index = 0; index <= SAVED_LIMIT; index++) list = addSavedSearch(list, input(`Search ${index}`), NOW + index, `id${index}`);
    expect(list).toHaveLength(SAVED_LIMIT);
    expect(list.at(-1)!.name).toBe('Search 1');
  });

  it('removes one by id', () => {
    const list = addSavedSearch(addSavedSearch([], input('Rings'), NOW, 'a'), input('Gloves'), NOW, 'b');
    expect(removeSavedSearch(list, 'a').map((entry) => entry.id)).toEqual(['b']);
  });

  it('reads back only well-formed searches of this version', () => {
    const good = addSavedSearch([], input('Rings'), NOW, 'a')[0]!;
    expect(readSavedSearches([good, { ...good, id: 'x', version: 2 }, { name: 'broken' }, null, 'text'])).toEqual([good]);
    expect(readSavedSearches(undefined)).toEqual([]);
  });
});
