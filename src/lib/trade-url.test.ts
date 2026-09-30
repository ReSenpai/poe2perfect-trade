import { describe, expect, it } from 'vitest';
import { buildSearchPath, isTradeSearchUrl, parseTradeUrl, withLeague } from './trade-url';

const ENCODED =
  'H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUipOTS4tSkzKSVWq1QHLFytZRVcrlVQWpCpZKSXmpSjpKKVl5pSkFoEkYmtjawH6Jta0RwAAAA';
const SAMPLE = `https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/${ENCODED}`;

describe('parseTradeUrl', () => {
  it('reads league and encoded query from the sample search', () => {
    expect(parseTradeUrl(SAMPLE)).toEqual({ league: 'Forbidden Rites', search: { kind: 'encoded', value: ENCODED } });
  });

  it.each([
    ['https://www.pathofexile.com/trade2/search/poe2/Standard/Ab3dEfgh', 'Standard', 'Ab3dEfgh'],
    ['https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/Ab3dEfgh/', 'Forbidden Rites', 'Ab3dEfgh'],
    ['https://pathofexile.com/trade2/search/poe2/Standard/Ab3dEfgh?foo=1#bar', 'Standard', 'Ab3dEfgh'],
    ['https://www.pathofexile.com/trade2/search/poe2/HC%20Forbidden%20Rites/lX9aB2', 'HC Forbidden Rites', 'lX9aB2'],
  ])('reads a saved search id from %s', (url, league, id) => {
    expect(parseTradeUrl(url)).toEqual({ league, search: { kind: 'id', id } });
  });

  it.each([
    ['https://www.pathofexile.com/trade2/search/poe2/Standard', 'Standard'],
    ['https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/', 'Forbidden Rites'],
  ])('returns a league without a search for %s', (url, league) => {
    expect(parseTradeUrl(url)).toEqual({ league, search: null });
  });

  it.each([
    ['search page without league', 'https://www.pathofexile.com/trade2/search/poe2'],
    ['bulk exchange', 'https://www.pathofexile.com/trade2/exchange/poe2/Standard'],
    ['PoE 1 trade', 'https://www.pathofexile.com/trade/search/Standard/Ab3dEfgh'],
    ['other realm', 'https://www.pathofexile.com/trade2/search/pc/Standard/Ab3dEfgh'],
    ['nested path', 'https://www.pathofexile.com/trade2/search/poe2/Standard/Ab3dEfgh/live'],
    ['forum', 'https://www.pathofexile.com/forum'],
    ['lookalike domain', 'https://www.pathofexile.com.example.com/trade2/search/poe2/Standard'],
    ['other site', 'https://example.com/trade2/search/poe2/Standard'],
    ['insecure scheme', 'http://www.pathofexile.com/trade2/search/poe2/Standard'],
    ['broken escape', 'https://www.pathofexile.com/trade2/search/poe2/%E0%A4%A'],
    ['not a URL', 'not a url'],
  ])('returns null for %s', (_name, url) => {
    expect(parseTradeUrl(url)).toBeNull();
  });
});

describe('isTradeSearchUrl', () => {
  it('is true for a search page', () => {
    expect(isTradeSearchUrl(SAMPLE)).toBe(true);
  });

  it('is false for the bulk exchange', () => {
    expect(isTradeSearchUrl('https://www.pathofexile.com/trade2/exchange/poe2/Standard')).toBe(false);
  });
});

describe('buildSearchPath', () => {
  it('builds the path of a search the way the site does', () => {
    expect(buildSearchPath('Forbidden Rites', ENCODED)).toBe(`/trade2/search/poe2/Forbidden%20Rites/${ENCODED}`);
  });

  it('builds the path of a league without a search', () => {
    expect(buildSearchPath('HC Forbidden Rites')).toBe('/trade2/search/poe2/HC%20Forbidden%20Rites');
  });

  it('round-trips through parseTradeUrl', () => {
    const url = `https://www.pathofexile.com${buildSearchPath('Forbidden Rites', ENCODED)}`;
    expect(parseTradeUrl(url)).toEqual({ league: 'Forbidden Rites', search: { kind: 'encoded', value: ENCODED } });
  });
});

describe('withLeague', () => {
  it('moves the same search to another league', () => {
    expect(withLeague(SAMPLE, 'Standard')).toBe(`/trade2/search/poe2/Standard/${ENCODED}`);
    expect(withLeague('https://www.pathofexile.com/trade2/search/poe2/Standard', 'HC Forbidden Rites')).toBe('/trade2/search/poe2/HC%20Forbidden%20Rites');
  });

  it('returns null away from a search page', () => {
    expect(withLeague('https://www.pathofexile.com/trade2/exchange/poe2/Standard', 'Standard')).toBeNull();
  });
});
