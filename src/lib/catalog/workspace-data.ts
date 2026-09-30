import { buildFilterRegistry, type FilterDefinition } from './filter-registry';
import { createFilterLabels, type FilterLabels, type FiltersCatalog, type StatsCatalog } from '@/lib/query/labels';
import type { BaseStatsData } from '@/lib/gamedata/base-stats';
import { buildFilterIndex, type FilterIndex } from './index';
import { createPossibleStats, type PossibleStats } from './possible';
import { buildMoreFilters, type MoreFilterGroup } from './more-filters';

export interface LeaguesCatalog {
  result: { id: string; realm?: string; text: string }[];
}

export interface StaticCatalog {
  result: { id: string; label?: string; entries: { id: string; text: string; image?: string }[] }[];
}

export interface ItemsCatalog {
  result: { id: string; label?: string; entries: { type: string; name?: string; text?: string }[] }[];
}

/** Something to put in the item search: a unique (name + base) or a base type. */
export interface ItemChoice {
  text: string;
  name?: string;
  type: string;
}

export interface Option {
  id: string;
  text: string;
}

/** Reference data the workspace needs, built once from api/trade2/data/*. */
export interface WorkspaceData {
  labels: FilterLabels;
  index: FilterIndex;
  leagues: Option[];
  /** Listing statuses of the status filter (Instant Buyout, In Person…). */
  statuses: Option[];
  /** Currencies of the price filter; "Any" (Exalted Orb Equivalent) has the empty id. */
  priceOptions: Option[];
  /** Currency (and other static item) names and icons by id: `divine` → Divine Orb. */
  currencies: Map<string, { text: string; image?: string }>;
  /** Item search choices, from api/trade2/data/items. */
  items: ItemChoice[];
  /** What can roll on which base; null when the game data was not loaded. */
  possible: PossibleStats | null;
  /** The site's filters the main panel does not show (More filters, step 36). */
  moreFilters: MoreFilterGroup[];
  /** Every filter beyond stats, named, for Your filters and Add filter (step 41). */
  filters: FilterDefinition[];
}

export function buildWorkspaceData(catalogs: {
  stats: StatsCatalog;
  filters: FiltersCatalog;
  leagues: LeaguesCatalog;
  static: StaticCatalog;
  items: ItemsCatalog;
  baseStats?: BaseStatsData;
}): WorkspaceData {
  const filter = (section: string, id: string) => catalogs.filters.result.find((entry) => entry.id === section)?.filters.find((entry) => entry.id === id);
  const status = filter('status_filters', 'status');
  const price = filter('trade_filters', 'price');
  const currencies = new Map<string, { text: string; image?: string }>();
  for (const group of catalogs.static.result) {
    for (const entry of group.entries) {
      if (!currencies.has(entry.id)) currencies.set(entry.id, entry.image ? { text: entry.text, image: entry.image } : { text: entry.text });
    }
  }

  const items = new Map<string, ItemChoice>();
  for (const group of catalogs.items.result) {
    for (const entry of group.entries) {
      const choice: ItemChoice = entry.name ? { text: entry.text ?? `${entry.name} ${entry.type}`, name: entry.name, type: entry.type } : { text: entry.type, type: entry.type };
      if (!items.has(choice.text)) items.set(choice.text, choice);
    }
  }
  const statTexts = new Map(catalogs.stats.result.flatMap((group) => group.entries.map((entry) => [entry.id, entry.text] as const)));

  return {
    labels: createFilterLabels(catalogs.stats, catalogs.filters),
    index: buildFilterIndex(catalogs.stats, catalogs.filters),
    leagues: catalogs.leagues.result.filter((league) => league.realm === undefined || league.realm === 'poe2').map(({ id, text }) => ({ id, text })),
    statuses: (status?.option?.options ?? []).filter((option): option is Option => option.id !== null),
    priceOptions: (price?.option?.options ?? []).map((option) => ({ id: option.id ?? '', text: option.text })),
    currencies,
    items: [...items.values()],
    moreFilters: buildMoreFilters(catalogs.filters),
    filters: buildFilterRegistry(catalogs.filters),
    possible: catalogs.baseStats ? onlyTradedBases(createPossibleStats(catalogs.baseStats, (id) => statTexts.get(id)), catalogs.items) : null,
  };
}

/** Game data knows bases the trade site does not list (unreleased, special): those are not offered as a type. */
function onlyTradedBases(possible: PossibleStats, items: ItemsCatalog): PossibleStats {
  const traded = new Set(items.result.flatMap((group) => group.entries.filter((entry) => !entry.name).map((entry) => entry.type)));
  return { ...possible, bases: (category) => possible.bases(category).filter((base) => traded.has(base)) };
}
