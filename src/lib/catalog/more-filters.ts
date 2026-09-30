/**
 * The filters of the site the main panel does not show (step 36, More filters): item level and quality, equipment,
 * requirements, endgame, miscellaneous and trade filters, as the site's catalog (`data/filters`) names them. Which of
 * them fit the chosen category is a guess by category family; a set filter is shown whatever the category.
 */

export interface MoreFilter {
  section: string;
  key: string;
  text: string;
  /** `range`: min – max; `yes-no`: Any / Yes / No; `option`: a list; `text`: free text (the seller account). */
  kind: 'range' | 'yes-no' | 'option' | 'text';
  /** For `option`: the choices, Any (no option) as the empty id. */
  options?: { id: string; text: string }[];
}

export interface MoreFilterGroup {
  section: string;
  title: string;
  filters: MoreFilter[];
}

type Catalog = {
  result: {
    id: string;
    title?: string;
    filters: { id: string; text?: string; minMax?: boolean; input?: unknown; option?: { options: { id: string | null; text: string }[] } }[];
  }[];
};

/** Filters of the main panel and the toolbar. */
const MAIN = new Set(['type_filters.category', 'type_filters.rarity', 'trade_filters.price', 'status_filters.status']);
const TITLES: Record<string, string> = { type_filters: 'Item', equipment_filters: 'Equipment', map_filters: 'Endgame', trade_filters: 'Trade' };

export function buildMoreFilters(catalog: Catalog): MoreFilterGroup[] {
  return catalog.result.flatMap((group): MoreFilterGroup[] => {
    const filters = group.filters.flatMap((entry): MoreFilter[] => {
      if (MAIN.has(`${group.id}.${entry.id}`)) return [];
      const base = { section: group.id, key: entry.id, text: entry.text ?? entry.id };
      if (entry.option) {
        const options = entry.option.options.map((option) => ({ id: option.id ?? '', text: option.text }));
        const yesNo = options.length === 3 && options.map((option) => option.id).join(',') === ',true,false';
        return [yesNo ? { ...base, kind: 'yes-no' } : { ...base, kind: 'option', options }];
      }
      if (entry.input) return [{ ...base, kind: 'text' }];
      if (entry.minMax) return [{ ...base, kind: 'range' }];
      return [];
    });
    return filters.length > 0 ? [{ section: group.id, title: TITLES[group.id] ?? group.title ?? group.id, filters }] : [];
  });
}

const WEAPON_STATS = new Set(['damage', 'aps', 'crit', 'dps', 'pdps', 'edps', 'reload_time']);
const DEFENCES = new Set(['ar', 'ev', 'es', 'ward', 'block']);

/** Whether a filter fits items of a category (a family guess); without a category every filter does. */
export function fitsCategory(filter: Pick<MoreFilter, 'section' | 'key'>, category: string | null): boolean {
  if (!category) return true;
  const family = category.split('.')[0]!;
  const equipment = family === 'weapon' || family === 'armour' || family === 'accessory';
  switch (filter.section) {
    case 'equipment_filters':
      if (WEAPON_STATS.has(filter.key)) return family === 'weapon';
      if (DEFENCES.has(filter.key)) return family === 'armour';
      if (filter.key === 'spirit') return category === 'weapon.sceptre' || family === 'armour' || family === 'accessory';
      return family === 'weapon' || family === 'armour';
    case 'req_filters':
      return equipment || family === 'gem' || family === 'flask';
    case 'map_filters':
      return filter.key === 'ultimatum_hint' ? category === 'map.ultimatum' : family === 'map';
    case 'misc_filters':
      if (filter.key === 'gem_level' || filter.key === 'gem_sockets') return family === 'gem';
      if (filter.key === 'area_level') return family === 'map';
      if (filter.key === 'sanctum_gold') return category === 'map.barya';
      if (filter.key === 'stack_size') return family === 'currency' || family === 'card';
      return true;
    default:
      return true;
  }
}

/** The groups with the filters that fit the category, plus any filter in `keep` (set ones stay in sight). */
export function visibleFilters(groups: MoreFilterGroup[], category: string | null, keep: ReadonlySet<string> = new Set()): MoreFilterGroup[] {
  return groups.flatMap((group) => {
    const filters = group.filters.filter((filter) => keep.has(`${filter.section}.${filter.key}`) || fitsCategory(filter, category));
    return filters.length > 0 ? [{ ...group, filters }] : [];
  });
}
