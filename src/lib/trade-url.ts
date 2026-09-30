export type TradeSearchRef = { kind: 'id'; id: string } | { kind: 'encoded'; value: string };

export interface TradeUrl {
  league: string;
  search: TradeSearchRef | null;
}

const HOSTS = new Set(['www.pathofexile.com', 'pathofexile.com']);
const SEARCH_PATH = /^\/trade2\/search\/poe2\/([^/]+)(?:\/([^/]+))?\/?$/;
/** A query stored in the URL itself is base64url(gzip(JSON)); gzip's magic bytes 1f 8b 08 encode as "H4sI". */
const ENCODED_PREFIX = 'H4sI';

/** League and search of a PoE 2 trade search page, or null for any other URL. */
export function parseTradeUrl(url: string): TradeUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !HOSTS.has(parsed.hostname)) return null;
  const match = SEARCH_PATH.exec(parsed.pathname);
  if (!match) return null;

  let league: string;
  try {
    league = decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
  const search = match[2];
  if (!search) return { league, search: null };
  return {
    league,
    search: search.startsWith(ENCODED_PREFIX) ? { kind: 'encoded', value: search } : { kind: 'id', id: search },
  };
}

export function isTradeSearchUrl(url: string): boolean {
  return parseTradeUrl(url) !== null;
}

/** Path of a search page: `/trade2/search/poe2/<league>[/<encoded query>]`, as the site writes it. */
export function buildSearchPath(league: string, search?: string): string {
  const path = `/trade2/search/poe2/${encodeURIComponent(league)}`;
  return search ? `${path}/${search}` : path;
}

/** Path of the same search in another league; null when `url` is not a search page. */
export function withLeague(url: string, league: string): string | null {
  const parsed = parseTradeUrl(url);
  if (!parsed) return null;
  const search = parsed.search && (parsed.search.kind === 'encoded' ? parsed.search.value : parsed.search.id);
  return buildSearchPath(league, search ?? undefined);
}
