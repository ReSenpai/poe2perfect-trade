import type { IconName } from '@/ui/kit/icon-registry';

/**
 * The popular parameters by meaning (v4 §9): what the player wants to improve, with the trade stats that mean it by
 * source — the total the server sums up, the explicit mod, the implicit mod. They name and group the parameter blocks
 * and lead Add parameter, so neither hangs on text rules; the long tail of the catalog stays with `classifyStat`. Where the catalog has two
 * stats with the same text (Spirit, all Attributes), the one the game data knows is taken.
 */

export type ParameterSource = 'total' | 'explicit' | 'implicit';

/** The colour a stat block takes: of an element, a resource or an attribute (`data-stat` in the UI). */
export type StatTone =
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'chaos'
  | 'elemental'
  | 'life'
  | 'mana'
  | 'spirit'
  | 'energy-shield'
  | 'strength'
  | 'dexterity'
  | 'intelligence'
  | 'attributes'
  | 'armour'
  | 'evasion'
  | 'physical'
  | 'critical'
  | 'speed'
  | 'minion'
  | 'skill'
  | 'accuracy'
  | 'spell'
  | 'attack'
  | 'utility'
  | 'generic';

export interface ParameterVariant {
  source: ParameterSource;
  statId: string;
}

export interface SemanticParameter {
  id: string;
  label: string;
  group: 'core' | 'resistance' | 'attribute' | 'damage' | 'other';
  unit: 'flat' | 'percent';
  tone?: StatTone;
  icon?: IconName;
  variants: ParameterVariant[];
}

const total = (id: string): ParameterVariant => ({ source: 'total', statId: `pseudo.${id}` });
const explicit = (stat: string): ParameterVariant => ({ source: 'explicit', statId: `explicit.${stat}` });
const implicit = (stat: string): ParameterVariant => ({ source: 'implicit', statId: `implicit.${stat}` });
const both = (stat: string) => [explicit(stat), implicit(stat)];

export const PARAMETERS: SemanticParameter[] = [
  { id: 'life', label: 'Life', group: 'core', tone: 'life', unit: 'flat', icon: 'life', variants: [total('pseudo_total_life'), ...both('stat_3299347043')] },
  { id: 'energy-shield', label: 'Energy Shield', group: 'core', tone: 'energy-shield', unit: 'flat', icon: 'shield', variants: [total('pseudo_total_energy_shield'), ...both('stat_3489782002')] },
  { id: 'fire-resistance', label: 'Fire Resistance', group: 'resistance', tone: 'fire', unit: 'percent', icon: 'fire', variants: [total('pseudo_total_fire_resistance'), ...both('stat_3372524247')] },
  { id: 'cold-resistance', label: 'Cold Resistance', group: 'resistance', tone: 'cold', unit: 'percent', icon: 'cold', variants: [total('pseudo_total_cold_resistance'), ...both('stat_4220027924')] },
  { id: 'lightning-resistance', label: 'Lightning Resistance', group: 'resistance', tone: 'lightning', unit: 'percent', icon: 'lightning', variants: [total('pseudo_total_lightning_resistance'), ...both('stat_1671376347')] },
  { id: 'chaos-resistance', label: 'Chaos Resistance', group: 'resistance', tone: 'chaos', unit: 'percent', icon: 'chaos', variants: [total('pseudo_total_chaos_resistance'), ...both('stat_2923486259')] },
  // The total over the three elements — a parameter of its own, not a requirement on each element (v4 §10.1).
  { id: 'elemental-resistance', label: 'Total Elemental Resistance', group: 'resistance', tone: 'elemental', unit: 'percent', icon: 'elemental', variants: [total('pseudo_total_elemental_resistance')] },

  { id: 'attack-speed', label: 'Attack Speed', group: 'damage', unit: 'percent', variants: both('stat_681332047') },
  { id: 'cast-speed', label: 'Cast Speed', group: 'damage', unit: 'percent', variants: both('stat_2891184298') },
  { id: 'critical-hit-chance', label: 'Critical Hit Chance', group: 'damage', unit: 'percent', variants: [explicit('stat_587431675')] },
  { id: 'critical-damage-bonus', label: 'Critical Damage Bonus', group: 'damage', unit: 'percent', variants: [explicit('stat_3556824919')] },
  { id: 'spell-damage', label: 'Spell Damage', group: 'damage', unit: 'percent', variants: [explicit('stat_2974417149')] },
  { id: 'added-physical-damage', label: 'Added Physical Damage to Attacks', group: 'damage', unit: 'flat', variants: both('stat_3032590688') },
  { id: 'spell-skill-levels', label: 'Level of all Spell Skills', group: 'damage', unit: 'flat', variants: [explicit('stat_124131830')] },
  { id: 'projectile-skill-levels', label: 'Level of all Projectile Skills', group: 'damage', unit: 'flat', variants: [explicit('stat_1202301673')] },
  { id: 'melee-skill-levels', label: 'Level of all Melee Skills', group: 'damage', unit: 'flat', variants: [explicit('stat_9187492')] },

  { id: 'mana', label: 'Mana', group: 'core', tone: 'mana', unit: 'flat', icon: 'mana', variants: [total('pseudo_total_mana'), ...both('stat_1050105434')] },
  { id: 'spirit', label: 'Spirit', group: 'core', tone: 'spirit', unit: 'flat', icon: 'spirit', variants: both('stat_3981240776') },
  { id: 'strength', label: 'Strength', group: 'attribute', tone: 'strength', unit: 'flat', icon: 'strength', variants: [total('pseudo_total_strength'), ...both('stat_4080418644')] },
  { id: 'dexterity', label: 'Dexterity', group: 'attribute', tone: 'dexterity', unit: 'flat', icon: 'dexterity', variants: [total('pseudo_total_dexterity'), ...both('stat_3261801346')] },
  { id: 'intelligence', label: 'Intelligence', group: 'attribute', tone: 'intelligence', unit: 'flat', icon: 'intelligence', variants: [total('pseudo_total_intelligence'), ...both('stat_328541901')] },
  { id: 'all-attributes', label: 'All Attributes', group: 'attribute', unit: 'flat', variants: [total('pseudo_total_all_attributes'), ...both('stat_1379411836')] },
  { id: 'movement-speed', label: 'Movement Speed', group: 'other', unit: 'percent', variants: [total('pseudo_increased_movement_speed'), ...both('stat_2250533757')] },
  { id: 'item-rarity', label: 'Rarity of Items found', group: 'other', unit: 'percent', variants: both('stat_3917489142') },
];

const BY_STAT = new Map(PARAMETERS.flatMap((parameter) => parameter.variants.map((variant) => [variant.statId, { parameter, variant }] as const)));

/** The parameter and source a trade stat stands for, or null for the long tail. */
export function parameterOf(statId: string): { parameter: SemanticParameter; variant: ParameterVariant } | null {
  return BY_STAT.get(statId) ?? null;
}

/**
 * The stats a search on these ids stands for on a card: the ids themselves and every source of their parameter — a
 * search on Total Life marks the explicit and implicit Life lines it adds up.
 */
export function relatedStats(statIds: Iterable<string>): Set<string> {
  const related = new Set<string>();
  for (const statId of statIds) {
    related.add(statId);
    for (const variant of parameterOf(statId)?.parameter.variants ?? []) related.add(variant.statId);
  }
  return related;
}

/** Words that give a stat of the long tail its colour, first match wins. */
const TONE_WORDS: [RegExp, StatTone][] = [
  [/\bFire\b/i, 'fire'],
  [/\bCold\b/i, 'cold'],
  [/\bLightning\b/i, 'lightning'],
  [/\bChaos\b/i, 'chaos'],
  [/\bElemental\b/i, 'elemental'],
  [/\bEnergy Shield\b/i, 'energy-shield'],
  [/\bLife\b/i, 'life'],
  [/\bMana\b/i, 'mana'],
  [/\bSpirit\b/i, 'spirit'],
  [/\bStrength\b/i, 'strength'],
  [/\bDexterity\b/i, 'dexterity'],
  [/\bIntelligence\b/i, 'intelligence'],
  [/\bAttributes\b/i, 'attributes'],
  [/\bArmour\b/i, 'armour'],
  [/\bEvasion\b/i, 'evasion'],
  [/\bCritical\b/i, 'critical'],
  [/\bSpeed\b/i, 'speed'],
  [/\bMinions?\b/i, 'minion'],
  [/\bLevel of all\b|\bSkill Gems?\b/i, 'skill'],
  [/\bPhysical\b/i, 'physical'],
  [/\bAccuracy\b/i, 'accuracy'],
  [/\bSpells?\b/i, 'spell'],
  [/\bAttacks?\b/i, 'attack'],
  [/\bRarity\b|\bQuantity\b|\bLight Radius\b|\bFlasks?\b|\bCharms?\b/i, 'utility'],
];

/**
 * The colour of a stat block — every stat has one: the registry's, else by the words of the stat (what it is about
 * first: an element, a resource, an attribute, then the kind of modifier), else the generic one.
 */
export function toneOf(statId: string, text: string | undefined): StatTone {
  const known = parameterOf(statId)?.parameter;
  if (known?.tone) return known.tone;
  const words = text ?? known?.label;
  return (words ? TONE_WORDS.find(([pattern]) => pattern.test(words))?.[1] : undefined) ?? 'generic';
}

/** Icons of the kit for the stat colours. */
const TONE_ICONS: Record<StatTone, IconName> = {
  fire: 'fire',
  cold: 'cold',
  lightning: 'lightning',
  chaos: 'chaos',
  elemental: 'elemental',
  life: 'life',
  mana: 'mana',
  spirit: 'spirit',
  'energy-shield': 'shield',
  strength: 'strength',
  dexterity: 'dexterity',
  intelligence: 'intelligence',
  attributes: 'strength',
  armour: 'armour',
  evasion: 'evasion',
  physical: 'weapon',
  critical: 'crit',
  speed: 'speed',
  minion: 'minion',
  skill: 'socket',
  accuracy: 'target',
  spell: 'spell',
  attack: 'weapon',
  utility: 'star',
  generic: 'diamond',
};

export function toneIcon(tone: StatTone | undefined): IconName | undefined {
  return tone ? TONE_ICONS[tone] : undefined;
}
