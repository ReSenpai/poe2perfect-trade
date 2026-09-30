import { DEFAULT_STATUS } from '@/lib/query/normalize';

/**
 * The editor's document of a trade query (step 20): the query as it came (a decoded URL, the page
 * state), with stable ids on stat groups and rows so the editor can address them while rows are edited, moved and
 * removed. Everything is kept as raw JSON and `compile` gives it back unchanged: unknown fields, disabled parts, empty
 * groups the site writes. `normalizeQuery` is not on this path — it drops and rewrites parts it does not know.
 *
 * Groups the editor can edit: and (All of), count (At least N of), not (Exclude). weight, weight2, if, unknown types
 * and groups with a malformed row are opaque: shown, switched off or removed as a whole, never rewritten.
 */

type Json = Record<string, unknown>;

export type EditableGroupType = 'and' | 'count' | 'not';
const EDITABLE: readonly unknown[] = ['and', 'count', 'not'] satisfies EditableGroupType[];

export interface DocRow {
  id: string;
  statId: string;
  value: Json | undefined;
  disabled: boolean;
  /** The stat filter as it came, unknown fields included. */
  raw: Json & { id: string };
}

export interface EditableGroup {
  id: string;
  opaque: false;
  type: EditableGroupType;
  /** count: how many rows must match. */
  value: Json | undefined;
  disabled: boolean;
  rows: DocRow[];
  /** The group without its filters, as it came. */
  raw: Json;
}

export interface OpaqueGroup {
  id: string;
  opaque: true;
  raw: unknown;
}

export type DocGroup = EditableGroup | OpaqueGroup;

export interface QueryDocument {
  status: Json;
  groups: DocGroup[];
  /** Whether the query has a `stats` list at all (kept absent when it had none). */
  hasStats: boolean;
  /** Every other top-level field (name, type, filters, term, future fields), as it came. */
  rest: Json;
  /** The next free id number. */
  nextId: number;
}

export function fromTradeQuery(query: unknown): QueryDocument {
  const { status, stats, ...rest } = isObject(query) ? query : {};
  let nextId = 0;
  const newId = (prefix: string) => `${prefix}${++nextId}`;
  const groups = Array.isArray(stats) ? stats.map((group) => readGroup(group, newId)) : [];
  return { status: readStatus(status), groups, hasStats: Array.isArray(stats), rest, nextId };
}

/** The trade query of the document: the imported query itself where nothing was edited. */
export function compile(doc: QueryDocument): Json {
  const query: Json = { status: doc.status, ...doc.rest };
  if (doc.hasStats || doc.groups.length > 0) query.stats = doc.groups.map(compileGroup);
  return query;
}

export function rowsOf(group: DocGroup): DocRow[] {
  return group.opaque ? [] : group.rows;
}

export function groupOf(doc: QueryDocument, groupId: string): DocGroup | undefined {
  return doc.groups.find((group) => group.id === groupId);
}

/** Replaces the range / option / weight of a row; its other fields and every id stay. */
export function setRowValue(doc: QueryDocument, rowId: string, value: Json | undefined): QueryDocument {
  return mapRows(doc, (row) => {
    if (row.id !== rowId) return row;
    const { value: _old, ...raw } = row.raw;
    return makeRow(row.id, value === undefined ? raw : { ...raw, value });
  });
}

/** Puts another stat on a row (Total → Explicit…): its id, bounds, other fields and place stay. */
export function setRowStat(doc: QueryDocument, rowId: string, statId: string): QueryDocument {
  return mapRows(doc, (row) => (row.id === rowId ? makeRow(row.id, { ...row.raw, id: statId }) : row));
}

/** Moves a row to the end of another editable group, keeping its id; unchanged if either side is opaque or missing. */
export function moveRow(doc: QueryDocument, rowId: string, targetGroupId: string): QueryDocument {
  const source = doc.groups.find((group) => rowsOf(group).some((row) => row.id === rowId));
  const target = groupOf(doc, targetGroupId);
  if (!source || !target || target.opaque || source === target) return doc;
  const row = rowsOf(source).find((candidate) => candidate.id === rowId)!;
  return {
    ...doc,
    groups: doc.groups.map((group) => {
      if (group.opaque) return group;
      if (group === source) return { ...group, rows: group.rows.filter((candidate) => candidate.id !== rowId) };
      if (group === target) return { ...group, rows: [...group.rows, row] };
      return group;
    }),
  };
}

/** Adds a stat row at the end of an editable group; the document is unchanged (rowId null) for an opaque one. */
export function addRow(doc: QueryDocument, groupId: string, statId: string): { doc: QueryDocument; rowId: string | null } {
  const target = groupOf(doc, groupId);
  if (!target || target.opaque) return { doc, rowId: null };
  const rowId = `r${doc.nextId + 1}`;
  const row = makeRow(rowId, { id: statId });
  return {
    doc: { ...doc, nextId: doc.nextId + 1, groups: doc.groups.map((group) => (group === target ? { ...target, rows: [...target.rows, row] } : group)) },
    rowId,
  };
}

/** Adds an empty editable group at the end. */
export function addGroup(doc: QueryDocument, type: EditableGroupType): { doc: QueryDocument; groupId: string } {
  const groupId = `g${doc.nextId + 1}`;
  const group: EditableGroup = { id: groupId, opaque: false, type, value: undefined, disabled: false, rows: [], raw: { type } };
  return { doc: { ...doc, nextId: doc.nextId + 1, groups: [...doc.groups, group] }, groupId };
}

export function removeRow(doc: QueryDocument, rowId: string): QueryDocument {
  return { ...doc, groups: doc.groups.map((group) => (group.opaque ? group : { ...group, rows: group.rows.filter((row) => row.id !== rowId) })) };
}

/** Removes a group, an opaque one included (as a whole). */
export function removeGroup(doc: QueryDocument, groupId: string): QueryDocument {
  return { ...doc, groups: doc.groups.filter((group) => group.id !== groupId) };
}

/** Switches a row off or on through its `disabled` flag; its bounds stay. */
export function setRowEnabled(doc: QueryDocument, rowId: string, enabled: boolean): QueryDocument {
  return mapRows(doc, (row) => (row.id === rowId ? makeRow(row.id, withDisabled(row.raw, !enabled)) : row));
}

/** Switches a group off or on, an opaque one included (only its `disabled` flag changes). */
export function setGroupEnabled(doc: QueryDocument, groupId: string, enabled: boolean): QueryDocument {
  return {
    ...doc,
    groups: doc.groups.map((group) => {
      if (group.id !== groupId) return group;
      if (group.opaque) return isObject(group.raw) ? { ...group, raw: withDisabled(group.raw, !enabled) } : group;
      return { ...group, disabled: !enabled, raw: withDisabled(group.raw, !enabled) };
    }),
  };
}

/** Sets the group's own value (count: how many rows must match); editable groups only. */
export function setGroupValue(doc: QueryDocument, groupId: string, value: Json | undefined): QueryDocument {
  return {
    ...doc,
    groups: doc.groups.map((group) => {
      if (group.id !== groupId || group.opaque) return group;
      const { value: _old, ...raw } = group.raw;
      return { ...group, value, raw: value === undefined ? raw : { ...raw, value } };
    }),
  };
}

function withDisabled<T extends Json>(raw: T, disabled: boolean): T {
  const { disabled: _old, ...rest } = raw;
  return (disabled ? { ...rest, disabled: true } : rest) as T;
}

function mapRows(doc: QueryDocument, map: (row: DocRow) => DocRow): QueryDocument {
  return { ...doc, groups: doc.groups.map((group) => (group.opaque ? group : { ...group, rows: group.rows.map(map) })) };
}

function readStatus(value: unknown): Json {
  // The page state writes the status as a plain string, the API takes { option }.
  if (typeof value === 'string' && value !== '') return { option: value };
  if (isObject(value) && typeof value.option === 'string' && value.option !== '') return value;
  return { option: DEFAULT_STATUS };
}

function readGroup(value: unknown, newId: (prefix: string) => string): DocGroup {
  const id = newId('g');
  if (!isObject(value) || !EDITABLE.includes(value.type) || !Array.isArray(value.filters)) return { id, opaque: true, raw: value };
  if (!value.filters.every((filter) => isObject(filter) && typeof filter.id === 'string' && filter.id !== '')) return { id, opaque: true, raw: value };
  const { filters, ...raw } = value;
  return {
    id,
    opaque: false,
    type: value.type as EditableGroupType,
    value: isObject(value.value) ? value.value : undefined,
    disabled: value.disabled === true,
    rows: (filters as (Json & { id: string })[]).map((filter) => makeRow(newId('r'), filter)),
    raw,
  };
}

function makeRow(id: string, raw: Json & { id: string }): DocRow {
  return { id, statId: raw.id, value: isObject(raw.value) ? raw.value : undefined, disabled: raw.disabled === true, raw };
}

function compileGroup(group: DocGroup): unknown {
  if (group.opaque) return group.raw;
  return { ...group.raw, filters: group.rows.map((row) => row.raw) };
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
