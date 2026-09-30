import type { SearchSort } from '@/lib/api/client';
import type { Listing } from '@/lib/listing/parse';
import type { TradeQuery } from '@/lib/query/model';
import { queryKey } from '@/lib/query/normalize';

/** How many searches keep their results for a reload. */
export const SNAPSHOT_LIMIT = 5;

/**
 * The results of one search as they were shown, kept so that reopening the search (a reload, back / forward) shows
 * them again without spending a search: the trade site's search limit is tight and the site under the overlay has
 * already spent one on opening the page.
 */
export interface ResultsSnapshot {
  league: string;
  query: TradeQuery;
  sort: SearchSort;
  /** The search id (the encoded query), for loading more of the found hashes. */
  id: string;
  total: number;
  hashes: string[];
  listings: Listing[];
  /** When the results were received (ms). */
  savedAt: number;
}

const keyOf = (league: string, query: TradeQuery, sort: SearchSort) => `${league}\n${queryKey(query)}\n${JSON.stringify(sort)}`;

/** The remembered results of this league, query and sort, or null. */
export function findSnapshot(list: readonly ResultsSnapshot[], league: string, query: TradeQuery, sort: SearchSort): ResultsSnapshot | null {
  const key = keyOf(league, query, sort);
  return list.find((saved) => keyOf(saved.league, saved.query, saved.sort) === key) ?? null;
}

/** The list with `snapshot` first, in place of older results of the same search, at most `limit` long. */
export function rememberSnapshot(list: readonly ResultsSnapshot[], snapshot: ResultsSnapshot, limit = SNAPSHOT_LIMIT): ResultsSnapshot[] {
  const key = keyOf(snapshot.league, snapshot.query, snapshot.sort);
  // Trade tokens act in the user's game and expire: they never reach the storage.
  const stored = { ...snapshot, listings: snapshot.listings.map(({ tokens: _tokens, ...listing }) => listing) };
  return [stored, ...list.filter((saved) => keyOf(saved.league, saved.query, saved.sort) !== key)].slice(0, limit);
}
