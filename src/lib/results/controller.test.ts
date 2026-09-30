import { describe, expect, it, vi } from 'vitest';
import { TradeApiError, type TradeClient } from '@/lib/api/client';
import type { RawFetchEntry } from '@/lib/api/raw';
import { normalizeQuery } from '@/lib/query/normalize';
import { loadListings } from '../../../tests/fixtures/load';
import { createResultsController, type ResultsState } from './controller';

const QUERY = normalizeQuery({ status: 'online' });
const ENTRIES = loadListings('listings-online').listings;
const HASHES = Array.from({ length: 25 }, (_, i) => `h${i}`);

function entryFor(hash: string): RawFetchEntry {
  return { ...ENTRIES[Number(hash.slice(1)) % ENTRIES.length]!, id: hash };
}

function fakeClient(overrides: Partial<Pick<TradeClient, 'search' | 'fetchListings'>> = {}) {
  return {
    search: vi.fn(async () => ({ id: 'H4sIq', total: 1135, hashes: HASHES, inexact: false })),
    fetchListings: vi.fn(async (hashes: string[], _queryId: string, _options?: { pseudos?: readonly string[] }) => hashes.map(entryFor)),
    ...overrides,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const ids = (state: ResultsState) => (state.status === 'ready' ? state.listings.map((listing) => listing.id) : []);

describe('createResultsController', () => {
  it('starts idle, searches and shows the first 10 listings', async () => {
    const client = fakeClient();
    const results = createResultsController(client);
    const seen: string[] = [];
    results.subscribe((state) => seen.push(state.status));
    expect(results.getState()).toEqual({ status: 'idle' });

    await results.search('Forbidden Rites', QUERY, { price: 'asc' });

    expect(client.search).toHaveBeenCalledWith('Forbidden Rites', QUERY, { price: 'asc' });
    expect(client.fetchListings).toHaveBeenCalledWith(HASHES.slice(0, 10), 'H4sIq', { pseudos: [] });
    expect(seen).toEqual(['searching', 'ready']);
    expect(results.getState()).toMatchObject({ status: 'ready', id: 'H4sIq', total: 1135, hasMore: true, loadingMore: false });
    expect(ids(results.getState())).toEqual(HASHES.slice(0, 10));
  });

  it('loads 10 more at a time until the found hashes run out', async () => {
    const client = fakeClient();
    const results = createResultsController(client);
    await results.search('Standard', QUERY);

    const loading = results.loadMore();
    expect(results.getState()).toMatchObject({ loadingMore: true });
    await loading;
    expect(ids(results.getState())).toEqual(HASHES.slice(0, 20));

    await results.loadMore();
    expect(ids(results.getState())).toEqual(HASHES);
    expect(results.getState()).toMatchObject({ hasMore: false });

    await results.loadMore();
    expect(client.fetchListings).toHaveBeenCalledTimes(3);
  });

  it('does not load the same page twice when asked again while loading', async () => {
    const client = fakeClient();
    const results = createResultsController(client);
    await results.search('Standard', QUERY);
    await Promise.all([results.loadMore(), results.loadMore()]);
    expect(client.fetchListings).toHaveBeenCalledTimes(2);
  });

  it('shows an empty result without fetching', async () => {
    const client = fakeClient({ search: vi.fn(async () => ({ id: 'H4sIe', total: 0, hashes: [], inexact: false })) });
    const results = createResultsController(client);
    await results.search('Standard', QUERY);
    expect(client.fetchListings).not.toHaveBeenCalled();
    expect(results.getState()).toMatchObject({ status: 'ready', total: 0, listings: [], hasMore: false });
  });

  it('reports a failed search with its kind and wait', async () => {
    const client = fakeClient({
      search: vi.fn(async () => {
        throw new TradeApiError('rate-limited', 'Too many requests, retry in 4 s', { retryAfter: 4 });
      }),
    });
    const results = createResultsController(client);
    await results.search('Standard', QUERY);
    expect(results.getState()).toEqual({ status: 'error', kind: 'rate-limited', message: 'Too many requests, retry in 4 s', retryAfter: 4 });
  });

  it('keeps the listings it has when loading more fails', async () => {
    const fetchListings = vi.fn(async (hashes: string[]) => hashes.map(entryFor));
    const results = createResultsController(fakeClient({ fetchListings }));
    await results.search('Standard', QUERY);
    fetchListings.mockRejectedValueOnce(new Error('offline'));
    await results.loadMore();
    expect(results.getState()).toMatchObject({ status: 'ready', loadingMore: false, moreError: 'offline' });
    expect(ids(results.getState())).toHaveLength(10);
  });

  it('drops the answer of a search that was replaced by a newer one', async () => {
    let finishFirst!: () => void;
    const search = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = () => resolve({ id: 'H4sIold', total: 1, hashes: ['h1'], inexact: false }))))
      .mockImplementationOnce(async () => ({ id: 'H4sInew', total: 2, hashes: ['h2', 'h3'], inexact: false }));
    const results = createResultsController(fakeClient({ search }));

    const first = results.search('Standard', QUERY);
    await results.search('Standard', normalizeQuery({ status: 'any' }));
    finishFirst();
    await first;
    await flush();

    expect(results.getState()).toMatchObject({ status: 'ready', id: 'H4sInew' });
  });

  it('does not search twice for the same search while it is still running', async () => {
    const client = fakeClient();
    const results = createResultsController(client);
    const first = results.search('Forbidden Rites', QUERY, { price: 'asc' });
    const second = results.search('Forbidden Rites', normalizeQuery({ status: 'online' }), { price: 'asc' });
    await Promise.all([first, second]);
    expect(client.search).toHaveBeenCalledTimes(1);

    await results.search('Forbidden Rites', QUERY, { price: 'asc' });
    expect(client.search).toHaveBeenCalledTimes(2);
  });

  it('searches again for another sort even while a search runs', async () => {
    const client = fakeClient();
    const results = createResultsController(client);
    await Promise.all([results.search('Forbidden Rites', QUERY, { price: 'asc' }), results.search('Forbidden Rites', QUERY, { price: 'desc' })]);
    expect(client.search).toHaveBeenCalledTimes(2);
  });

  it('hands out what a snapshot needs and shows a restored one without any request', async () => {
    const client = fakeClient();
    const results = createResultsController(client);
    expect(results.snapshot()).toBeNull();
    await results.search('Forbidden Rites', QUERY, { price: 'asc' });
    const saved = results.snapshot()!;
    expect(saved).toMatchObject({ id: 'H4sIq', total: 1135, hashes: HASHES });
    expect(saved.listings).toHaveLength(10);

    const restored = createResultsController(client);
    restored.restore({ ...saved, savedAt: 5000 });
    expect(restored.getState()).toMatchObject({ status: 'ready', id: 'H4sIq', total: 1135, hasMore: true, savedAt: 5000 });
    expect(ids(restored.getState())).toEqual(HASHES.slice(0, 10));
    expect(client.search).toHaveBeenCalledTimes(1);

    await restored.loadMore();
    expect(client.fetchListings).toHaveBeenLastCalledWith(HASHES.slice(10, 20), 'H4sIq', { pseudos: [] });
    expect(ids(restored.getState())).toHaveLength(20);
  });

  it('goes back to idle on reset and drops a search still running', async () => {
    const results = createResultsController(fakeClient());
    const running = results.search('Forbidden Rites', QUERY, { price: 'asc' });
    results.reset();
    await running;
    expect(results.getState()).toEqual({ status: 'idle' });
  });

  it('asks for the pseudo totals of the enabled pseudo filters, on every page', async () => {
    const client = fakeClient();
    const results = createResultsController(client);
    const query = normalizeQuery({
      status: 'online',
      stats: [
        { type: 'and', filters: [{ id: 'pseudo.pseudo_total_life', value: { min: 80 } }, { id: 'explicit.stat_1' }, { id: 'pseudo.pseudo_total_mana', disabled: true }] },
        { type: 'count', value: { min: 1 }, filters: [{ id: 'pseudo.pseudo_total_fire_resistance' }] },
        { type: 'not', filters: [{ id: 'pseudo.pseudo_total_cold_resistance' }] },
      ],
    });
    await results.search('Forbidden Rites', query);
    await results.loadMore();
    const expected = { pseudos: ['pseudo.pseudo_total_life', 'pseudo.pseudo_total_fire_resistance'] };
    expect(vi.mocked(client.fetchListings).mock.calls.map((call) => call[2])).toEqual([expected, expected]);
  });

  it('keeps the shown results on screen while a new search runs', async () => {
    let release!: () => void;
    const search = vi
      .fn()
      .mockImplementationOnce(async () => ({ id: 'H4sIq', total: 1135, hashes: HASHES, inexact: false }))
      .mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ id: 'H4sInew', total: 3, hashes: ['h1'], inexact: false }))));
    const results = createResultsController(fakeClient({ search }));
    await results.search('Standard', QUERY);
    const running = results.search('Standard', normalizeQuery({ status: 'any' }));
    expect(results.getState()).toMatchObject({ status: 'searching', previous: { status: 'ready', id: 'H4sIq' } });
    release();
    await running;
    expect(results.getState()).toMatchObject({ status: 'ready', id: 'H4sInew' });
  });

  it('has no previous results to keep before the first search', () => {
    const results = createResultsController(fakeClient());
    void results.search('Standard', QUERY);
    expect(results.getState()).toEqual({ status: 'searching' });
  });
});
