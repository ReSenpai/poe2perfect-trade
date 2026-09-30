import type { Option, WorkspaceData } from '@/lib/catalog/workspace-data';
import type { Change, ItemContext } from './context';

/**
 * What the Item section offers (step 23): the trade categories and rarities, one search over bases and
 * uniques, and which base belongs to which category. Base ↔ category comes from the game data; where it has nothing
 * to say the answer is "unknown" (null), never "does not fit".
 */

export interface ItemCatalogChoice {
  kind: 'base' | 'unique';
  /** As listed: "Ruby Ring", "Andvarius Gold Ring". */
  text: string;
  /** Unique name. */
  name?: string;
  /** Base type. */
  type: string;
}

export interface ItemCatalog {
  categories: Option[];
  rarities: Option[];
  /** Whether `type` is a base of `category`: null when the game data does not cover it. */
  baseFits(category: string | null, type: string): boolean | null;
  /** The most specific category a base belongs to, null when unknown. */
  categoryOfBase(type: string): string | null;
  search(text: string, category?: string | null, limit?: number): ItemCatalogChoice[];
  /** The item context a choice sets: a unique also sets its rarity, and its category when its base is known. */
  choose(choice: ItemCatalogChoice): Change<ItemContext>;
}

export function createItemCatalog(data: Pick<WorkspaceData, 'index' | 'items' | 'possible'>): ItemCatalog {
  const optionsOf = (key: string) => {
    const entry = data.index.get(key);
    return entry?.kind === 'fixed' ? entry.options.filter((option): option is Option => option.id !== null && option.id !== '') : [];
  };
  const categories = optionsOf('fixed:type_filters:category');
  const rarities = optionsOf('fixed:type_filters:rarity');

  let baseCategories: Map<string, string> | null = null;
  const categoryMap = () => {
    if (baseCategories) return baseCategories;
    // A base belongs to several categories ("Sword" and "One-Handed Melee"): the one with the fewest bases wins.
    const best = new Map<string, { category: string; size: number }>();
    for (const { id } of categories) {
      const bases = data.possible?.bases(id) ?? [];
      for (const base of bases) {
        const current = best.get(base);
        if (!current || bases.length < current.size) best.set(base, { category: id, size: bases.length });
      }
    }
    baseCategories = new Map([...best].map(([base, { category }]) => [base, category]));
    return baseCategories;
  };

  const choices: ItemCatalogChoice[] = data.items.map((item) => (item.name ? { kind: 'unique', text: item.text, name: item.name, type: item.type } : { kind: 'base', text: item.text, type: item.type }));

  const catalog: ItemCatalog = {
    categories,
    rarities,

    baseFits(category, type) {
      if (!data.possible || category === null) return null;
      const bases = data.possible.bases(category);
      return bases.length === 0 ? null : bases.includes(type);
    },

    categoryOfBase(type) {
      return categoryMap().get(type) ?? null;
    },

    search(text, category = null, limit = 20) {
      const words = text.toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length === 0) return [];
      const covered = category !== null && catalog.baseFits(category, '') !== null;
      return choices
        .filter((choice) => {
          const textWords = choice.text.toLowerCase().split(/\s+/);
          if (!words.every((word) => textWords.some((candidate) => candidate.startsWith(word)))) return false;
          if (!covered) return true;
          if (choice.kind === 'base') return catalog.baseFits(category, choice.type) === true;
          const own = catalog.categoryOfBase(choice.type);
          return own === null || own === category;
        })
        .sort((a, b) => (a.kind === b.kind ? a.text.length - b.text.length || a.text.localeCompare(b.text) : a.kind === 'base' ? -1 : 1))
        .slice(0, limit);
    },

    choose(choice) {
      if (choice.kind === 'base') return { type: choice.type, name: null };
      const category = catalog.categoryOfBase(choice.type);
      return { name: choice.name ?? null, type: choice.type, rarity: 'unique', ...(category ? { category } : {}) };
    },
  };
  return catalog;
}
