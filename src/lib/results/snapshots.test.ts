import { describe, expect, it } from 'vitest';
import { parseListing } from '@/lib/listing/parse';
import { normalizeQuery } from '@/lib/query/normalize';
import { loadListings } from '../../../tests/fixtures/load';
import { findSnapshot, type ResultsSnapshot, rememberSnapshot } from './snapshots';

const GLOVES = normalizeQuery({ status: { option: 'online' }, filters: { type_filters: { filters: { category: { option: 'armour.gloves' } } } } });
const RINGS = normalizeQuery({ status: { option: 'online' }, filters: { type_filters: { filters: { category: { option: 'accessory.ring' } } } } });

function snapshot(overrides: Partial<ResultsSnapshot> = {}): ResultsSnapshot {
  return { league: 'Forbidden Rites', query: GLOVES, sort: { price: 'asc' }, id: 'H4sIgloves', total: 25, hashes: ['a', 'b'], listings: [], savedAt: 1000, ...overrides };
}

describe('findSnapshot', () => {
  it('finds the results of the same league, query and sort', () => {
    const saved = snapshot();
    expect(findSnapshot([saved], 'Forbidden Rites', normalizeQuery(structuredClone(GLOVES)), { price: 'asc' })).toBe(saved);
  });

  it('does not take the results of another league, query or sort for these', () => {
    const list = [snapshot()];
    expect(findSnapshot(list, 'Standard', GLOVES, { price: 'asc' })).toBeNull();
    expect(findSnapshot(list, 'Forbidden Rites', RINGS, { price: 'asc' })).toBeNull();
    expect(findSnapshot(list, 'Forbidden Rites', GLOVES, { price: 'desc' })).toBeNull();
  });
});

describe('rememberSnapshot', () => {
  it('puts the newest first and replaces the older results of the same search', () => {
    const older = snapshot({ savedAt: 1 });
    const rings = snapshot({ query: RINGS, id: 'H4sIrings', savedAt: 2 });
    const newer = snapshot({ total: 30, savedAt: 3 });
    expect(rememberSnapshot([rings, older], newer)).toEqual([newer, rings]);
  });

  it('keeps a limited number of searches', () => {
    let list: ResultsSnapshot[] = [];
    for (let i = 0; i < 7; i++) list = rememberSnapshot(list, snapshot({ league: `L${i}`, savedAt: i }), 5);
    expect(list.map((saved) => saved.league)).toEqual(['L6', 'L5', 'L4', 'L3', 'L2']);
  });
});

describe('rememberSnapshot and trade tokens', () => {
  it('never stores the trade tokens of the listings', () => {
    const listings = loadListings('listings-rings').listings.map(parseListing);
    expect(listings[0]!.tokens).toBeDefined();
    const [saved] = rememberSnapshot([], snapshot({ listings }));
    expect(saved!.listings.every((listing) => listing.tokens === undefined)).toBe(true);
    expect(JSON.stringify(saved)).not.toContain('scrubbed');
  });
});
