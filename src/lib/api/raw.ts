/** Shapes of api/trade2 responses, as far as the extension reads them. See docs/ARCHITECTURE.md, "Trade API". */

export interface RawPrice {
  type: string;
  amount: number;
  currency: string;
}

export interface RawAccount {
  name: string;
  /** null for Instant Buyout listings: the seller does not need to be online. */
  online: { league?: string; status?: string } | null;
  lastCharacterName?: string;
  language?: string;
  realm?: string;
}

export interface RawListing {
  method: string;
  indexed: string;
  stash: { name: string; x: number; y: number };
  price?: RawPrice;
  account: RawAccount;
  /** In Person listings: a ready-made message in the seller's language. */
  whisper?: string;
  whisper_token?: string;
  /** Instant Buyout listings. */
  hideout_token?: string;
  fee?: number;
}

export interface RawItem {
  name: string;
  typeLine: string;
  baseType: string;
  rarity?: string;
  ilvl?: number;
  note?: string;
  league?: string;
  [key: string]: unknown;
}

export interface RawFetchEntry {
  id: string;
  listing: RawListing;
  item: RawItem;
}

export interface RawSearchResponse {
  id: string;
  complexity?: number;
  result: string[];
  total: number;
  inexact?: boolean;
}
