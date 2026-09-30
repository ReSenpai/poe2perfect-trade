import {
  type FilterSection,
  type FixedFilterValue,
  type ItemRef,
  type RangeValue,
  STAT_GROUP_TYPES,
  type StatFilter,
  type StatFilterValue,
  type StatGroup,
  type StatGroupType,
  type TradeQuery,
} from './model';

/** The listing status of a fresh trade2 page (Instant Buyout). */
export const DEFAULT_STATUS = 'securable';

type Json = Record<string, unknown>;

/**
 * Canonical form of a query from the URL, the page state or the UI: the page state writes `status: "online"`, the API
 * `status: { option: "online" }`; empty groups, "Any" options and blank ranges mean "no filter" and are dropped.
 */
export function normalizeQuery(raw: unknown): TradeQuery {
  const source = isObject(raw) ? raw : {};
  const { status, name, type, stats, filters, ...rest } = source;

  const query: TradeQuery = { status: { option: readStatus(status) }, stats: [], filters: {} };
  const itemName = readItemRef(name);
  if (itemName !== undefined) query.name = itemName;
  const itemType = readItemRef(type);
  if (itemType !== undefined) query.type = itemType;
  query.stats = Array.isArray(stats) ? stats.map(readGroup).filter((group): group is StatGroup => group !== null) : [];
  query.filters = readSections(filters);
  // Unknown fields (term, future additions) travel untouched.
  for (const [key, value] of Object.entries(rest)) if (value !== undefined) query[key] = value;
  return query;
}

/** Stable text form: object keys sorted, array order kept (it matters for stat filters). */
export function queryKey(query: TradeQuery): string {
  return JSON.stringify(query, (_key, value: unknown) =>
    isObject(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value,
  );
}

export function sameQuery(a: unknown, b: unknown): boolean {
  return queryKey(normalizeQuery(a)) === queryKey(normalizeQuery(b));
}

function readStatus(value: unknown): string {
  const option = isObject(value) ? value.option : value;
  return typeof option === 'string' && option !== '' ? option : DEFAULT_STATUS;
}

function readItemRef(value: unknown): ItemRef | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value;
  if (isObject(value) && typeof value.option === 'string' && value.option !== '') {
    return typeof value.discriminator === 'string' ? { option: value.option, discriminator: value.discriminator } : { option: value.option };
  }
  return undefined;
}

function readGroup(value: unknown): StatGroup | null {
  if (!isObject(value) || !Array.isArray(value.filters)) return null;
  const filters = value.filters.map(readStatFilter).filter((filter): filter is StatFilter => filter !== null);
  if (filters.length === 0) return null;

  const type = (STAT_GROUP_TYPES as readonly unknown[]).includes(value.type) ? (value.type as StatGroupType) : 'and';
  const group: StatGroup = { type, filters };
  const range = readRange(value.value);
  if (range) group.value = range;
  if (value.disabled === true) group.disabled = true;
  return group;
}

function readStatFilter(value: unknown): StatFilter | null {
  if (!isObject(value) || typeof value.id !== 'string' || value.id === '') return null;
  const filter: StatFilter = { id: value.id };
  if (isObject(value.value)) {
    const out: StatFilterValue = { ...readRange(value.value) };
    const weight = readNumber(value.value.weight);
    if (weight !== undefined) out.weight = weight;
    const option = value.value.option;
    if ((typeof option === 'string' && option !== '') || typeof option === 'number') out.option = option;
    if (Object.keys(out).length > 0) filter.value = out;
  }
  if (value.disabled === true) filter.disabled = true;
  return filter;
}

function readSections(value: unknown): Record<string, FilterSection> {
  const sections: Record<string, FilterSection> = {};
  if (!isObject(value)) return sections;
  for (const [id, section] of Object.entries(value)) {
    if (!isObject(section) || !isObject(section.filters)) continue;
    const filters: Record<string, FixedFilterValue> = {};
    for (const [key, raw] of Object.entries(section.filters)) {
      const filter = readFixedFilter(raw);
      if (filter) filters[key] = filter;
    }
    if (Object.keys(filters).length === 0) continue;
    sections[id] = section.disabled === true ? { disabled: true, filters } : { filters };
  }
  return sections;
}

function readFixedFilter(value: unknown): FixedFilterValue | null {
  if (!isObject(value)) return null;
  const filter: FixedFilterValue = {};
  // "Any" is option null; yes/no options are the strings "true" / "false".
  if (typeof value.option === 'string' && value.option !== '') filter.option = value.option;
  Object.assign(filter, readRange(value));
  if (typeof value.input === 'string' && value.input.trim() !== '') filter.input = value.input;
  return Object.keys(filter).length > 0 ? filter : null;
}

function readRange(value: unknown): RangeValue | undefined {
  if (!isObject(value)) return undefined;
  const range: RangeValue = {};
  const min = readNumber(value.min);
  const max = readNumber(value.max);
  if (min !== undefined) range.min = min;
  if (max !== undefined) range.max = max;
  return Object.keys(range).length > 0 ? range : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
