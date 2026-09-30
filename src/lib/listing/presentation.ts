import type { Listing, ModDetail, TotalKey } from './parse';

/**
 * The item of a listing as the game shows it — one model for the listing card, the tooltip and the comparison, so
 * their order and text of mods never drift apart (v4 §13.1).
 */

export type ItemRarity = 'normal' | 'magic' | 'rare' | 'unique' | 'other';

/** The kind of card the trade site draws: its `<kind>Popup` class. */
export type ItemFrame = 'normal' | 'magic' | 'rare' | 'unique' | 'gem' | 'currency' | 'quest' | 'prophecy' | 'relic' | 'supporterFoil' | 'necropolis' | 'breachGem';

/**
 * `item.frameType` → card, as the site's own code maps it (step 24a). 11 and 13 follow the class names
 * in the site CSS; 6 (divination cards, a different layout) and 12 (gold) fall back to the rarity.
 */
const FRAMES: Partial<Record<number, ItemFrame>> = {
  0: 'normal',
  1: 'magic',
  2: 'rare',
  3: 'unique',
  4: 'gem',
  5: 'currency',
  7: 'quest',
  8: 'prophecy',
  9: 'relic',
  10: 'supporterFoil',
  11: 'necropolis',
  13: 'breachGem',
};

export interface PresentationLine {
  text: string;
  /** Mod tier mark (P4, S3). */
  tag?: string;
  /** The trade stat id of this mod (from the item's hashes): what a stat filter can match exactly. */
  statId?: string;
  /** From the tier: P… is a prefix, S… a suffix. */
  affix?: 'prefix' | 'suffix';
  /** Shown on hover / focus, as the site does: the roll ranges and the mod name with its level. */
  detail?: { ranges: string; name: string };
  /** Roll range of each value of the line, in order. */
  ranges?: [number, number][];
  /** The mod behind the line as the game names it: `Prefix Modifier "Rotund" (Tier: 2)`. */
  modName?: string;
}

export interface PresentationSection {
  /** Mod kind (explicit, implicit, rune…) or `socketed`. */
  kind: string;
  /** Null for explicit mods: the game shows them without a title. */
  title: string | null;
  tone: 'mod' | 'implicit' | 'muted';
  lines: PresentationLine[];
}

export interface ItemPresentation {
  title: string;
  /** "Ring", "Gloves": the first line of the properties. */
  category: string | null;
  verified: boolean;
  subtitle: string | null;
  iconUrl: string | null;
  rarity: ItemRarity;
  /** The rarity as the trade data says it: "Rare", "Currency". */
  rarityText: string;
  frame: ItemFrame;
  /** Item level first, then the properties with values; `field`: what the site sorts the results by for this line. */
  stats: { name: string; value: string; field?: string; augmented?: true }[];
  sockets: number;
  requirements: string | null;
  /** The requirements one by one, each with its sort field: Level 48 (`lvl`), 56 Dex (`dex`). */
  requirementParts: { text: string; field?: string }[];
  /** DPS, defences at max quality, base percentile, as the site shows them under the card. */
  totals: { name: string; value: string; field: string; augmented?: true }[];
  sections: PresentationSection[];
  flavour: string | null;
  corrupted: boolean;
}

/** Sort fields of the site for the property lines (step 24b); others are not sortable. */
const PROPERTY_FIELDS: Record<string, string> = {
  'Item Level': 'ilvl',
  Quality: 'quality',
  'Physical Damage': 'pdamage',
  'Elemental Damage': 'edamage',
  'Critical Hit Chance': 'crit',
  'Attacks per Second': 'aps',
  Armour: 'ar',
  'Evasion Rating': 'ev',
  'Energy Shield': 'es',
  Ward: 'ward',
};
const REQUIREMENT_FIELDS: Record<string, string> = { Level: 'lvl', Str: 'str', Dex: 'dex', Int: 'int', Strength: 'str', Dexterity: 'dex', Intelligence: 'int' };

/** The server totals by the site's words; each one is also its sort field. */
const TOTAL_NAMES: Record<TotalKey, string> = {
  dps: 'DPS',
  pdps: 'Physical DPS',
  edps: 'Elemental DPS',
  base_defence_percentile: 'Base Percentile',
  ar: 'Armour',
  ev: 'Evasion',
  es: 'Energy Shield',
  ward: 'Ward',
};

const FIELD_LABELS: Record<string, string> = {
  ...TOTAL_NAMES,
  ...Object.fromEntries(Object.entries(PROPERTY_FIELDS).map(([name, field]) => [field, name])),
  lvl: 'Level',
  str: 'Strength',
  dex: 'Dexterity',
  int: 'Intelligence',
};

/** Words for a property or requirement sort field (`ev` → Evasion Rating); null for stat fields and unknown ones. */
export function sortFieldLabel(field: string): string | null {
  return FIELD_LABELS[field] ?? null;
}

const withField = <T extends { name: string }>(line: T, fields: Record<string, string>): T & { field?: string } => {
  const field = fields[line.name];
  return field ? { ...line, field } : line;
};

const RARITIES = new Set<ItemRarity>(['normal', 'magic', 'rare', 'unique']);

const SECTION_TITLES: Record<string, string> = {
  enchant: 'Enchant',
  implicit: 'Implicit',
  rune: 'Augment',
  fractured: 'Fractured',
  desecrated: 'Desecrated',
  crafted: 'Crafted',
};
/** Kinds the game shows above the explicit mods, in a quieter tone. */
const IMPLICIT_TONE = new Set(['enchant', 'implicit', 'rune']);

export function itemPresentation(listing: Listing): ItemPresentation {
  const { item } = listing;
  const rarity = item.rarity.toLowerCase() as ItemRarity;

  // Mods come ordered by kind (parseListing): each run of one kind is a section.
  const sections: PresentationSection[] = [];
  for (const mod of listing.mods) {
    const line: PresentationLine = { text: mod.text, ...(mod.tier ? { tag: mod.tier } : {}), ...(mod.statId ? { statId: mod.statId } : {}) };
    const affix = mod.tier?.startsWith('P') ? 'prefix' : mod.tier?.startsWith('S') ? 'suffix' : undefined;
    if (affix) line.affix = affix;
    const detail = modDetail(mod.details);
    if (detail) line.detail = detail;
    const ranges = mod.details?.flatMap((each) => each.ranges);
    if (ranges && ranges.length > 0) line.ranges = ranges;
    const first = mod.details?.[0];
    const tierNumber = mod.tier?.match(/^[PS](\d+)$/)?.[1];
    if (affix && first?.name && tierNumber) line.modName = `${affix === 'prefix' ? 'Prefix' : 'Suffix'} Modifier "${first.name}" (Tier: ${tierNumber})`;
    const last = sections.at(-1);
    if (last?.kind === mod.kind) {
      last.lines.push(line);
      continue;
    }
    const quiet = mod.kind === 'pseudo';
    const title = mod.kind === 'explicit' || quiet ? null : (SECTION_TITLES[mod.kind] ?? capitalize(mod.kind));
    sections.push({ kind: mod.kind, title, tone: quiet ? 'muted' : IMPLICIT_TONE.has(mod.kind) ? 'implicit' : 'mod', lines: [line] });
  }
  if (item.socketed.length > 0) sections.push({ kind: 'socketed', title: 'Socketed', tone: 'muted', lines: item.socketed.map((text) => ({ text })) });

  return {
    title: item.name || item.typeLine,
    category: item.category ?? null,
    verified: item.verified,
    subtitle: item.name ? item.baseType : null,
    iconUrl: item.icon || null,
    rarity: RARITIES.has(rarity) ? rarity : 'other',
    rarityText: item.rarity,
    frame: (item.frameType !== undefined ? FRAMES[item.frameType] : undefined) ?? (RARITIES.has(rarity) ? (rarity as ItemFrame) : 'normal'),
    stats: [...(item.ilvl !== undefined ? [{ name: 'Item Level', value: String(item.ilvl) }] : []), ...item.properties].map((stat) => withField(stat, PROPERTY_FIELDS)),
    requirements: item.requirements,
    sockets: item.sockets,
    totals: (item.totals ?? []).map((total) => ({
      name: TOTAL_NAMES[total.key],
      value: total.key === 'base_defence_percentile' ? `${total.value}%` : String(total.value),
      field: total.key,
      ...(total.augmented ? { augmented: true as const } : {}),
    })),
    requirementParts: item.requirementList.map((part) => {
      const field = REQUIREMENT_FIELDS[part.name];
      return field ? { text: part.text, field } : { text: part.text };
    }),
    sections,
    flavour: item.flavour ?? null,
    corrupted: item.corrupted,
  };
}

/** "[237—346]" and "Hunter's (≥58)"; equal ends as one number, values of a line one after another. */
function modDetail(details: ModDetail[] | undefined): PresentationLine['detail'] | undefined {
  if (!details || details.length === 0) return undefined;
  const ranges = details.flatMap((detail) => detail.ranges.map(([min, max]) => (min === max ? `[${min}]` : `[${min}—${max}]`))).join(' ');
  const name = details
    .filter((detail) => detail.name || detail.level !== undefined)
    .map((detail) => [detail.name, detail.level !== undefined ? `(≥${detail.level})` : undefined].filter(Boolean).join(' '))
    .join(', ');
  return ranges || name ? { ranges, name } : undefined;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

