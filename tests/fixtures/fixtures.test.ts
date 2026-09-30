import { describe, expect, it } from 'vitest';
import { normalizeQuery } from '@/lib/query/normalize';
import { CATALOGS, LISTING_FIXTURES, loadCatalog, loadListings } from './load';

describe('fixtures', () => {
  it('In Person listings carry a whisper and an online status', () => {
    const { listings } = loadListings('listings-online');
    expect(listings).toHaveLength(10);
    for (const { listing } of listings) {
      expect(listing.whisper).toMatch(/^@Character\d+ /);
      expect(listing.whisper_token).toBe('scrubbed');
      expect(listing.account.online).not.toBeNull();
    }
  });

  it('Instant Buyout listings carry a hideout token and a fee instead', () => {
    const { listings } = loadListings('listings-securable');
    expect(listings).toHaveLength(10);
    for (const { listing } of listings) {
      expect(listing.hideout_token).toBe('scrubbed');
      expect(listing.fee).toBeGreaterThan(0);
      expect(listing).not.toHaveProperty('whisper');
      expect(listing.account.online).toBeNull();
    }
  });

  it('rings: the sample ring search of CLAUDE.md, In Person', () => {
    const { request, listings } = loadListings('listings-rings');
    expect(normalizeQuery(request.query).filters.type_filters?.filters.category).toEqual({ option: 'accessory.ring' });
    expect(listings.length).toBeGreaterThan(0);
    for (const { listing, item } of listings) {
      expect(item.baseType).toMatch(/Ring$/);
      expect(listing.whisper_token).toBe('scrubbed');
    }
  });

  it('hold only placeholder names', () => {
    for (const name of LISTING_FIXTURES) {
      for (const { listing } of loadListings(name).listings) {
        expect(listing.account.name).toMatch(/^Seller\d+#\d{4}$/);
        expect(listing.stash.name).toBe('Stash');
        if (listing.account.lastCharacterName !== undefined) expect(listing.account.lastCharacterName).toMatch(/^Character\d+$/);
      }
    }
  });

  it.each(CATALOGS)('catalog %s is a non-empty result list', (name) => {
    expect(loadCatalog(name).result.length).toBeGreaterThan(0);
  });
});
