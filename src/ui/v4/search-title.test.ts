import { describe, expect, it } from 'vitest';
import { searchTitle } from './search-title';

describe('searchTitle', () => {
  it.each([
    ['Ring', 'Find a ring'],
    ['Amulet', 'Find an amulet'],
    ['Body Armour', 'Find a body armour'],
    ['One-Handed Sword', 'Find a one-handed sword'],
    ['Gloves', 'Find gloves'],
    ['Boots', 'Find boots'],
    ['Any Weapon', 'Find any weapon'],
    ['Unarmed', 'Find unarmed items'],
    [null, 'Find items'],
  ])('%s → %s', (category, title) => {
    expect(searchTitle(category)).toBe(title);
  });
});
