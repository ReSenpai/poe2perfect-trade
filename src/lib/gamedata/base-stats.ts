/**
 * Which trade stats can appear on which item class, built from game data (repoe-fork, see docs/ARCHITECTURE.md, "Game data").
 * Runs at build time (scripts/build-base-stats.ts); the extension ships only the compact result.
 * No imports: the build script runs this file with Node's type stripping.
 */

export interface RepoeMod {
  domain: string;
  generation_type: string;
  stats: { id: string; min: number; max: number }[];
  spawn_weights: { tag: string; weight: number }[];
}

export interface RepoeTranslation {
  ids: string[];
  English: { string: string; format?: string[] }[] | null;
}

export interface RepoeData {
  version: string;
  statDescriptions: RepoeTranslation[];
  mods: Record<string, RepoeMod>;
  modsByBase: Record<string, Record<string, { bases: string[]; mods: Record<string, Record<string, Record<string, number>>> }>>;
  baseItems: Record<string, { name: string; item_class: string; tags: string[]; implicits: string[]; release_state?: string }>;
  augments: Record<
    string,
    { categories: Record<string, { stats: { id: string }[]; stat_text: string[] | null; bonded_stat_text?: string[] | null; target: string[] | string | null }> }
  >;
  /** api/trade2/data/stats */
  tradeStats: { result: { id: string; entries: { id: string; text: string }[] }[] };
}

export type Affix = 'p' | 's' | null;

/** Compact result shipped with the extension. */
export interface BaseStatsData {
  version: string;
  /** Every trade stat id once; classes refer to them by index. */
  stats: string[];
  /** Trade category (type_filters → category) → item classes. */
  categories: Record<string, string[]>;
  classes: Record<
    string,
    {
      /** [index into the shared `stats`, highest value, prefix / suffix for explicit mods] */
      stats: [number, number | null, Affix][];
      /** Groups of bases allowing the same stats, with indexes into the class `stats`. */
      sets: { bases: string[]; stats: number[] }[];
    }
  >;
}

const ONE_MELEE = ['Claws', 'Daggers', 'One Hand Swords', 'One Hand Axes', 'One Hand Maces', 'Spears', 'Flails'];
const TWO_MELEE = ['Two Hand Swords', 'Two Hand Axes', 'Two Hand Maces', 'Quarterstaves', 'Talismans'];
const RANGED = ['Bows', 'Crossbows'];
const CASTER = ['Wands', 'Sceptres', 'Staves'];
const ARMOUR = ['Helmets', 'Body Armours', 'Gloves', 'Boots', 'Quivers', 'Shields', 'Foci', 'Bucklers'];
const ACCESSORY = ['Amulets', 'Belts', 'Rings'];
const FLASK = ['Life Flasks', 'Mana Flasks', 'Charms'];

/** Trade categories (api/trade2/data/filters → type_filters → category) and the game item classes behind them. */
export const CATEGORY_CLASSES: Record<string, string[]> = {
  weapon: [...ONE_MELEE, ...TWO_MELEE, ...RANGED, ...CASTER, 'Fishing Rods'],
  'weapon.onemelee': ONE_MELEE,
  'weapon.claw': ['Claws'],
  'weapon.dagger': ['Daggers'],
  'weapon.onesword': ['One Hand Swords'],
  'weapon.oneaxe': ['One Hand Axes'],
  'weapon.onemace': ['One Hand Maces'],
  'weapon.spear': ['Spears'],
  'weapon.flail': ['Flails'],
  'weapon.twomelee': TWO_MELEE,
  'weapon.twosword': ['Two Hand Swords'],
  'weapon.twoaxe': ['Two Hand Axes'],
  'weapon.twomace': ['Two Hand Maces'],
  'weapon.warstaff': ['Quarterstaves'],
  'weapon.talisman': ['Talismans'],
  'weapon.ranged': RANGED,
  'weapon.bow': ['Bows'],
  'weapon.crossbow': ['Crossbows'],
  'weapon.caster': CASTER,
  'weapon.wand': ['Wands'],
  'weapon.sceptre': ['Sceptres'],
  'weapon.staff': ['Staves'],
  'weapon.rod': ['Fishing Rods'],
  armour: ARMOUR,
  'armour.helmet': ['Helmets'],
  'armour.chest': ['Body Armours'],
  'armour.gloves': ['Gloves'],
  'armour.boots': ['Boots'],
  'armour.quiver': ['Quivers'],
  'armour.shield': ['Shields'],
  'armour.focus': ['Foci'],
  'armour.buckler': ['Bucklers'],
  accessory: ACCESSORY,
  'accessory.amulet': ['Amulets'],
  'accessory.belt': ['Belts'],
  'accessory.ring': ['Rings'],
  jewel: ['Jewels'],
  flask: FLASK,
  'flask.life': ['Life Flasks'],
  'flask.mana': ['Mana Flasks'],
  'flask.charm': ['Charms'],
  'map.waystone': ['Waystones'],
  'map.tablet': ['Tablet'],
  'sanctum.relic': ['Relics'],
};

const MARTIAL = [...ONE_MELEE, ...TWO_MELEE, ...RANGED];
const WEAPONS = [...MARTIAL, ...CASTER];

/** Augment (rune, soul core) targets written as a group name rather than a list of classes. */
const AUGMENT_TARGETS: Record<string, string[]> = {
  Armour: ['Helmets', 'Body Armours', 'Gloves', 'Boots', 'Shields', 'Bucklers', 'Foci'],
  'Martial Weapon': MARTIAL,
  'Martial Weapon, Wand or Staff': [...MARTIAL, 'Wands', 'Staves'],
  'Wand or Staff': ['Wands', 'Staves'],
  'Caster Weapon': ['Wands', 'Staves'],
  Weapon: WEAPONS,
  'All Equipment': [...WEAPONS, ...ARMOUR],
  Shields: ['Shields'],
  'Shields and Bucklers': ['Shields', 'Bucklers'],
  'One Hand Mace or Quarterstaff': ['One Hand Maces', 'Quarterstaves'],
  'Crossbow, Bow or Spear': ['Crossbows', 'Bows', 'Spears'],
  'One Hand Mace, Two Hand Mace or Talisman': ['One Hand Maces', 'Two Hand Maces', 'Talismans'],
  'Quarterstaff or Spear': ['Quarterstaves', 'Spears'],
};

function augmentTargets(target: string[] | string | null): string[] {
  if (Array.isArray(target)) return target;
  if (typeof target !== 'string') return [];
  return AUGMENT_TARGETS[stripMarkup(target)] ?? [];
}

/** "[Resistances|Fire Resistance]" → "Fire Resistance". */
function stripMarkup(text: string): string {
  return text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1');
}

/** Comparable form of a stat text: placeholders and numbers become `#`, signs before them go. */
function normalize(text: string): string {
  return stripMarkup(text)
    .replace(/\{\d+\}/g, '#')
    .replace(/[+-]?\d+(?:\.\d+)?/g, '#')
    .replace(/[+-]#/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Game stat id → trade stat id of a trade type (explicit, implicit, rune, enchant, desecrated), matched by the English
 * template text. Local game stats (`local_*`) prefer the trade stat marked " (Local)".
 */
export function createStatLinker(
  statDescriptions: RepoeTranslation[],
  tradeStats: RepoeData['tradeStats'],
): (statId: string, type: string) => string | null {
  const translations = new Map<string, RepoeTranslation>();
  for (const entry of statDescriptions) for (const id of entry.ids) if (!translations.has(id)) translations.set(id, entry);
  const byText = tradeTextIndex(tradeStats);

  return (statId, type) => {
    const entry = translations.get(statId);
    if (!entry?.English) return null;
    for (const variant of entry.English) {
      const text = normalize(variant.string);
      if (!text) continue;
      const candidates = statId.startsWith('local_') ? [`${text} (local)`, text] : [text, `${text} (local)`];
      for (const candidate of candidates) {
        const id = byText.get(`${type}|${candidate}`);
        if (id) return id;
      }
    }
    return null;
  };
}

function tradeTextIndex(tradeStats: RepoeData['tradeStats']): Map<string, string> {
  const byText = new Map<string, string>();
  for (const group of tradeStats.result) {
    for (const entry of group.entries) {
      const key = `${group.id}|${normalize(entry.text)}`;
      if (!byText.has(key)) byText.set(key, entry.id);
    }
  }
  return byText;
}

/** The game's rule: the first spawn weight whose tag the base has decides; no matching tag — no spawn. */
export function canSpawn(weights: { tag: string; weight: number }[], tags: string[]): boolean {
  for (const { tag, weight } of weights) if (tags.includes(tag)) return weight > 0;
  return false;
}

export function buildBaseStats(repoe: RepoeData): { data: BaseStatsData; report: { linked: number; unlinked: string[] } } {
  const link = createStatLinker(repoe.statDescriptions, repoe.tradeStats);
  const runeByText = tradeTextIndex(repoe.tradeStats);
  const wantedClasses = new Set(Object.values(CATEGORY_CLASSES).flat());
  const desecrated = Object.entries(repoe.mods).filter(([, mod]) => mod.domain === 'desecrated' && (mod.generation_type === 'prefix' || mod.generation_type === 'suffix'));
  const linkedMods = new Set<string>();
  const unlinkedMods = new Set<string>();
  const classes: BaseStatsData['classes'] = {};
  const built = new Map<string, { ids: string[]; table: Map<string, { max: number | null; affix: Affix }>; sets: { bases: string[]; stats: number[] }[] }>();

  for (const [className, sets] of Object.entries(repoe.modsByBase)) {
    if (!wantedClasses.has(className)) continue;
    const table = new Map<string, { max: number | null; affix: Affix }>();
    const outSets: { bases: string[]; stats: Set<string> }[] = [];

    for (const [tagKey, set] of Object.entries(sets)) {
      const found = new Set<string>();
      const add = (tradeId: string, value: number | null, affix: Affix) => {
        found.add(tradeId);
        const current = table.get(tradeId);
        if (!current) table.set(tradeId, { max: value, affix });
        else {
          if (value !== null && (current.max === null || value > current.max)) current.max = value;
          current.affix ??= affix;
        }
      };
      const addMod = (modId: string, type: string, affix: Affix) => {
        const mod = repoe.mods[modId];
        if (!mod) return;
        let linked = false;
        for (const stat of mod.stats) {
          const tradeId = link(stat.id, type);
          if (tradeId) {
            add(tradeId, stat.max, affix);
            linked = true;
          }
        }
        if (linked) linkedMods.add(modId);
        else unlinkedMods.add(modId);
      };

      for (const kind of ['prefix', 'suffix'] as const) {
        for (const group of Object.values(set.mods[kind] ?? {})) for (const modId of Object.keys(group)) addMod(modId, 'explicit', kind === 'prefix' ? 'p' : 's');
      }
      for (const group of Object.values(set.mods.corrupted ?? {})) for (const modId of Object.keys(group)) addMod(modId, 'enchant', null);
      for (const base of set.bases) for (const modId of repoe.baseItems[base]?.implicits ?? []) addMod(modId, 'implicit', null);

      const tags = tagKey.split(',');
      for (const [modId, mod] of desecrated) if (canSpawn(mod.spawn_weights, tags)) addMod(modId, 'desecrated', mod.generation_type === 'prefix' ? 'p' : 's');

      for (const augment of Object.values(repoe.augments)) {
        for (const category of Object.values(augment.categories)) {
          if (!augmentTargets(category.target).includes(className)) continue;
          const lines = [...(category.stat_text ?? []), ...(category.bonded_stat_text ?? []).map((line) => `Bonded: ${line}`)];
          for (const line of lines) {
            const tradeId = runeByText.get(`rune|${normalize(line)}`);
            const numbers = stripMarkup(line).match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
            if (tradeId) add(tradeId, numbers.length > 0 ? Math.max(...numbers) : null, null);
          }
        }
      }

      const names = set.bases.filter((base) => repoe.baseItems[base]?.release_state !== 'unreleased').map((base) => repoe.baseItems[base]?.name ?? base);
      outSets.push({ bases: names, stats: found });
    }

    const ids = [...table.keys()];
    const position = new Map(ids.map((id, index) => [id, index]));
    // Armour classes have dozens of tag sets that mostly allow the same stats: one entry per distinct stat list.
    const merged = new Map<string, { bases: string[]; stats: number[] }>();
    for (const set of outSets) {
      const indexes = [...set.stats].map((id) => position.get(id)!).sort((x, y) => x - y);
      const key = indexes.join(',');
      const existing = merged.get(key);
      if (existing) existing.bases.push(...set.bases);
      else merged.set(key, { bases: [...set.bases], stats: indexes });
    }
    built.set(className, { ids, table, sets: [...merged.values()] });
  }

  const shared = [...new Set([...built.values()].flatMap((entry) => entry.ids))];
  const sharedIndex = new Map(shared.map((id, index) => [id, index]));
  for (const [className, entry] of built) {
    classes[className] = {
      stats: entry.ids.map((id) => [sharedIndex.get(id)!, entry.table.get(id)!.max, entry.table.get(id)!.affix]),
      sets: entry.sets,
    };
  }

  for (const id of linkedMods) unlinkedMods.delete(id);
  return { data: { version: repoe.version, stats: shared, categories: CATEGORY_CLASSES, classes }, report: { linked: linkedMods.size, unlinked: [...unlinkedMods].sort() } };
}
