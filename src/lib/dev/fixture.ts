import type { SearchSort, TradeClient } from '@/lib/api/client';
import type { RawFetchEntry } from '@/lib/api/raw';
import { normalizeQuery } from '@/lib/query/normalize';
import { scrubListings } from './scrub';

export interface ListingsFixture {
  meta: { league: string; capturedAt: string };
  request: { query: unknown; sort: SearchSort };
  search: { id: string; total: number; result: string[] };
  listings: RawFetchEntry[];
}

export type CaptureResult = { ok: true; fileName: string; fixture: ListingsFixture } | { ok: false; message: string };

/** The fetch endpoint takes at most 10 listings per request: one request is enough for a fixture. */
const FIXTURE_SIZE = 10;

/** Dev tool: one search with the page's query and one fetch of the first 10 listings, scrubbed for the public repository. */
export async function captureListingsFixture({
  league,
  query: rawQuery,
  client,
  now = () => new Date(),
}: {
  league: string;
  query: unknown;
  client: Pick<TradeClient, 'search' | 'fetchListings'>;
  now?: () => Date;
}): Promise<CaptureResult> {
  if (rawQuery === null || rawQuery === undefined) return { ok: false, message: 'No search query on this page' };

  const query = normalizeQuery(rawQuery);
  const sort: SearchSort = { price: 'asc' };
  let search;
  let entries: RawFetchEntry[] = [];
  try {
    search = await client.search(league, query, sort);
    const hashes = search.hashes.slice(0, FIXTURE_SIZE);
    if (hashes.length > 0) entries = await client.fetchListings(hashes, search.id);
  } catch (error) {
    return { ok: false, message: `API request failed: ${error instanceof Error ? error.message : String(error)}` };
  }

  return {
    ok: true,
    fileName: `listings-${query.status.option}.json`,
    fixture: {
      meta: { league, capturedAt: now().toISOString() },
      request: { query, sort },
      search: { id: search.id, total: search.total, result: search.hashes },
      listings: scrubListings(entries),
    },
  };
}

export function summarizeFixture({ meta, search, listings }: ListingsFixture): string {
  return `${meta.league} · found: ${search.total} · listings: ${listings.length}`;
}
