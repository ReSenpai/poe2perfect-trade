import { describe, expect, it } from 'vitest';
import { loadListings } from '../../../tests/fixtures/load';
import { itemText } from './item-text';
import { type Listing, parseListing } from './parse';
import { itemPresentation } from './presentation';

const RING = parseListing(loadListings('listings-rings').listings[0]!);

describe('itemText', () => {
  it('writes the item as the game copies it with details: augmented values, sockets, mod headers and roll ranges', () => {
    const focus: Listing = {
      ...RING,
      item: {
        ...RING.item,
        name: 'Tribal Crest',
        baseType: 'Tasalio Focus',
        category: 'Focus',
        ilvl: 82,
        properties: [
          { name: 'Quality', value: '+20%', augmented: true },
          { name: 'Energy Shield', value: '212', augmented: true },
        ],
        requirements: 'Level 80, 115 Int',
        requirementList: [
          { name: 'Level', text: 'Level 80' },
          { name: 'Int', text: '115 Int' },
        ],
        sockets: 1,
        corrupted: true,
      },
      mods: [
        { kind: 'implicit', text: '+24 to maximum Mana', details: [{ ranges: [[20, 25]] }] },
        { kind: 'rune', text: '30% increased Energy Shield from Equipped Body Armour' },
        { kind: 'explicit', text: '72% increased Chaos Damage', tier: 'P2', details: [{ name: 'Baleful', tier: 'P2', level: 50, ranges: [[65, 74]] }] },
        { kind: 'explicit', text: 'Adds 10 to 12 Physical Damage to Attacks', tier: 'P4', details: [{ name: 'Glinting', tier: 'P4', level: 30, ranges: [[8, 11], [12, 14]] }] },
        { kind: 'explicit', text: '+2 to Level of all Spell Skills', tier: 'S1', details: [{ name: 'of the Conjurer', tier: 'S1', level: 75, ranges: [[2, 2]] }] },
        { kind: 'pseudo', text: '+24 total maximum Mana' },
      ],
    };
    expect(itemText(itemPresentation(focus))).toBe(
      [
        'Item Class: Focus',
        'Rarity: Rare',
        'Tribal Crest',
        'Tasalio Focus',
        '--------',
        'Quality: +20% (augmented)',
        'Energy Shield: 212 (augmented)',
        '--------',
        'Requires: Level 80, 115 Int',
        '--------',
        'Sockets: S',
        '--------',
        'Item Level: 82',
        '--------',
        '+24(20-25) to maximum Mana (implicit)',
        '--------',
        '30% increased Energy Shield from Equipped Body Armour (rune)',
        '--------',
        '{ Prefix Modifier "Baleful" (Tier: 2) }',
        '72(65-74)% increased Chaos Damage',
        '{ Prefix Modifier "Glinting" (Tier: 4) }',
        'Adds 10(8-11) to 12(12-14) Physical Damage to Attacks',
        '{ Suffix Modifier "of the Conjurer" (Tier: 1) }',
        '+2 to Level of all Spell Skills',
        '--------',
        'Corrupted',
      ].join('\n'),
    );
  });

  it('writes a one-line name for an item without a name, and nothing of the seller', () => {
    const listing: Listing = { ...RING, item: { ...RING.item, name: '', typeLine: 'Ruby Ring', rarity: 'Normal' } };
    const text = itemText(itemPresentation(listing));
    expect(text.split('\n').slice(0, 3)).toEqual(['Item Class: Ring', 'Rarity: Normal', 'Ruby Ring']);
    expect(text).not.toContain(RING.seller.account);
  });
});
