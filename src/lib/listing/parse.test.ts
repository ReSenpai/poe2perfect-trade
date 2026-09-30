import { describe, expect, it } from 'vitest';
import type { RawFetchEntry } from '@/lib/api/raw';
import { loadListings } from '../../../tests/fixtures/load';
import { formatAge, formatTotal, parseListing, stripMarkup } from './parse';

const online = loadListings('listings-online').listings;
const securable = loadListings('listings-securable').listings;

describe('stripMarkup', () => {
  it.each([
    ['+31% to [Resistances|Lightning Resistance]', '+31% to Lightning Resistance'],
    ['Adds 2 to 46 [Lightning] damage to [Attack|Attacks]', 'Adds 2 to 46 Lightning damage to Attacks'],
    ['+76 to maximum Life', '+76 to maximum Life'],
  ])('%s → %s', (text, plain) => {
    expect(stripMarkup(text)).toBe(plain);
  });
});

describe('parseListing', () => {
  it('reads an In Person listing', () => {
    const listing = parseListing(online[0]!);
    expect(listing).toMatchObject({
      id: online[0]!.id,
      item: { name: 'Rune Claw', baseType: 'Fine Bracers', rarity: 'Rare', ilvl: 66, category: 'Gloves', corrupted: false },
      price: { amount: 1, currency: 'regal', type: 'price' },
      seller: { account: 'Seller1#0001', character: 'Character1', status: 'online' },
      indexed: '2026-09-12T18:51:21Z',
      instantBuyout: false,
    });
    expect(listing.item.icon).toMatch(/^https:\/\/web\.poecdn\.com\//);
    expect(listing.whisper).toMatch(/^@Character1 Hi, I would like to buy your Rune Claw Fine Bracers/);
    expect(listing.mods.slice(0, 2)).toMatchObject([
      { kind: 'explicit', text: 'Adds 2 to 46 Lightning damage to Attacks', statId: 'explicit.stat_1754445556', tier: 'P3' },
      { kind: 'explicit', text: '+76 to maximum Life', statId: 'explicit.stat_3299347043', tier: 'P4' },
    ]);
  });

  it('reads properties, requirements, socketed items and flavour text', () => {
    const listing = parseListing(online[0]!);
    expect(listing.item.properties).toEqual([{ name: 'Evasion Rating', value: '105' }]);
    expect(listing.item.requirements).toBe('Level 48, 56 Dex');

    const entry: RawFetchEntry = {
      ...online[0]!,
      item: {
        ...online[0]!.item,
        properties: [
          { name: 'Gloves', values: [], displayMode: 0 },
          { name: 'Stack Size', values: [['3/10', 0]], displayMode: 0 },
          { name: 'Grants {0} of {1}', values: [['2', 0], ['Life', 0]], displayMode: 3 },
        ],
        socketedItems: [{ typeLine: 'Greater Iron Rune' }, { baseType: 'Soul Core of Tacati' }],
        flavourText: ['First line', 'second line'],
      },
    };
    const parsed = parseListing(entry);
    expect(parsed.item.properties).toEqual([
      { name: 'Stack Size', value: '3/10' },
      { name: 'Grants 2 of Life', value: '' },
    ]);
    expect(parsed.item.socketed).toEqual(['Greater Iron Rune', 'Soul Core of Tacati']);
    expect(parsed.item.flavour).toBe('First line second line');
  });

  it('marks AFK sellers', () => {
    const afk = online.find((entry) => entry.listing.account.online?.status === 'afk')!;
    expect(parseListing(afk).seller.status).toBe('afk');
  });

  it('reads an Instant Buyout listing', () => {
    const listing = parseListing(securable[0]!);
    expect(listing).toMatchObject({
      price: { amount: 1, currency: 'aug', type: 'b/o' },
      seller: { account: 'Seller1#0001', status: 'instant' },
      instantBuyout: true,
      fee: securable[0]!.listing.fee,
    });
    expect(listing.whisper).toBeUndefined();
    expect(listing.seller.character).toBeUndefined();
  });

  it('orders mods the way the game shows them and keeps plain-string mods', () => {
    const entry: RawFetchEntry = {
      ...online[0]!,
      item: {
        ...online[0]!.item,
        explicitMods: ['+10 to Strength'],
        implicitMods: [{ description: '+8% to [Resistances|Cold Resistance]', hash: 'stat.implicit.stat_4220027924' }],
        runeMods: ['+12% to Fire Resistance'],
        enchantMods: ['Enchanted'],
        craftedMods: ['Crafted mod'],
        corrupted: true,
      },
    };
    const listing = parseListing(entry);
    expect(listing.mods.map((mod) => `${mod.kind}:${mod.text}`)).toEqual([
      'enchant:Enchanted',
      'implicit:+8% to Cold Resistance',
      'rune:+12% to Fire Resistance',
      'explicit:+10 to Strength',
      'crafted:Crafted mod',
    ]);
    expect(listing.mods[1]!.statId).toBe('implicit.stat_4220027924');
    expect(listing.item.corrupted).toBe(true);
  });

  it('copes with a listing without a price and an offline seller', () => {
    const entry: RawFetchEntry = {
      ...online[0]!,
      listing: { ...online[0]!.listing, price: undefined, account: { name: 'Seller9#0009', online: null } },
    };
    expect(parseListing(entry)).toMatchObject({ price: null, seller: { status: 'offline' } });
  });

  it('parses every fixture listing', () => {
    for (const entry of [...online, ...securable]) {
      const listing = parseListing(entry);
      expect(listing.item.baseType).not.toBe('');
      expect(listing.mods.length).toBeGreaterThan(0);
      expect(listing.mods.every((mod) => !mod.text.includes('['))).toBe(true);
    }
  });
});

describe('formatAge', () => {
  const now = Date.parse('2026-09-18T12:00:00Z');
  it.each([
    ['2026-09-18T11:59:40Z', 'just now'],
    ['2026-09-18T11:48:00Z', '12 min ago'],
    ['2026-09-18T09:00:00Z', '3 h ago'],
    ['2026-09-17T11:00:00Z', '1 day ago'],
    ['2026-09-12T18:51:21Z', '5 days ago'],
    ['not a date', ''],
  ])('%s → %s', (indexed, text) => {
    expect(formatAge(indexed, now)).toBe(text);
  });
});

describe('formatTotal', () => {
  it.each([
    [0, 'No results'],
    [1, '1 result'],
    [1135, '1,135 results'],
    [10000, '10,000+ results'],
  ])('%i → %s', (total, text) => {
    expect(formatTotal(total)).toBe(text);
  });
});

describe('parseListing mod details', () => {
  const entry = loadListings('listings-rings').listings[0]!;

  it('keeps what the trade data says about each mod: name, tier, level and roll ranges', () => {
    const listing = parseListing(entry);
    const accuracy = listing.mods.find((mod) => mod.text === '+249 to Accuracy Rating')!;
    expect(accuracy.details).toEqual([{ name: "Hunter's", tier: 'P2', level: 58, ranges: [[237, 346]] }]);
    expect(accuracy.tier).toBe('P2');
  });

  it('reads the pseudo totals the server added as their own section, last', () => {
    const withPseudo = { ...entry, item: { ...entry.item, pseudoMods: [{ description: '+37% total to Fire Resistance', domain: 'pseudo', hash: 'pseudo.pseudo_total_fire_resistance' }] } };
    const listing = parseListing(withPseudo);
    expect(listing.mods.at(-1)).toEqual({ kind: 'pseudo', text: '+37% total to Fire Resistance', statId: 'pseudo.pseudo_total_fire_resistance' });
  });
});

describe('parseListing trade tokens', () => {
  it('keeps the tokens the whisper endpoint takes, for In person and Instant buyout', () => {
    expect(parseListing(loadListings('listings-rings').listings[0]!).tokens).toEqual({ whisper: 'scrubbed' });
    expect(parseListing(loadListings('listings-securable').listings[0]!).tokens).toEqual({ hideout: 'scrubbed' });
  });
});

describe('parseListing for the item text', () => {
  const gloves = loadListings('listings-online').listings[0]!;

  it('marks properties raised by the item mods (augmented), as the game copies them', () => {
    const listing = parseListing({ ...gloves, item: { ...gloves.item, properties: [{ name: 'Gloves', values: [], displayMode: 0 }, { name: '[Armour]', values: [['159', 1]], displayMode: 0 }, { name: 'Quality', values: [['+5%', 0]], displayMode: 0 }] } });
    expect(listing.item.properties).toEqual([
      { name: 'Armour', value: '159', augmented: true },
      { name: 'Quality', value: '+5%' },
    ]);
  });

  it('reads the totals the server works out (DPS, defences at max quality, base percentile), in the order the site shows them', () => {
    const extended = { ...(gloves.item.extended as object), dps: 180.5, pdps: 120, edps: 60.5, dps_aug: true, pdps_aug: true, ar: 310, ar_aug: true, es: 0, base_defence_percentile: 87 };
    const parsed = parseListing({ ...gloves, item: { ...gloves.item, extended } } as RawFetchEntry);
    expect(parsed.item.totals).toEqual([
      { key: 'dps', value: 180.5, augmented: true },
      { key: 'pdps', value: 120, augmented: true },
      { key: 'edps', value: 60.5 },
      { key: 'base_defence_percentile', value: 87 },
      { key: 'ar', value: 310, augmented: true },
      { key: 'ev', value: 126, augmented: true }, // the gloves' own evasion
    ]);
    expect(parseListing(loadListings('listings-rings').listings[0]!).item.totals).toEqual([]);
  });

  it('counts the sockets of the item', () => {
    expect(parseListing(gloves).item.sockets).toBe(0);
    expect(parseListing({ ...gloves, item: { ...gloves.item, sockets: [{ group: 0, type: 'rune' }, { group: 1, type: 'rune' }] } }).item.sockets).toBe(2);
  });

  it('reads each socket with its type and what sits in it, and the size of the item', () => {
    const socketed = { typeLine: 'Lesser Iron Rune', icon: 'https://web.poecdn.com/gen/image/rune.png', socketedIcon: 'https://web.poecdn.com/gen/image/RuneSocketFilled.png', socket: 1 };
    const item = { ...gloves.item, w: 2, h: 3, sockets: [{ group: 0, type: 'rune' }, { group: 1, type: 'rune' }], socketedItems: [socketed] };
    const parsed = parseListing({ ...gloves, item } as RawFetchEntry);
    expect(parsed.item.socketList).toEqual([{ type: 'rune' }, { type: 'rune', item: { name: 'Lesser Iron Rune', icon: 'https://web.poecdn.com/gen/image/RuneSocketFilled.png' } }]);
    expect(parsed.item.size).toEqual({ w: 2, h: 3 });
    expect(parseListing(gloves).item.socketList).toEqual([]);
  });
});
