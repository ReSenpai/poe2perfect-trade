import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildWorkspaceData, type WorkspaceData } from '@/lib/catalog/workspace-data';
import type { BaseStatsData } from '@/lib/gamedata/base-stats';
import type { ListingsFixture } from '@/lib/dev/fixture';
import type { FiltersCatalog, StatsCatalog } from '@/lib/query/labels';

/**
 * Real data from the trade site. `data/*` — public reference data (`node scripts/fetch-catalogs.mjs`);
 * `listings-*` — one search + fetch captured with the dev popup ("Export fixture"), scrubbed by `scrubListings`.
 */
export const LISTING_FIXTURES = ['listings-online', 'listings-securable', 'listings-rings'] as const;
export type ListingFixtureName = (typeof LISTING_FIXTURES)[number];

export const CATALOGS = ['leagues', 'stats', 'filters', 'static', 'items'] as const;
export type CatalogName = (typeof CATALOGS)[number];

const cache = new Map<string, unknown>();

function readJson<T>(path: string): T {
  if (!cache.has(path)) cache.set(path, JSON.parse(readFileSync(resolve('tests/fixtures', path), 'utf-8')));
  return cache.get(path) as T;
}

export function loadListings(name: ListingFixtureName): ListingsFixture {
  return readJson<ListingsFixture>(`${name}.json`);
}

interface Catalogs {
  leagues: { result: { id: string; realm: string; text: string }[] };
  stats: StatsCatalog;
  filters: FiltersCatalog;
  static: { result: { id: string; label: string; entries: { id: string; text: string; image?: string }[] }[] };
  items: { result: { id: string; label: string; entries: { type: string; name?: string; text?: string }[] }[] };
}

/** `{ result: [...] }` exactly as api/trade2/data/<name> returns it. */
export function loadCatalog<N extends CatalogName>(name: N): Catalogs[N] {
  return readJson<Catalogs[N]>(`data/${name}.json`);
}

let workspaceData: WorkspaceData | null = null;

/** Reference data of the workspace, built from the catalog fixtures. */
export function loadWorkspaceData(): WorkspaceData {
  workspaceData ??= buildWorkspaceData({
    stats: loadCatalog('stats'),
    filters: loadCatalog('filters'),
    leagues: loadCatalog('leagues'),
    static: loadCatalog('static'),
    items: loadCatalog('items'),
    baseStats: loadBaseStats(),
  });
  return workspaceData;
}

/** The game data table the extension ships (public/data/base-stats.json, built by scripts/build-base-stats.ts). */
export function loadBaseStats(): BaseStatsData {
  return readJson<BaseStatsData>('../../public/data/base-stats.json');
}
