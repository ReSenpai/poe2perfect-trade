import { parameterOf, type StatTone, toneOf } from '@/lib/catalog/semantic';
import type { Listing } from '@/lib/listing/parse';
import { itemPresentation } from '@/lib/listing/presentation';

/**
 * Two listings side by side (v4 §14): the price, the conditions of the search, then the other properties. Each metric
 * knows what "better" means for it: a minimum prefers more, a maximum less, a range or a plain property nothing. An
 * unknown value is "—", never 0, and gives the other column no advantage; money is compared in one currency only.
 */

export interface CompareCondition {
  statId: string;
  min?: number;
  max?: number;
}

export interface CompareInput {
  listings: [Listing, Listing];
  /** The stat conditions of the applied search. */
  conditions: CompareCondition[];
  /** The name of a stat as the filters show it. */
  label: (statId: string) => string;
  currencyName: (currency: string) => string;
}

export interface CompareCell {
  text: string;
  /** The number compared; null when not known. */
  value: number | null;
  /** Better by the rule of the row (a minimum of the search, the lower price). */
  preferred?: true;
}

export interface CompareRow {
  key: string;
  group: 'price' | 'parameter' | 'property';
  label: string;
  tone?: StatTone;
  cells: [CompareCell, CompareCell];
}

export interface Comparison {
  rows: CompareRow[];
  /** Right minus left, where it means something: "+7 Exalted Orb", "Life +16", "Fire Resistance −6%". */
  differences: string[];
}

type Direction = 'more' | 'less' | 'none';

export function compareListings({ listings, conditions, label, currencyName }: CompareInput): Comparison {
  const rows: CompareRow[] = [];
  const differences: string[] = [];

  // Price: preference and difference only in one currency, no exchange rate.
  const [leftPrice, rightPrice] = listings.map((listing) => listing.price);
  const oneCurrency = leftPrice && rightPrice && leftPrice.currency === rightPrice.currency ? leftPrice.currency : null;
  const priceCell = (price: Listing['price']): CompareCell => (price ? { text: `${format(price.amount)} ${currencyName(price.currency)}`, value: oneCurrency ? price.amount : null } : { text: 'No price', value: null });
  rows.push(prefer({ key: 'price', group: 'price', label: 'Price', cells: [priceCell(leftPrice ?? null), priceCell(rightPrice ?? null)] }, 'less'));
  if (oneCurrency && leftPrice!.amount !== rightPrice!.amount) differences.push(`${signed(rightPrice!.amount - leftPrice!.amount)} ${currencyName(oneCurrency)}`);

  // The conditions of the search, once each.
  const seen = new Set<string>();
  for (const condition of conditions) {
    if (seen.has(condition.statId)) continue;
    seen.add(condition.statId);
    const name = label(condition.statId);
    const unit = parameterOf(condition.statId)?.parameter.unit === 'percent' || listings.some((listing) => linesOf(listing, condition.statId).some((line) => line.includes('%'))) ? '%' : '';
    const cells = listings.map((listing) => statCell(listing, condition.statId, unit)) as [CompareCell, CompareCell];
    const tone = toneOf(condition.statId, name);
    rows.push(prefer({ key: condition.statId, group: 'parameter', label: name, ...(tone ? { tone } : {}), cells }, direction(condition)));
    const [left, right] = cells;
    if (left.value !== null && right.value !== null && left.value !== right.value) differences.push(`${name} ${signed(right.value - left.value)}${unit}`);
  }

  // Everything else on the cards, apart and without preference.
  const properties = listings.map((listing) => {
    const item = itemPresentation(listing);
    return new Map([...item.stats, ...item.totals].map((stat) => [stat.name, stat.value]));
  });
  const names = [...new Set(properties.flatMap((each) => [...each.keys()]))];
  for (const name of names) {
    const cells = properties.map((each) => {
      const text = each.get(name);
      return text === undefined ? { text: '—', value: null } : { text, value: firstNumber(text) };
    }) as [CompareCell, CompareCell];
    rows.push({ key: `property:${name}`, group: 'property', label: name, cells });
  }

  return { rows, differences };
}

function direction(condition: CompareCondition): Direction {
  const hasMin = condition.min !== undefined;
  const hasMax = condition.max !== undefined;
  if (hasMin && !hasMax) return 'more';
  if (hasMax && !hasMin) return 'less';
  return 'none';
}

function prefer(row: CompareRow, rule: Direction): CompareRow {
  const [left, right] = row.cells;
  if (rule === 'none' || left.value === null || right.value === null || left.value === right.value) return row;
  const leftBetter = rule === 'more' ? left.value > right.value : left.value < right.value;
  return { ...row, cells: leftBetter ? [{ ...left, preferred: true }, right] : [left, { ...right, preferred: true }] };
}

function linesOf(listing: Listing, statId: string): string[] {
  return listing.mods.filter((mod) => mod.statId === statId).map((mod) => mod.text);
}

/**
 * The value of a stat on an item: its lines added up. Without a line, a pseudo total is unknown (the server gives only
 * what it summed), a mod is 0 when the item's lines carry their stat ids (so the item is known not to have it).
 */
function statCell(listing: Listing, statId: string, unit: string): CompareCell {
  const lines = linesOf(listing, statId);
  if (lines.length === 0) {
    const knownAbsent = !statId.startsWith('pseudo.') && listing.mods.some((mod) => mod.statId !== undefined);
    return knownAbsent ? { text: `0${unit}`, value: 0 } : { text: '—', value: null };
  }
  let low = 0;
  let high = 0;
  let ranged = false;
  for (const line of lines) {
    const numbers = [...line.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    if (numbers.length === 0) return { text: '—', value: null };
    if (/^Adds /.test(line) && numbers.length >= 2) {
      ranged = true;
      low += numbers[0]!;
      high += numbers[1]!;
    } else {
      low += numbers[0]!;
      high += numbers[0]!;
    }
  }
  return ranged ? { text: `${format(low)}–${format(high)}`, value: (low + high) / 2 } : { text: `${format(low)}${unit}`, value: low };
}

function firstNumber(text: string): number | null {
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function format(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function signed(value: number): string {
  return value > 0 ? `+${format(value)}` : `−${format(-value)}`;
}
