import type { SearchSort } from '@/lib/api/client';
import { sameQuery } from '@/lib/query/normalize';

/**
 * A draft left unapplied survives a reload or leaving the page (step 31): kept with the search the page showed, it
 * comes back only on a page of that search, as changes over it. One at a time; nothing here searches.
 */
export interface RememberedDraft {
  version: 1;
  /** The search of the page the draft was made on: its league and query (applied, or opened). */
  baseLeague: string;
  base: unknown;
  /** The draft: league, query exactly as compiled, sort. */
  league: string;
  draft: unknown;
  sort: SearchSort;
  savedAt: number;
}

/** The remembered draft when the page shows the search it was made on; null otherwise. */
export function draftFor(memory: RememberedDraft | null, league: string, pageQuery: unknown): RememberedDraft | null {
  if (!memory || memory.baseLeague !== league || !sameQuery(memory.base, pageQuery)) return null;
  return memory;
}

export function readRememberedDraft(value: unknown): RememberedDraft | null {
  if (!value || typeof value !== 'object') return null;
  const memory = value as Partial<RememberedDraft>;
  const ok =
    memory.version === 1 &&
    typeof memory.baseLeague === 'string' &&
    typeof memory.league === 'string' &&
    typeof memory.savedAt === 'number' &&
    typeof memory.base === 'object' &&
    memory.base !== null &&
    typeof memory.draft === 'object' &&
    memory.draft !== null &&
    typeof memory.sort === 'object' &&
    memory.sort !== null;
  return ok ? (memory as RememberedDraft) : null;
}
