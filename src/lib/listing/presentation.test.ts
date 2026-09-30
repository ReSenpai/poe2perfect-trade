import { describe, expect, it } from 'vitest';
import { LISTING_FIXTURES, loadListings } from '../../../tests/fixtures/load';
import { type Listing, parseListing } from './parse';
import { itemPresentation, sortFieldLabel } from './presentation';

const ALL = LISTING_FIXTURES.flatMap((name) => loadListings(name).listings.map(parseListing));

describe('itemPresentation', () => {
  it('keeps every mod line, in the order parseListing gives, grouped by kind', () => {
    for (const listing of ALL) {
      const shown = itemPresentation(listing).sections.filter((section) => section.kind !== 'socketed');
      expect(shown.flatMap((section) => section.lines.map((line) => line.text))).toEqual(listing.mods.map((mod) => mod.text));
      expect(shown.flatMap((section) => section.lines.map((line) => line.statId))).toEqual(listing.mods.map((mod) => mod.statId));
      // one section per run of a kind
      shown.forEach((section, index) => expect(section.kind).not.toBe(shown[index - 1]?.kind));
    }
  });

  it('names the sections as the game does: explicit mods need no title', () => {
    const titles = new Map(ALL.flatMap((listing) => itemPresentation(listing).sections.map((section) => [section.kind, section.title] as const)));
    expect(titles.get('explicit')).toBeNull();
    expect(titles.get('implicit')).toBe('Implicit');
    const base = ALL[0]!;
    expect(itemPresentation({ ...base, mods: [{ kind: 'rune', text: '+10% to Fire Resistance' }] }).sections[0]!.title).toBe('Augment');
  });

  it('maps rarities to the card frames, other frame types to a neutral one', () => {
    const base = ALL[0]!;
    const withRarity = (rarity: string): Listing => ({ ...base, item: { ...base.item, rarity } });
    expect(['Normal', 'Magic', 'Rare', 'Unique', 'Currency', 'Gem'].map((rarity) => itemPresentation(withRarity(rarity)).rarity)).toEqual(['normal', 'magic', 'rare', 'unique', 'other', 'other']);
  });

  it('keeps a section of an unknown kind with a readable title', () => {
    const base = ALL[0]!;
    const listing: Listing = { ...base, mods: [{ kind: 'sanctum', text: 'Something new' }] };
    expect(itemPresentation(listing).sections[0]).toMatchObject({ kind: 'sanctum', title: 'Sanctum', lines: [{ text: 'Something new' }] });
  });
});

describe('itemPresentation frame', () => {
  const base = ALL[0]!;
  const framed = (frameType: number | undefined, rarity = 'Rare'): Listing => ({ ...base, item: { ...base.item, rarity, ...(frameType === undefined ? { frameType: undefined } : { frameType }) } });

  it('reads the frame type of the item from the trade data', () => {
    expect(base.item.frameType).toBe(2);
    expect(itemPresentation(base).frame).toBe('rare');
  });

  it('picks the card the site shows for each frame type', () => {
    const frames = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13].map((type) => itemPresentation(framed(type)).frame);
    expect(frames).toEqual(['normal', 'magic', 'rare', 'unique', 'gem', 'currency', 'quest', 'prophecy', 'relic', 'supporterFoil', 'necropolis', 'breachGem']);
  });

  it('falls back to the rarity for frame types it has no card for, or none at all', () => {
    expect(itemPresentation(framed(12, 'Normal')).frame).toBe('normal');
    expect(itemPresentation(framed(undefined, 'Unique')).frame).toBe('unique');
    expect(itemPresentation(framed(99, 'Currency')).frame).toBe('normal');
  });
});

describe('itemPresentation details', () => {
  const ring = parseListing(loadListings('listings-rings').listings[0]!);

  it('starts the properties with the item category, as the site does', () => {
    expect(ring.item.category).toBe('Ring');
    expect(itemPresentation(ring).category).toBe('Ring');
  });

  it('gives each mod line its tier as prefix or suffix, and the mod name, level and roll ranges', () => {
    const line = itemPresentation(ring).sections.flatMap((section) => section.lines).find((candidate) => candidate.text === '+249 to Accuracy Rating')!;
    expect(line).toMatchObject({ tag: 'P2', affix: 'prefix', detail: { name: "Hunter's (≥58)", ranges: '[237—346]' } });
  });

  it('writes a range with equal ends as one number, and joins the values of a line', () => {
    const listing: Listing = { ...ring, mods: [{ kind: 'explicit', text: 'x', tier: 'S1', details: [{ name: 'A', tier: 'S1', level: 1, ranges: [[1, 1], [41, 46]] }] }] };
    expect(itemPresentation(listing).sections[0]!.lines[0]).toMatchObject({ affix: 'suffix', detail: { name: 'A (≥1)', ranges: '[1] [41—46]' } });
  });

  it('shows the pseudo totals of the server as a quiet section without a title', () => {
    const listing: Listing = { ...ring, mods: [...ring.mods, { kind: 'pseudo', text: '+37% total to Fire Resistance', statId: 'pseudo.pseudo_total_fire_resistance' }] };
    expect(itemPresentation(listing).sections.at(-1)).toMatchObject({ kind: 'pseudo', title: null, tone: 'muted' });
  });

  it('knows whether the listing is verified', () => {
    expect(ring.item.verified).toBe(true);
    expect(itemPresentation(ring).verified).toBe(true);
  });
});

describe('itemPresentation sort fields', () => {
  const gloves = parseListing(loadListings('listings-online').listings[0]!);

  it('gives the properties the site sorts by their sort field', () => {
    expect(itemPresentation(gloves).stats).toEqual([
      { name: 'Item Level', value: String(gloves.item.ilvl), field: 'ilvl' },
      { name: 'Evasion Rating', value: '105', field: 'ev' },
    ]);
    const weapon: Listing = { ...gloves, item: { ...gloves.item, properties: ['Quality', 'Physical Damage', 'Elemental Damage', 'Critical Hit Chance', 'Attacks per Second', 'Armour', 'Energy Shield', 'Ward', 'Spirit'].map((name) => ({ name, value: '1' })) } };
    expect(itemPresentation(weapon).stats.slice(1).map((stat) => stat.field)).toEqual(['quality', 'pdamage', 'edamage', 'crit', 'aps', 'ar', 'es', 'ward', undefined]);
  });

  it('names the server totals as the site does, each with its sort field', () => {
    const weapon: Listing = { ...gloves, item: { ...gloves.item, totals: [{ key: 'dps', value: 180.5, augmented: true }, { key: 'pdps', value: 120 }, { key: 'edps', value: 60.5 }, { key: 'base_defence_percentile', value: 87 }, { key: 'ar', value: 310 }, { key: 'ev', value: 126 }, { key: 'es', value: 40 }, { key: 'ward', value: 12 }] } };
    expect(itemPresentation(weapon).totals).toEqual([
      { name: 'DPS', value: '180.5', field: 'dps', augmented: true },
      { name: 'Physical DPS', value: '120', field: 'pdps' },
      { name: 'Elemental DPS', value: '60.5', field: 'edps' },
      { name: 'Base Percentile', value: '87%', field: 'base_defence_percentile' },
      { name: 'Armour', value: '310', field: 'ar' },
      { name: 'Evasion', value: '126', field: 'ev' },
      { name: 'Energy Shield', value: '40', field: 'es' },
      { name: 'Ward', value: '12', field: 'ward' },
    ]);
    expect(sortFieldLabel('base_defence_percentile')).toBe('Base Percentile');
    expect(sortFieldLabel('pdps')).toBe('Physical DPS');
  });

  it('splits the requirements, each part with its own sort field', () => {
    expect(itemPresentation(gloves).requirementParts).toEqual([
      { text: 'Level 48', field: 'lvl' },
      { text: '56 Dex', field: 'dex' },
    ]);
  });
});

describe('sortFieldLabel', () => {
  it('names the property and requirement sort fields as the card does', () => {
    expect(['ilvl', 'ev', 'es', 'ar', 'quality', 'pdamage', 'aps', 'lvl', 'dex', 'str', 'int'].map(sortFieldLabel)).toEqual([
      'Item Level',
      'Evasion Rating',
      'Energy Shield',
      'Armour',
      'Quality',
      'Physical Damage',
      'Attacks per Second',
      'Level',
      'Dexterity',
      'Strength',
      'Intelligence',
    ]);
    expect(sortFieldLabel('stat.explicit.stat_1')).toBeNull();
  });
});

