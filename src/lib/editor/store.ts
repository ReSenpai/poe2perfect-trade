import type { SearchSort, TradeApiErrorKind, TradeClient } from '@/lib/api/client';
import type { TradeQuery } from '@/lib/query/model';
import { queryKey } from '@/lib/query/normalize';
import { createResultsController, type ResultsState } from '@/lib/results/controller';
import type { ResultsSnapshot } from '@/lib/results/snapshots';
import { type Budget, type Change, type ItemContext, readBudget, readFixedRange, readItemContext, setBudget, setFixedOption, setFixedRange, setFixedText, setItemContext } from './context';
import {
  addGroup,
  addRow,
  compile,
  type DocRow,
  type EditableGroup,
  fromTradeQuery,
  groupOf,
  moveRow,
  type QueryDocument,
  removeGroup,
  removeRow,
  rowsOf,
  setGroupValue,
  setRowEnabled,
  setRowStat, setRowValue,
} from './document';
import { isSimple } from './simple';
import type { FilterDefinition } from '@/lib/catalog/filter-registry';
import { type FilterValue, planRequirementLimits, readFilter, type RequirementLimits, writeFilter } from './selected-filters';

/**
 * State of the v4 editor (step 21): the draft being edited, the applied search whose results are shown,
 * the request in flight. Nothing searches on its own: only `apply()` does, once per draft, and a rate limit is waited
 * out without retrying. Text typed into a number field stays a text until it is a number; until then the query keeps
 * its old value and Apply is blocked with an error at that field.
 */

type Json = Record<string, unknown>;
type Bound = 'min' | 'max';

export interface AppliedSearch {
  doc: QueryDocument;
  league: string;
  sort: SearchSort;
  /** Which Apply this is (1, 2, …). */
  revision: number;
  /** The search id (the encoded query), for the page URL. */
  id: string;
}

export type RequestState =
  | { status: 'idle' }
  | { status: 'searching'; revision: number }
  | { status: 'cooldown'; until: number }
  | { status: 'error'; kind: TradeApiErrorKind | 'unknown'; message: string };

export interface Notice {
  code: 'base-cleared' | 'currency-changed' | 'draft-restored' | 'group-removed' | 'required-separately' | 'filter-removed';
  message: string;
  /** Whether Undo takes the change back. */
  undo: boolean;
}

export interface Issue {
  severity: 'error' | 'warning';
  code: 'not-a-number' | 'min-above-max' | 'count-out-of-range' | 'duplicate-in-group' | 'required-and-excluded';
  message: string;
  rowId?: string;
  groupId?: string;
  /** A field outside the conditions: the budget's price range. */
  section?: 'budget';
  /** A fixed filter's range (More filters): `req_filters.lvl`. */
  filter?: string;
  field?: Bound | 'count';
}

export interface EditorState {
  league: string;
  sort: SearchSort;
  draft: QueryDocument;
  /** Text of the number fields as typed, by row id (`budget` for the price range). */
  inputs: Record<string, { min?: string; max?: string }>;
  applied: AppliedSearch | null;
  /** The search the page opened with: what Reset goes back to before the first Apply. */
  imported: { doc: QueryDocument; league: string; sort: SearchSort };
  request: RequestState;
  results: ResultsState;
  notice: Notice | null;
  canUndo: boolean;
  /** Compact filters (registry ids) in the order they were added now: Your filters shows them so. */
  filterOrder: string[];
}

export interface EditorStoreOptions {
  client: Pick<TradeClient, 'search' | 'fetchListings'>;
  league: string;
  sort?: SearchSort;
  /** The query as it came (a decoded URL, the page state), not normalized. */
  query: unknown;
  now?: () => number;
  /** Whether a base type belongs to a category: false clears it on a category change, null (unknown) keeps it. */
  baseFits?: (category: string | null, type: string) => boolean | null;
  /** Remembered results of the imported search: shown as applied, without a request. */
  restore?: RestoredResults;
  /** A search was applied: its id belongs in the page URL, its results may be remembered. */
  onApplied?: (applied: AppliedSearch, results: ShownResults) => void;
}

/** What results need to be shown again later. */
export type ShownResults = Pick<ResultsSnapshot, 'id' | 'total' | 'hashes' | 'listings'>;
export type RestoredResults = ShownResults & { savedAt: number };

export interface EditorStore {
  getState(): EditorState;
  subscribe(listener: (state: EditorState) => void): () => void;
  setConditionInput(rowId: string, field: Bound, text: string): void;
  swapBounds(rowId: string): void;
  setConditionEnabled(rowId: string, enabled: boolean): void;
  /** Adds a stat to a group (null: All of, created when missing); returns the row id, the existing one for a repeat. */
  addCondition(groupId: string | null, statId: string): string;
  removeCondition(rowId: string): void;
  /** Another source of the same parameter (Total / Explicit / Implicit): the row keeps its bounds and place. */
  setConditionStat(rowId: string, statId: string): void;
  moveCondition(rowId: string, groupId: string): void;
  setGroupCount(groupId: string, count: number): void;
  /** A new empty group at the end (Rules): All of, At least 1 of, None of; its id. */
  addGroup(type: 'and' | 'count' | 'not'): string;
  /** A group with its conditions, Undo bringing it back. */
  removeGroup(groupId: string): void;
  /**
   * Add alternative (step 39): to a required row — it and the pick become a group At least 1 of 2, the row keeping its
   * range; to a group (or a row of it) — the pick joins it. The pick is a new stat or a required row already in the
   * search (moved with its range). A stat already in the group is not added again. Returns the picked row's id ('' when
   * nothing could be done: an exclusion, an opaque group).
   */
  addAlternative(anchorId: string, pick: { statId: string } | { rowId: string }): string;
  /** A row of a group becomes a required parameter; the group left behind follows the rules of a removal. */
  requireSeparately(rowId: string): void;
  /** Every row of a group becomes required on its own: the meaning changes, so Undo is offered. */
  requireAllSeparately(groupId: string): void;
  /**
   * Must not have: a required row goes to None of without its range (kept here for Require). A total cannot be
   * excluded — `statId` names the specific modifier instead. False when it cannot be done.
   */
  exclude(rowId: string, statId?: string): boolean;
  /** An exclusion back to a required parameter, with the range it had. */
  require(rowId: string): void;
  setItemContext(change: Change<ItemContext>): void;
  setBudget(change: Change<Budget>): void;
  /** Typed text of the price range: a finished number (or an empty field: no limit) goes into the query. */
  setBudgetInput(field: Bound, text: string): void;
  setLeague(league: string): void;
  setSort(sort: SearchSort): void;
  /** Listing mode (the query status: In person, Instant buyout…). */
  setListingMode(option: string): void;
  /** A fixed option filter (Corrupted: No); null removes it. */
  setFixedOption(section: string, key: string, option: string | null): void;
  /** One end of a fixed filter's range as typed (More filters): a number goes to the draft, other text stays here. */
  setFixedRangeInput(section: string, key: string, field: Bound, text: string): void;
  /** A text filter (the seller account); blank removes it. */
  setFixedText(section: string, key: string, text: string): void;
  clearFilters(): void;
  undo(): void;
  /** Puts the notice away (its close button). */
  dismissNotice(): void;
  /** A compact filter set (or removed with null): one change, Undo bringing the last back. */
  setFilter(definition: FilterDefinition, value: FilterValue | null): void;
  /** Can equip: every filled limit as at most N, or nothing when one is not a whole number (false). */
  applyRequirementLimits(registry: FilterDefinition[], limits: RequirementLimits): boolean;
  /** Back to the applied search, or to the imported one before any. */
  resetChanges(): void;
  apply(): Promise<void>;
  /** Searches the applied search again (the draft stays as it is). */
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  /**
   * Sorts the shown results by a field of their cards (`stat.<id>`, `ilvl`, `lvl`): one search of the applied search,
   * high to low, and low to high for a second click on the same field. The draft keeps its edits; its sort follows.
   */
  sortResults(field: string): Promise<void>;
  /** Opens another search (back / forward): a fresh draft, never a search; remembered results if given. */
  /** Another search as the new draft and base: from the address, or a saved search with its own sort. */
  importQuery(query: unknown, league: string, restore?: RestoredResults, sort?: SearchSort): void;
  /** A draft left unapplied on this search (a reload, a return): changes over the base, Reset takes them back. */
  loadDraft(query: unknown, league: string, sort: SearchSort): void;
}

const DEFAULT_SORT: SearchSort = { price: 'asc' };

export function createEditorStore({ client, league, sort = DEFAULT_SORT, query, now = Date.now, baseFits, restore, onApplied }: EditorStoreOptions): EditorStore {
  const results = createResultsController(client);
  const doc = fromTradeQuery(query);
  let state: EditorState = {
    league,
    sort,
    draft: doc,
    inputs: {},
    applied: null,
    imported: { doc, league, sort },
    request: { status: 'idle' },
    results: results.getState(),
    notice: null,
    filterOrder: [],
    canUndo: false,
  };
  const history: { draft: QueryDocument; inputs: EditorState['inputs'] }[] = [];
  const listeners = new Set<(state: EditorState) => void>();
  let revision = 0;
  let inFlight: { key: string; promise: Promise<void> } | null = null;

  const set = (patch: Partial<EditorState>) => {
    // A notice is about the last change: the next edit of the draft puts it away, unless it brings its own.
    state = { ...state, ...('draft' in patch && !('notice' in patch) ? { notice: null } : {}), ...patch };
    listeners.forEach((listener) => listener(state));
  };
  results.subscribe((next) => set({ results: next }));

  /** Shows remembered results of the imported search as its applied search. */
  const restoreResults = (saved: RestoredResults | undefined) => {
    if (!saved) {
      results.reset();
      return null;
    }
    results.restore(saved);
    return { doc: state.imported.doc, league: state.imported.league, sort: state.imported.sort, revision: 0, id: saved.id };
  };
  if (restore) set({ applied: restoreResults(restore) });

  /** One search of a document; its successful answer becomes the applied search. */
  const run = (searchDoc: QueryDocument, searchLeague: string, searchSort: SearchSort): Promise<void> => {
    const key = searchKey(searchDoc, searchLeague, searchSort);
    if (inFlight?.key === key) return inFlight.promise;

    const current = ++revision;
    set({ request: { status: 'searching', revision: current } });
    const promise = results.search(searchLeague, compile(searchDoc) as TradeQuery, searchSort).then(() => {
      if (current !== revision) return;
      const outcome = results.getState();
      if (outcome.status === 'ready') {
        const applied: AppliedSearch = { doc: searchDoc, league: searchLeague, sort: searchSort, revision: current, id: outcome.id };
        set({ applied, request: { status: 'idle' } });
        const shown = results.snapshot();
        if (shown) onApplied?.(applied, shown);
      } else if (outcome.status === 'error') {
        set({
          request:
            outcome.kind === 'rate-limited' && outcome.retryAfter != null
              ? { status: 'cooldown', until: now() + outcome.retryAfter * 1000 }
              : { status: 'error', kind: outcome.kind, message: outcome.message },
        });
      }
    });
    inFlight = { key, promise };
    void promise.finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
    return promise;
  };

  const coolingDown = () => state.request.status === 'cooldown' && now() < state.request.until;

  /** A change Undo can take back. */
  const change = (patch: Partial<EditorState>) => {
    history.push({ draft: state.draft, inputs: state.inputs });
    set({ ...patch, canUndo: true });
  };

  const rowById = (rowId: string) => state.draft.groups.flatMap(rowsOf).find((row) => row.id === rowId);
  const editableOf = (draft: QueryDocument, rowId: string) => draft.groups.find((group): group is EditableGroup => !group.opaque && group.rows.some((row) => row.id === rowId));
  // Ranges of excluded rows, for Require: never part of the query.
  const excludedValues = new Map<string, DocRow['value']>();

  /** The All of group of required parameters, made when there is none. */
  const withAllOf = (draft: QueryDocument): { draft: QueryDocument; groupId: string } => {
    // Not one turned off on the site: what is added is searched.
    const existing = draft.groups.find((group) => isSimple(group) && group.type === 'and');
    if (existing) return { draft, groupId: existing.id };
    const added = addGroup(draft, 'and');
    return { draft: added.doc, groupId: added.groupId };
  };

  /**
   * A group after a row left it (§6.4): an empty group goes (a notice for alternatives, Undo brings it back); the last row
   * of an At least 1 becomes required; N above the rows left stays, as an error — never lowered quietly.
   */
  const settle = (draft: QueryDocument, groupId: string): { draft: QueryDocument; notice: Notice | null } => {
    const group = groupOf(draft, groupId);
    if (!group || group.opaque || group.type === 'and') return { draft, notice: null };
    if (group.rows.length === 0) {
      const notice: Notice | null = group.type === 'count' ? { code: 'group-removed', message: 'Group removed', undo: true } : null;
      return { draft: removeGroup(draft, groupId), notice };
    }
    const count = group.value?.min;
    if (group.type === 'count' && group.rows.length === 1 && (typeof count !== 'number' || count <= 1)) {
      const allOf = withAllOf(draft);
      return { draft: removeGroup(moveRow(allOf.draft, group.rows[0]!.id, allOf.groupId), groupId), notice: null };
    }
    return { draft, notice: null };
  };

  const setBound = (row: DocRow, field: Bound, value: number | undefined): QueryDocument => {
    const { [field]: _old, ...others } = row.value ?? {};
    const next: Json = value === undefined ? others : { ...others, [field]: value };
    return setRowValue(state.draft, row.id, Object.keys(next).length > 0 ? next : undefined);
  };

  const store: EditorStore = {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setConditionInput(rowId, field, text) {
      const row = rowById(rowId);
      if (!row) return;
      const inputs = { ...state.inputs, [rowId]: { ...state.inputs[rowId], [field]: text } };
      const parsed = parseNumber(text);
      set({ inputs, draft: parsed === 'invalid' ? state.draft : setBound(row, field, parsed) });
    },

    swapBounds(rowId) {
      const row = rowById(rowId);
      const min = row?.value?.min;
      const max = row?.value?.max;
      if (!row || typeof min !== 'number' || typeof max !== 'number') return;
      set({ draft: setRowValue(state.draft, rowId, { ...row.value, min: max, max: min }), inputs: { ...state.inputs, [rowId]: { min: String(max), max: String(min) } } });
    },

    setConditionEnabled(rowId, enabled) {
      set({ draft: setRowEnabled(state.draft, rowId, enabled) });
    },

    addCondition(groupId, statId) {
      let draft = state.draft;
      let target = groupId ? groupOf(draft, groupId) : draft.groups.find((group) => isSimple(group) && group.type === 'and');
      if (!target) {
        const added = addGroup(draft, 'and');
        draft = added.doc;
        target = groupOf(draft, added.groupId)!;
      }
      const existing = rowsOf(target).find((row) => row.statId === statId);
      if (existing) return existing.id;
      const added = addRow(draft, target.id, statId);
      if (added.rowId === null) return '';
      set({ draft: added.doc });
      return added.rowId;
    },

    setConditionStat(rowId, statId) {
      set({ draft: setRowStat(state.draft, rowId, statId) });
    },

    removeCondition(rowId) {
      const group = editableOf(state.draft, rowId);
      const removed = removeRow(state.draft, rowId);
      change(group ? settle(removed, group.id) : { draft: removed, notice: null });
    },

    addAlternative(anchorId, pick) {
      let draft = state.draft;
      let group = groupOf(draft, anchorId) ?? editableOf(draft, anchorId);
      if (!group || group.opaque || group.type === 'not') return '';
      if (group.type === 'and') {
        // A required row: it opens a new group, At least 1 of it and the pick.
        const created = addGroup(draft, 'count');
        draft = moveRow(setGroupValue(created.doc, created.groupId, { min: 1 }), anchorId, created.groupId);
        group = groupOf(draft, created.groupId) as EditableGroup;
      }
      const target = group as EditableGroup;
      let pickedId: string;
      if ('rowId' in pick) {
        const source = editableOf(draft, pick.rowId);
        if (!source || source.type !== 'and') return '';
        draft = moveRow(draft, pick.rowId, target.id);
        pickedId = pick.rowId;
      } else {
        const existing = target.rows.find((row) => row.statId === pick.statId);
        if (existing) {
          if (draft !== state.draft) change({ draft, notice: null });
          return existing.id;
        }
        const added = addRow(draft, target.id, pick.statId);
        if (added.rowId === null) return '';
        draft = added.doc;
        pickedId = added.rowId;
      }
      change({ draft, notice: null });
      return pickedId;
    },

    requireSeparately(rowId) {
      const group = editableOf(state.draft, rowId);
      if (!group || group.type !== 'count') return;
      const allOf = withAllOf(state.draft);
      change(settle(moveRow(allOf.draft, rowId, allOf.groupId), group.id));
    },

    requireAllSeparately(groupId) {
      const group = groupOf(state.draft, groupId);
      if (!group || group.opaque || group.type !== 'count') return;
      let { draft, groupId: allOfId } = withAllOf(state.draft);
      for (const row of group.rows) draft = moveRow(draft, row.id, allOfId);
      change({ draft: removeGroup(draft, groupId), notice: { code: 'required-separately', message: 'Each parameter is required separately now', undo: true } });
    },

    exclude(rowId, statId) {
      const group = editableOf(state.draft, rowId);
      const row = rowById(rowId);
      if (!group || group.type !== 'and' || !row) return false;
      const target = statId ?? row.statId;
      // A total is a sum of sources: its absence is not the absence of a modifier (§6.5).
      if (target.startsWith('pseudo.')) return false;
      excludedValues.set(rowId, row.value);
      let draft = setRowValue(target === row.statId ? state.draft : setRowStat(state.draft, rowId, target), rowId, undefined);
      // A None of kept as it is (ranges, turned off) gets no company: an exclusion of its own.
      let none = draft.groups.find((each) => isSimple(each) && each.type === 'not')?.id;
      if (!none) {
        const added = addGroup(draft, 'not');
        draft = added.doc;
        none = added.groupId;
      }
      const { [rowId]: _typed, ...inputs } = state.inputs;
      change({ draft: moveRow(draft, rowId, none), inputs, notice: null });
      return true;
    },

    require(rowId) {
      const group = editableOf(state.draft, rowId);
      if (!group || group.type !== 'not') return;
      const allOf = withAllOf(state.draft);
      const draft = setRowValue(moveRow(allOf.draft, rowId, allOf.groupId), rowId, excludedValues.get(rowId));
      excludedValues.delete(rowId);
      change(settle(draft, group.id));
    },

    moveCondition(rowId, groupId) {
      change({ draft: moveRow(state.draft, rowId, groupId), notice: null });
    },

    addGroup(type) {
      const added = addGroup(state.draft, type);
      const draft = type === 'count' ? setGroupValue(added.doc, added.groupId, { min: 1 }) : added.doc;
      set({ draft });
      return added.groupId;
    },

    removeGroup(groupId) {
      change({ draft: removeGroup(state.draft, groupId), notice: { code: 'group-removed', message: 'Group removed', undo: true } });
    },

    setGroupCount(groupId, count) {
      const group = groupOf(state.draft, groupId);
      if (!group || group.opaque) return;
      set({ draft: setGroupValue(state.draft, groupId, { ...group.value, min: count }) });
    },

    setItemContext(context) {
      let draft = setItemContext(state.draft, context);
      let notice: Notice | null = null;
      const { category, type } = readItemContext(draft);
      if ('category' in context && !('type' in context) && type && baseFits?.(category, type) === false) {
        draft = setItemContext(draft, { type: null });
        notice = { code: 'base-cleared', message: 'Base cleared for the new category', undo: true };
      }
      change({ draft, notice });
    },

    setBudget(budget) {
      const before = readBudget(state.draft);
      const draft = setBudget(state.draft, budget);
      const kept = before.min !== null || before.max !== null;
      const currencyChanged = 'currency' in budget && budget.currency !== before.currency && kept;
      set({ draft, notice: currencyChanged ? { code: 'currency-changed', message: 'Amount kept; currency changed', undo: false } : null });
    },

    setBudgetInput(field, text) {
      const parsed = parseNumber(text);
      const inputs = { ...state.inputs, budget: { ...state.inputs.budget, [field]: text } };
      set({ inputs, draft: parsed === 'invalid' ? state.draft : setBudget(state.draft, { [field]: parsed ?? null }) });
    },

    setLeague(next) {
      set({ league: next });
    },

    setSort(next) {
      set({ sort: next });
    },

    clearFilters() {
      // Conditions and the item go; the listing mode (status), league and sort stay.
      change({ draft: { ...state.draft, groups: [], hasStats: true, rest: { filters: {} } }, inputs: {}, notice: null, filterOrder: [] });
    },

    undo() {
      const previous = history.pop();
      if (!previous) return;
      set({ ...previous, notice: null, canUndo: history.length > 0 });
    },

    setFilter(definition, value) {
      const draft = writeFilter(state.draft, definition, value);
      const present = readFilter(draft, definition) !== null;
      const others = state.filterOrder.filter((id) => id !== definition.id);
      const filterOrder = present ? (state.filterOrder.includes(definition.id) ? state.filterOrder : [...others, definition.id]) : others;
      const removed = !present && readFilter(state.draft, definition) !== null;
      change({ draft, filterOrder, notice: removed ? { code: 'filter-removed', message: 'Filter removed', undo: true } : null });
    },

    applyRequirementLimits(registry, limits) {
      const plan = planRequirementLimits(state.draft, registry, limits);
      if (Object.keys(plan.errors).length > 0 || plan.changes.length === 0) return false;
      let draft = state.draft;
      let filterOrder = state.filterOrder;
      for (const { definition, max } of plan.changes) {
        draft = writeFilter(draft, definition, { kind: 'range', min: null, max });
        if (!filterOrder.includes(definition.id)) filterOrder = [...filterOrder, definition.id];
      }
      change({ draft, filterOrder, notice: null });
      return true;
    },

    dismissNotice() {
      set({ notice: null });
    },

    resetChanges() {
      const base = state.applied ?? state.imported;
      history.length = 0;
      set({ draft: base.doc, league: base.league, sort: base.sort, inputs: {}, notice: null, canUndo: false });
    },

    setFixedRangeInput(section, key, field, text) {
      const parsed = parseNumber(text);
      const inputKey = `fixed:${section}.${key}`;
      const inputs = { ...state.inputs, [inputKey]: { ...state.inputs[inputKey], [field]: text } };
      set({ inputs, draft: parsed === 'invalid' ? state.draft : setFixedRange(state.draft, section, key, { [field]: parsed ?? null }) });
    },

    setFixedText(section, key, text) {
      set({ draft: setFixedText(state.draft, section, key, text) });
    },

    setFixedOption(section, key, option) {
      set({ draft: setFixedOption(state.draft, section, key, option) });
    },

    setListingMode(option) {
      set({ draft: { ...state.draft, status: { ...state.draft.status, option } } });
    },

    apply() {
      if (coolingDown()) return Promise.resolve();
      if (validate(state).some((issue) => issue.severity === 'error')) return Promise.resolve();
      // A notice is about the draft; applied, the draft is the search.
      if (state.notice) set({ notice: null });
      return run(state.draft, state.league, state.sort);
    },

    refresh() {
      if (!state.applied || coolingDown()) return Promise.resolve();
      return run(state.applied.doc, state.applied.league, state.applied.sort);
    },

    loadMore() {
      return results.loadMore();
    },

    sortResults(field) {
      const applied = state.applied;
      if (!applied || coolingDown()) return Promise.resolve();
      const sort: SearchSort = { [field]: applied.sort[field] === 'desc' ? 'asc' : 'desc' };
      set({ sort });
      return run(applied.doc, applied.league, sort);
    },

    loadDraft(next, nextLeague, nextSort) {
      history.length = 0;
      set({ draft: fromTradeQuery(next), league: nextLeague, sort: nextSort, inputs: {}, notice: { code: 'draft-restored', message: 'Unapplied changes restored', undo: false }, canUndo: false, filterOrder: [] });
    },

    importQuery(next, nextLeague, saved, nextSort = state.sort) {
      const nextDoc = fromTradeQuery(next);
      history.length = 0;
      revision++;
      inFlight = null;
      state = { ...state, sort: nextSort, imported: { doc: nextDoc, league: nextLeague, sort: nextSort } };
      const applied = restoreResults(saved);
      set({ draft: nextDoc, league: nextLeague, inputs: {}, applied, request: { status: 'idle' }, notice: null, canUndo: false, filterOrder: [] });
    },
  };
  return store;
}

/** Whether the draft (query, league or sort) differs from the applied search, or the imported one before any. */
export function isDirty(state: EditorState): boolean {
  const base = state.applied ?? state.imported;
  return searchKey(state.draft, state.league, state.sort) !== searchKey(base.doc, base.league, base.sort);
}

/** Problems to show at their fields; any error blocks Apply. */
export function validate(state: EditorState): Issue[] {
  const issues: Issue[] = [];
  for (const field of ['min', 'max'] as const) {
    const text = state.inputs.budget?.[field];
    if (text !== undefined && parseNumber(text) === 'invalid') issues.push({ severity: 'error', code: 'not-a-number', message: 'Enter a number', section: 'budget', field });
  }
  const budget = readBudget(state.draft);
  if (budget.min !== null && budget.max !== null && budget.min > budget.max) {
    issues.push({ severity: 'error', code: 'min-above-max', message: 'Minimum is higher than maximum', section: 'budget', field: 'min' });
  }
  // More filters: text that is not a number stays in its field; a minimum above the maximum.
  for (const [inputKey, texts] of Object.entries(state.inputs)) {
    if (!inputKey.startsWith('fixed:')) continue;
    const filter = inputKey.slice('fixed:'.length);
    for (const field of ['min', 'max'] as const) {
      const text = texts[field];
      if (text !== undefined && parseNumber(text) === 'invalid') issues.push({ severity: 'error', code: 'not-a-number', message: 'Enter a number', filter, field });
    }
    const [section, key] = filter.split('.') as [string, string];
    const range = readFixedRange(state.draft, section, key);
    if (range.min !== null && range.max !== null && range.min > range.max) {
      issues.push({ severity: 'error', code: 'min-above-max', message: 'Minimum is higher than maximum', filter, field: 'min' });
    }
  }
  for (const group of state.draft.groups) {
    if (group.opaque) continue;
    for (const row of group.rows) {
      for (const field of ['min', 'max'] as const) {
        const text = state.inputs[row.id]?.[field];
        if (text !== undefined && parseNumber(text) === 'invalid') {
          issues.push({ severity: 'error', code: 'not-a-number', message: 'Enter a number', rowId: row.id, field });
        }
      }
      const { min, max } = row.value ?? {};
      if (!row.disabled && typeof min === 'number' && typeof max === 'number' && min > max) {
        issues.push({ severity: 'error', code: 'min-above-max', message: 'Minimum is higher than maximum', rowId: row.id, field: 'min' });
      }
    }
    const count = group.value?.min;
    const active = group.rows.filter((row) => !row.disabled);
    if (group.type === 'count' && !group.disabled && typeof count === 'number' && (!Number.isInteger(count) || count < 1 || count > active.length)) {
      issues.push({ severity: 'error', code: 'count-out-of-range', message: `Choose a count from 1 to ${active.length}`, groupId: group.id, field: 'count' });
    }
    // The same condition twice would count twice (§7).
    if (group.type === 'count' && !group.disabled) {
      const seen = new Set<string>();
      for (const row of active) {
        if (seen.has(row.statId)) issues.push({ severity: 'error', code: 'duplicate-in-group', message: 'This parameter is already in the group', rowId: row.id });
        seen.add(row.statId);
      }
    }
  }
  // One modifier both required and excluded: nothing can match.
  const required = new Set(state.draft.groups.filter((group) => !group.opaque && group.type === 'and' && !group.disabled).flatMap(rowsOf).filter((row) => !row.disabled).map((row) => row.statId));
  for (const group of state.draft.groups) {
    if (group.opaque || group.type !== 'not' || group.disabled) continue;
    for (const row of group.rows) {
      if (!row.disabled && required.has(row.statId)) issues.push({ severity: 'error', code: 'required-and-excluded', message: 'This modifier is both required and excluded', rowId: row.id });
    }
  }
  return issues;
}

function searchKey(doc: QueryDocument, league: string, sort: SearchSort): string {
  return `${league}|${JSON.stringify(sort)}|${queryKey(compile(doc) as TradeQuery)}`;
}

const NUMBER = /^[-+]?(\d+(\.\d+)?|\.\d+)$/;

/** A finished number, undefined for an empty field (no bound), or 'invalid' for text that is not one (yet): "-", "1.". */
function parseNumber(text: string): number | undefined | 'invalid' {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  return NUMBER.test(trimmed) ? Number(trimmed) : 'invalid';
}
