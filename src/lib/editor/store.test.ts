import { describe, expect, it, vi } from 'vitest';
import { createFakeClient, type FakeScenario } from '../../../tests/fixtures/fake-client';
import { readBudget, readItemContext } from './context';
import { compile, rowsOf } from './document';
import { createEditorStore, type EditorStoreOptions, isDirty, validate } from './store';

const QUERY = {
  status: { option: 'online' },
  type: 'Iron Gauntlets',
  stats: [
    { type: 'and', filters: [{ id: 'pseudo.pseudo_total_life', value: { min: 80 } }, { id: 'explicit.stat_w', value: { weight: 2, min: 1 } }] },
    { type: 'count', value: { min: 2 }, filters: [{ id: 'pseudo.pseudo_total_fire_resistance', value: { min: 35 } }, { id: 'pseudo.pseudo_total_cold_resistance', value: { min: 30 } }, { id: 'pseudo.pseudo_total_lightning_resistance', value: { min: 30 } }] },
  ],
  filters: {
    type_filters: { filters: { category: { option: 'armour.gloves' }, rarity: { option: 'rare' } } },
    trade_filters: { filters: { price: { max: 50, option: 'exalted' } } },
  },
};

const NOW = Date.parse('2026-09-23T12:00:00Z');

function setup(scenario: FakeScenario = 'normal', options: Partial<EditorStoreOptions> = {}) {
  const fake = createFakeClient(scenario);
  const client = { search: vi.fn(fake.search), fetchListings: vi.fn(fake.fetchListings) };
  let time = NOW;
  const onApplied = vi.fn();
  const store = createEditorStore({ client, league: 'Forbidden Rites', query: QUERY, now: () => time, onApplied, ...options });
  const rows = () => store.getState().draft.groups.flatMap(rowsOf);
  const row = (statId: string) => rows().find((candidate) => candidate.statId === statId)!;
  return { store, client, fake, onApplied, rows, row, tick: (ms: number) => (time += ms) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const LIFE = 'pseudo.pseudo_total_life';
const FIRE = 'pseudo.pseudo_total_fire_resistance';

describe('editor store: inputs', () => {
  it('starts from the imported query, unchanged and not dirty', () => {
    const { store } = setup();
    expect(compile(store.getState().draft)).toEqual(QUERY);
    expect(store.getState().applied).toBeNull();
    expect(isDirty(store.getState())).toBe(false);
  });

  it('puts a typed number into the row, keeping its other value fields', () => {
    const { store, row } = setup();
    store.setConditionInput(row('explicit.stat_w').id, 'min', '3');
    expect(row('explicit.stat_w').value).toEqual({ weight: 2, min: 3 });
    expect(store.getState().inputs[row('explicit.stat_w').id]).toEqual({ min: '3' });
    expect(isDirty(store.getState())).toBe(true);
  });

  it('keeps text that is not a number yet in the field only, and blocks Apply with an error at the field', async () => {
    const { store, client, row } = setup();
    const life = row(LIFE).id;
    store.setConditionInput(life, 'min', '-');
    expect(row(LIFE).value).toEqual({ min: 80 }); // the old number stays in the query…
    expect(validate(store.getState())).toEqual([expect.objectContaining({ severity: 'error', code: 'not-a-number', rowId: life, field: 'min', message: 'Enter a number' })]);
    await store.apply(); // …but is never searched in its place
    expect(client.search).not.toHaveBeenCalled();

    store.setConditionInput(life, 'min', '-5');
    expect(row(LIFE).value).toEqual({ min: -5 });
    expect(validate(store.getState())).toEqual([]);
  });

  it('tells Any (an empty field) from 0, and keeps the row when both bounds are cleared', () => {
    const { store, row } = setup();
    const life = row(LIFE).id;
    store.setConditionInput(life, 'min', '0');
    expect(row(LIFE).value).toEqual({ min: 0 });
    store.setConditionInput(life, 'min', '');
    expect(row(LIFE)).toMatchObject({ value: undefined, disabled: false });
    expect(compile(store.getState().draft).stats).toContainEqual(expect.objectContaining({ filters: expect.arrayContaining([{ id: LIFE }]) }));
  });

  it('switches a row off without touching its bounds', () => {
    const { store, row } = setup();
    store.setConditionEnabled(row(LIFE).id, false);
    expect(row(LIFE)).toMatchObject({ disabled: true, value: { min: 80 } });
  });

  it('reports a minimum above the maximum at the row and swaps only that row', () => {
    const { store, row } = setup();
    const life = row(LIFE).id;
    store.setConditionInput(life, 'max', '40');
    store.setConditionInput(row(FIRE).id, 'max', '50');
    expect(validate(store.getState())).toEqual([expect.objectContaining({ severity: 'error', code: 'min-above-max', rowId: life, message: 'Minimum is higher than maximum' })]);
    store.swapBounds(life);
    expect(row(LIFE).value).toEqual({ min: 40, max: 80 });
    expect(store.getState().inputs[life]).toEqual({ min: '40', max: '80' });
    expect(row(FIRE).value).toEqual({ min: 35, max: 50 });
    expect(validate(store.getState())).toEqual([]);
  });

  it('asks for as many active rows as an At least N group counts', () => {
    const { store, row } = setup();
    const group = store.getState().draft.groups[1]!.id;
    store.setGroupCount(group, 3);
    expect(validate(store.getState())).toEqual([]);
    store.setConditionEnabled(row(FIRE).id, false);
    expect(validate(store.getState())).toEqual([expect.objectContaining({ severity: 'error', code: 'count-out-of-range', groupId: group, message: 'Choose a count from 1 to 2' })]);
  });
});

describe('editor store: conditions and context', () => {
  it('adds an empty group of a kind, to be filled, and removes a group with its conditions, Undo bringing it back', () => {
    const { store } = setup();
    const before = store.getState().draft.groups.length;
    const none = store.addGroup('not');
    expect(store.getState().draft.groups.at(-1)).toMatchObject({ id: none, type: 'not', rows: [] });
    const count = store.addGroup('count');
    expect(store.getState().draft.groups.at(-1)).toMatchObject({ id: count, type: 'count', value: { min: 1 } });
    store.addCondition(none, 'explicit.stat_1');
    expect(compile(store.getState().draft).stats).toContainEqual({ type: 'not', filters: [{ id: 'explicit.stat_1' }] });
    const [, countGroup] = store.getState().draft.groups;
    store.removeGroup(countGroup!.id);
    expect(store.getState().draft.groups).toHaveLength(before + 1);
    expect(compile(store.getState().draft).stats).not.toContainEqual(expect.objectContaining({ type: 'count', value: { min: 2 } }));
    store.undo();
    expect(store.getState().draft.groups).toHaveLength(before + 2);
    expect(isDirty(store.getState())).toBe(true);
  });

  it('adds a condition to a group, and focuses the one already there instead of a duplicate', () => {
    const { store, rows } = setup();
    const [all, count] = store.getState().draft.groups;
    const added = store.addCondition(all!.id, 'explicit.stat_new');
    expect(rows().find((row) => row.id === added)).toMatchObject({ statId: 'explicit.stat_new' });
    expect(store.addCondition(all!.id, 'explicit.stat_new')).toBe(added);
    expect(store.addCondition(count!.id, 'explicit.stat_new')).not.toBe(added); // the same stat in another group is a real query
  });

  it('switches the source of a condition, keeping its bounds and typed text, and it is a change', () => {
    const { store, row, rows } = setup();
    const life = row(LIFE);
    store.setConditionInput(life.id, 'min', '90');
    store.setConditionStat(life.id, 'explicit.stat_3299347043');
    expect(rows().find((each) => each.id === life.id)).toMatchObject({ statId: 'explicit.stat_3299347043', value: { min: 90 } });
    expect(store.getState().inputs[life.id]).toEqual({ min: '90' });
    expect(isDirty(store.getState())).toBe(true);
  });

  it('puts a notice away once the draft is applied: it was about the draft', async () => {
    const { store } = setup();
    store.loadDraft(QUERY, 'Forbidden Rites', { price: 'desc' });
    expect(store.getState().notice).not.toBeNull();
    await store.apply();
    expect(store.getState().notice).toBeNull();
  });

  it('lets a notice be dismissed', () => {
    const { store } = setup();
    store.loadDraft(QUERY, 'Forbidden Rites', { price: 'desc' });
    store.dismissNotice();
    expect(store.getState().notice).toBeNull();
  });

  it('brings back a draft left unapplied, as changes over the same search, without a request', () => {
    const { store, client, row } = setup();
    const changed = { ...QUERY, stats: [{ ...QUERY.stats[0]!, filters: [{ id: LIFE, value: { min: 95 } }] }, QUERY.stats[1]!] };
    store.loadDraft(changed, 'Forbidden Rites', { price: 'desc' });
    const state = store.getState();
    expect(row(LIFE).value).toEqual({ min: 95 });
    expect(state.sort).toEqual({ price: 'desc' });
    expect(isDirty(state)).toBe(true);
    expect(state.notice).toMatchObject({ message: 'Unapplied changes restored' });
    store.setConditionInput(row(LIFE).id, 'min', '96'); // the next edit: the notice has been read
    expect(store.getState().notice).toBeNull();
    store.resetChanges();
    expect(compile(store.getState().draft)).toEqual(QUERY);
    expect(client.search).not.toHaveBeenCalled();
  });

  it('takes a range of a fixed filter as typed: a number goes to the draft, other text stays in the field with an error', () => {
    const { store } = setup();
    store.setFixedRangeInput('req_filters', 'lvl', 'min', '60');
    expect(compile(store.getState().draft)).toMatchObject({ filters: { req_filters: { filters: { lvl: { min: 60 } } } } });
    store.setFixedRangeInput('req_filters', 'lvl', 'max', 'abc');
    expect(store.getState().inputs['fixed:req_filters.lvl']).toEqual({ min: '60', max: 'abc' });
    expect(validate(store.getState())).toContainEqual(expect.objectContaining({ code: 'not-a-number', filter: 'req_filters.lvl', field: 'max' }));
    store.setFixedRangeInput('req_filters', 'lvl', 'max', '40');
    expect(validate(store.getState())).toContainEqual(expect.objectContaining({ code: 'min-above-max', filter: 'req_filters.lvl', field: 'min' }));
    store.setFixedRangeInput('req_filters', 'lvl', 'max', '');
    expect(validate(store.getState())).toEqual([]);
    expect(isDirty(store.getState())).toBe(true);
  });

  it('sets a text filter', () => {
    const { store } = setup();
    store.setFixedText('trade_filters', 'account', 'Seller#1');
    expect(compile(store.getState().draft)).toMatchObject({ filters: { trade_filters: { filters: { account: { input: 'Seller#1' } } } } });
  });

  it('opens another search with its own sort, unchanged and without a request', () => {
    const { store, client } = setup();
    store.importQuery({ status: { option: 'any' } }, 'Standard', undefined, { 'stat.pseudo.pseudo_total_life': 'desc' });
    const state = store.getState();
    expect([state.league, state.sort]).toEqual(['Standard', { 'stat.pseudo.pseudo_total_life': 'desc' }]);
    expect(isDirty(state)).toBe(false);
    expect(client.search).not.toHaveBeenCalled();
  });

  it('adds to All of by default, creating the group when the query has none', () => {
    const { store } = setup('normal', { query: { status: { option: 'online' } } });
    const added = store.addCondition(null, LIFE);
    expect(compile(store.getState().draft).stats).toEqual([{ type: 'and', filters: [{ id: LIFE }] }]);
    expect(rowsOf(store.getState().draft.groups[0]!)[0]!.id).toBe(added);
  });

  it('removes a condition, and Undo brings it back with its id', () => {
    const { store, row, rows } = setup();
    const life = row(LIFE);
    store.removeCondition(life.id);
    expect(rows().map((r) => r.statId)).not.toContain(LIFE);
    store.undo();
    expect(row(LIFE)).toEqual(life);
  });

  it('clears a base that does not fit a new category, says so, and Undo restores the whole change', () => {
    const baseFits = vi.fn((category: string | null, type: string) => (category === 'armour.gloves' ? type === 'Iron Gauntlets' : false));
    const { store } = setup('normal', { baseFits });
    store.setItemContext({ category: 'accessory.ring' });
    expect(readItemContext(store.getState().draft)).toEqual({ category: 'accessory.ring', rarity: 'rare', type: null, name: null });
    expect(store.getState().notice).toEqual({ code: 'base-cleared', message: 'Base cleared for the new category', undo: true });
    expect(store.getState().draft.groups.flatMap(rowsOf)).toHaveLength(5); // conditions stay

    store.undo();
    expect(readItemContext(store.getState().draft)).toEqual({ category: 'armour.gloves', rarity: 'rare', type: 'Iron Gauntlets', name: null });
    expect(store.getState().notice).toBeNull();
  });

  it('keeps a base the data cannot place (unknown fit)', () => {
    const { store } = setup('normal', { baseFits: () => null });
    store.setItemContext({ category: 'accessory.ring' });
    expect(readItemContext(store.getState().draft).type).toBe('Iron Gauntlets');
    expect(store.getState().notice).toBeNull();
  });

  it('keeps the amount when the budget currency changes, and says so', () => {
    const { store } = setup();
    store.setBudget({ currency: 'divine' });
    expect(readBudget(store.getState().draft)).toEqual({ min: null, max: 50, currency: 'divine' });
    expect(store.getState().notice).toEqual({ code: 'currency-changed', message: 'Amount kept; currency changed', undo: false });
  });

  it('clears the filters but keeps the listing mode, with Undo', () => {
    const { store } = setup();
    store.clearFilters();
    expect(compile(store.getState().draft)).toEqual({ status: { option: 'online' }, stats: [], filters: {} });
    store.undo();
    expect(compile(store.getState().draft)).toEqual(QUERY);
  });
});

describe('editor store: Apply', () => {
  it('searches the compiled draft once and makes it the applied search', async () => {
    const { store, client, onApplied, row } = setup();
    store.setConditionInput(row(LIFE).id, 'min', '90');
    await store.apply();

    expect(client.search).toHaveBeenCalledTimes(1);
    const [league, query, sort] = client.search.mock.calls[0]!;
    expect([league, sort]).toEqual(['Forbidden Rites', { price: 'asc' }]);
    expect((query as typeof QUERY).stats[0]!.filters[0]).toEqual({ id: LIFE, value: { min: 90 } });
    expect(store.getState().applied).toMatchObject({ league: 'Forbidden Rites', sort: { price: 'asc' }, revision: 1, id: 'H4sIfake-normal' });
    expect(store.getState().results).toMatchObject({ status: 'ready', total: 1135 });
    expect(isDirty(store.getState())).toBe(false);
    expect(onApplied).toHaveBeenCalledWith(store.getState().applied, expect.objectContaining({ id: 'H4sIfake-normal' }));
  });

  it('runs one search for a double Apply', async () => {
    const { store, client } = setup();
    await Promise.all([store.apply(), store.apply()]);
    expect(client.search).toHaveBeenCalledTimes(1);
  });

  it('ties the results to the revision that was sent while the draft moves on', async () => {
    const { store, fake, row } = setup('slow');
    const applying = store.apply();
    expect(store.getState().request).toEqual({ status: 'searching', revision: 1 });
    store.setConditionInput(row(LIFE).id, 'min', '100');
    fake.release();
    await applying;

    expect(store.getState().applied!.revision).toBe(1);
    expect(rowsOf(store.getState().applied!.doc.groups[0]!)[0]!.value).toEqual({ min: 80 });
    expect(isDirty(store.getState())).toBe(true);
  });

  it('keeps the applied search when a search fails, and waits out a rate limit without retrying', async () => {
    const { store, client, tick } = setup('rate-limited');
    await store.apply();
    expect(store.getState().applied).toBeNull();
    expect(store.getState().request).toEqual({ status: 'cooldown', until: NOW + 42_000 });

    tick(10_000);
    await store.apply();
    expect(client.search).toHaveBeenCalledTimes(1);
    tick(32_000);
    await flush();
    expect(client.search).toHaveBeenCalledTimes(1); // no automatic retry
    await store.apply();
    expect(client.search).toHaveBeenCalledTimes(2);
  });

  it('reports other failures as errors', async () => {
    const { store } = setup('verification');
    await store.apply();
    expect(store.getState().request).toMatchObject({ status: 'error', kind: 'verification' });
  });

  it('takes league and sort into the draft: dirty, no search until Apply', async () => {
    const { store, client } = setup();
    await store.apply();
    store.setSort({ price: 'desc' });
    expect(isDirty(store.getState())).toBe(true);
    store.setSort({ price: 'asc' });
    expect(isDirty(store.getState())).toBe(false);
    store.setLeague('Standard');
    expect(isDirty(store.getState())).toBe(true);
    expect(client.search).toHaveBeenCalledTimes(1);
    await store.apply();
    expect(client.search).toHaveBeenLastCalledWith('Standard', expect.anything(), { price: 'asc' });
  });

  it('resets the draft to the applied search, or to the imported one before any', async () => {
    const { store, row } = setup();
    store.setConditionInput(row(LIFE).id, 'min', '90');
    store.resetChanges();
    expect(compile(store.getState().draft)).toEqual(QUERY);
    expect(store.getState().inputs).toEqual({});

    store.setConditionInput(row(LIFE).id, 'min', '95');
    await store.apply();
    store.setConditionInput(row(LIFE).id, 'min', '120');
    store.setSort({ price: 'desc' });
    store.resetChanges();
    expect(row(LIFE).value).toEqual({ min: 95 });
    expect(store.getState().sort).toEqual({ price: 'asc' });
    expect(isDirty(store.getState())).toBe(false);
  });

  it('notifies subscribers of every change', () => {
    const { store, row } = setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.setConditionInput(row(LIFE).id, 'min', '81');
    expect(listener).toHaveBeenCalledWith(store.getState());
    unsubscribe();
    store.setConditionInput(row(LIFE).id, 'min', '82');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('editor store: results lifecycle', () => {
  const SAVED = { id: 'H4sIsaved', total: 1117, hashes: Array.from({ length: 25 }, (_, i) => `fake${String(i).padStart(2, '0')}`), savedAt: NOW - 12 * 60_000 };

  it('shows remembered results of the imported search as applied, without a request', () => {
    const { store, client } = setup('normal', { restore: { ...SAVED, listings: [] } });
    expect(store.getState().results).toMatchObject({ status: 'ready', total: 1117, savedAt: SAVED.savedAt });
    expect(store.getState().applied).toMatchObject({ league: 'Forbidden Rites', revision: 0, id: 'H4sIsaved' });
    expect(isDirty(store.getState())).toBe(false);
    expect(client.search).not.toHaveBeenCalled();
  });

  it('hands the shown results to onApplied, for remembering them', async () => {
    const { store, onApplied } = setup();
    await store.apply();
    const [, results] = onApplied.mock.lastCall!;
    expect(results).toMatchObject({ id: 'H4sIfake-normal', total: 1135 });
    expect(results.listings).toHaveLength(10);
  });

  it('loads more of the applied results', async () => {
    const { store, client } = setup();
    await store.apply();
    await store.loadMore();
    expect(client.fetchListings).toHaveBeenCalledTimes(2);
    expect(store.getState().results).toMatchObject({ status: 'ready' });
    expect((store.getState().results as { listings: unknown[] }).listings).toHaveLength(20);
  });

  it('refreshes the applied search without touching the draft', async () => {
    const { store, client, row } = setup();
    await store.apply();
    store.setConditionInput(row(LIFE).id, 'min', '99');
    await store.refresh();
    expect(client.search).toHaveBeenCalledTimes(2);
    expect((client.search.mock.calls[1]![1] as typeof QUERY).stats[0]!.filters[0]).toEqual({ id: LIFE, value: { min: 80 } });
    expect(row(LIFE).value).toEqual({ min: 99 });
    expect(store.getState().applied!.revision).toBe(2);
  });

  it('refreshes nothing before the first search', async () => {
    const { store, client } = setup();
    await store.refresh();
    expect(client.search).not.toHaveBeenCalled();
  });

  it('changes the listing mode in the draft', () => {
    const { store } = setup();
    store.setListingMode('securable');
    expect(compile(store.getState().draft).status).toEqual({ option: 'securable' });
    expect(isDirty(store.getState())).toBe(true);
  });

  it('opens another search (back / forward): a new draft, no search, remembered results if any', async () => {
    const { store, client } = setup();
    await store.apply();
    store.importQuery({ status: { option: 'any' } }, 'Standard');
    expect(compile(store.getState().draft)).toEqual({ status: { option: 'any' } });
    expect(store.getState()).toMatchObject({ league: 'Standard', applied: null, inputs: {}, canUndo: false, results: { status: 'idle' } });

    store.importQuery(QUERY, 'Forbidden Rites', { ...SAVED, listings: [] });
    expect(store.getState().results).toMatchObject({ status: 'ready', total: 1117 });
    expect(store.getState().applied).toMatchObject({ id: 'H4sIsaved' });
    expect(client.search).toHaveBeenCalledTimes(1);
  });
});

describe('editor store: budget fields', () => {
  it('takes typed prices like the condition fields: numbers go in, empty means no limit', () => {
    const { store } = setup();
    store.setBudgetInput('max', '60');
    expect(readBudget(store.getState().draft)).toEqual({ min: null, max: 60, currency: 'exalted' });
    expect(store.getState().inputs.budget).toEqual({ max: '60' });
    store.setBudgetInput('max', '');
    expect(readBudget(store.getState().draft).max).toBeNull();
  });

  it('keeps an unfinished price in the field and blocks Apply with an error there', async () => {
    const { store, client } = setup();
    store.setBudgetInput('max', '6.');
    expect(readBudget(store.getState().draft).max).toBe(50);
    expect(validate(store.getState())).toEqual([expect.objectContaining({ severity: 'error', code: 'not-a-number', section: 'budget', field: 'max' })]);
    await store.apply();
    expect(client.search).not.toHaveBeenCalled();
  });

  it('reports a minimum price above the maximum', () => {
    const { store } = setup();
    store.setBudgetInput('min', '70');
    expect(validate(store.getState())).toEqual([expect.objectContaining({ code: 'min-above-max', section: 'budget', field: 'min', message: 'Minimum is higher than maximum' })]);
  });
});

describe('editor store: sort by a line of the results', () => {
  it('searches the applied query sorted by the field, high to low, and flips on a second click', async () => {
    const { store, client, row } = setup();
    await store.apply();
    store.setConditionInput(row(LIFE).id, 'min', '99'); // a draft edit stays a draft edit
    await store.sortResults('stat.explicit.stat_1');
    expect(client.search).toHaveBeenLastCalledWith('Forbidden Rites', expect.objectContaining({ stats: QUERY.stats }), { 'stat.explicit.stat_1': 'desc' });
    expect(store.getState().applied!.sort).toEqual({ 'stat.explicit.stat_1': 'desc' });
    expect(store.getState().sort).toEqual({ 'stat.explicit.stat_1': 'desc' });
    expect(row(LIFE).value).toEqual({ min: 99 });

    await store.sortResults('stat.explicit.stat_1');
    expect(client.search).toHaveBeenLastCalledWith('Forbidden Rites', expect.anything(), { 'stat.explicit.stat_1': 'asc' });
    await store.sortResults('ilvl');
    expect(client.search).toHaveBeenLastCalledWith('Forbidden Rites', expect.anything(), { ilvl: 'desc' });
  });

  it('does nothing before a search or while a rate limit runs', async () => {
    const before = setup();
    await before.store.sortResults('ilvl');
    expect(before.client.search).not.toHaveBeenCalled();

    const limited = setup('rate-limited');
    await limited.store.apply();
    await limited.store.sortResults('ilvl');
    expect(limited.client.search).toHaveBeenCalledTimes(1);
  });
});
