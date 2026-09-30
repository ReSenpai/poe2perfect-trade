import { type SearchSort, TradeApiError, type TradeApiErrorKind, type TradeClient } from '@/lib/api/client';
import { type Listing, parseListing } from '@/lib/listing/parse';
import type { TradeQuery } from '@/lib/query/model';
import { queryKey } from '@/lib/query/normalize';
import type { ResultsSnapshot } from './snapshots';

/** Listings are fetched 10 at a time (the fetch endpoint's limit). */
const PAGE_SIZE = 10;

export type ResultsState =
  | { status: 'idle' }
  /** `previous`: the results shown before, kept on screen while the new search runs. */
  | { status: 'searching'; previous?: ReadyResults }
  | {
      status: 'ready';
      /** The encoded query: the search id for fetches and the page URL. */
      id: string;
      total: number;
      listings: Listing[];
      hasMore: boolean;
      loadingMore: boolean;
      moreError?: string;
      /** Restored from a snapshot received at this time (ms), rather than just searched. */
      savedAt?: number;
    }
  | { status: 'error'; kind: TradeApiErrorKind | 'unknown'; message: string; retryAfter: number | null };

export type ReadyResults = Extract<ResultsState, { status: 'ready' }>;

export interface ResultsController {
  getState(): ResultsState;
  search(league: string, query: TradeQuery, sort?: SearchSort): Promise<void>;
  loadMore(): Promise<void>;
  /** Shows remembered results without a request; Load more continues with their hashes. */
  restore(snapshot: Pick<ResultsSnapshot, 'id' | 'total' | 'hashes' | 'listings' | 'savedAt'>): void;
  /** What the shown results need to be restored later, or null when none are shown. */
  snapshot(): Pick<ResultsSnapshot, 'id' | 'total' | 'hashes' | 'listings'> | null;
  /** Back to no results; a search still running is dropped. */
  reset(): void;
  subscribe(listener: (state: ResultsState) => void): () => void;
}

/**
 * Search results: one search, then listings 10 at a time. Answers of replaced searches are dropped; the same search
 * asked again while it runs is not sent twice.
 */
export function createResultsController(client: Pick<TradeClient, 'search' | 'fetchListings'>): ResultsController {
  let state: ResultsState = { status: 'idle' };
  let searchId = 0;
  let hashes: string[] = [];
  /** Pseudo totals the listings of this search come with. */
  let pseudos: string[] = [];
  let running: { key: string; promise: Promise<void> } | null = null;
  const listeners = new Set<(state: ResultsState) => void>();

  const set = (next: ResultsState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  const fetchPage = async (from: number, id: string) => (await client.fetchListings(hashes.slice(from, from + PAGE_SIZE), id, { pseudos })).map(parseListing);

  const run = async (league: string, query: TradeQuery, sort: SearchSort | undefined) => {
    const current = ++searchId;
    pseudos = pseudoFilters(query);
    const shown = state.status === 'ready' ? state : state.status === 'searching' ? state.previous : undefined;
    set(shown ? { status: 'searching', previous: shown } : { status: 'searching' });
    try {
      const found = await client.search(league, query, sort);
      if (current !== searchId) return;
      hashes = found.hashes;
      const listings = hashes.length > 0 ? await fetchPage(0, found.id) : [];
      if (current !== searchId) return;
      set({ status: 'ready', id: found.id, total: found.total, listings, hasMore: listings.length < hashes.length, loadingMore: false });
    } catch (error) {
      if (current !== searchId) return;
      set(
        error instanceof TradeApiError
          ? { status: 'error', kind: error.kind, message: error.message, retryAfter: error.retryAfter }
          : { status: 'error', kind: 'unknown', message: error instanceof Error ? error.message : String(error), retryAfter: null },
      );
    }
  };

  return {
    getState: () => state,

    search(league, query, sort) {
      const key = [league, queryKey(query), JSON.stringify(sort ?? null)].join('|');
      if (running?.key === key) return running.promise;
      const promise = run(league, query, sort).finally(() => {
        if (running?.promise === promise) running = null;
      });
      running = { key, promise };
      return promise;
    },

    async loadMore() {
      if (state.status !== 'ready' || !state.hasMore || state.loadingMore) return;
      const current = searchId;
      const { id, listings } = state;
      set({ ...state, loadingMore: true, moreError: undefined });
      try {
        const more = await fetchPage(listings.length, id);
        if (current !== searchId || state.status !== 'ready') return;
        const all = [...listings, ...more];
        set({ ...state, listings: all, hasMore: all.length < hashes.length, loadingMore: false });
      } catch (error) {
        if (current !== searchId || state.status !== 'ready') return;
        set({ ...state, loadingMore: false, moreError: error instanceof Error ? error.message : String(error) });
      }
    },

    restore(snapshot) {
      searchId++;
      running = null;
      hashes = snapshot.hashes;
      const { id, total, listings, savedAt } = snapshot;
      set({ status: 'ready', id, total, listings, hasMore: listings.length < hashes.length, loadingMore: false, savedAt });
    },

    snapshot() {
      if (state.status !== 'ready') return null;
      return { id: state.id, total: state.total, hashes, listings: state.listings };
    },

    reset() {
      searchId++;
      running = null;
      set({ status: 'idle' });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Enabled pseudo filters of the query, outside Exclude groups: the totals worth showing on each listing. */
function pseudoFilters(query: TradeQuery): string[] {
  // The v4 editor searches the query as it came, so any part may be missing or of an unknown shape.
  const groups: unknown[] = Array.isArray(query.stats) ? query.stats : [];
  const ids: string[] = [];
  for (const group of groups) {
    const { type, disabled, filters } = (group ?? {}) as { type?: unknown; disabled?: unknown; filters?: unknown };
    if (disabled === true || type === 'not' || !Array.isArray(filters)) continue;
    for (const filter of filters) {
      const { id, disabled: off } = (filter ?? {}) as { id?: unknown; disabled?: unknown };
      if (off !== true && typeof id === 'string' && id.startsWith('pseudo.')) ids.push(id);
    }
  }
  return [...new Set(ids)];
}
