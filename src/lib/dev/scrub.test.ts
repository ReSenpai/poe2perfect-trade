import { describe, expect, it } from 'vitest';
import type { RawFetchEntry } from '@/lib/api/raw';
import { scrubListings } from './scrub';

function entry(overrides: { listing?: Partial<RawFetchEntry['listing']>; item?: Partial<RawFetchEntry['item']> } = {}): RawFetchEntry {
  return {
    id: 'hash-1',
    listing: {
      method: 'psapi',
      indexed: '2026-09-18T04:00:00Z',
      stash: { name: 'My Secret Tab', x: 2, y: 20 },
      whisper: '@RealCharacter Hi, I would like to buy your Gloom Paw Gleaming Cuffs listed for 1 regal in Forbidden Rites (stash tab "My Secret Tab"; position: left 3, top 21)',
      whisper_token: 'real-whisper-token',
      account: {
        name: 'RealAccount#1234',
        online: { league: 'Forbidden Rites', status: 'afk' },
        lastCharacterName: 'RealCharacter',
        language: 'en_US',
        realm: 'poe2',
      },
      price: { type: '~b/o', amount: 1, currency: 'regal' },
      ...overrides.listing,
    },
    item: {
      league: 'Forbidden Rites',
      id: 'item-1',
      name: 'Gloom Paw',
      typeLine: 'Gleaming Cuffs',
      baseType: 'Gleaming Cuffs',
      rarity: 'Rare',
      ilvl: 81,
      note: 'price for RealAccount friends',
      explicitMods: ['+80 to maximum Life'],
      ...overrides.item,
    },
  };
}

const SECRETS = ['RealAccount', 'RealCharacter', 'My Secret Tab', 'real-whisper-token', 'real-hideout-token', 'friends'];

describe('scrubListings', () => {
  it('replaces seller, character and stash names with numbered placeholders', () => {
    const [scrubbed] = scrubListings([entry()]);
    expect(scrubbed!.listing.account).toEqual({
      name: 'Seller1#0001',
      online: { league: 'Forbidden Rites', status: 'afk' },
      lastCharacterName: 'Character1',
      language: 'en_US',
      realm: 'poe2',
    });
    expect(scrubbed!.listing.stash).toEqual({ name: 'Stash', x: 2, y: 20 });
  });

  it('rebuilds the whisper from public listing data', () => {
    const [scrubbed] = scrubListings([entry()]);
    expect(scrubbed!.listing.whisper).toBe(
      '@Character1 Hi, I would like to buy your Gloom Paw Gleaming Cuffs listed for 1 regal in Forbidden Rites (stash tab "Stash"; position: left 3, top 21)',
    );
    expect(scrubbed!.listing.whisper_token).toBe('scrubbed');
  });

  it('replaces the hideout token of instant buyout listings', () => {
    const [scrubbed] = scrubListings([
      entry({ listing: { whisper: undefined, whisper_token: undefined, hideout_token: 'real-hideout-token', fee: 21831 } }),
    ]);
    expect(scrubbed!.listing.hideout_token).toBe('scrubbed');
    expect(scrubbed!.listing.fee).toBe(21831);
    expect(scrubbed!.listing).not.toHaveProperty('whisper');
  });

  it('rebuilds the note from the price', () => {
    const [scrubbed] = scrubListings([entry()]);
    expect(scrubbed!.item.note).toBe('~b/o 1 regal');
  });

  it('numbers sellers by first appearance and reuses the number for the same seller', () => {
    const other = entry({ listing: { account: { name: 'Other#1', online: null } } });
    const scrubbed = scrubListings([entry(), other, entry()]);
    expect(scrubbed.map((e) => e.listing.account.name)).toEqual(['Seller1#0001', 'Seller2#0002', 'Seller1#0001']);
  });

  it('keeps the item data and leaves no secret anywhere', () => {
    const scrubbed = scrubListings([entry(), entry({ listing: { hideout_token: 'real-hideout-token' } })]);
    expect(scrubbed[0]!.item.explicitMods).toEqual(['+80 to maximum Life']);
    const text = JSON.stringify(scrubbed);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
  });

  it('skips null entries the API returns for gone listings', () => {
    expect(scrubListings([null, entry()])).toHaveLength(1);
  });
});
