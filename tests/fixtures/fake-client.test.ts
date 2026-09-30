import { describe, expect, it } from 'vitest';
import { TradeApiError } from '@/lib/api/client';
import { normalizeQuery } from '@/lib/query/normalize';
import { createFakeClient } from './fake-client';

const QUERY = normalizeQuery({ status: 'online' });

describe('createFakeClient', () => {
  it('answers a normal search with the fixture hashes and fetches its listings', async () => {
    const client = createFakeClient('normal');
    const found = await client.search('Forbidden Rites', QUERY);
    expect(found.total).toBeGreaterThan(0);
    expect(found.hashes.length).toBeGreaterThan(0);
    const listings = await client.fetchListings(found.hashes.slice(0, 3), found.id);
    expect(listings.map((entry) => entry.id)).toEqual(found.hashes.slice(0, 3));
  });

  it('finds nothing for empty', async () => {
    expect(await createFakeClient('empty').search('Forbidden Rites', QUERY)).toMatchObject({ total: 0, hashes: [] });
  });

  it('drops the listings that are gone for null-listing', async () => {
    const client = createFakeClient('null-listing');
    const found = await client.search('Forbidden Rites', QUERY);
    const listings = await client.fetchListings(found.hashes.slice(0, 10), found.id);
    expect(listings.length).toBeLessThan(10);
  });

  it('mixes price currencies for mixed-currency', async () => {
    const client = createFakeClient('mixed-currency');
    const found = await client.search('Forbidden Rites', QUERY);
    const currencies = new Set((await client.fetchListings(found.hashes.slice(0, 10), found.id)).map((entry) => entry.listing.price?.currency));
    expect(currencies.size).toBeGreaterThan(1);
  });

  it.each([
    ['rate-limited', 'rate-limited', 42],
    ['verification', 'verification', null],
    ['network', 'network', null],
  ] as const)('fails the search the way the client does for %s', async (scenario, kind, retryAfter) => {
    const error = await createFakeClient(scenario)
      .search('Forbidden Rites', QUERY)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TradeApiError);
    expect(error).toMatchObject({ kind, retryAfter });
  });

  it('searches but fails to load more for fetch-error', async () => {
    const client = createFakeClient('fetch-error');
    const found = await client.search('Forbidden Rites', QUERY);
    expect(await client.fetchListings(found.hashes.slice(0, 10), found.id)).toHaveLength(10);
    await expect(client.fetchListings(found.hashes.slice(10, 20), found.id)).rejects.toBeInstanceOf(TradeApiError);
  });

  it('holds the search until released for slow', async () => {
    const client = createFakeClient('slow');
    let done = false;
    const search = client.search('Forbidden Rites', QUERY).then(() => (done = true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(done).toBe(false);
    client.release();
    await search;
    expect(done).toBe(true);
  });
});
