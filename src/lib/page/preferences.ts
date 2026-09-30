import { storage } from 'wxt/utils/storage';
import type { ResultsSnapshot } from '@/lib/results/snapshots';
import type { RememberedDraft } from '@/lib/saved/draft-memory';
import type { SavedSearch } from '@/lib/saved/saved-searches';
import type { V4Prefs } from '@/ui/v4/V4Workspace';
import type { PageMode } from './controller';

/** Whether the user last chose the extension workspace or the original site. */
export const pageModeItem = storage.defineItem<PageMode>('local:pageMode', { fallback: 'extension' });

/** Results of the last few searches, shown again when a search is reopened instead of searching on their own. */
export const resultsSnapshotsItem = storage.defineItem<ResultsSnapshot[]>('local:resultsSnapshots', { fallback: [] });

/** Layout of the workspace: filter pane share (percent) and whether the filters are collapsed. */
export const v4PrefsItem = storage.defineItem<V4Prefs>('local:v4Prefs', { fallback: { filterWidth: 42, filtersCollapsed: false } });

/** Saved searches (step 31); read back through `readSavedSearches`. */
export const savedSearchesItem = storage.defineItem<SavedSearch[]>('local:savedSearches', { fallback: [] });

/** A draft left unapplied (step 31); read back through `readRememberedDraft`. */
export const v4DraftItem = storage.defineItem<RememberedDraft | null>('local:v4Draft', { fallback: null });

/** What the removed legacy workspace and the dev switch kept (step 32): nothing reads them any more. */
export const LEGACY_KEYS = ['local:filterWidth', 'local:filtersCollapsed', 'local:listingView', 'local:filterMode', 'local:recentFilters', 'local:uiVersion'] as const;

/** Clears the legacy keys; the ones above stay. */
export function forgetLegacyPreferences(removeItems: (keys: string[]) => Promise<void> = (keys) => storage.removeItems(keys as `local:${string}`[])): Promise<void> {
  return removeItems([...LEGACY_KEYS]);
}
