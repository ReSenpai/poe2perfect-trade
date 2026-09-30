import type { QueryDocument } from './document';

/**
 * The item context (category, rarity, base, unique name) and the budget (price range and currency) of a query
 * document. They live in the query's own places — `filters.type_filters`, `type` / `name`, `filters.trade_filters.price`
 * — and every other field there is kept as it came.
 */

type Json = Record<string, unknown>;

export interface ItemContext {
  category: string | null;
  rarity: string | null;
  /** Base type. */
  type: string | null;
  /** Unique item name. */
  name: string | null;
}

export interface Budget {
  min: number | null;
  max: number | null;
  currency: string | null;
}

/** A change to the context or budget: `null` removes the part, a missing key leaves it. */
export type Change<T> = { [K in keyof T]?: T[K] };

export function readItemContext(doc: QueryDocument): ItemContext {
  const filters = sectionFilters(doc, 'type_filters');
  return { category: optionOf(filters.category), rarity: optionOf(filters.rarity), type: itemText(doc.rest.type), name: itemText(doc.rest.name) };
}

export function setItemContext(doc: QueryDocument, change: Change<ItemContext>): QueryDocument {
  let rest = doc.rest;
  for (const key of ['type', 'name'] as const) {
    if (!(key in change)) continue;
    const { [key]: _old, ...others } = rest;
    rest = change[key] == null ? others : { ...others, [key]: change[key] };
  }
  let next = { ...doc, rest };
  for (const key of ['category', 'rarity'] as const) {
    if (!(key in change)) continue;
    const value = change[key];
    next = updateFilter(next, 'type_filters', key, (filter) => withKey(filter, 'option', value ?? undefined));
  }
  return next;
}

export function readBudget(doc: QueryDocument): Budget {
  const price = sectionFilters(doc, 'trade_filters').price;
  const read = (key: string) => (isObject(price) && typeof price[key] === 'number' ? (price[key] as number) : null);
  return { min: read('min'), max: read('max'), currency: optionOf(price) };
}

/** Changes the price range or currency; a new currency keeps the amounts (no conversion). */
export function setBudget(doc: QueryDocument, change: Change<Budget>): QueryDocument {
  return updateFilter(doc, 'trade_filters', 'price', (price) => {
    let next = price;
    if ('min' in change) next = withKey(next, 'min', change.min ?? undefined);
    if ('max' in change) next = withKey(next, 'max', change.max ?? undefined);
    if ('currency' in change) next = withKey(next, 'option', change.currency ?? undefined);
    return next;
  });
}

/** The option of a fixed filter (`misc_filters.corrupted` → "false"), null when it is not set. */
export function readFixedOption(doc: QueryDocument, section: string, key: string): string | null {
  return optionOf(sectionFilters(doc, section)[key]);
}

/** Sets or removes (null) the option of a fixed filter; the other fields of the section stay. */
export function setFixedOption(doc: QueryDocument, section: string, key: string, option: string | null): QueryDocument {
  return updateFilter(doc, section, key, (filter) => withKey(filter, 'option', option ?? undefined));
}

export interface FixedRange {
  min: number | null;
  max: number | null;
}

/** The range of a fixed filter (`req_filters.lvl` → 60 – Any); an end not set is null (Any), never 0. */
export function readFixedRange(doc: QueryDocument, section: string, key: string): FixedRange {
  const filter = sectionFilters(doc, section)[key];
  const read = (end: 'min' | 'max') => (isObject(filter) && typeof filter[end] === 'number' ? (filter[end] as number) : null);
  return { min: read('min'), max: read('max') };
}

/** Changes one or both ends of a fixed range; null removes an end, an empty filter goes. */
export function setFixedRange(doc: QueryDocument, section: string, key: string, change: Change<FixedRange>): QueryDocument {
  return updateFilter(doc, section, key, (filter) => {
    let next = filter;
    if ('min' in change) next = withKey(next, 'min', change.min ?? undefined);
    if ('max' in change) next = withKey(next, 'max', change.max ?? undefined);
    return next;
  });
}

/** The text of a fixed filter (the seller account), null when not set. */
export function readFixedText(doc: QueryDocument, section: string, key: string): string | null {
  const filter = sectionFilters(doc, section)[key];
  return isObject(filter) && typeof filter.input === 'string' && filter.input.trim() !== '' ? filter.input : null;
}

/** Sets the text of a fixed filter; blank text removes it. */
export function setFixedText(doc: QueryDocument, section: string, key: string, text: string): QueryDocument {
  return updateFilter(doc, section, key, (filter) => withKey(filter, 'input', text.trim() === '' ? undefined : text));
}

function sectionFilters(doc: QueryDocument, section: string): Json {
  const sections = doc.rest.filters;
  const found = isObject(sections) ? sections[section] : undefined;
  return isObject(found) && isObject(found.filters) ? found.filters : {};
}

/** Rewrites one fixed filter; an emptied filter, and then an emptied section, are removed. */
function updateFilter(doc: QueryDocument, section: string, key: string, update: (filter: Json) => Json): QueryDocument {
  const sections = isObject(doc.rest.filters) ? doc.rest.filters : {};
  const current = isObject(sections[section]) ? (sections[section] as Json) : {};
  const filters = isObject(current.filters) ? current.filters : {};
  const filter = update(isObject(filters[key]) ? (filters[key] as Json) : {});
  const { [key]: _old, ...otherFilters } = filters;
  const nextFilters = Object.keys(filter).length > 0 ? { ...otherFilters, [key]: filter } : otherFilters;
  const { [section]: _section, ...otherSections } = sections;
  const nextSections = Object.keys(nextFilters).length > 0 ? { ...otherSections, [section]: { ...current, filters: nextFilters } } : otherSections;
  return { ...doc, rest: { ...doc.rest, filters: nextSections } };
}

function withKey(object: Json, key: string, value: unknown): Json {
  const { [key]: _old, ...rest } = object;
  return value === undefined ? rest : { ...rest, [key]: value };
}

function optionOf(filter: unknown): string | null {
  return isObject(filter) && typeof filter.option === 'string' && filter.option !== '' ? filter.option : null;
}

function itemText(ref: unknown): string | null {
  if (typeof ref === 'string') return ref.trim() === '' ? null : ref;
  return optionOf(ref);
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
