import { describe, expect, it, vi } from 'vitest';
import { encodeQueryParam } from '@/lib/query/codec';
import { normalizeQuery } from '@/lib/query/normalize';
import { createQueryLoader } from './query-loader';

const ORIGIN = 'https://www.pathofexile.com';
const QUERY = { status: { option: 'online' }, stats: [{ type: 'and', filters: [{ id: 'explicit.stat_3299347043', value: { min: 70 } }] }] };

function pageWith(state: unknown, league = 'Forbidden Rites'): string {
  return `<html><body><script>window.tradeOpts = ${JSON.stringify({ tab: 'search', realm: 'poe2', leagues: [], league, state })};</script></body></html>`;
}

function doc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('createQueryLoader', () => {
  it('also hands out the query as it came, for the editor: nothing normalized away', async () => {
    const raw = { status: 'online', stats: [{ type: 'xor', filters: [] }, { type: 'and', filters: [] }], term: 'x' };
    const url = `${ORIGIN}/trade2/search/poe2/Standard/${await encodeQueryParam(raw)}`;
    const load = createQueryLoader({ initialUrl: 'other', initialDocument: doc('<html></html>'), fetchHtml: vi.fn() });
    const result = await load(url);
    expect(result.ok && result.raw).toEqual(raw);
  });

  it('decodes the query kept in the URL, without touching the page', async () => {
    const fetchHtml = vi.fn();
    const url = `${ORIGIN}/trade2/search/poe2/Forbidden%20Rites/${await encodeQueryParam(QUERY)}`;
    const load = createQueryLoader({ initialUrl: 'other', initialDocument: doc('<html></html>'), fetchHtml });

    await expect(load(url)).resolves.toEqual({ ok: true, league: 'Forbidden Rites', query: normalizeQuery(QUERY), raw: QUERY });
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it('starts from an empty query on a league page without a search', async () => {
    const fetchHtml = vi.fn();
    const load = createQueryLoader({ initialUrl: 'other', initialDocument: doc('<html></html>'), fetchHtml });

    await expect(load(`${ORIGIN}/trade2/search/poe2/Standard`)).resolves.toEqual({ ok: true, league: 'Standard', query: normalizeQuery({}), raw: {} });
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it('reads a search the URL cannot decode (a short saved id) from the page it was opened with', async () => {
    const url = `${ORIGIN}/trade2/search/poe2/Standard/Ab3dEf`;
    const load = createQueryLoader({ initialUrl: url, initialDocument: doc(pageWith({ status: 'securable' }, 'Standard')), fetchHtml: vi.fn() });

    await expect(load(url)).resolves.toEqual({ ok: true, league: 'Standard', query: normalizeQuery({ status: 'securable' }), raw: { status: 'securable' } });
  });

  it('fetches the page of such a search reached by in-app navigation', async () => {
    const url = `${ORIGIN}/trade2/search/poe2/Standard/Ab3dEf`;
    const fetchHtml = vi.fn(async () => pageWith(QUERY, 'Standard'));
    const load = createQueryLoader({ initialUrl: 'other', initialDocument: doc('<html></html>'), fetchHtml });

    await expect(load(url)).resolves.toEqual({ ok: true, league: 'Standard', query: normalizeQuery(QUERY), raw: QUERY });
    expect(fetchHtml).toHaveBeenCalledWith(url);
  });

  it('reports a search it cannot read', async () => {
    const url = `${ORIGIN}/trade2/search/poe2/Standard/H4sIbroken`;
    const load = createQueryLoader({ initialUrl: url, initialDocument: doc('<html></html>'), fetchHtml: vi.fn() });

    await expect(load(url)).resolves.toEqual({ ok: false, message: "Couldn't read this search from the page (missing)" });
  });

  it('reports a failed page download', async () => {
    const url = `${ORIGIN}/trade2/search/poe2/Standard/Ab3dEf`;
    const load = createQueryLoader({
      initialUrl: 'other',
      initialDocument: doc('<html></html>'),
      fetchHtml: vi.fn(async () => {
        throw new Error('HTTP 503');
      }),
    });

    await expect(load(url)).resolves.toEqual({ ok: false, message: "Couldn't load this search: HTTP 503" });
  });

  it('reports a URL that is not a trade search', async () => {
    const load = createQueryLoader({ initialUrl: 'other', initialDocument: doc('<html></html>'), fetchHtml: vi.fn() });
    await expect(load(`${ORIGIN}/forum`)).resolves.toEqual({ ok: false, message: 'Not a trade search page' });
  });
});
