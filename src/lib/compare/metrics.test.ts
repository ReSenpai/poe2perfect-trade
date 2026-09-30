import { describe, expect, it } from 'vitest';
import { type Listing, parseListing } from '@/lib/listing/parse';
import { loadListings } from '../../../tests/fixtures/load';
import { compareListings, type CompareInput } from './metrics';

const RING = parseListing(loadListings('listings-rings').listings[0]!);
const LIFE = 'pseudo.pseudo_total_life';
const FIRE = 'pseudo.pseudo_total_fire_resistance';
const COLD_EXPLICIT = 'explicit.stat_4220027924';

function listing(id: string, price: Listing['price'], mods: Listing['mods'], properties: Listing['item']['properties'] = []): Listing {
  return { ...RING, id, price, mods, item: { ...RING.item, ilvl: 80, properties, totals: [] } };
}

const LEFT = listing('a', { amount: 25, currency: 'exalted', type: 'price' }, [
  { kind: 'explicit', text: '+92 to maximum Life', statId: 'explicit.stat_3299347043' },
  { kind: 'explicit', text: '+35% to Cold Resistance', statId: COLD_EXPLICIT },
  { kind: 'pseudo', text: '+92 total maximum Life', statId: LIFE },
  { kind: 'pseudo', text: '+41% total to Fire Resistance', statId: FIRE },
], [{ name: 'Quality', value: '+20%' }]);
const RIGHT = listing('b', { amount: 32, currency: 'exalted', type: 'price' }, [
  { kind: 'explicit', text: '+108 to maximum Life', statId: 'explicit.stat_3299347043' },
  { kind: 'pseudo', text: '+108 total maximum Life', statId: LIFE },
  { kind: 'pseudo', text: '+35% total to Fire Resistance', statId: FIRE },
]);

const input = (overrides: Partial<CompareInput> = {}): CompareInput => ({
  listings: [LEFT, RIGHT],
  conditions: [
    { statId: LIFE, min: 80 },
    { statId: FIRE, min: 35 },
    { statId: COLD_EXPLICIT, min: 20 },
  ],
  label: (statId) => ({ [LIFE]: 'Life', [FIRE]: 'Fire Resistance', [COLD_EXPLICIT]: 'Cold Resistance' })[statId] ?? statId,
  currencyName: (id) => ({ exalted: 'Exalted Orb', divine: 'Divine Orb' })[id] ?? id,
  ...overrides,
});

const row = (result: ReturnType<typeof compareListings>, key: string) => result.rows.find((each) => each.key === key)!;

describe('compareListings', () => {
  it('starts with the price, the lower one preferred when both are in one currency, and the difference', () => {
    const result = compareListings(input());
    expect(result.rows[0]).toMatchObject({ key: 'price', group: 'price', label: 'Price', cells: [{ text: '25 Exalted Orb', preferred: true }, { text: '32 Exalted Orb' }] });
    expect(result.rows[0]!.cells[1].preferred).toBeUndefined();
    expect(result.differences[0]).toBe('+7 Exalted Orb');
  });

  it('has no preference and no money difference for prices in different currencies', () => {
    const result = compareListings(input({ listings: [LEFT, { ...RIGHT, price: { amount: 1, currency: 'divine', type: 'price' } }] }));
    expect(row(result, 'price').cells.map((cell) => [cell.text, cell.preferred])).toEqual([
      ['25 Exalted Orb', undefined],
      ['1 Divine Orb', undefined],
    ]);
    expect(result.differences.some((text) => text.includes('Orb'))).toBe(false);
  });

  it('gives each condition of the search its value on both items, preferring more for a minimum', () => {
    const result = compareListings(input());
    expect(row(result, LIFE)).toMatchObject({ group: 'parameter', label: 'Life', tone: 'life', cells: [{ text: '92', value: 92 }, { text: '108', value: 108, preferred: true }] });
    expect(row(result, FIRE)).toMatchObject({ label: 'Fire Resistance', cells: [{ text: '41%', preferred: true }, { text: '35%' }] });
    expect(result.differences).toEqual(['+7 Exalted Orb', 'Life +16', 'Fire Resistance −6%', 'Cold Resistance −35%']);
  });

  it('says 0 for a mod the item shows it lacks, and not available for a total the server did not give', () => {
    const result = compareListings(input({ conditions: [{ statId: COLD_EXPLICIT, min: 20 }, { statId: 'pseudo.pseudo_total_cold_resistance', min: 20 }] }));
    expect(row(result, COLD_EXPLICIT).cells.map((cell) => [cell.text, cell.value])).toEqual([
      ['35%', 35],
      ['0%', 0],
    ]);
    const unknown = row(result, 'pseudo.pseudo_total_cold_resistance');
    expect(unknown.cells.map((cell) => [cell.text, cell.value, cell.preferred])).toEqual([
      ['—', null, undefined],
      ['—', null, undefined],
    ]);
  });

  it('prefers less for a maximum, and nothing for a range or equal values', () => {
    const lower = compareListings(input({ conditions: [{ statId: LIFE, max: 100 }] }));
    expect(row(lower, LIFE).cells.map((cell) => cell.preferred)).toEqual([true, undefined]);
    const range = compareListings(input({ conditions: [{ statId: LIFE, min: 80, max: 120 }] }));
    expect(row(range, LIFE).cells.map((cell) => cell.preferred)).toEqual([undefined, undefined]);
    const same = compareListings(input({ listings: [LEFT, { ...LEFT, id: 'c' }], conditions: [{ statId: LIFE, min: 80 }] }));
    expect(row(same, LIFE).cells.map((cell) => cell.preferred)).toEqual([undefined, undefined]);
  });

  it('lists the other properties apart, without preference, not available where one item has none', () => {
    const result = compareListings(input());
    const properties = result.rows.filter((each) => each.group === 'property');
    expect(properties.map((each) => [each.label, each.cells.map((cell) => cell.text)])).toEqual([
      ['Item Level', ['80', '80']],
      ['Quality', ['+20%', '—']],
    ]);
    expect(properties.flatMap((each) => each.cells).some((cell) => cell.preferred)).toBe(false);
  });

  it('counts a damage range by its average and shows it as a range', () => {
    const adds = (min: number, max: number) => [{ kind: 'explicit', text: `Adds ${min} to ${max} Physical Damage to Attacks`, statId: 'explicit.stat_3032590688' }];
    const result = compareListings(input({ listings: [{ ...LEFT, mods: adds(5, 11) }, { ...RIGHT, mods: adds(6, 12) }], conditions: [{ statId: 'explicit.stat_3032590688', min: 5 }] }));
    expect(row(result, 'explicit.stat_3032590688').cells.map((cell) => [cell.text, cell.value, cell.preferred])).toEqual([
      ['5–11', 8, undefined],
      ['6–12', 9, true],
    ]);
  });
});
