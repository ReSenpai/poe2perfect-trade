import type { TradeQuery } from '@/lib/query/model';
import { parseRateLimit, waitMs } from './rate-limit';
import type { RawFetchEntry, RawSearchResponse } from './raw';

const BASE = '/api/trade2/';
/** The fetch endpoint takes at most 10 listings per request. */
const FETCH_SIZE = 10;
/** Reference data is cached by the CDN for 4 hours; we keep our copy as long. */
export const CATALOG_TTL_MS = 4 * 60 * 60 * 1000;
/** Fetch windows are a few seconds long: waiting that out beats failing. Longer lockouts are reported. */
const MAX_FETCH_WAIT_MS = 15_000;

export type CatalogName = 'leagues' | 'stats' | 'filters' | 'static' | 'items';

/** `verification`: the site answered with its check page (Cloudflare), not with an API error. */
export type TradeApiErrorKind = 'rate-limited' | 'unauthorized' | 'verification' | 'bad-query' | 'server' | 'network';

export class TradeApiError extends Error {
  readonly kind: TradeApiErrorKind;
  readonly status: number | null;
  /** Seconds until the request may be repeated (rate-limited only). */
  readonly retryAfter: number | null;

  constructor(kind: TradeApiErrorKind, message: string, { status = null, retryAfter = null }: { status?: number | null; retryAfter?: number | null } = {}) {
    super(message);
    this.name = 'TradeApiError';
    this.kind = kind;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export interface SearchResult {
  /** The encoded query: goes into the page URL and into fetch requests. */
  id: string;
  /** Capped at 10000 by the site. */
  total: number;
  /** Up to 100 listing hashes, in sort order. */
  hashes: string[];
  inexact: boolean;
}

export type SearchSort = Record<string, 'asc' | 'desc'>;

/** Key-value storage for reference data (chrome.storage.local in the extension). */
export interface CatalogCache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface TradeClient {
  search(league: string, query: TradeQuery, sort?: SearchSort): Promise<SearchResult>;
  /** `pseudos`: pseudo stat ids whose totals the server adds to each item (`item.pseudoMods`), as the site asks. */
  fetchListings(hashes: string[], queryId: string, options?: { pseudos?: readonly string[] }): Promise<RawFetchEntry[]>;
  getCatalog<T = unknown>(name: CatalogName): Promise<T>;
  /**
   * Travel to hideout (a `hideout_token`) or Direct whisper (a `whisper_token`): acts in the user's game, so only on
   * their click. `in-demand`: the site says to try again, then with `continue`.
   */
  whisper(token: string, options?: { continue?: boolean }): Promise<'sent' | 'in-demand'>;
}

type Endpoint = 'search' | 'fetch' | 'data' | 'whisper';

/**
 * api/trade2 client. Tracks the rate limit state the site reports per endpoint: a search that would go over is refused
 * with `rate-limited` (the UI shows a countdown), fetches wait for short windows.
 */
export function createTradeClient({
  fetchFn,
  now = Date.now,
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  cache,
}: {
  fetchFn: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  cache?: CatalogCache;
}): TradeClient {
  const blockedUntil: Record<Endpoint, number> = { search: 0, fetch: 0, data: 0, whisper: 0 };
  const catalogDownloads = new Map<CatalogName, Promise<unknown>>();

  function rateLimited(endpoint: Endpoint): TradeApiError {
    const seconds = Math.ceil((blockedUntil[endpoint] - now()) / 1000);
    return new TradeApiError('rate-limited', `Too many requests, retry in ${seconds} s`, { retryAfter: seconds });
  }

  async function request<T>(endpoint: Endpoint, path: string, init?: RequestInit): Promise<T> {
    if (blockedUntil[endpoint] > now()) throw rateLimited(endpoint);

    let response: Response;
    try {
      // The site sends these with every call; the whisper endpoint (Travel to hideout) answers 403 without them.
      const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(init?.headers as Record<string, string> | undefined) };
      response = await fetchFn(BASE + path, { ...init, headers, credentials: 'same-origin' });
    } catch (error) {
      throw new TradeApiError('network', error instanceof Error ? error.message : String(error));
    }

    const limits = parseRateLimit(response.headers);
    let wait = limits ? waitMs(limits) : 0;
    const retryAfter = Number(response.headers.get('retry-after'));
    if (response.status === 429 && retryAfter > 0) wait = Math.max(wait, retryAfter * 1000);
    if (wait > 0) blockedUntil[endpoint] = Math.max(blockedUntil[endpoint], now() + wait);

    if (response.ok) return (await response.json()) as T;

    let message = `HTTP ${response.status}`;
    const html = (response.headers.get('content-type') ?? '').includes('text/html');
    if (html && (response.status === 403 || response.headers.get('cf-mitigated') === 'challenge')) {
      throw new TradeApiError('verification', 'The trade site asks for a verification', { status: response.status });
    }
    try {
      const body = (await response.json()) as { error?: { message?: unknown } };
      if (typeof body.error?.message === 'string') message = body.error.message;
    } catch {
      // Not JSON (Cloudflare or maintenance pages): the status is all there is.
    }
    const status = response.status;
    if (status === 429) throw blockedUntil[endpoint] > now() ? rateLimited(endpoint) : new TradeApiError('rate-limited', message, { status, retryAfter: 1 });
    if (status === 400) throw new TradeApiError('bad-query', message, { status });
    if (status === 401 || status === 403) throw new TradeApiError('unauthorized', message, { status });
    throw new TradeApiError('server', message, { status });
  }

  async function downloadCatalog(name: CatalogName): Promise<unknown> {
    const key = `catalog:${name}`;
    const cached = cache ? readCacheEntry(await cache.get(key)) : null;
    if (cached && now() - cached.savedAt <= CATALOG_TTL_MS) return cached.data;
    try {
      const data = await request<unknown>('data', `data/${name}`);
      await cache?.set(key, { savedAt: now(), data });
      return data;
    } catch (error) {
      if (cached) return cached.data;
      throw error;
    }
  }

  return {
    async search(league, query, sort = { price: 'asc' }) {
      const body = await request<RawSearchResponse>('search', `search/poe2/${encodeURIComponent(league)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sort }),
      });
      return { id: body.id, total: body.total, hashes: body.result, inexact: body.inexact === true };
    },

    async fetchListings(hashes, queryId, { pseudos = [] } = {}) {
      const extra = pseudos.map((id) => `&pseudos[]=${id}`).join('');
      const entries: RawFetchEntry[] = [];
      for (let start = 0; start < hashes.length; start += FETCH_SIZE) {
        const wait = blockedUntil.fetch - now();
        if (wait > MAX_FETCH_WAIT_MS) throw rateLimited('fetch');
        if (wait > 0) await sleep(wait);
        const batch = hashes.slice(start, start + FETCH_SIZE);
        const body = await request<{ result: (RawFetchEntry | null)[] }>('fetch', `fetch/${batch.join(',')}?query=${queryId}${extra}`);
        for (const entry of body.result) if (entry) entries.push(entry);
      }
      return entries;
    },

    async whisper(token, options = {}) {
      const body = await request<{ success?: unknown }>('whisper', 'whisper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...(options.continue ? { continue: true } : {}) }),
      });
      return body.success === true ? 'sent' : 'in-demand';
    },

    getCatalog<T>(name: CatalogName) {
      let download = catalogDownloads.get(name);
      if (!download) {
        download = downloadCatalog(name).finally(() => catalogDownloads.delete(name));
        catalogDownloads.set(name, download);
      }
      return download as Promise<T>;
    },
  };
}

function readCacheEntry(value: unknown): { savedAt: number; data: unknown } | null {
  if (typeof value !== 'object' || value === null) return null;
  const { savedAt, data } = value as { savedAt?: unknown; data?: unknown };
  return typeof savedAt === 'number' && data !== undefined ? { savedAt, data } : null;
}
