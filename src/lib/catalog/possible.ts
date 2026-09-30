import type { BaseStatsData } from '@/lib/gamedata/base-stats';

/** What can appear on the item being searched for (docs/ARCHITECTURE.md, "Game data"). */
export interface PossibleSet {
  /** False only when the game data knows the stat and it cannot roll here. */
  has(tradeId: string): boolean;
  /** yes — known to roll here; no — known not to; unknown — the game data does not cover the stat. */
  status(tradeId: string): 'yes' | 'no' | 'unknown';
  /**
   * Highest value the stat reaches here (undefined when unknown). For a pseudo total: the sum of the highest values of
   * the stats it adds up, each stat counted once whatever its source — a ceiling for a slider, not a promise.
   */
  max(tradeId: string): number | undefined;
  affix(tradeId: string): 'prefix' | 'suffix' | undefined;
  /** Number of distinct stats known to be possible. */
  size: number;
  /** Explicit mods that can roll here, as prefix or suffix. */
  affixes(): { id: string; affix: 'prefix' | 'suffix' }[];
}

export interface PossibleStats {
  /** null when there is nothing to narrow by: no category, or one the game data does not cover. */
  forItem(category: string | null, base?: string | null): PossibleSet | null;
  /** Base type names of a category, sorted; empty when the game data does not cover it. */
  bases(category: string | null): string[];
}

/** Trade types that are versions of explicit mods. */
const EXPLICIT_VERSIONS = new Set(['fractured', 'crafted']);

/**
 * Pseudo stats sum up other stats: one is possible when a stat it adds up can roll. Matched on whole stat texts — only
 * the plain additions the site counts, not a requirement, a conversion or a conditional bonus that merely names the
 * stat; first rule that fits the pseudo text wins; pseudo stats without a rule (mod counts…) are always possible.
 */
const PSEUDO_RULES: [RegExp, RegExp][] = [
  [/Fire Resistance/, /^#% to (?:all Elemental Resistances|(?:\w+ and )?Fire(?: and \w+)? Resistances?)$/],
  [/Cold Resistance/, /^#% to (?:all Elemental Resistances|(?:\w+ and )?Cold(?: and \w+)? Resistances?)$/],
  [/Lightning Resistance/, /^#% to (?:all Elemental Resistances|(?:\w+ and )?Lightning(?: and \w+)? Resistances?)$/],
  [/Chaos Resistance/, /^#% to (?:\w+ and )?Chaos(?: and \w+)? Resistances?$/],
  [/Elemental Resistance/, /^#% to (?:all Elemental Resistances|(?:\w+ and )?(?:Fire|Cold|Lightning)(?: and \w+)? Resistances?)$/],
  [/Resistance/, /^#% to (?:all Elemental Resistances|(?:\w+ and )?\w+ Resistances?)$/],
  [/maximum Life/, /^# to maximum Life$/],
  [/maximum Mana/, /^# to maximum Mana$/],
  [/maximum Energy Shield/, /^# to maximum Energy Shield/],
  [/Strength/, /^# to (?:all Attributes|(?:\w+ and )?Strength(?: and \w+)?)$/],
  [/Dexterity/, /^# to (?:all Attributes|(?:\w+ and )?Dexterity(?: and \w+)?)$/],
  [/Intelligence/, /^# to (?:all Attributes|(?:\w+ and )?Intelligence(?: and \w+)?)$/],
  [/Attributes/, /^# to (?:all Attributes|Strength|Dexterity|Intelligence|\w+ and \w+)$/],
  [/Movement Speed/, /^#% increased Movement Speed$/],
];

/**
 * Catalyst quality raises the explicit modifiers of jewellery (step 35): the most seen on the trade site
 * is +65% on rings (a Refined Breach Ring: 20% + 25% from its implicit + 20% from an essence) and +50% on amulets;
 * belts and other items have none. A 30% roll on a ring shows as 49%.
 */
const CATALYST_QUALITY: Record<string, number> = { Rings: 65, Amulets: 50 };
const RAISED_BY_QUALITY = /^(?:explicit|desecrated)\./;

export function createPossibleStats(data: BaseStatsData, textOf: (tradeId: string) => string | undefined): PossibleStats {
  const known = new Set(data.stats);

  return {
    bases(category) {
      if (!category) return [];
      const names = new Set<string>();
      for (const name of data.categories[category] ?? []) for (const set of data.classes[name]?.sets ?? []) for (const base of set.bases) names.add(base);
      return [...names].sort((a, b) => a.localeCompare(b));
    },

    forItem(category, base) {
      if (!category) return null;
      const classes = (data.categories[category] ?? []).filter((name) => data.classes[name]);
      if (classes.length === 0) return null;

      const stats = new Map<string, { max: number | null; affix: 'p' | 's' | null }>();
      for (const name of classes) {
        const cls = data.classes[name]!;
        const sets = base ? cls.sets.filter((set) => set.bases.includes(base)) : [];
        const indexes = sets.length > 0 ? new Set(sets.flatMap((set) => set.stats)) : null;
        const quality = CATALYST_QUALITY[name] ?? 0;
        cls.stats.forEach(([shared, rolled, affix], index) => {
          if (indexes && !indexes.has(index)) return;
          const id = data.stats[shared]!;
          const max = rolled !== null && quality > 0 && RAISED_BY_QUALITY.test(id) ? Math.floor(rolled * (1 + quality / 100)) : rolled;
          const current = stats.get(id);
          if (!current) stats.set(id, { max, affix });
          else if (max !== null && (current.max === null || max > current.max)) current.max = max;
        });
      }

      /** Stats a pseudo total adds up, among the ones possible here; null when the pseudo has no rule. */
      const pseudoParts = (tradeId: string): string[] | null => {
        const text = textOf(tradeId);
        const rule = text ? PSEUDO_RULES.find(([pseudo]) => pseudo.test(text)) : undefined;
        if (!rule) return null;
        return [...stats.keys()].filter((id) => {
          const partText = textOf(id);
          // Bonded rune bonuses are conditional; totals are about the item's own stats.
          return partText !== undefined && !partText.startsWith('Bonded') && rule[1].test(partText);
        });
      };
      // An item has every explicit stat it rolls, but one implicit (its base's), one corruption, one desecrated mod and
      // the runes of its sockets: of those, only the best one counts towards the highest total.
      const pseudoMax = (tradeId: string): number | undefined => {
        let explicit = 0;
        const best = new Map<string, number>();
        let found = false;
        for (const id of pseudoParts(tradeId) ?? []) {
          const value = stats.get(id)?.max;
          if (value === null || value === undefined) continue;
          found = true;
          const type = id.slice(0, id.indexOf('.'));
          if (type === 'explicit') explicit += value;
          else best.set(type, Math.max(best.get(type) ?? 0, value));
        }
        return found ? explicit + [...best.values()].reduce((sum, value) => sum + value, 0) : undefined;
      };

      const pseudoCache = new Map<string, 'yes' | 'no' | 'unknown'>();
      const pseudoStatus = (tradeId: string): 'yes' | 'no' | 'unknown' => {
        const parts = pseudoParts(tradeId);
        if (parts === null) return 'unknown';
        return parts.length > 0 ? 'yes' : 'no';
      };

      const resolve = (tradeId: string) => {
        const dot = tradeId.indexOf('.');
        const type = tradeId.slice(0, dot);
        return EXPLICIT_VERSIONS.has(type) ? `explicit${tradeId.slice(dot)}` : tradeId;
      };

      const status = (tradeId: string): 'yes' | 'no' | 'unknown' => {
        if (tradeId.startsWith('pseudo.')) {
          let result = pseudoCache.get(tradeId);
          if (result === undefined) pseudoCache.set(tradeId, (result = pseudoStatus(tradeId)));
          return result;
        }
        const id = resolve(tradeId);
        if (!known.has(id)) return 'unknown';
        return stats.has(id) ? 'yes' : 'no';
      };

      return {
        size: stats.size,
        status,
        affixes: () =>
          [...stats.entries()]
            .filter(([id, stat]) => id.startsWith('explicit.') && stat.affix !== null)
            .map(([id, stat]) => ({ id, affix: stat.affix === 'p' ? ('prefix' as const) : ('suffix' as const) })),
        has: (tradeId) => status(tradeId) !== 'no',
        max: (tradeId) => (tradeId.startsWith('pseudo.') ? pseudoMax(tradeId) : (stats.get(resolve(tradeId))?.max ?? undefined)),
        affix(tradeId) {
          const affix = stats.get(resolve(tradeId))?.affix;
          return affix === 'p' ? 'prefix' : affix === 's' ? 'suffix' : undefined;
        },
      };
    },
  };
}
