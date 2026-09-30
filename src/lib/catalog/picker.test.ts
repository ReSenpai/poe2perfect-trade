import { describe, expect, it } from 'vitest';
import { loadWorkspaceData } from '../../../tests/fixtures/load';
import { createApplicability } from './applicability';
import { pickerResults } from './picker';

const DATA = loadWorkspaceData();
const applicability = createApplicability(DATA.possible);
const ring = applicability.forItem({ category: 'accessory.ring', base: null, rarity: 'rare', name: null });
const noItem = applicability.forItem({ category: null, base: null, rarity: null, name: null });

const titles = (results: ReturnType<typeof pickerResults>) => results.sections.map((section) => section.title);

describe('pickerResults', () => {
  it('offers the popular parameters for the item and the recent ones before anything is typed', () => {
    const results = pickerResults({ index: DATA.index, checks: ring, text: '', recent: ['explicit.stat_3032590688'] });
    expect(titles(results).slice(0, 2)).toEqual(['Popular for this item', 'Recent']);
    const popular = results.sections[0]!.items.map((item) => item.label);
    expect(popular).toContain('Life');
    expect(popular).toContain('Fire Resistance');
    expect(popular).not.toContain('Spirit');
    expect(results.sections[1]!.items[0]).toMatchObject({ statId: 'explicit.stat_3032590688' });
  });

  it('lets every parameter the item can have be browsed, by source, each once, after popular and recent', () => {
    const results = pickerResults({ index: DATA.index, checks: ring, text: '', recent: [] });
    const browse = results.sections.slice(1);
    expect(browse.map((section) => section.title).slice(0, 3)).toEqual(['Total · all on this item', 'Explicit · all on this item', 'Implicit · all on this item']);
    const items = browse.flatMap((section) => section.items);
    expect(items.length).toBeGreaterThan(50);
    expect(items.every((item) => item.status === 'supported')).toBe(true);
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
    expect(items.map((item) => item.label)).toContain('Life'); // a parameter once, with its sources
    expect(items.map((item) => item.label)).not.toContain('Spirit');
    // Alphabetical by words: "# to Accuracy Rating" goes under A, not before every other line for its "#".
    const words = (label: string) => label.replace(/^[^A-Za-z]+/, '');
    const explicit = browse[1]!.items.map((item) => words(item.label));
    expect([...explicit].sort((a, b) => a.localeCompare(b))).toEqual(explicit);
  });

  it('lets the whole catalog be browsed without an item, by source, nothing claimed about it', () => {
    const results = pickerResults({ index: DATA.index, checks: noItem, text: '', recent: [] });
    const browse = results.sections.filter((section) => section.browse);
    expect(browse.map((section) => section.title).slice(0, 3)).toEqual(['Total · all', 'Explicit · all', 'Implicit · all']);
    const items = browse.flatMap((section) => section.items);
    expect(items.length).toBeGreaterThan(8000);
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
    expect(items.every((item) => item.status === 'unknown')).toBe(true);
  });

  it('finds a parameter by its words once, with its sources to choose from', () => {
    const results = pickerResults({ index: DATA.index, checks: ring, text: 'life', recent: [] });
    const life = results.sections[0]!.items[0]!;
    expect(results.sections[0]!.title).toBe('Available for this item');
    expect(life).toMatchObject({ label: 'Life', parameterId: 'life', statId: 'pseudo.pseudo_total_life', status: 'supported' });
    expect(life.variants!.map((variant) => variant.source)).toEqual(['total', 'explicit', 'implicit']);
    const all = results.sections.flatMap((section) => section.items);
    expect(all.filter((item) => item.parameterId === 'life')).toHaveLength(1);
  });

  it('keeps stats the game data does not know in view, apart, and the incompatible ones behind a toggle', () => {
    const results = pickerResults({ index: DATA.index, checks: ring, text: 'spirit', recent: [] });
    expect(titles(results)).toEqual(['Availability not verified']);
    expect(results.sections[0]!.items.map((item) => item.statId)).toContain('explicit.stat_2704225257');
    expect(results.incompatible.map((item) => item.label)).toContain('Spirit');
  });

  it('makes no claims without an item', () => {
    const results = pickerResults({ index: DATA.index, checks: noItem, text: 'life', recent: [] });
    expect(titles(results)).toEqual(['Results']);
    expect(results.note).toBe('Choose a category to check what the item can have');
    expect(results.incompatible).toEqual([]);
  });

  it('says when item checks are unavailable', () => {
    const results = pickerResults({ index: DATA.index, checks: createApplicability(null).forItem({ category: 'accessory.ring', base: null, rarity: 'rare', name: null }), text: 'life', recent: [] });
    expect(results.note).toBe('Item-specific suggestions unavailable');
  });

  it('finds a stat by its exact trade id and explains its status', () => {
    const results = pickerResults({ index: DATA.index, checks: ring, text: 'explicit.stat_3981240776', recent: [] });
    expect(results.incompatible[0]).toMatchObject({ label: 'Spirit', status: 'unsupported' });
  });
});
