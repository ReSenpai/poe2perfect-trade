import { fitsCategory } from './more-filters';

/**
 * The filters of the site that are not stats (step 41 A, the unified filters design §12): every field of the
 * site's schema (`data/filters`) once, with a name people use, a line saying what it is, the words it is found by, the
 * section of Add filter it lives in, the kind of value it takes, its icon, and whether the top of the panel already edits
 * it (pinned: category, rarity, price, seller status). The ids are ours, not the site's: the binding says where it goes.
 */

export type CatalogSection = 'properties' | 'requirements' | 'trade';
export type FilterValueKind = 'range' | 'boolean' | 'enum' | 'text';
export type FilterIconKey =
  | 'itemLevel'
  | 'quality'
  | 'corrupted'
  | 'identified'
  | 'fractured'
  | 'sanctified'
  | 'twiceCorrupted'
  | 'cultivated'
  | 'unrevealed'
  | 'desecrated'
  | 'crafted'
  | 'itemProperty'
  | 'requiredLevel'
  | 'strength'
  | 'dexterity'
  | 'intelligence'
  | 'price'
  | 'seller'
  | 'sellerStatus'
  | 'listedTime'
  | 'tradeOption'
  | 'filter';

export interface FilterDefinition {
  id: string;
  label: string;
  /** "Requirement · Strength needed to equip". */
  description: string;
  /** Other words it is found by: "ilvl", "req level", "str". */
  aliases: string[];
  section: CatalogSection;
  valueKind: FilterValueKind;
  iconKey: FilterIconKey;
  /** pinned: edited at the top of the panel, the catalog only leads there. */
  placement: 'pinned' | 'selected-list';
  /** Where it goes in the query. */
  binding: { section: string; key: string };
  /** For enum: the choices; the site's Any (no filter) is not one. */
  options?: { id: string; text: string }[];
  /** For range: the bound a new condition sets (a requirement: at most). */
  defaultBound?: 'min' | 'max';
  /** What the site calls it. */
  siteText: string;
}

type Schema = {
  result: {
    id: string;
    filters: { id: string; text?: string; minMax?: boolean; input?: unknown; option?: { options: { id: string | null; text: string }[] } }[];
  }[];
};

type Known = Partial<Pick<FilterDefinition, 'label' | 'description' | 'aliases' | 'iconKey' | 'placement'>> & { id: string };

/** Our names for the fields we know; the rest keep the site's text. */
const KNOWN: Record<string, Known> = {
  'status_filters.status': { id: 'trade.status', label: 'Seller status', iconKey: 'sellerStatus', placement: 'pinned', aliases: ['online', 'status'] },
  'type_filters.category': { id: 'item.category', label: 'Category', placement: 'pinned', aliases: ['item class', 'type'] },
  'type_filters.rarity': { id: 'item.rarity', label: 'Rarity', placement: 'pinned' },
  'type_filters.ilvl': { id: 'property.item_level', label: 'Item level', description: 'Item property · Level of the item', iconKey: 'itemLevel', aliases: ['ilvl', 'item level'] },
  'type_filters.quality': { id: 'property.quality', label: 'Quality', iconKey: 'quality', aliases: ['qual'] },
  'equipment_filters.damage': { id: 'property.damage', label: 'Damage' },
  'equipment_filters.aps': { id: 'property.attacks_per_second', label: 'Attacks per second', aliases: ['aps', 'attack speed'] },
  'equipment_filters.crit': { id: 'property.critical_chance', label: 'Critical chance', aliases: ['crit'] },
  'equipment_filters.dps': { id: 'property.dps', label: 'DPS', aliases: ['damage per second', 'total dps'] },
  'equipment_filters.pdps': { id: 'property.physical_dps', label: 'Physical DPS', aliases: ['pdps', 'phys dps'] },
  'equipment_filters.edps': { id: 'property.elemental_dps', label: 'Elemental DPS', aliases: ['edps', 'ele dps'] },
  'equipment_filters.reload_time': { id: 'property.reload_time', label: 'Reload time' },
  'equipment_filters.ar': { id: 'property.armour', label: 'Armour', aliases: ['ar', 'armor'] },
  'equipment_filters.ev': { id: 'property.evasion', label: 'Evasion', aliases: ['ev'] },
  'equipment_filters.es': { id: 'property.energy_shield', label: 'Energy Shield', aliases: ['es'] },
  'equipment_filters.ward': { id: 'property.runic_ward', label: 'Runic Ward', aliases: ['ward'] },
  'equipment_filters.block': { id: 'property.block', label: 'Block' },
  'equipment_filters.spirit': { id: 'property.spirit', label: 'Spirit' },
  'equipment_filters.rune_sockets': { id: 'property.augmentable_sockets', label: 'Augmentable sockets', aliases: ['sockets', 'rune sockets'] },
  'req_filters.lvl': { id: 'requirement.level', label: 'Required level', description: 'Requirement · Character level needed to equip', iconKey: 'requiredLevel', aliases: ['req level', 'required level', 'level requirement', 'req lvl'] },
  'req_filters.str': { id: 'requirement.strength', label: 'Required Strength', description: 'Requirement · Strength needed to equip', iconKey: 'strength', aliases: ['str', 'req str', 'strength requirement'] },
  'req_filters.dex': { id: 'requirement.dexterity', label: 'Required Dexterity', description: 'Requirement · Dexterity needed to equip', iconKey: 'dexterity', aliases: ['dex', 'req dex', 'dexterity requirement'] },
  'req_filters.int': { id: 'requirement.intelligence', label: 'Required Intelligence', description: 'Requirement · Intelligence needed to equip', iconKey: 'intelligence', aliases: ['int', 'req int', 'intelligence requirement'] },
  'map_filters.map_tier': { id: 'property.map_tier', label: 'Waystone tier', aliases: ['tier', 'map tier'] },
  'misc_filters.identified': { id: 'property.identified', label: 'Identified', iconKey: 'identified', aliases: ['id', 'unidentified'] },
  'misc_filters.fractured_item': { id: 'property.fractured', label: 'Fractured', iconKey: 'fractured' },
  'misc_filters.corrupted': { id: 'property.corrupted', label: 'Corrupted', iconKey: 'corrupted', aliases: ['corrupt'] },
  'misc_filters.sanctified': { id: 'property.sanctified', label: 'Sanctified', iconKey: 'sanctified' },
  'misc_filters.twice_corrupted': { id: 'property.twice_corrupted', label: 'Twice Corrupted', iconKey: 'twiceCorrupted' },
  'misc_filters.mutated': { id: 'property.cultivated', label: 'Cultivated Vaal Unique', iconKey: 'cultivated', aliases: ['mutated'] },
  'misc_filters.veiled': { id: 'property.unrevealed', label: 'Unrevealed', iconKey: 'unrevealed', aliases: ['veiled'] },
  'misc_filters.desecrated': { id: 'property.desecrated', label: 'Desecrated', iconKey: 'desecrated' },
  'misc_filters.crafted': { id: 'property.crafted', label: 'Crafted', iconKey: 'crafted' },
  'trade_filters.account': { id: 'trade.account', label: 'Seller account', iconKey: 'seller', aliases: ['seller', 'account'] },
  'trade_filters.collapse': { id: 'trade.collapse', label: 'Collapse listings by account', iconKey: 'tradeOption', aliases: ['one per seller'] },
  'trade_filters.indexed': { id: 'trade.listed', label: 'Listed', iconKey: 'listedTime', aliases: ['age', 'time', 'indexed'] },
  'trade_filters.sale_type': { id: 'trade.sale_type', label: 'Sale type', iconKey: 'tradeOption', aliases: ['price note', 'unpriced'] },
  'trade_filters.fee': { id: 'trade.gold_fee', label: 'Gold fee', iconKey: 'price', aliases: ['fee', 'gold'] },
  'trade_filters.price': { id: 'trade.price', label: 'Price', iconKey: 'price', placement: 'pinned', aliases: ['buyout', 'budget', 'cost'] },
};

const SECTIONS: Record<string, CatalogSection> = {
  status_filters: 'trade',
  type_filters: 'properties',
  equipment_filters: 'properties',
  req_filters: 'requirements',
  map_filters: 'properties',
  misc_filters: 'properties',
  trade_filters: 'trade',
};
const SECTION_WORD: Record<CatalogSection, string> = { properties: 'Item property', requirements: 'Requirement', trade: 'Trade' };

export function buildFilterRegistry(schema: Schema): FilterDefinition[] {
  return schema.result.flatMap((group) =>
    group.filters.map((field): FilterDefinition => {
      const known = KNOWN[`${group.id}.${field.id}`];
      const section = SECTIONS[group.id] ?? 'properties';
      const siteText = field.text ?? known?.label ?? field.id;
      const label = known?.label ?? siteText;
      const choices = field.option?.options.filter((option) => option.id !== null && option.id !== '').map((option) => ({ id: option.id!, text: option.text }));
      const boolean = field.option !== undefined && choices?.map((option) => option.id).join(',') === 'true,false' && field.option.options.length === 3;
      const valueKind: FilterValueKind = field.minMax ? 'range' : field.input ? 'text' : boolean ? 'boolean' : 'enum';
      return {
        id: known?.id ?? `${section === 'trade' ? 'trade' : section === 'requirements' ? 'requirement' : 'property'}.${field.id}`,
        label,
        description: known?.description ?? `${SECTION_WORD[section]} · ${siteText}`,
        aliases: known?.aliases ?? [],
        section,
        valueKind,
        iconKey: known?.iconKey ?? (section === 'trade' ? 'tradeOption' : section === 'requirements' ? 'filter' : 'itemProperty'),
        placement: known?.placement ?? 'selected-list',
        binding: { section: group.id, key: field.id },
        ...(valueKind === 'enum' && choices ? { options: choices } : {}),
        ...(valueKind === 'range' ? { defaultBound: section === 'requirements' ? ('max' as const) : ('min' as const) } : {}),
        siteText,
      };
    }),
  );
}

/**
 * Filters by the words typed, best first: a whole name or word of it, then the start of a name, then every word somewhere
 * in the name, its words or the site's text. Local; nothing is asked of the site.
 */
export function findFilters(registry: FilterDefinition[], text: string): FilterDefinition[] {
  const query = text.trim().toLowerCase();
  if (!query) return [];
  const words = query.split(/\s+/);
  const scored = registry.flatMap((definition, order) => {
    const names = [definition.label, ...definition.aliases].map((name) => name.toLowerCase());
    const haystack = [...names, definition.siteText.toLowerCase()].join(' ');
    let score: number;
    if (names.includes(query) || definition.siteText.toLowerCase() === query) score = 0;
    else if (names.some((name) => name.startsWith(query))) score = 1;
    else if (words.every((word) => haystack.includes(word))) score = 2;
    else return [];
    return [{ definition, score, order }];
  });
  return scored.sort((a, b) => a.score - b.score || a.order - b.order).map((entry) => entry.definition);
}

/** Whether a filter fits items of the category; null without one (nothing to tell). Pinned ones always do. */
export function filterApplies(definition: FilterDefinition, category: string | null): boolean | null {
  if (!category) return null;
  if (definition.placement === 'pinned') return true;
  return fitsCategory(definition.binding, category);
}
