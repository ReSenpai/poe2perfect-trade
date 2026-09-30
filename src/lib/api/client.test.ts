import { describe, expect, it, vi } from 'vitest';
import { loadListings } from '../../../tests/fixtures/load';
import { normalizeQuery } from '@/lib/query/normalize';
import { CATALOG_TTL_MS, type CatalogCache, createTradeClient, TradeApiError } from './client';

const QUERY = normalizeQuery(loadListings('listings-online').request.query);
const SEARCH = { id: 'H4sIabc', complexity: 9, result: Array.from({ length: 25 }, (_, i) => `h${i}`), total: 1135 };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function accountState(current: number, restricted = 0, hits = 3, period = 5) {
  return {
    'x-rate-limit-rules': 'Account',
    'x-rate-limit-account': `${hits}:${period}:60`,
    'x-rate-limit-account-state': `${current}:${period}:${restricted}`,
  };
}

function setup(respond: (url: string, init?: RequestInit) => Response | Promise<Response>, cache?: CatalogCache) {
  let time = 1_000_000;
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => respond(url, init));
  const sleep = vi.fn(async (ms: number) => {
    time += ms;
  });
  const client = createTradeClient({ fetchFn: fetchFn as unknown as typeof fetch, now: () => time, sleep, cache });
  return { client, fetchFn, sleep, advance: (ms: number) => (time += ms) };
}

async function error(promise: Promise<unknown>): Promise<TradeApiError> {
  try {
    await promise;
  } catch (caught) {
    if (caught instanceof TradeApiError) return caught;
    throw caught;
  }
  throw new Error('expected a TradeApiError');
}

describe('search', () => {
  it('posts the query with its sort to the league and returns the result', async () => {
    const { client, fetchFn } = setup(() => json(SEARCH, 200, accountState(1)));

    await expect(client.search('Forbidden Rites', QUERY, { price: 'asc' })).resolves.toEqual({
      id: 'H4sIabc',
      total: 1135,
      hashes: SEARCH.result,
      inexact: false,
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/trade2/search/poe2/Forbidden%20Rites');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(String(init?.body))).toEqual({ query: QUERY, sort: { price: 'asc' } });
  });

  it('refuses to search while the account window is full, without calling the site', async () => {
    const { client, fetchFn, advance } = setup(() => json(SEARCH, 200, accountState(3)));
    await client.search('Standard', QUERY);

    const blocked = await error(client.search('Standard', QUERY));
    expect(blocked).toMatchObject({ kind: 'rate-limited', retryAfter: 5 });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    advance(5_000);
    await client.search('Standard', QUERY);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('reports the seconds left, rounded up', async () => {
    const { client, advance } = setup(() => json(SEARCH, 200, accountState(3)));
    await client.search('Standard', QUERY);
    advance(3_200);
    expect(await error(client.search('Standard', QUERY))).toMatchObject({ retryAfter: 2 });
  });

  it('honours a restriction and a 429 with Retry-After', async () => {
    const { client, fetchFn, advance } = setup(() => json({ error: { code: 3, message: 'Rate limit exceeded' } }, 429, { 'Retry-After': '30', ...accountState(4, 30) }));

    expect(await error(client.search('Standard', QUERY))).toMatchObject({ kind: 'rate-limited', retryAfter: 30 });
    expect(await error(client.search('Standard', QUERY))).toMatchObject({ kind: 'rate-limited', retryAfter: 30 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    advance(30_000);
    await error(client.search('Standard', QUERY));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('keeps search and fetch limits apart', async () => {
    const { client, fetchFn } = setup((url) => (url.includes('/search/') ? json(SEARCH, 200, accountState(3)) : json({ result: [] }, 200, accountState(1, 0, 6, 4))));
    await client.search('Standard', QUERY);
    await client.fetchListings(['h1'], 'H4sIabc');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, { error: { code: 2, message: 'Unknown stat provided' } }, { kind: 'bad-query', message: 'Unknown stat provided', status: 400 }],
    [401, { error: { code: 8, message: 'Unauthorized' } }, { kind: 'unauthorized', status: 401 }],
    [403, { error: { code: 6, message: 'Forbidden' } }, { kind: 'unauthorized', status: 403 }],
    [500, { error: { code: 1, message: 'Internal' } }, { kind: 'server', status: 500 }],
  ])('maps HTTP %i to a typed error', async (status, body, expected) => {
    const { client } = setup(() => json(body, status));
    expect(await error(client.search('Standard', QUERY))).toMatchObject(expected);
  });

  it('maps a non-JSON error page to a server error', async () => {
    const { client } = setup(() => new Response('<html>maintenance</html>', { status: 503 }));
    expect(await error(client.search('Standard', QUERY))).toMatchObject({ kind: 'server', status: 503 });
  });

  it('maps the site verification page (Cloudflare) to verification, not to a sign-in problem', async () => {
    const page = () => new Response('<html>Just a moment…</html>', { status: 403, headers: { 'Content-Type': 'text/html' } });
    expect(await error(setup(page).client.search('Standard', QUERY))).toMatchObject({ kind: 'verification', status: 403 });
    const challenge = () => new Response('<html></html>', { status: 503, headers: { 'Content-Type': 'text/html', 'cf-mitigated': 'challenge' } });
    expect(await error(setup(challenge).client.search('Standard', QUERY))).toMatchObject({ kind: 'verification', status: 503 });
  });

  it('maps a failed request to a network error', async () => {
    const { client } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await error(client.search('Standard', QUERY))).toMatchObject({ kind: 'network', message: 'Failed to fetch' });
  });
});

describe('fetchListings', () => {
  const fixture = loadListings('listings-online').listings;

  it('fetches in batches of 10 with the query id and keeps the order', async () => {
    const { client, fetchFn } = setup((url) => {
      const hashes = url.split('/fetch/')[1]!.split('?')[0]!.split(',');
      return json({ result: hashes.map((hash) => ({ ...fixture[0]!, id: hash })) });
    });

    const listings = await client.fetchListings(SEARCH.result, 'H4sIabc');

    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      `/api/trade2/fetch/${SEARCH.result.slice(0, 10).join(',')}?query=H4sIabc`,
      `/api/trade2/fetch/${SEARCH.result.slice(10, 20).join(',')}?query=H4sIabc`,
      `/api/trade2/fetch/${SEARCH.result.slice(20).join(',')}?query=H4sIabc`,
    ]);
    expect(listings.map((entry) => entry.id)).toEqual(SEARCH.result);
  });

  it('asks the server for the pseudo totals of the search, as the site does', async () => {
    const { client, fetchFn } = setup(() => json({ result: [fixture[0]] }));
    await client.fetchListings(['a'], 'H4sIabc', { pseudos: ['pseudo.pseudo_total_life', 'pseudo.pseudo_total_fire_resistance'] });
    expect(fetchFn.mock.calls[0]![0]).toBe('/api/trade2/fetch/a?query=H4sIabc&pseudos[]=pseudo.pseudo_total_life&pseudos[]=pseudo.pseudo_total_fire_resistance');
  });

  it('drops listings that are gone (null entries)', async () => {
    const { client } = setup(() => json({ result: [null, fixture[1]] }));
    expect(await client.fetchListings(['a', 'b'], 'q')).toEqual([fixture[1]]);
  });

  it('waits for a full fetch window instead of failing', async () => {
    const { client, fetchFn, sleep } = setup(() => json({ result: [] }, 200, accountState(6, 0, 6, 4)));
    await client.fetchListings(SEARCH.result.slice(0, 20), 'q');
    expect(sleep).toHaveBeenCalledWith(4_000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('gives up with rate-limited when the wait is too long', async () => {
    const { client, fetchFn } = setup(() => json({ result: [] }, 200, accountState(7, 60, 6, 4)));
    expect(await error(client.fetchListings(SEARCH.result.slice(0, 20), 'q'))).toMatchObject({ kind: 'rate-limited', retryAfter: 60 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does nothing for no hashes', async () => {
    const { client, fetchFn } = setup(() => json({ result: [] }));
    expect(await client.fetchListings([], 'q')).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('getCatalog', () => {
  function memoryCache(initial: Record<string, unknown> = {}) {
    const store = new Map(Object.entries(initial));
    return {
      store,
      cache: {
        get: vi.fn(async (key: string) => store.get(key)),
        set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
      } satisfies CatalogCache,
    };
  }

  const STATS = { result: [{ id: 'pseudo', label: 'Pseudo', entries: [] }] };

  it('downloads a catalog once and then serves it from the cache', async () => {
    const { cache, store } = memoryCache();
    const { client, fetchFn } = setup(() => json(STATS), cache);

    await expect(client.getCatalog('stats')).resolves.toEqual(STATS);
    await expect(client.getCatalog('stats')).resolves.toEqual(STATS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]![0]).toBe('/api/trade2/data/stats');
    expect(store.get('catalog:stats')).toEqual({ savedAt: 1_000_000, data: STATS });
  });

  it('downloads again when the cached copy is older than the TTL', async () => {
    const { cache } = memoryCache({ 'catalog:stats': { savedAt: 1_000_000 - CATALOG_TTL_MS - 1, data: { result: [] } } });
    const { client, fetchFn } = setup(() => json(STATS), cache);
    await expect(client.getCatalog('stats')).resolves.toEqual(STATS);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to a stale copy when the download fails', async () => {
    const stale = { result: [{ id: 'old', label: 'Old', entries: [] }] };
    const { cache } = memoryCache({ 'catalog:stats': { savedAt: 0, data: stale } });
    const { client } = setup(() => new Response('', { status: 503 }), cache);
    await expect(client.getCatalog('stats')).resolves.toEqual(stale);
  });

  it('ignores a broken cache entry and works without a cache', async () => {
    const { cache } = memoryCache({ 'catalog:stats': 'garbage' });
    await expect(setup(() => json(STATS), cache).client.getCatalog('stats')).resolves.toEqual(STATS);
    await expect(setup(() => json(STATS)).client.getCatalog('stats')).resolves.toEqual(STATS);
  });

  it('shares one download between parallel calls', async () => {
    const { client, fetchFn } = setup(() => json(STATS));
    await Promise.all([client.getCatalog('stats'), client.getCatalog('stats')]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('whisper', () => {
  it('posts the token of the listing to the whisper endpoint', async () => {
    const { client, fetchFn } = setup(() => json({ success: true }));
    expect(await client.whisper('tok')).toBe('sent');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/trade2/whisper');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(init!.body))).toEqual({ token: 'tok' });
  });

  it('says when the item is in demand, and asks to continue on the next try', async () => {
    const { client, fetchFn } = setup(() => json({ success: false }));
    expect(await client.whisper('tok')).toBe('in-demand');
    await client.whisper('tok', { continue: true });
    expect(JSON.parse(String(fetchFn.mock.calls[1]![1]!.body))).toEqual({ token: 'tok', continue: true });
  });

  it('passes the message of a refusal on', async () => {
    const { client } = setup(() => json({ error: { code: 3, message: 'Character not online' } }, 400));
    expect(await error(client.whisper('tok'))).toMatchObject({ kind: 'bad-query', message: 'Character not online' });
  });
});

describe('request headers', () => {
  it('sends the headers the site itself sends with every API call (the whisper endpoint refuses without them)', async () => {
    const { client, fetchFn } = setup((url) => (url.endsWith('/whisper') ? json({ success: true }) : json(SEARCH)));
    await client.search('Standard', QUERY);
    await client.whisper('tok');
    for (const [, init] of fetchFn.mock.calls) {
      expect(new Headers(init!.headers).get('X-Requested-With')).toBe('XMLHttpRequest');
      expect(new Headers(init!.headers).get('Accept')).toBe('application/json');
    }
    expect(new Headers(fetchFn.mock.calls[1]![1]!.headers).get('Content-Type')).toBe('application/json');
  });
});
