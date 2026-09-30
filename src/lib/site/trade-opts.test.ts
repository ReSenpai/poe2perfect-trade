import { describe, expect, it } from 'vitest';
import { readTradeOpts } from './trade-opts';

const OPTS = {
  tab: 'search',
  realm: 'poe2',
  realms: [],
  leagues: [
    { id: 'Forbidden Rites', realm: 'poe2', text: 'Forbidden Rites' },
    { id: 'Standard', realm: 'poe2', text: 'Standard' },
  ],
  news: { trade_news: [] },
  basePath: '/trade2',
  league: 'Forbidden Rites',
  state: { status: { option: 'securable' }, stats: [{ type: 'and', filters: [] }] },
};

function page(script: string): string {
  return `<html><head><script type="x-template"><div class="search-panel"></div></script></head>
<body><script>
    <!--
                var isRequireReady = false;
    //--></script>
<script>
    <!--
    ${script}
    //--></script></body></html>`;
}

function doc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('readTradeOpts', () => {
  it('reads league, leagues and the search state from the page script', () => {
    const result = readTradeOpts(doc(page(`window.tradeOpts = ${JSON.stringify(OPTS)};`)));
    expect(result).toEqual({
      ok: true,
      opts: {
        tab: 'search',
        realm: 'poe2',
        league: 'Forbidden Rites',
        leagues: OPTS.leagues,
        state: OPTS.state,
      },
    });
  });

  it('accepts HTML text and a page without a search state', () => {
    const { state: _state, ...withoutState } = OPTS;
    const result = readTradeOpts(page(`window.tradeOpts = ${JSON.stringify(withoutState)};\n    foo();`));
    expect(result).toMatchObject({ ok: true, opts: { league: 'Forbidden Rites', state: null } });
  });

  it('keeps braces inside strings intact', () => {
    const opts = { ...OPTS, state: { ...OPTS.state, name: 'a}b;{' } };
    const result = readTradeOpts(doc(page(`window.tradeOpts = ${JSON.stringify(opts)}; other({x:1});`)));
    expect(result).toMatchObject({ ok: true, opts: { state: { name: 'a}b;{' } } });
  });

  it('reports a page without tradeOpts', () => {
    expect(readTradeOpts(doc(page('var x = 1;')))).toEqual({ ok: false, error: 'missing' });
  });

  it('reports broken JSON', () => {
    expect(readTradeOpts(doc(page('window.tradeOpts = {"tab": ;')))).toEqual({ ok: false, error: 'invalid' });
  });

  it('reports options without a league', () => {
    expect(readTradeOpts(doc(page('window.tradeOpts = {"tab":"search"};')))).toEqual({ ok: false, error: 'invalid' });
  });
});
