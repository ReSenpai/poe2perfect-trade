import type { ApplicabilityReason, ItemChecks } from './applicability';
import type { FilterIndex, StatEntry } from './index';
import { searchFilters } from './search';
import { PARAMETERS, type ParameterVariant, parameterOf, type SemanticParameter } from './semantic';

/**
 * What Add parameter offers (v4 §9.3): popular and recent parameters before anything is typed, then search results —
 * the parameters of the registry once each with their sources, the long tail as it is. Confirmed first, then the ones
 * the game data does not cover (shown, never hidden), the incompatible ones apart behind a toggle. Without an item to
 * check against there are no claims at all.
 */

export interface PickerItem {
  key: string;
  label: string;
  /** Full wording of the default stat. */
  detail: string;
  /** Total / Explicit / Implicit… of the default stat. */
  source: string;
  /** What a pick adds by default. */
  statId: string;
  parameterId?: string;
  variants?: ParameterVariant[];
  status: 'supported' | 'unsupported' | 'unknown';
}

export interface PickerResults {
  /** browse: a source's whole list to scroll through (nothing typed). */
  sections: { title: string; items: PickerItem[]; browse?: boolean }[];
  incompatible: PickerItem[];
  /** Why availability is not shown. */
  note: string | null;
}

const NOTES: Partial<Record<ApplicabilityReason, string>> = {
  'no-item': 'Choose a category to check what the item can have',
  'no-game-data': 'Item-specific suggestions unavailable',
  unique: 'A unique item: availability is not checked',
  'category-not-covered': 'Availability is not verified for this item',
};
const EXACT_ID = /^[a-z]+\.[a-z0-9_]+$/;
const POPULAR_LIMIT = 12;

export function pickerResults({ index, checks, text, recent }: { index: FilterIndex; checks: ItemChecks; text: string; recent: string[] }): PickerResults {
  const note = NOTES[checks.applicability(PARAMETERS[0]!.variants[0]!.statId).reason] ?? null;
  const stat = (id: string) => {
    const entry = index.get(`stat:${id}`);
    return entry?.kind === 'stat' ? entry : undefined;
  };
  const fromParameter = (parameter: SemanticParameter): PickerItem => {
    const variant = parameter.variants[0]!;
    return {
      key: `parameter:${parameter.id}`,
      label: parameter.label,
      detail: stat(variant.statId)?.text ?? parameter.label,
      source: sourceLabel(variant.statId),
      statId: variant.statId,
      parameterId: parameter.id,
      variants: parameter.variants,
      status: checks.applicability(variant.statId).status,
    };
  };
  const fromEntry = (entry: StatEntry): PickerItem => {
    const known = parameterOf(entry.id);
    if (known) return fromParameter(known.parameter);
    return { key: entry.key, label: entry.text, detail: entry.text, source: sourceLabel(entry.id), statId: entry.id, status: checks.applicability(entry.id).status };
  };

  const query = text.trim();
  if (query === '') {
    const popular = PARAMETERS.map(fromParameter).filter((item) => note !== null || item.status === 'supported').slice(0, POPULAR_LIMIT);
    const recentItems = recent.flatMap((id) => {
      const entry = stat(id);
      return entry ? [fromEntry(entry)] : [];
    });
    return {
      sections: [
        { title: note === null ? 'Popular for this item' : 'Popular', items: popular },
        { title: 'Recent', items: dedupe(recentItems) },
        ...browseAll(index, fromEntry, note === null),
      ].filter((section) => section.items.length > 0),
      incompatible: [],
      note,
    };
  }

  const exact = EXACT_ID.test(query) ? stat(query) : undefined;
  const found = searchFilters(index, query, { limit: 80 }).filter((entry): entry is StatEntry => entry.kind === 'stat');
  const items = dedupe([...(exact ? [exact] : []), ...found].map(fromEntry));

  if (note !== null) return { sections: items.length > 0 ? [{ title: 'Results', items }] : [], incompatible: [], note };
  return {
    sections: [
      { title: 'Available for this item', items: items.filter((item) => item.status === 'supported') },
      { title: 'Availability not verified', items: items.filter((item) => item.status === 'unknown') },
    ].filter((section) => section.items.length > 0),
    incompatible: items.filter((item) => item.status === 'unsupported'),
    note,
  };
}

/** Where sources come in the list to browse: totals, the item's own rolls, its base, then the rest by name. */
const SOURCE_ORDER = ['pseudo', 'explicit', 'implicit'];

/**
 * Everything the item can have, to browse without knowing what to type (as the site's own list): by source, each
 * parameter once with its sources, by words. For an item only what the game data confirms on it; without one the whole
 * catalog, nothing claimed about it.
 */
function browseAll(index: FilterIndex, fromEntry: (entry: StatEntry) => PickerItem, onItem: boolean): { title: string; items: PickerItem[]; browse: true }[] {
  const seen = new Set<string>();
  const bySource = new Map<string, PickerItem[]>();
  for (const entry of index.entries) {
    if (entry.kind !== 'stat') continue;
    const item = fromEntry(entry);
    if ((onItem && item.status !== 'supported') || seen.has(item.key)) continue;
    seen.add(item.key);
    const source = item.statId.slice(0, item.statId.indexOf('.'));
    bySource.set(source, [...(bySource.get(source) ?? []), item]);
  }
  const rank = (source: string) => (SOURCE_ORDER.includes(source) ? SOURCE_ORDER.indexOf(source) : SOURCE_ORDER.length);
  const name = (source: string) => sourceLabel(`${source}.`);
  // By words: "# to Accuracy Rating" under A, not ahead of everything for its "#".
  const words = (item: PickerItem) => item.label.replace(/^[^A-Za-z]+/, '');
  return [...bySource]
    .sort(([a], [b]) => rank(a) - rank(b) || name(a).localeCompare(name(b)))
    .map(([source, items]) => ({ title: `${name(source)} · all${onItem ? ' on this item' : ''}`, items: items.sort((a, b) => words(a).localeCompare(words(b))), browse: true as const }));
}

function dedupe(items: PickerItem[]): PickerItem[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.key) && seen.add(item.key));
}

const SOURCES: Record<string, string> = { pseudo: 'Total', explicit: 'Explicit', implicit: 'Implicit', crafted: 'Crafted', fractured: 'Fractured', rune: 'Augment', enchant: 'Enchant', desecrated: 'Desecrated', sanctum: 'Sanctum', skill: 'Skill' };

export function sourceLabel(statId: string): string {
  const type = statId.slice(0, statId.indexOf('.'));
  return SOURCES[type] ?? type;
}
