import { decodeQueryParam } from '@/lib/query/codec';
import type { TradeQuery } from '@/lib/query/model';
import { normalizeQuery } from '@/lib/query/normalize';
import { readTradeOpts } from '@/lib/site/trade-opts';
import { parseTradeUrl } from '@/lib/trade-url';

/** `raw` is the query as it came (decoded URL, page state): the v4 editor keeps what `normalizeQuery` drops. */
export type LoadResult = { ok: true; league: string; query: TradeQuery; raw?: unknown } | { ok: false; message: string };

/**
 * The search of a trade URL. The query normally travels in the URL itself and is decoded here; a search the URL cannot
 * give (a short saved id, a broken value) is read from the page state the server renders — the document the page was
 * opened with, or the page fetched again after in-app navigation.
 */
export function createQueryLoader({
  initialUrl,
  initialDocument,
  fetchHtml,
}: {
  initialUrl: string;
  initialDocument: Document;
  fetchHtml: (url: string) => Promise<string>;
}): (url: string) => Promise<LoadResult> {
  return async (url) => {
    const parsed = parseTradeUrl(url);
    if (!parsed) return { ok: false, message: 'Not a trade search page' };
    const { league, search } = parsed;
    if (!search) return { ok: true, league, query: normalizeQuery({}), raw: {} };

    if (search.kind === 'encoded') {
      const decoded = await decodeQueryParam(search.value);
      if (decoded) return { ok: true, league, query: normalizeQuery(decoded), raw: decoded };
    }

    let page: Document | string;
    try {
      page = url === initialUrl ? initialDocument : await fetchHtml(url);
    } catch (error) {
      return { ok: false, message: `Couldn't load this search: ${error instanceof Error ? error.message : String(error)}` };
    }
    const opts = readTradeOpts(page);
    if (!opts.ok) return { ok: false, message: `Couldn't read this search from the page (${opts.error})` };
    return { ok: true, league, query: normalizeQuery(opts.opts.state), raw: opts.opts.state };
  };
}
