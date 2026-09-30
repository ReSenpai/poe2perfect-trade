import { describe, expect, it } from 'vitest';
import { loadListings } from '../../../tests/fixtures/load';
import { decodeQueryParam, encodeQueryParam } from './codec';

const SAMPLE =
  'H4sIAAAAAAAACqtWKi5JLCktVrKqVsovKMnMz1OyUipOTS4tSkzKSVWq1QHLFytZRVcrlVQWpCpZKSXmpSjpKKVl5pSkFoEkYmtjawH6Jta0RwAAAA';

describe('decodeQueryParam', () => {
  it('decodes the query of the sample search URL', async () => {
    await expect(decodeQueryParam(SAMPLE)).resolves.toEqual({ status: { option: 'securable' }, stats: [{ type: 'and', filters: [] }] });
  });

  it.each(['listings-online', 'listings-securable'] as const)('decodes the search id the server returned for %s', async (name) => {
    const { search, request } = loadListings(name);
    await expect(decodeQueryParam(search.id)).resolves.toEqual(request.query);
  });

  it.each([
    ['not base64', '!!!'],
    ['not gzip', 'SGVsbG8'],
    ['gzip of something that is not JSON', 'H4sIAAAAAAAACstIzcnJBwCGphA2BQAAAA'],
    ['gzip of a JSON array', 'H4sIAAAAAAAACos2jAUAuDIvTAMAAAA'],
    ['empty', ''],
  ])('returns null for %s', async (_name, value) => {
    await expect(decodeQueryParam(value)).resolves.toBeNull();
  });
});

describe('encodeQueryParam', () => {
  it('produces an URL-safe gzip param that decodes back', async () => {
    const query = { status: { option: 'online' }, stats: [{ type: 'and', filters: [{ id: 'explicit.stat_3299347043', value: { min: 70 } }] }], name: 'Ünïcode ~ ?&/' };
    const encoded = await encodeQueryParam(query);

    expect(encoded).toMatch(/^H4sI[A-Za-z0-9_-]+$/);
    await expect(decodeQueryParam(encoded)).resolves.toEqual(query);
  });
});
