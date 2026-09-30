import type { FilterDefinition } from '@/lib/catalog/filter-registry';
import { readFixedOption, readFixedRange, readFixedText, setFixedOption, setFixedRange, setFixedText } from './context';
import type { QueryDocument } from './document';

/**
 * The compact filters of a query (step 41 B, the unified filters design §4, §12): a filter of the registry
 * read from and written to the query document by its binding. Absent is no condition; No (false) is one; 0 is a bound;
 * an empty range, choice or text is nothing.
 */

export type FilterValue =
  | { kind: 'boolean'; value: boolean }
  | { kind: 'range'; min: number | null; max: number | null }
  | { kind: 'enum'; value: string }
  | { kind: 'text'; value: string };

export function readFilter(doc: QueryDocument, definition: FilterDefinition): FilterValue | null {
  const { section, key } = definition.binding;
  switch (definition.valueKind) {
    case 'range': {
      const { min, max } = readFixedRange(doc, section, key);
      return min === null && max === null ? null : { kind: 'range', min, max };
    }
    case 'boolean': {
      const option = readFixedOption(doc, section, key);
      return option === 'true' ? { kind: 'boolean', value: true } : option === 'false' ? { kind: 'boolean', value: false } : null;
    }
    case 'enum': {
      const option = readFixedOption(doc, section, key);
      return option === null ? null : { kind: 'enum', value: option };
    }
    case 'text': {
      const text = readFixedText(doc, section, key);
      return text === null ? null : { kind: 'text', value: text };
    }
  }
}

/** Sets a filter, or removes it (null, or a value that says nothing). */
export function writeFilter(doc: QueryDocument, definition: FilterDefinition, value: FilterValue | null): QueryDocument {
  const { section, key } = definition.binding;
  switch (definition.valueKind) {
    case 'range': {
      const range = value?.kind === 'range' ? value : { min: null, max: null };
      const finite = (bound: number | null) => (bound !== null && Number.isFinite(bound) ? bound : null);
      return setFixedRange(doc, section, key, { min: finite(range.min), max: finite(range.max) });
    }
    case 'boolean':
      return setFixedOption(doc, section, key, value?.kind === 'boolean' ? String(value.value) : null);
    case 'enum':
      return setFixedOption(doc, section, key, value?.kind === 'enum' && value.value !== '' ? value.value : null);
    case 'text':
      return setFixedText(doc, section, key, value?.kind === 'text' ? value.value : '');
  }
}

export interface SelectedFilter {
  definition: FilterDefinition;
  value: FilterValue;
}

/** A field of the query the registry does not know (a newer site, an odd link): kept, shown, never rewritten. */
export interface UnknownFilter {
  section: string;
  key: string;
  raw: unknown;
}

/**
 * What the query asks beyond stats, for the list of Your filters: the pinned ones (category, rarity, price, status) stay
 * at the top of the panel. Those added now come in the order they were added, after the rest in the schema's order.
 */
export function selectedFilters(doc: QueryDocument, registry: FilterDefinition[], order: string[]): { known: SelectedFilter[]; unknown: UnknownFilter[] } {
  const known = registry.flatMap((definition) => {
    if (definition.placement === 'pinned') return [];
    const value = readFilter(doc, definition);
    return value ? [{ definition, value }] : [];
  });
  const rank = (filter: SelectedFilter) => {
    const at = order.indexOf(filter.definition.id);
    return at < 0 ? -1 : at;
  };
  known.sort((a, b) => rank(a) - rank(b));

  const bound = new Set(registry.map((definition) => `${definition.binding.section}.${definition.binding.key}`));
  const sections = doc.rest.filters;
  const unknown: UnknownFilter[] = [];
  if (sections && typeof sections === 'object') {
    for (const [section, content] of Object.entries(sections as Record<string, unknown>)) {
      const filters = content && typeof content === 'object' ? (content as { filters?: unknown }).filters : undefined;
      if (!filters || typeof filters !== 'object') continue;
      for (const [key, raw] of Object.entries(filters as Record<string, unknown>)) {
        if (!bound.has(`${section}.${key}`)) unknown.push({ section, key, raw });
      }
    }
  }
  return { known, unknown };
}

export interface RequirementLimits {
  level?: string;
  strength?: string;
  dexterity?: string;
  intelligence?: string;
}

const LIMIT_IDS: [keyof RequirementLimits, string][] = [
  ['level', 'requirement.level'],
  ['strength', 'requirement.strength'],
  ['dexterity', 'requirement.dexterity'],
  ['intelligence', 'requirement.intelligence'],
];

export interface RequirementPlan {
  /** Per field that is not a whole number: its message; with any, nothing changes. */
  errors: Partial<Record<keyof RequirementLimits, string>>;
  changes: { definition: FilterDefinition; max: number }[];
  added: number;
  updated: number;
  /** Requirements whose minimum an at-most limit takes away. */
  minimumRemoved: string[];
}

/**
 * Can equip (§6): each filled field becomes "at most N" of its requirement (a minimum it had goes); an empty field changes
 * nothing. All or nothing: a field that is not a whole number leaves no change at all.
 */
export function planRequirementLimits(doc: QueryDocument, registry: FilterDefinition[], limits: RequirementLimits): RequirementPlan {
  const errors: RequirementPlan['errors'] = {};
  const changes: RequirementPlan['changes'] = [];
  let added = 0;
  let updated = 0;
  const minimumRemoved: string[] = [];
  for (const [field, id] of LIMIT_IDS) {
    const text = limits[field]?.trim() ?? '';
    if (text === '') continue;
    if (!/^\d+$/.test(text)) {
      errors[field] = 'Enter a whole number';
      continue;
    }
    const definition = registry.find((candidate) => candidate.id === id);
    if (!definition) continue;
    const current = readFilter(doc, definition);
    if (current === null) added++;
    else updated++;
    if (current?.kind === 'range' && current.min !== null) minimumRemoved.push(definition.label);
    changes.push({ definition, max: Number(text) });
  }
  if (Object.keys(errors).length > 0) return { errors, changes: [], added: 0, updated: 0, minimumRemoved: [] };
  return { errors, changes, added, updated, minimumRemoved };
}
