import type { FilterEntry, FilterGroupId, FilterIndex } from './index';
import type { PossibleSet } from './possible';

export interface SearchOptions {
  /** Simple: explicit, pseudo, implicit and fixed filters; Advanced: the whole catalog. */
  mode?: 'simple' | 'advanced';
  group?: FilterGroupId;
  limit?: number;
  /** The item being searched for: what can roll on it comes first. */
  possible?: PossibleSet | null;
}

/** Order of stat types among equally good matches. */
const TYPE_ORDER = ['explicit', 'pseudo', 'implicit', 'crafted', 'fractured', 'augment', 'enchant', 'desecrated', 'sanctum', 'skill'];
const SIMPLE_TYPES = new Set(['explicit', 'pseudo', 'implicit']);

/**
 * Filters for the text typed into "Add filter…". Every word of the query has to start a word of the label or the stat
 * text (`res fire` finds "Fire Res"); failing that, the whole query as a substring. Results come in tiers — fixed,
 * explicit and pseudo first, then implicit, then the rest (crafted, fractured, augment…) — and by match quality inside.
 */
export function searchFilters(index: FilterIndex, text: string, { mode = 'advanced', group, limit = 50, possible = null }: SearchOptions = {}): FilterEntry[] {
  const query = normalize(text);
  if (query === '') return [];
  const words = query.split(' ');

  const matches: { entry: FilterEntry; score: number }[] = [];
  for (const entry of index.entries) {
    if (group && entry.group !== group) continue;
    if (mode === 'simple' && entry.kind === 'stat' && !SIMPLE_TYPES.has(entry.type)) continue;
    const score = scoreEntry(entry, query, words);
    if (score > 0) matches.push({ entry, score });
  }

  // Surely possible on the item first, stats the game data does not cover next, impossible ones last.
  const FITS = { yes: 0, unknown: 1, no: 2 };
  const fits = (entry: FilterEntry) => (entry.kind === 'fixed' || !possible ? 0 : FITS[possible.status(entry.id)]);
  matches.sort(
    (a, b) =>
      fits(a.entry) - fits(b.entry) ||
      tier(a.entry) - tier(b.entry) ||
      b.score - a.score ||
      typeRank(a.entry) - typeRank(b.entry) ||
      a.entry.label.length - b.entry.label.length ||
      a.entry.text.localeCompare(b.entry.text),
  );
  return matches.slice(0, limit).map((match) => match.entry);
}

/** The "Common Filters" column of the filter picker. */
const COMMON_KEYS = [
  'stat:explicit.stat_3299347043', // # to maximum Life
  'stat:explicit.stat_3372524247', // #% to Fire Resistance
  'stat:explicit.stat_4220027924', // #% to Cold Resistance
  'stat:explicit.stat_1671376347', // #% to Lightning Resistance
  'stat:explicit.stat_2923486259', // #% to Chaos Resistance
  'stat:explicit.stat_3489782002', // # to maximum Energy Shield
  'stat:explicit.stat_1050105434', // # to maximum Mana
  'stat:explicit.stat_2250533757', // #% increased Movement Speed
  'fixed:type_filters:ilvl',
];

/** The "Suggested Pseudo Filters" column of the filter picker. */
const SUGGESTED_PSEUDO_KEYS = [
  'stat:pseudo.pseudo_total_elemental_resistance',
  'stat:pseudo.pseudo_total_resistance',
  'stat:pseudo.pseudo_total_life',
  'stat:pseudo.pseudo_total_energy_shield',
  'stat:pseudo.pseudo_total_all_attributes',
];

export function commonFilters(index: FilterIndex): FilterEntry[] {
  return pick(index, COMMON_KEYS);
}

export function suggestedPseudoFilters(index: FilterIndex): FilterEntry[] {
  return pick(index, SUGGESTED_PSEUDO_KEYS);
}

function pick(index: FilterIndex, keys: string[]): FilterEntry[] {
  return keys.map((key) => index.get(key)).filter((entry): entry is FilterEntry => entry !== undefined);
}

/**
 * Label matches beat text matches. Among label matches, the closer the query covers the label the better ("Life" over
 * "Life Recharges"), and pseudo totals get a bonus: they are what a buyer usually means ("life" → "Total Life").
 */
function scoreEntry(entry: FilterEntry, query: string, words: string[]): number {
  const label = normalize(entry.label);
  if (label === query) return 6;
  if (startsWords(label, words)) {
    const pseudoBonus = entry.kind === 'stat' && entry.type === 'pseudo' ? 1 : 0;
    return 3 + query.length / label.length + (label.startsWith(query) ? 0.5 : 0) + pseudoBonus;
  }
  const texts = [entry.text, ...(entry.kind === 'stat' ? entry.aliases : [])].map(normalize);
  if (texts.some((text) => text === query)) return 3;
  if (texts.some((text) => startsWords(text, words))) return 2;
  if (texts.some((text) => text.includes(query))) return 1;
  return 0;
}

/** Every query word starts some word of the text. */
function startsWords(text: string, words: string[]): boolean {
  const textWords = text.split(' ');
  return words.every((word) => textWords.some((textWord) => textWord.startsWith(word)));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[#+%()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tier(entry: FilterEntry): number {
  if (entry.kind === 'fixed' || entry.type === 'explicit' || entry.type === 'pseudo') return 0;
  return entry.type === 'implicit' ? 1 : 2;
}

function typeRank(entry: FilterEntry): number {
  if (entry.kind === 'fixed') return -1;
  const rank = TYPE_ORDER.indexOf(entry.type);
  return rank === -1 ? TYPE_ORDER.length : rank;
}
