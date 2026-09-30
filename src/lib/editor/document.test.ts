import { describe, expect, it } from 'vitest';
import { LISTING_FIXTURES, loadListings } from '../../../tests/fixtures/load';
import { addGroup, addRow, compile, fromTradeQuery, groupOf, moveRow, removeGroup, removeRow, rowsOf, setGroupEnabled, setGroupValue, setRowEnabled, setRowStat, setRowValue } from './document';

/** The sample page URL of CLAUDE.md before step 19: the site writes an empty "and" group. */
const SITE_EMPTY = { status: { option: 'securable' }, stats: [{ type: 'and', filters: [] }] };

/** A shared link with everything the editor can't edit yet or doesn't know. */
const ADVANCED = {
  status: 'online',
  term: 'kept as is',
  name: { option: 'Andvarius', discriminator: 'legacy' },
  stats: [
    { type: 'and', filters: [{ id: 'pseudo.pseudo_total_life', value: { min: 80 } }, { id: 'explicit.stat_1', disabled: true, note: 'unknown row field' }] },
    { type: 'count', value: { min: 2 }, filters: [{ id: 'pseudo.pseudo_total_fire_resistance', value: { min: 35 } }, { id: 'pseudo.pseudo_total_cold_resistance', value: { min: 30 } }, { id: 'pseudo.pseudo_total_lightning_resistance', value: { min: 30 }, disabled: true }], disabled: true },
    { type: 'not', filters: [{ id: 'explicit.stat_2' }] },
    { type: 'weight', value: { min: 100 }, filters: [{ id: 'explicit.stat_3', value: { weight: 2 } }, { id: 'explicit.stat_4', value: { weight: 1.5, min: 10 } }] },
    { type: 'weight2', filters: [{ id: 'explicit.stat_5', value: { weight: 1 } }] },
    { type: 'if', filters: [{ id: 'explicit.stat_6', value: { min: 1 } }] },
    { type: 'xor', future: true, filters: [{ id: 'explicit.stat_7' }] },
    { type: 'and', filters: [] },
    { type: 'and', filters: [{ value: { min: 1 } }] },
  ],
  filters: {
    type_filters: { filters: { category: { option: 'accessory.ring' }, rarity: { option: null } } },
    trade_filters: { disabled: true, filters: { price: { max: 50, option: 'exalted' } } },
    future_filters: { filters: { anything: { mystery: [1, 2] } }, extra: 'x' },
  },
};

describe('QueryDocument', () => {
  it.each(LISTING_FIXTURES)('compiles the %s fixture query back unchanged, the status in the API form', (name) => {
    const query = loadListings(name).request.query as { status: unknown };
    const status = typeof query.status === 'string' ? { option: query.status } : query.status;
    expect(compile(fromTradeQuery(query))).toEqual({ ...query, status });
  });

  it('keeps the empty group the site itself writes', () => {
    expect(compile(fromTradeQuery(SITE_EMPTY))).toEqual(SITE_EMPTY);
  });

  it('keeps an advanced shared link unchanged, apart from the page form of the status', () => {
    expect(compile(fromTradeQuery(ADVANCED))).toEqual({ ...ADVANCED, status: { option: 'online' } });
  });

  it('edits and / count / not groups and leaves weight, weight2, if and unknown types opaque', () => {
    const doc = fromTradeQuery(ADVANCED);
    expect(doc.groups.map((group) => (group.opaque ? `opaque:${String((group.raw as { type?: unknown }).type)}` : group.type))).toEqual([
      'and',
      'count',
      'not',
      'opaque:weight',
      'opaque:weight2',
      'opaque:if',
      'opaque:xor',
      'and',
      // A row without a stat id cannot be edited safely: its group is kept as it came.
      'opaque:and',
    ]);
    const count = doc.groups[1]!;
    expect(count.opaque ? null : { value: count.value, disabled: count.disabled, rows: rowsOf(count).map((row) => [row.statId, row.disabled]) }).toEqual({
      value: { min: 2 },
      disabled: true,
      rows: [
        ['pseudo.pseudo_total_fire_resistance', false],
        ['pseudo.pseudo_total_cold_resistance', false],
        ['pseudo.pseudo_total_lightning_resistance', true],
      ],
    });
  });

  it('gives every group and row its own id', () => {
    const doc = fromTradeQuery(ADVANCED);
    const ids = [...doc.groups.map((group) => group.id), ...doc.groups.flatMap((group) => rowsOf(group).map((row) => row.id))];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts a missing status as Instant Buyout, like the site', () => {
    expect(compile(fromTradeQuery({}))).toEqual({ status: { option: 'securable' } });
    expect(compile(fromTradeQuery(null))).toEqual({ status: { option: 'securable' } });
  });
});

describe('QueryDocument edits', () => {
  it('changes the stat of a row in place: its id, bounds, other fields and place stay', () => {
    const doc = fromTradeQuery(ADVANCED);
    const fire = rowsOf(doc.groups[1]!)[0]!;
    const next = setRowStat(doc, fire.id, 'explicit.stat_3372524247');
    expect(rowsOf(next.groups[1]!)[0]).toMatchObject({ id: fire.id, statId: 'explicit.stat_3372524247', value: fire.value });
    expect(rowsOf(next.groups[1]!).map((row) => row.id)).toEqual(rowsOf(doc.groups[1]!).map((row) => row.id));
    const compiled = compile(next) as typeof ADVANCED;
    expect(compiled.stats[1]!.filters[0]).toEqual({ ...ADVANCED.stats[1]!.filters[0], id: 'explicit.stat_3372524247' });
  });

  it('changes a row value and nothing else, keeping every id', () => {
    const doc = fromTradeQuery(ADVANCED);
    const fire = rowsOf(doc.groups[1]!)[0]!;
    const next = setRowValue(doc, fire.id, { min: 40 });

    expect(rowsOf(next.groups[1]!)[0]).toMatchObject({ id: fire.id, statId: fire.statId, value: { min: 40 } });
    expect(next.groups.map((group) => group.id)).toEqual(doc.groups.map((group) => group.id));
    expect(next.groups.flatMap((group) => rowsOf(group).map((row) => row.id))).toEqual(doc.groups.flatMap((group) => rowsOf(group).map((row) => row.id)));
    const compiled = compile(next) as typeof ADVANCED;
    expect(compiled.stats[1]!.filters[0]).toEqual({ id: 'pseudo.pseudo_total_fire_resistance', value: { min: 40 } });
    expect(compiled.stats[0]).toEqual(ADVANCED.stats[0]);
    expect(doc).toEqual(fromTradeQuery(ADVANCED)); // the original document is not touched
  });

  it('replaces only the value of a row: unknown row fields and the disabled flag stay', () => {
    const doc = fromTradeQuery(ADVANCED);
    const unknownRow = rowsOf(doc.groups[0]!)[1]!;
    const next = setRowValue(doc, unknownRow.id, { min: 5 });
    expect((compile(next) as typeof ADVANCED).stats[0]!.filters[1]).toEqual({ id: 'explicit.stat_1', disabled: true, note: 'unknown row field', value: { min: 5 } });
  });

  it('moves a row to another group with the same id', () => {
    const doc = fromTradeQuery(ADVANCED);
    const cold = rowsOf(doc.groups[1]!)[1]!;
    const target = doc.groups[0]!.id;
    const next = moveRow(doc, cold.id, target);

    expect(rowsOf(groupOf(next, target)!).at(-1)).toEqual(cold);
    expect(rowsOf(next.groups[1]!).map((row) => row.id)).not.toContain(cold.id);
    expect((compile(next) as typeof ADVANCED).stats[0]!.filters.at(-1)).toEqual({ id: 'pseudo.pseudo_total_cold_resistance', value: { min: 30 } });
  });

  it('does not move rows into or out of an opaque group', () => {
    const doc = fromTradeQuery(ADVANCED);
    const life = rowsOf(doc.groups[0]!)[0]!;
    expect(moveRow(doc, life.id, doc.groups[3]!.id)).toBe(doc);
    expect(moveRow(doc, 'no-such-row', doc.groups[1]!.id)).toBe(doc);
  });
});

describe('QueryDocument row and group edits', () => {
  it('adds a row with a new id, and a new group', () => {
    const doc = fromTradeQuery(ADVANCED);
    const added = addRow(doc, doc.groups[0]!.id, 'explicit.stat_9');
    const row = rowsOf(added.doc.groups[0]!).at(-1)!;
    expect(row).toMatchObject({ id: added.rowId, statId: 'explicit.stat_9', disabled: false });
    expect(doc.groups.flatMap((group) => rowsOf(group).map((r) => r.id))).not.toContain(added.rowId);

    const grouped = addGroup(added.doc, 'count');
    expect(groupOf(grouped.doc, grouped.groupId)).toMatchObject({ opaque: false, type: 'count', rows: [] });
    expect((compile(grouped.doc) as { stats: unknown[] }).stats.at(-1)).toEqual({ type: 'count', filters: [] });
    expect(addRow(doc, doc.groups[3]!.id, 'explicit.stat_9').doc).toBe(doc); // not into an opaque group
  });

  it('removes a row or a whole group, opaque ones included', () => {
    const doc = fromTradeQuery(ADVANCED);
    const life = rowsOf(doc.groups[0]!)[0]!;
    expect(rowsOf(removeRow(doc, life.id).groups[0]!).map((row) => row.statId)).toEqual(['explicit.stat_1']);
    expect(removeGroup(doc, doc.groups[3]!.id).groups.map((group) => group.id)).not.toContain(doc.groups[3]!.id);
  });

  it('switches a row or a group off and on through the disabled flag', () => {
    const doc = fromTradeQuery(ADVANCED);
    const life = rowsOf(doc.groups[0]!)[0]!;
    const off = setRowEnabled(doc, life.id, false);
    expect((compile(off) as typeof ADVANCED).stats[0]!.filters[0]).toEqual({ id: 'pseudo.pseudo_total_life', value: { min: 80 }, disabled: true });
    expect((compile(setRowEnabled(off, life.id, true)) as typeof ADVANCED).stats[0]!.filters[0]).toEqual(ADVANCED.stats[0]!.filters[0]);

    const weightOff = setGroupEnabled(doc, doc.groups[3]!.id, false);
    expect((compile(weightOff) as typeof ADVANCED).stats[3]).toEqual({ ...ADVANCED.stats[3], disabled: true });
  });

  it('sets how many rows of a count group must match', () => {
    const doc = fromTradeQuery(ADVANCED);
    const next = setGroupValue(doc, doc.groups[1]!.id, { min: 1 });
    expect(groupOf(next, doc.groups[1]!.id)).toMatchObject({ value: { min: 1 } });
    expect((compile(next) as typeof ADVANCED).stats[1]).toMatchObject({ type: 'count', value: { min: 1 }, disabled: true });
  });
});
