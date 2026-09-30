import type { RawFetchEntry } from '@/lib/api/raw';

export type SellerStatus = 'online' | 'afk' | 'offline' | 'instant';

export interface ListingMod {
  /** enchant, implicit, rune, explicit, crafted, fractured, desecrated… */
  kind: string;
  text: string;
  /** Catalog stat id (`explicit.stat_…`): tells which mods a stat filter matched. */
  statId?: string;
  tier?: string;
  /** What the trade data says about the mods behind this line (a hybrid line has several). */
  details?: ModDetail[];
}

export interface ModDetail {
  /** "Hunter's". */
  name?: string;
  /** "P2" (prefix, tier 2), "S1". */
  tier?: string;
  /** Item level the mod needs. */
  level?: number;
  /** Roll range of each value: [[237, 346]]. */
  ranges: [number, number][];
}

export interface Listing {
  /** The listing hash from the search. */
  id: string;
  item: {
    name: string;
    baseType: string;
    typeLine: string;
    rarity: string;
    /** The card the game draws for the item (0 Normal … 13 breach graft), see `itemPresentation`. */
    frameType?: number;
    ilvl?: number;
    icon: string;
    /** First property without values: "Gloves", "Ring"… */
    category?: string;
    /** Properties with values: Evasion Rating 105, Stack Size 3/10…; `augmented`: raised by the item's mods. */
    properties: { name: string; value: string; augmented?: true }[];
    /** Number of sockets. */
    sockets: number;
    /** The sockets one by one: their type (`rune`…) and what sits in them, as the site draws them on the icon. */
    socketList: ItemSocket[];
    /** What the server works out for the card (`item.extended`): DPS, defences at max quality, base percentile. */
    totals: ItemTotal[];
    /** Inventory cells the item takes; the icon is drawn to it. */
    size?: { w: number; h: number };
    /** "Level 48, 56 Dex"; null without requirements. */
    requirements: string | null;
    /** The same, one by one: `{ name: 'Dex', text: '56 Dex' }`. */
    requirementList: { name: string; text: string }[];
    /** Runes, soul cores and other socketed items by name. */
    socketed: string[];
    flavour?: string;
    corrupted: boolean;
    /** The site checked the listing is still there. */
    verified: boolean;
  };
  mods: ListingMod[];
  price: { amount: number; currency: string; type: 'b/o' | 'price' } | null;
  seller: { account: string; character?: string; status: SellerStatus };
  indexed: string;
  /** In Person: the ready-made message in the seller's language. */
  whisper?: string;
  instantBuyout: boolean;
  /** Instant Buyout: gold fee. */
  fee?: number;
  /** What the whisper endpoint takes: never stored (remembered results drop them) nor logged. */
  tokens?: { whisper?: string; hideout?: string };
}

/** Mod sections in the order the game shows them; any other `*Mods` array follows. */
const MOD_ORDER = ['enchant', 'implicit', 'rune', 'fractured', 'explicit', 'desecrated', 'crafted'];

/** "[Resistances|Lightning Resistance]" → "Lightning Resistance", "[Lightning]" → "Lightning". */
export function stripMarkup(text: string): string {
  return text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1');
}

export function parseListing(entry: RawFetchEntry): Listing {
  const { listing, item } = entry;
  const properties = readProperties(item.properties);
  const category = properties.find((property) => property.values.length === 0)?.name;

  const instantBuyout = listing.hideout_token !== undefined;
  const online = listing.account.online;
  const status: SellerStatus = instantBuyout ? 'instant' : online ? (online.status === 'afk' ? 'afk' : 'online') : 'offline';

  const parsed: Listing = {
    id: entry.id,
    item: {
      name: item.name ?? '',
      baseType: item.baseType ?? item.typeLine ?? '',
      typeLine: item.typeLine ?? '',
      rarity: item.rarity ?? 'Normal',
      ...(typeof item.frameType === 'number' ? { frameType: item.frameType } : {}),
      verified: item.verified === true,
      icon: typeof item.icon === 'string' ? item.icon : '',
      properties: properties.filter((property) => property.values.length > 0 || property.name.includes('{0}')).map(formatProperty),
      requirements: readRequirements(item.requirements),
      requirementList: readRequirementList(item.requirements),
      sockets: Array.isArray(item.sockets) ? item.sockets.length : 0,
      socketList: readSocketList(item.sockets, item.socketedItems),
      totals: readTotals(item.extended),
      ...(typeof item.w === 'number' && typeof item.h === 'number' ? { size: { w: item.w, h: item.h } } : {}),
      socketed: readSocketed(item.socketedItems),
      corrupted: item.corrupted === true,
    },
    mods: readMods(item),
    price: listing.price ? { amount: listing.price.amount, currency: listing.price.currency, type: listing.price.type.includes('b/o') ? 'b/o' : 'price' } : null,
    seller: { account: listing.account.name, status },
    indexed: listing.indexed,
    instantBuyout,
  };
  if (item.ilvl !== undefined) parsed.item.ilvl = item.ilvl;
  if (category) parsed.item.category = category;
  if (Array.isArray(item.flavourText)) parsed.item.flavour = item.flavourText.filter((line) => typeof line === 'string').map(stripMarkup).join(' ');
  if (listing.account.lastCharacterName) parsed.seller.character = listing.account.lastCharacterName;
  if (listing.whisper) parsed.whisper = listing.whisper;
  if (listing.fee !== undefined) parsed.fee = listing.fee;
  const tokens = {
    ...(typeof listing.whisper_token === 'string' ? { whisper: listing.whisper_token } : {}),
    ...(typeof listing.hideout_token === 'string' ? { hideout: listing.hideout_token } : {}),
  };
  if (Object.keys(tokens).length > 0) parsed.tokens = tokens;
  return parsed;
}

interface RawProperty {
  name: string;
  values: string[];
  displayMode: number;
  /** A value shown in the "augmented" colour (1): raised by the item's mods. */
  augmented: boolean;
}

/** `properties` / `requirements`: `{ name, values: [[value, colour]], displayMode }`, markup stripped. */
function readProperties(value: unknown): RawProperty[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): RawProperty[] => {
    const { name, values, displayMode } = (raw ?? {}) as { name?: unknown; values?: unknown; displayMode?: unknown };
    if (typeof name !== 'string') return [];
    const texts = Array.isArray(values) ? values.map((entry) => (Array.isArray(entry) ? String(entry[0]) : String(entry))) : [];
    const augmented = Array.isArray(values) && values.some((entry) => Array.isArray(entry) && entry[1] === 1);
    return [{ name: stripMarkup(name), values: texts, displayMode: typeof displayMode === 'number' ? displayMode : 0, augmented }];
  });
}

/** displayMode 3 fills `{0}`, `{1}` placeholders in the name; the others read "name: values". */
function formatProperty(property: RawProperty): { name: string; value: string; augmented?: true } {
  if (property.displayMode === 3 || property.name.includes('{0}')) {
    return { name: property.name.replace(/\{(\d+)\}/g, (_match, index: string) => property.values[Number(index)] ?? ''), value: '' };
  }
  const formatted = { name: property.name, value: property.values.join(', ') };
  return property.augmented ? { ...formatted, augmented: true } : formatted;
}

/** "Level 48, 56 Dex": displayMode 1 puts the value first. */
function readRequirements(value: unknown): string | null {
  const requirements = readRequirementList(value).map((requirement) => requirement.text);
  return requirements.length > 0 ? requirements.join(', ') : null;
}

function readRequirementList(value: unknown): { name: string; text: string }[] {
  return readProperties(value).map((requirement) => {
    const amount = requirement.values.join(', ');
    return { name: requirement.name, text: requirement.displayMode === 1 ? `${amount} ${requirement.name}` : `${requirement.name} ${amount}` };
  });
}

/** The server totals, in the order the site shows them under the card (`itemPopupAdditional`). */
export const TOTAL_KEYS = ['dps', 'pdps', 'edps', 'base_defence_percentile', 'ar', 'ev', 'es', 'ward'] as const;
export type TotalKey = (typeof TOTAL_KEYS)[number];

export interface ItemTotal {
  key: TotalKey;
  value: number;
  /** `<key>_aug`: the value at max Quality. */
  augmented?: true;
}

/** As the site: a zero DPS or defence is not shown; the base percentile is, whenever it is there. */
function readTotals(extended: unknown): ItemTotal[] {
  if (!extended || typeof extended !== 'object') return [];
  const raw = extended as Record<string, unknown>;
  return TOTAL_KEYS.flatMap((key): ItemTotal[] => {
    const value = raw[key];
    if (typeof value !== 'number' || (value === 0 && key !== 'base_defence_percentile')) return [];
    return [raw[`${key}_aug`] === true ? { key, value, augmented: true } : { key, value }];
  });
}

export interface ItemSocket {
  type: string;
  /** A rune, soul core…: its name and the picture of the filled socket (`socketedIcon`, what the site shows). */
  item?: { name: string; icon: string };
}

function readSocketList(sockets: unknown, socketed: unknown): ItemSocket[] {
  if (!Array.isArray(sockets)) return [];
  const items = Array.isArray(socketed) ? (socketed as Record<string, unknown>[]) : [];
  return sockets.map((raw, index) => {
    const { type } = (raw ?? {}) as { type?: unknown };
    const socket: ItemSocket = { type: typeof type === 'string' ? type : 'rune' };
    const inside = items.find((candidate) => candidate?.socket === index);
    const name = inside && (typeof inside.typeLine === 'string' ? inside.typeLine : inside.baseType);
    const icon = inside && (typeof inside.socketedIcon === 'string' ? inside.socketedIcon : inside.icon);
    if (typeof name === 'string' && typeof icon === 'string') socket.item = { name: stripMarkup(name), icon };
    return socket;
  });
}

function readSocketed(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const { typeLine, baseType } = (raw ?? {}) as { typeLine?: unknown; baseType?: unknown };
    const name = typeof typeLine === 'string' ? typeLine : baseType;
    return typeof name === 'string' ? [stripMarkup(name)] : [];
  });
}

function readMods(item: RawFetchEntry['item']): ListingMod[] {
  const kinds = Object.keys(item)
    .filter((key) => key.endsWith('Mods') && Array.isArray(item[key]))
    .map((key) => key.slice(0, -'Mods'.length))
    .sort((a, b) => rank(a) - rank(b));

  return kinds.flatMap((kind) =>
    (item[`${kind}Mods`] as unknown[]).flatMap((raw): ListingMod[] => {
      if (typeof raw === 'string') return [{ kind, text: stripMarkup(raw) }];
      if (typeof raw !== 'object' || raw === null) return [];
      const { description, hash, mods } = raw as { description?: unknown; hash?: unknown; mods?: unknown };
      if (typeof description !== 'string') return [];
      const mod: ListingMod = { kind, text: stripMarkup(description) };
      if (typeof hash === 'string') mod.statId = hash.replace(/^stat\./, '');
      const details = Array.isArray(mods) ? mods.map(readDetail).filter((detail): detail is ModDetail => detail !== null) : [];
      if (details.length > 0) mod.details = details;
      const tier = details[0]?.tier;
      if (tier) mod.tier = tier;
      return [mod];
    }),
  );
}

function readDetail(raw: unknown): ModDetail | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { name, tier, level, magnitudes } = raw as { name?: unknown; tier?: unknown; level?: unknown; magnitudes?: unknown };
  const detail: ModDetail = { ranges: [] };
  if (typeof name === 'string' && name !== '') detail.name = name;
  if (typeof tier === 'string' && tier !== '') detail.tier = tier;
  if (typeof level === 'number') detail.level = level;
  if (Array.isArray(magnitudes)) {
    for (const magnitude of magnitudes) {
      const { min, max } = (magnitude ?? {}) as { min?: unknown; max?: unknown };
      const low = Number(min);
      const high = Number(max);
      if (Number.isFinite(low) && Number.isFinite(high)) detail.ranges.push([low, high]);
    }
  }
  return detail;
}

function rank(kind: string): number {
  const index = MOD_ORDER.indexOf(kind);
  return index === -1 ? MOD_ORDER.length : index;
}

/** "just now", "12 min ago", "3 h ago", "5 days ago"; empty for an unreadable date. */
export function formatAge(indexed: string, now: number): string {
  const time = Date.parse(indexed);
  if (Number.isNaN(time)) return '';
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** The site caps the total at 10000. */
export function formatTotal(total: number): string {
  if (total === 0) return 'No results';
  if (total === 1) return '1 result';
  return `${total.toLocaleString('en-US')}${total >= 10_000 ? '+' : ''} results`;
}
