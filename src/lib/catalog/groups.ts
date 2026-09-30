import { shortStatLabel } from '@/lib/query/labels';

/** Meaning-based groups of stats in the filter panel (the v2 design, "Filter group"). */
export type StatGroupId = 'core' | 'resistances' | 'attributes' | 'defensive' | 'special';

export const STAT_GROUPS: { id: StatGroupId; title: string }[] = [
  { id: 'core', title: 'Core Stats' },
  { id: 'resistances', title: 'Resistances' },
  { id: 'attributes', title: 'Attributes' },
  { id: 'defensive', title: 'Defensive' },
  { id: 'special', title: 'Special' },
];

/** Stat types that are about something other than item stats (sanctum relics, skill gems). */
const SPECIAL_TYPES = new Set(['sanctum', 'skill']);

/** Mods of other mechanics: jewel radius grants, waystone / area modifiers on monsters and maps. */
const OTHER_MECHANICS = /passive skills (?:in radius )?also grant|\bmonsters?\b|^(?:area|map) (?:has|contains)/;

// Checked in this order; the first match wins.
const RESISTANCE = /\bresistances?\b/;
const OFFENSIVE_RESISTANCE = /penetrat|exposure|enem|minion/;
const ATTRIBUTE = /^(?:total |increased )?(?:to )?(?:all )?(?:strength|dexterity|intelligence|attributes)\b/;
const CORE_POOL = /^(?:total |increased )?(?:maximum )?(?:life|mana|spirit)$/;
const DEFENSIVE =
  /\b(?:armour|evasion|energy shield|block|ward|deflect|damage taken|threshold|recover|recoup|regenerat|leech|life|mana|flask|charm)/;
const OFFENSIVE = /\b(?:damage|speed|critical|accuracy|level of|projectile|area of effect|penetrat|skill|spell|attack|minion)/;

/**
 * Group of a stat by its text. Rules are a heuristic over the catalog wording: resistances and attributes first, then the
 * life / mana / spirit pools (core), defences, offence (core); everything else — and mods of other mechanics — is Special.
 */
export function classifyStat(text: string, type: string): StatGroupId {
  if (SPECIAL_TYPES.has(type)) return 'special';
  const lower = text.toLowerCase();
  const label = shortStatLabel(text).toLowerCase();

  if (OTHER_MECHANICS.test(lower)) return 'special';
  if (RESISTANCE.test(lower) && !OFFENSIVE_RESISTANCE.test(lower)) return 'resistances';
  if (ATTRIBUTE.test(label)) return 'attributes';
  if (CORE_POOL.test(label)) return 'core';
  if (DEFENSIVE.test(lower) && !/\bdamage\b(?! taken)/.test(lower)) return 'defensive';
  if (OFFENSIVE.test(lower)) return 'core';
  return 'special';
}
