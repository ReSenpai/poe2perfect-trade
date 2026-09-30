import type { FixedFilterValue, RangeValue, StatFilter, StatGroupType, TradeQuery } from './model';

/** api/trade2/data/stats and data/filters, as far as labels need them. */
export interface StatsCatalog {
  result: { id: string; label?: string; entries: { id: string; text: string; type: string }[] }[];
}

export interface FiltersCatalog {
  result: {
    id: string;
    title?: string;
    filters: { id: string; text?: string; minMax?: boolean; option?: { options: { id: string | null; text: string }[] } }[];
  }[];
}

export interface StatLabel {
  text: string;
  type: string;
  label: string;
}

export interface FixedLabel {
  text: string;
  label: string;
  /** option id → text; "Any" (id null) is left out. */
  options?: Map<string, string>;
}

export interface FilterLabels {
  stat(id: string): StatLabel | undefined;
  fixed(section: string, key: string): FixedLabel | undefined;
}

/** A chip of the ACTIVE FILTERS row. `key` addresses the filter in the query (for removal and focus). */
export interface FilterChip {
  key: string;
  text: string;
  title: string;
}

/** Shorter names the chips use for a few long filter titles. */
export const FIXED_LABELS: Record<string, string> = { 'Item Category': 'Category', 'Item Rarity': 'Rarity' };
/** Stat types shown without a marker: explicit mods are the norm, pseudo labels already read as "Total …". */
const UNMARKED_TYPES = new Set(['explicit', 'pseudo']);

export function createFilterLabels(stats: StatsCatalog, filters: FiltersCatalog): FilterLabels {
  const statIndex = new Map<string, StatLabel>();
  for (const group of stats.result) {
    for (const entry of group.entries) {
      if (!statIndex.has(entry.id)) statIndex.set(entry.id, { text: entry.text, type: entry.type, label: shortStatLabel(entry.text) });
    }
  }

  const fixedIndex = new Map<string, FixedLabel>();
  for (const section of filters.result) {
    for (const filter of section.filters) {
      const text = filter.text ?? filter.id;
      const label: FixedLabel = { text, label: FIXED_LABELS[text] ?? text };
      if (filter.option) {
        label.options = new Map(
          filter.option.options.filter((option) => option.id !== null).map((option) => [option.id as string, option.text]),
        );
      }
      fixedIndex.set(`${section.id}:${filter.id}`, label);
    }
  }

  return {
    stat: (id) => statIndex.get(id),
    fixed: (section, key) => fixedIndex.get(`${section}:${key}`),
  };
}

/** "# to maximum Life" → "Life", "+#% total to Fire Resistance" → "Total Fire Res". */
export function shortStatLabel(text: string): string {
  const label = text
    .replace(/\s*\(Local\)$/, '')
    .replace(/[+-]?#%?\s*/g, '')
    .replace(/^total (?:to )?(?:maximum )?/, 'Total ')
    .replace(/^to maximum /, '')
    .replace(/^to /, '')
    .replace(/\bResistances?\b/g, 'Res')
    .replace(/\s+/g, ' ')
    .trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "70+", "≤50", "30–50", "5"; empty when there is no bound. */
export function formatRange({ min, max }: RangeValue): string {
  if (min !== undefined && max !== undefined) return min === max ? String(min) : `${min}–${max}`;
  if (min !== undefined) return `${min}+`;
  if (max !== undefined) return `≤${max}`;
  return '';
}

/** Enabled filters of the query as chips: the item name and base, fixed filters (what the item is), then stats. */
export function activeFilters(query: TradeQuery, labels: FilterLabels): FilterChip[] {
  const chips: FilterChip[] = [];
  const itemName = itemRefText(query.name);
  if (itemName) chips.push({ key: 'item:name', text: `Item: ${itemName}`, title: `Item: ${itemName}` });
  const itemType = itemRefText(query.type);
  if (itemType) chips.push({ key: 'item:type', text: `Base: ${itemType}`, title: `Base type: ${itemType}` });

  for (const [sectionId, section] of Object.entries(query.filters)) {
    if (section.disabled) continue;
    for (const [key, value] of Object.entries(section.filters)) {
      const label = labels.fixed(sectionId, key);
      const valueText = describeFixedValue(value, label);
      chips.push(chip(`fixed:${sectionId}:${key}`, label?.label ?? key, label?.text ?? key, valueText));
    }
  }

  query.stats.forEach((group, groupIndex) => {
    if (group.disabled) return;
    group.filters.forEach((filter, filterIndex) => {
      if (filter.disabled) return;
      const { short, full } = describeStat(filter, group.type, labels);
      chips.push(chip(`stat:${groupIndex}:${filterIndex}`, short, full, filter.value ? formatStatValue(filter.value) : ''));
    });
  });

  return chips;
}

/** Text of an item name / base: plain, or the option picked from the site's list. */
export function itemRefText(ref: TradeQuery['name']): string | null {
  if (typeof ref === 'string') return ref;
  return ref?.option ?? null;
}

function describeStat(filter: StatFilter, groupType: StatGroupType, labels: FilterLabels): { short: string; full: string } {
  const stat = labels.stat(filter.id);
  let short = stat?.label ?? filter.id;
  if (stat && !UNMARKED_TYPES.has(stat.type)) short += ` (${stat.type})`;
  const full = stat?.text ?? filter.id;
  return groupType === 'not' ? { short: `Not ${short}`, full: `Not ${full}` } : { short, full };
}

function formatStatValue(value: NonNullable<StatFilter['value']>): string {
  return [value.option !== undefined ? String(value.option) : '', formatRange(value)].filter(Boolean).join(' ');
}

function describeFixedValue(value: FixedFilterValue, label: FixedLabel | undefined): string {
  if (value.input !== undefined) return value.input;
  const option = value.option !== undefined ? (label?.options?.get(value.option) ?? value.option) : '';
  const range = formatRange(value);
  // Price: "≤5 Divine Orb" — the option is the currency of the range.
  return range && option ? `${range} ${option}` : range || option;
}

function chip(key: string, short: string, full: string, value: string): FilterChip {
  return value ? { key, text: `${short}: ${value}`, title: `${full}: ${value}` } : { key, text: short, title: full };
}
