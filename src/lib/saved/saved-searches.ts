import type { SearchSort } from '@/lib/api/client';

/**
 * Searches the user keeps by name (v4 §15, step 31): the query exactly as the editor compiles it — unknown fields and
 * groups the editor cannot edit stay — with its league and sort. Opening one is a draft; nothing here searches.
 */

export interface SavedSearch {
  id: string;
  name: string;
  /** Layout of this record; a newer one is left alone rather than misread. */
  version: 1;
  league: string;
  query: unknown;
  sort: SearchSort;
  savedAt: number;
}

export const SAVED_LIMIT = 50;

export interface SavedSearchInput {
  name: string;
  league: string;
  query: unknown;
  sort: SearchSort;
}

/** Newest first; the oldest past the limit go. Nothing is overwritten here: a name taken is for the dialog to ask about. */
export function addSavedSearch(list: SavedSearch[], input: SavedSearchInput, now: number, id: string = newId()): SavedSearch[] {
  const entry: SavedSearch = { id, name: input.name.trim(), version: 1, league: input.league, query: input.query, sort: input.sort, savedAt: now };
  return [entry, ...list].slice(0, SAVED_LIMIT);
}

/** A saved search replaced by the current one, which takes the top. */
export function replaceSavedSearch(list: SavedSearch[], targetId: string, input: SavedSearchInput, now: number, id: string = newId()): SavedSearch[] {
  return addSavedSearch(removeSavedSearch(list, targetId), input, now, id);
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The search saved under this name (any case, any spaces around). */
export function savedByName(list: SavedSearch[], name: string): SavedSearch | undefined {
  return list.find((saved) => sameName(saved.name, name));
}

/** A name next to a taken one that is free: "Rings (2)", "Rings (3)"… */
export function freeName(list: SavedSearch[], name: string): string {
  const base = name.trim();
  for (let number = 2; ; number++) {
    const candidate = `${base} (${number})`;
    if (!savedByName(list, candidate)) return candidate;
  }
}

export function removeSavedSearch(list: SavedSearch[], id: string): SavedSearch[] {
  return list.filter((saved) => saved.id !== id);
}

/** What storage gave back, keeping only records of this version that have everything. */
export function readSavedSearches(value: unknown): SavedSearch[] {
  if (!Array.isArray(value)) return [];
  return value.filter((raw): raw is SavedSearch => {
    if (!raw || typeof raw !== 'object') return false;
    const entry = raw as Partial<SavedSearch>;
    return (
      entry.version === 1 &&
      typeof entry.id === 'string' &&
      typeof entry.name === 'string' &&
      typeof entry.league === 'string' &&
      typeof entry.savedAt === 'number' &&
      typeof entry.query === 'object' &&
      entry.query !== null &&
      typeof entry.sort === 'object' &&
      entry.sort !== null
    );
  });
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
