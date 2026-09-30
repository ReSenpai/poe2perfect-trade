import { describe, expect, it, vi } from 'vitest';
import { createFakeClient } from '../../../tests/fixtures/fake-client';
import { compile, type EditableGroup, rowsOf } from './document';
import { createEditorStore, validate } from './store';

// Step 39 (the simple conditions design): required parameters (All of), alternatives (At least N of M,
// a count group with a minimum only) and exclusions (a not group, no range).

const LIFE = 'pseudo.pseudo_total_life';
const STR = 'pseudo.pseudo_total_strength';
const FIRE = 'pseudo.pseudo_total_fire_resistance';
const COLD = 'pseudo.pseudo_total_cold_resistance';
const CHAOS = 'pseudo.pseudo_total_chaos_resistance';
const RARITY = 'explicit.stat_3917489142';

const QUERY = {
  status: { option: 'online' },
  stats: [
    {
      type: 'and',
      filters: [
        { id: LIFE, value: { min: 80 } },
        { id: STR, value: { min: 25 } },
        { id: FIRE, value: { min: 35 } },
        { id: COLD, value: { min: 30 } },
        { id: RARITY, value: { min: 10 } },
      ],
    },
  ],
};

function setup(query: unknown = QUERY) {
  const fake = createFakeClient('normal');
  const store = createEditorStore({ client: { search: vi.fn(fake.search), fetchListings: vi.fn(fake.fetchListings) }, league: 'Forbidden Rites', query });
  const draft = () => store.getState().draft;
  const rows = () => draft().groups.flatMap(rowsOf);
  const row = (statId: string) => rows().find((candidate) => candidate.statId === statId)!;
  const groups = (type: string) => draft().groups.filter((group): group is EditableGroup => !group.opaque && group.type === type);
  const stats = () => compile(draft()).stats as unknown[];
  return { store, draft, rows, row, groups, stats };
}

describe('alternatives: At least N of M', () => {
  it('turns a required parameter and a new one into one group, 1 of 2, the first keeping its range', () => {
    const { store, row, groups, stats } = setup();
    const added = store.addAlternative(row(FIRE).id, { statId: CHAOS });
    expect(added).toBe(row(CHAOS).id);
    expect(stats()).toEqual([
      { type: 'and', filters: [{ id: LIFE, value: { min: 80 } }, { id: STR, value: { min: 25 } }, { id: COLD, value: { min: 30 } }, { id: RARITY, value: { min: 10 } }] },
      { type: 'count', value: { min: 1 }, filters: [{ id: FIRE, value: { min: 35 } }, { id: CHAOS }] },
    ]);
    expect(groups('count')[0]!.rows.map((each) => each.id)[0]).toBe(row(FIRE).id); // the same row, moved
    store.undo();
    expect(groups('count')).toHaveLength(0);
    expect(row(FIRE)).toBeTruthy();
  });

  it('adds more alternatives to the group, keeping N; a stat already in it is not added twice', () => {
    const { store, row, groups } = setup();
    store.addAlternative(row(FIRE).id, { statId: CHAOS });
    const group = groups('count')[0]!.id;
    store.setGroupCount(group, 2);
    store.addAlternative(group, { statId: 'pseudo.pseudo_total_lightning_resistance' });
    expect(groups('count')[0]!.rows).toHaveLength(3);
    expect(groups('count')[0]!.value).toEqual({ min: 2 });
    expect(store.addAlternative(group, { statId: CHAOS })).toBe(row(CHAOS).id); // focus the one there
    expect(groups('count')[0]!.rows).toHaveLength(3);
  });

  it('moves a parameter already in the search into the alternatives, with its range', () => {
    const { store, row, groups } = setup();
    store.addAlternative(row(FIRE).id, { rowId: row(COLD).id });
    expect(groups('count')[0]!.rows.map((each) => [each.statId, each.value])).toEqual([
      [FIRE, { min: 35 }],
      [COLD, { min: 30 }],
    ]);
    expect(groups('and')[0]!.rows.map((each) => each.statId)).toEqual([LIFE, STR, RARITY]);
  });

  it('makes a row required separately; with one row left and N = 1 the group becomes a required parameter', () => {
    const { store, row, groups } = setup();
    store.addAlternative(row(FIRE).id, { rowId: row(COLD).id });
    store.requireSeparately(row(COLD).id);
    expect(groups('count')).toHaveLength(0);
    expect(groups('and')[0]!.rows.map((each) => each.statId)).toEqual([LIFE, STR, RARITY, COLD, FIRE]);
  });

  it('requires all of a group separately, and Undo brings the group back', () => {
    const { store, row, groups } = setup();
    store.addAlternative(row(FIRE).id, { rowId: row(COLD).id });
    store.addAlternative(groups('count')[0]!.id, { statId: CHAOS });
    store.requireAllSeparately(groups('count')[0]!.id);
    expect(groups('count')).toHaveLength(0);
    expect(groups('and')[0]!.rows.map((each) => each.statId)).toEqual([LIFE, STR, RARITY, FIRE, COLD, CHAOS]);
    expect(store.getState().notice).toEqual(expect.objectContaining({ code: 'required-separately', undo: true }));
    store.undo();
    expect(groups('count')[0]!.rows).toHaveLength(3);
  });

  describe('removing a row (§6.4)', () => {
    const three = () => {
      const context = setup();
      const { store, row, groups } = context;
      store.addAlternative(row(FIRE).id, { rowId: row(COLD).id });
      store.addAlternative(groups('count')[0]!.id, { statId: CHAOS });
      return { ...context, group: groups('count')[0]!.id };
    };

    it('keeps N while it fits the rows left', () => {
      const { store, row, groups, group } = three();
      store.setGroupCount(group, 2);
      store.removeCondition(row(CHAOS).id);
      expect(groups('count')[0]!.value).toEqual({ min: 2 });
      expect(validate(store.getState())).toEqual([]);
    });

    it('never lowers N quietly: N above the rows left is an error at the group', () => {
      const { store, row, groups, group } = three();
      store.setGroupCount(group, 3);
      store.removeCondition(row(CHAOS).id);
      expect(groups('count')[0]!.value).toEqual({ min: 3 });
      expect(validate(store.getState())).toEqual([expect.objectContaining({ severity: 'error', code: 'count-out-of-range', groupId: group, field: 'count', message: 'Choose a count from 1 to 2' })]);
    });

    it('with one row left and N = 1, the row becomes required', () => {
      const { store, row, groups } = three();
      store.removeCondition(row(CHAOS).id);
      store.removeCondition(row(COLD).id);
      expect(groups('count')).toHaveLength(0);
      expect(groups('and')[0]!.rows.map((each) => each.statId)).toContain(FIRE);
    });

    it('with one row left and N > 1, the group stays with its error', () => {
      const { store, row, groups, group } = three();
      store.setGroupCount(group, 2);
      store.removeCondition(row(CHAOS).id);
      store.removeCondition(row(COLD).id);
      expect(groups('count')[0]!.rows.map((each) => each.statId)).toEqual([FIRE]);
      expect(validate(store.getState())).toEqual([expect.objectContaining({ code: 'count-out-of-range', message: 'Choose a count from 1 to 1' })]);
    });

    it('with no rows left, the group goes, Undo bringing it back', () => {
      const { store, row, groups, group } = three();
      store.setGroupCount(group, 3);
      store.removeCondition(row(CHAOS).id);
      store.removeCondition(row(COLD).id);
      store.removeCondition(row(FIRE).id);
      expect(groups('count')).toHaveLength(0);
      expect(store.getState().notice).toEqual(expect.objectContaining({ code: 'group-removed', undo: true }));
      store.undo();
      expect(groups('count')[0]!.rows.map((each) => each.statId)).toEqual([FIRE]);
    });
  });

  it('flags the same condition twice in a group (a link can bring one)', () => {
    const { store } = setup({ stats: [{ type: 'count', value: { min: 1 }, filters: [{ id: FIRE, value: { min: 35 } }, { id: FIRE, value: { min: 40 } }] }] });
    expect(validate(store.getState())).toEqual([expect.objectContaining({ severity: 'error', code: 'duplicate-in-group' })]);
  });

  it('keeps a count group of a link that asks for more than it has, as an error, not quietly', () => {
    const { store, groups } = setup({ stats: [{ type: 'count', value: { min: 3 }, filters: [{ id: FIRE, value: { min: 35 } }, { id: COLD, value: { min: 30 } }] }] });
    expect(validate(store.getState())).toEqual([expect.objectContaining({ code: 'count-out-of-range', groupId: groups('count')[0]!.id, message: 'Choose a count from 1 to 2' })]);
  });
});

describe('groups kept as they are', () => {
  it('adds a parameter to an All of in use, not to one turned off on the site', () => {
    const { store, groups } = setup({ stats: [{ type: 'and', disabled: true, filters: [{ id: LIFE, value: { min: 80 } }] }] });
    store.addCondition(null, FIRE);
    expect(groups('and')).toHaveLength(2);
    expect(groups('and')[0]!.rows.map((each) => each.statId)).toEqual([LIFE]);
    expect(groups('and')[1]!.rows.map((each) => each.statId)).toEqual([FIRE]);
  });

  it('excludes into a None of of its own when the one there has ranges', () => {
    const { store, row, groups } = setup({ stats: [{ type: 'and', filters: [{ id: RARITY, value: { min: 10 } }] }, { type: 'not', filters: [{ id: FIRE, value: { min: 10 } }] }] });
    store.exclude(row(RARITY).id);
    expect(groups('not').map((group) => group.rows.map((each) => each.statId))).toEqual([[FIRE], [RARITY]]);
  });
});

describe('exclusions: Must not have', () => {
  it('moves the modifier into None of without its range, and Require brings the range back', () => {
    const { store, row, groups, stats } = setup();
    expect(store.exclude(row(RARITY).id)).toBe(true);
    expect(stats()).toContainEqual({ type: 'not', filters: [{ id: RARITY }] });
    expect(groups('and')[0]!.rows.map((each) => each.statId)).not.toContain(RARITY);
    store.require(row(RARITY).id);
    expect(groups('not')).toHaveLength(0);
    expect(row(RARITY).value).toEqual({ min: 10 });
    expect(groups('and')[0]!.rows.map((each) => each.statId)).toContain(RARITY);
  });

  it('keeps several exclusions in one None of, each without a range', () => {
    const { store, row, stats } = setup();
    store.exclude(row(RARITY).id);
    store.exclude(row(STR).id, 'explicit.stat_4080418644');
    expect(stats()).toContainEqual({ type: 'not', filters: [{ id: RARITY }, { id: 'explicit.stat_4080418644' }] });
  });

  it('does not exclude a total: a specific modifier has to be chosen instead', () => {
    const { store, row, groups } = setup();
    expect(store.exclude(row(LIFE).id)).toBe(false);
    expect(groups('not')).toHaveLength(0);
    expect(store.exclude(row(LIFE).id, 'explicit.stat_3299347043')).toBe(true);
    expect(groups('not')[0]!.rows.map((each) => [each.statId, each.value])).toEqual([['explicit.stat_3299347043', undefined]]);
  });

  it('removing an exclusion takes it out of the search; the last one takes None of with it', () => {
    const { store, row, groups } = setup();
    store.exclude(row(RARITY).id);
    store.removeCondition(row(RARITY).id);
    expect(groups('not')).toHaveLength(0);
  });

  it('flags a modifier both required and excluded', () => {
    const { store } = setup({ stats: [{ type: 'and', filters: [{ id: RARITY, value: { min: 10 } }] }, { type: 'not', filters: [{ id: RARITY }] }] });
    expect(validate(store.getState())).toEqual([expect.objectContaining({ severity: 'error', code: 'required-and-excluded' })]);
  });

  it('does not exclude a row of a group: it is made required separately first', () => {
    const { store, row, groups } = setup();
    store.addAlternative(row(FIRE).id, { rowId: row(COLD).id });
    expect(store.exclude(row(COLD).id)).toBe(false);
    expect(groups('count')[0]!.rows).toHaveLength(2);
  });
});
