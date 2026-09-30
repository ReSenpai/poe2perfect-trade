import { describe, expect, it, vi } from 'vitest';
import type { TradeClient } from '@/lib/api/client';
import type { RawFetchEntry } from '@/lib/api/raw';
import { normalizeQuery } from '@/lib/query/normalize';
import { captureListingsFixture, summarizeFixture, type ListingsFixture } from './fixture';

const QUERY = { status: { option: 'online' }, stats: [{ type: 'and', filters: [] }] };
const HASHES = Array.from({ length: 25 }, (_, i) => `hash-${i}`);
const NOW = () => new Date('2026-09-18T07:00:00.000Z');

function listing(i: number): RawFetchEntry {
  return {
    id: `hash-${i}`,
    listing: {
      method: 'psapi',
      indexed: '2026-09-18T04:00:00Z',
      stash: { name: 'Tab', x: 0, y: 0 },
      whisper: '@Char hi',
      whisper_token: 'token',
      account: { name: `Account${i}`, online: null, lastCharacterName: 'Char' },
      price: { type: '~price', amount: i, currency: 'exalted' },
    },
    item: { name: '', typeLine: 'Gold Ring', baseType: 'Gold Ring', rarity: 'Normal', ilvl: 80 },
  };
}

function fakeClient(hashes = HASHES) {
  return {
    search: vi.fn(async () => ({ id: 'H4sIencoded', total: hashes.length ? 1137 : 0, hashes, inexact: false })),
    fetchListings: vi.fn(async (batch: string[]) => batch.map((hash) => listing(Number(hash.split('-')[1])))),
    getCatalog: vi.fn(),
  } satisfies Pick<TradeClient, 'search' | 'fetchListings' | 'getCatalog'>;
}

describe('captureListingsFixture', () => {
  it('runs one search and one fetch of the first 10 listings', async () => {
    const client = fakeClient();
    await captureListingsFixture({ league: 'Forbidden Rites', query: QUERY, client, now: NOW });

    expect(client.search).toHaveBeenCalledWith('Forbidden Rites', normalizeQuery(QUERY), { price: 'asc' });
    expect(client.fetchListings).toHaveBeenCalledExactlyOnceWith(HASHES.slice(0, 10), 'H4sIencoded');
  });

  it('returns a scrubbed fixture named after the listing status', async () => {
    const result = await captureListingsFixture({ league: 'Forbidden Rites', query: QUERY, client: fakeClient(), now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileName).toBe('listings-online.json');
    expect(result.fixture.meta).toEqual({ league: 'Forbidden Rites', capturedAt: '2026-09-18T07:00:00.000Z' });
    expect(result.fixture.request).toEqual({ query: normalizeQuery(QUERY), sort: { price: 'asc' } });
    expect(result.fixture.search).toEqual({ id: 'H4sIencoded', total: 1137, result: HASHES });
    expect(result.fixture.listings).toHaveLength(10);
    expect(JSON.stringify(result.fixture)).not.toContain('Account');
  });

  it('reads the status the way the page state writes it (a plain string)', async () => {
    const query = { ...QUERY, status: 'securable' };
    const result = await captureListingsFixture({ league: 'Forbidden Rites', query, client: fakeClient(), now: NOW });
    expect(result).toMatchObject({ ok: true, fileName: 'listings-securable.json' });
  });

  it('skips the fetch when nothing is found', async () => {
    const client = fakeClient([]);
    const result = await captureListingsFixture({ league: 'Standard', query: QUERY, client, now: NOW });

    expect(client.fetchListings).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, fixture: { listings: [] } });
  });

  it('reports a failed request', async () => {
    const client = fakeClient();
    client.search.mockRejectedValue(new Error('Too many requests, retry in 5 s'));
    const result = await captureListingsFixture({ league: 'Standard', query: QUERY, client, now: NOW });
    expect(result).toEqual({ ok: false, message: 'API request failed: Too many requests, retry in 5 s' });
  });

  it('reports a page without a search', async () => {
    const result = await captureListingsFixture({ league: 'Standard', query: null, client: fakeClient(), now: NOW });
    expect(result).toEqual({ ok: false, message: 'No search query on this page' });
  });
});

describe('summarizeFixture', () => {
  it('names league, totals and prices', () => {
    const fixture: ListingsFixture = {
      meta: { league: 'Forbidden Rites', capturedAt: '' },
      request: { query: QUERY, sort: { price: 'asc' } },
      search: { id: 'x', total: 1137, result: HASHES },
      listings: [listing(1), listing(2)],
    };
    expect(summarizeFixture(fixture)).toBe('Forbidden Rites · found: 1137 · listings: 2');
  });
});
