import type { RawFetchEntry } from '@/lib/api/raw';

const TOKEN = 'scrubbed';

/**
 * Fixtures live in a public repository: account, character and stash names, notes and whisper/hideout tokens are
 * replaced. Sellers get stable numbers (Seller1#0001, Character1) in order of first appearance; the whisper and the
 * note are rebuilt from public listing data. Null entries (listings gone since the search) are dropped.
 */
export function scrubListings(entries: (RawFetchEntry | null)[]): RawFetchEntry[] {
  const sellers = new Map<string, number>();
  return entries.filter((entry): entry is RawFetchEntry => entry !== null).map((entry) => {
    const { listing, item } = entry;
    let seller = sellers.get(listing.account.name);
    if (seller === undefined) {
      seller = sellers.size + 1;
      sellers.set(listing.account.name, seller);
    }
    const character = `Character${seller}`;
    const stash = { ...listing.stash, name: 'Stash' };
    const account = { ...listing.account, name: `Seller${seller}#${String(seller).padStart(4, '0')}` };
    if (account.lastCharacterName !== undefined) account.lastCharacterName = character;

    const scrubbed: RawFetchEntry['listing'] = { ...listing, stash, account };
    if (listing.whisper !== undefined) {
      const price = listing.price ? `${listing.price.amount} ${listing.price.currency}` : 'offer';
      const title = [item.name, item.typeLine].filter(Boolean).join(' ');
      scrubbed.whisper =
        `@${character} Hi, I would like to buy your ${title} listed for ${price} in ${item.league ?? ''} ` +
        `(stash tab "Stash"; position: left ${stash.x + 1}, top ${stash.y + 1})`;
    } else delete scrubbed.whisper;
    if (listing.whisper_token !== undefined) scrubbed.whisper_token = TOKEN;
    else delete scrubbed.whisper_token;
    if (listing.hideout_token !== undefined) scrubbed.hideout_token = TOKEN;

    const scrubbedItem = { ...item };
    if (item.note !== undefined) {
      if (listing.price) scrubbedItem.note = `${listing.price.type} ${listing.price.amount} ${listing.price.currency}`;
      else delete scrubbedItem.note;
    }
    return { ...entry, listing: scrubbed, item: scrubbedItem };
  });
}
