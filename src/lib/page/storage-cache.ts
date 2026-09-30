import type { CatalogCache } from '@/lib/api/client';

/** The part of chrome.storage.local the cache uses. */
export interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const PREFIX = 'poe2trade:';

/**
 * Reference data cache in extension storage. Storage problems (quota, a reloaded extension) only cost a download,
 * so they are swallowed.
 */
export function createStorageCache(area: StorageArea): CatalogCache {
  return {
    async get(key) {
      try {
        return (await area.get(PREFIX + key))[PREFIX + key];
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      try {
        await area.set({ [PREFIX + key]: value });
      } catch {
        // The next load downloads again.
      }
    },
  };
}
