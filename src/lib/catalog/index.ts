import { FIXED_LABELS, type FiltersCatalog, shortStatLabel, type StatsCatalog } from '@/lib/query/labels';
import { classifyStat, STAT_GROUPS, type StatGroupId } from './groups';

/** Sections of api/trade2/data/filters shown as filter groups; the status filter lives in the results toolbar. */
const SECTION_GROUPS = [
  { id: 'type_filters', title: 'Type' },
  { id: 'equipment_filters', title: 'Equipment' },
  { id: 'req_filters', title: 'Requirements' },
  { id: 'map_filters', title: 'Endgame' },
  { id: 'misc_filters', title: 'Miscellaneous' },
  { id: 'trade_filters', title: 'Trade' },
] as const;

export type SectionGroupId = (typeof SECTION_GROUPS)[number]['id'];
export type FilterGroupId = StatGroupId | SectionGroupId;

export const FILTER_GROUPS: { id: FilterGroupId; title: string }[] = [...STAT_GROUPS, ...SECTION_GROUPS];

export interface StatEntry {
  kind: 'stat';
  /** Same form as chip keys: `stat:<id>`. */
  key: string;
  id: string;
  text: string;
  /** Other wordings of the same stat id in the catalog. */
  aliases: string[];
  type: string;
  typeLabel: string;
  label: string;
  group: StatGroupId;
}

export type FixedControl = 'range' | 'option' | 'option-range' | 'input';

export interface FixedEntry {
  kind: 'fixed';
  /** `fixed:<section>:<filter>`. */
  key: string;
  section: SectionGroupId;
  filter: string;
  text: string;
  label: string;
  control: FixedControl;
  /** Choices without "Any" (id null). */
  options: { id: string; text: string }[];
  group: SectionGroupId;
}

export type FilterEntry = StatEntry | FixedEntry;

export interface FilterIndex {
  entries: FilterEntry[];
  get(key: string): FilterEntry | undefined;
  counts(): Record<FilterGroupId, number>;
}

export function buildFilterIndex(stats: StatsCatalog, filters: FiltersCatalog): FilterIndex {
  const entries: FilterEntry[] = [];
  const byKey = new Map<string, FilterEntry>();
  const add = (entry: FilterEntry) => {
    entries.push(entry);
    byKey.set(entry.key, entry);
  };

  const sectionIds = new Set<string>(SECTION_GROUPS.map((group) => group.id));
  for (const section of filters.result) {
    if (!sectionIds.has(section.id)) continue;
    const sectionId = section.id as SectionGroupId;
    for (const filter of section.filters) {
      const text = filter.text ?? filter.id;
      const hasOptions = filter.option !== undefined;
      const hasRange = filter.minMax === true;
      add({
        kind: 'fixed',
        key: `fixed:${sectionId}:${filter.id}`,
        section: sectionId,
        filter: filter.id,
        text,
        label: FIXED_LABELS[text] ?? text,
        control: hasOptions && hasRange ? 'option-range' : hasOptions ? 'option' : hasRange ? 'range' : 'input',
        options: (filter.option?.options ?? []).filter((option): option is { id: string; text: string } => option.id !== null),
        group: sectionId,
      });
    }
  }

  for (const group of stats.result) {
    for (const stat of group.entries) {
      const key = `stat:${stat.id}`;
      const existing = byKey.get(key);
      if (existing?.kind === 'stat') {
        if (stat.text !== existing.text) existing.aliases.push(stat.text);
        continue;
      }
      add({
        kind: 'stat',
        key,
        id: stat.id,
        text: stat.text,
        aliases: [],
        type: stat.type,
        typeLabel: group.label ?? stat.type,
        label: shortStatLabel(stat.text),
        group: classifyStat(stat.text, stat.type),
      });
    }
  }

  return {
    entries,
    get: (key) => byKey.get(key),
    counts() {
      const counts = Object.fromEntries(FILTER_GROUPS.map((group) => [group.id, 0])) as Record<FilterGroupId, number>;
      for (const entry of entries) counts[entry.group]++;
      return counts;
    },
  };
}
