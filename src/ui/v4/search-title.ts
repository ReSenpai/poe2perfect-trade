/** Categories that are plural already: "Find gloves", not "Find a gloves". */
const PLURAL = /^(gloves|boots)$/;

/** The heading of the filters, by the category searched (shell v5): "Find a ring", "Find an amulet", "Find any weapon". */
export function searchTitle(category: string | null): string {
  if (!category) return 'Find items';
  const words = category.toLowerCase();
  if (words.startsWith('any ') || PLURAL.test(words)) return `Find ${words}`;
  if (/ed$/.test(words)) return `Find ${words} items`;
  // 'One' sounds like 'won': a one-handed sword.
  return `Find ${/^[aeiou]/.test(words) && !words.startsWith('one') ? 'an' : 'a'} ${words}`;
}
