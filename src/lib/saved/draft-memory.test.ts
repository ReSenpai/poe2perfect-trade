import { describe, expect, it } from 'vitest';
import { draftFor, readRememberedDraft, type RememberedDraft } from './draft-memory';

const BASE = { status: { option: 'online' }, stats: [{ type: 'and', filters: [{ id: 'pseudo.pseudo_total_life', value: { min: 80 } }] }] };
const DRAFT = { ...BASE, stats: [{ type: 'and', filters: [{ id: 'pseudo.pseudo_total_life', value: { min: 95 } }] }], unknownField: 1 };
const MEMORY: RememberedDraft = { version: 1, baseLeague: 'Forbidden Rites', base: BASE, league: 'Forbidden Rites', draft: DRAFT, sort: { price: 'asc' }, savedAt: 1 };

describe('draft memory', () => {
  it('gives the draft back for the page it was made on', () => {
    expect(draftFor(MEMORY, 'Forbidden Rites', BASE)).toBe(MEMORY);
    // The same search written in another order is the same page.
    expect(draftFor(MEMORY, 'Forbidden Rites', { stats: BASE.stats, status: BASE.status })).toBe(MEMORY);
  });

  it('gives nothing for another search or league', () => {
    expect(draftFor(MEMORY, 'Standard', BASE)).toBeNull();
    expect(draftFor(MEMORY, 'Forbidden Rites', { status: { option: 'any' } })).toBeNull();
    expect(draftFor(null, 'Forbidden Rites', BASE)).toBeNull();
  });

  it('reads back only a well-formed record of this version', () => {
    expect(readRememberedDraft(MEMORY)).toEqual(MEMORY);
    expect(readRememberedDraft({ ...MEMORY, version: 2 })).toBeNull();
    expect(readRememberedDraft({ draft: DRAFT })).toBeNull();
    expect(readRememberedDraft(undefined)).toBeNull();
  });
});
