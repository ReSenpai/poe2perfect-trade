/**
 * Pictures of item categories (the category assets, step 34): the trade category id and the picture of its
 * family — kinds share one (swords, axes, maces, gems, flasks), "Any …" takes its family's. Shipped as extension files
 * (public/category, web-accessible) and loaded only when shown; a category without a picture gets a neutral box.
 */
const ART: Record<string, string> = {
  'accessory.ring': 'ring',
  'accessory.amulet': 'amulet',
  'accessory.belt': 'belt',
  'armour.helmet': 'helmet',
  'armour.chest': 'body-armour',
  'armour.gloves': 'gloves',
  'armour.boots': 'boots',
  'armour.shield': 'shield',
  'armour.buckler': 'buckler',
  'armour.quiver': 'quiver',
  'armour.focus': 'focus',
  'weapon.onesword': 'sword',
  'weapon.twosword': 'sword',
  'weapon.oneaxe': 'axe',
  'weapon.twoaxe': 'axe',
  'weapon.onemace': 'mace',
  'weapon.twomace': 'mace',
  'weapon.spear': 'spear',
  'weapon.flail': 'flail',
  'weapon.claw': 'claw',
  'weapon.dagger': 'dagger',
  'weapon.bow': 'bow',
  'weapon.crossbow': 'crossbow',
  'weapon.wand': 'wand',
  'weapon.sceptre': 'sceptre',
  'weapon.staff': 'staff',
  'weapon.warstaff': 'quarterstaff',
  'weapon.talisman': 'talisman',
  'gem.activegem': 'gem',
  'gem.supportgem': 'gem',
  'gem.metagem': 'gem',
  'jewel': 'jewel',
  'flask.life': 'flask',
  'flask.mana': 'flask',
  'flask.charm': 'charm',
  'map.waystone': 'waystone',
  'map.fragment': 'fragment',
  'map.logbook': 'logbook',
  'map.breachstone': 'breachstone',
  'map.barya': 'trial-coin',
  'map.bosskey': 'pinnacle-key',
  'map.ultimatum': 'ultimatum',
  'map.tablet': 'tablet',
  'sanctum.relic': 'relic',
  'currency': 'currency',
  'currency.omen': 'omen',
  'currency.rune': 'rune',
  'currency.soulcore': 'soul-core',
  'card': 'card',
  'weapon.rod': 'fishing-rod',
  'weapon.unarmed': 'unarmed',
  'currency.talisman': 'talisman',
  'weapon': 'sword',
  'weapon.onemelee': 'sword',
  'weapon.twomelee': 'sword',
  'weapon.ranged': 'bow',
  'weapon.caster': 'staff',
  'armour': 'body-armour',
  'accessory': 'amulet',
  'gem': 'gem',
  'flask': 'flask',
  'map': 'waystone',
  'currency.socketable': 'rune',
};

let assetUrl: (path: string) => string = (path) => path;

/** How an extension file is addressed from the page: `browser.runtime.getURL` in the content script. */
export function setAssetUrl(resolve: (path: string) => string): void {
  assetUrl = resolve;
}

/** The picture of a category as an extension path; null for Any (no category). */
export function categoryArtPath(categoryId: string | null): string | null {
  if (!categoryId) return null;
  const key = ART[categoryId];
  return key ? `category/${key}.png` : 'category/unknown.svg';
}

/** Any extension file (public/…) as the page addresses it: the help's ring picture. */
export function extensionAssetUrl(path: string): string {
  return assetUrl(path);
}

export function categoryArtUrl(categoryId: string | null): string | null {
  const path = categoryArtPath(categoryId);
  return path ? assetUrl(path) : null;
}
