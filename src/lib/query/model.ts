/**
 * The trade search query in its canonical form (see `normalizeQuery`): the shape api/trade2 takes, with empty parts
 * dropped. Fields the extension does not know are kept as they are, so no search power is lost on the way.
 */

export const STAT_GROUP_TYPES = ['and', 'not', 'if', 'count', 'weight', 'weight2'] as const;
export type StatGroupType = (typeof STAT_GROUP_TYPES)[number];

export interface RangeValue {
  min?: number;
  max?: number;
}

export interface StatFilterValue extends RangeValue {
  weight?: number;
  option?: string | number;
}

export interface StatFilter {
  id: string;
  value?: StatFilterValue;
  disabled?: true;
}

export interface StatGroup {
  type: StatGroupType;
  filters: StatFilter[];
  /** count / weight groups: how many filters must match, or the weighted sum. */
  value?: RangeValue;
  disabled?: true;
}

/** A fixed filter (item level, rarity, price…): an option, a range, both (price), or free text (seller account). */
export interface FixedFilterValue extends RangeValue {
  option?: string;
  input?: string;
}

export interface FilterSection {
  filters: Record<string, FixedFilterValue>;
  disabled?: true;
}

/** Item name / base type: plain text, or an option picked from the site's item list. */
export type ItemRef = string | { option: string; discriminator?: string };

export interface TradeQuery {
  status: { option: string };
  name?: ItemRef;
  type?: ItemRef;
  stats: StatGroup[];
  filters: Record<string, FilterSection>;
  [unknown: string]: unknown;
}
