import { TradeApiError, type TradeClient } from '@/lib/api/client';
import type { RawFetchEntry } from '@/lib/api/raw';
import { loadListings } from './load';

/**
 * States of the trade API that the UI has to handle but that must not be provoked on the live site (429, the
 * Cloudflare check, a failing fetch), answered from the captured listings.
 */
export type FakeScenario =
  | 'normal'
  | 'empty'
  | 'null-listing'
  | 'mixed-currency'
  | 'slow'
  | 'rate-limited'
  | 'verification'
  | 'network'
  | 'fetch-error';

/** Found hashes: more than one page, so Load more has something to load. */
const FOUND = 25;
const PAGE = 10;

export interface FakeClient extends Pick<TradeClient, 'search' | 'fetchListings'> {
  /** Lets a held `slow` search answer. */
  release(): void;
}

export function createFakeClient(scenario: FakeScenario, fixture: Parameters<typeof loadListings>[0] = 'listings-online'): FakeClient {
  const entries = loadListings(fixture).listings;
  const hashes = scenario === 'empty' ? [] : Array.from({ length: FOUND }, (_, i) => `fake${String(i).padStart(2, '0')}`);
  const entryFor = (hash: string): RawFetchEntry | null => {
    const index = hashes.indexOf(hash);
    if (index === -1) return null;
    if (scenario === 'null-listing' && index % 3 === 1) return null;
    const entry: RawFetchEntry = { ...entries[index % entries.length]!, id: hash };
    if (scenario === 'mixed-currency' && index % 2 === 1 && entry.listing.price) {
      return { ...entry, listing: { ...entry.listing, price: { ...entry.listing.price, currency: 'divine' } } };
    }
    return entry;
  };

  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));

  return {
    release: () => release(),

    async search() {
      if (scenario === 'slow') await held;
      if (scenario === 'rate-limited') throw new TradeApiError('rate-limited', 'Too many searches', { status: 429, retryAfter: 42 });
      if (scenario === 'verification') throw new TradeApiError('verification', 'The trade site asks for a verification', { status: 403 });
      if (scenario === 'network') throw new TradeApiError('network', 'Failed to fetch');
      return { id: `H4sIfake-${scenario}`, total: hashes.length === 0 ? 0 : 1135, hashes, inexact: false };
    },

    async fetchListings(requested) {
      if (scenario === 'fetch-error' && requested.some((hash) => hashes.indexOf(hash) >= PAGE)) {
        throw new TradeApiError('server', 'HTTP 502: Bad gateway', { status: 502 });
      }
      return requested.map(entryFor).filter((entry): entry is RawFetchEntry => entry != null);
    },
  };
}
