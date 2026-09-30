import { describe, expect, it } from 'vitest';
import { loadBaseStats, loadCatalog } from '../../../tests/fixtures/load';
import { buildWorkspaceData } from './workspace-data';

const data = buildWorkspaceData({
  stats: loadCatalog('stats'),
  filters: loadCatalog('filters'),
  leagues: loadCatalog('leagues'),
  static: loadCatalog('static'),
  items: loadCatalog('items'),
  baseStats: loadBaseStats(),
});

describe('buildWorkspaceData', () => {
  it('names filters and indexes them', () => {
    expect(data.labels.stat('explicit.stat_3299347043')?.label).toBe('Life');
    expect(data.index.get('fixed:type_filters:category')).toBeDefined();
  });

  it('lists the PoE 2 leagues', () => {
    expect(data.leagues.map((league) => league.id)).toContain('Forbidden Rites');
  });

  it('lists the listing statuses of the status filter', () => {
    expect(data.statuses).toEqual([
      { id: 'available', text: 'Instant Buyout and In Person' },
      { id: 'securable', text: 'Instant Buyout' },
      { id: 'onlineleague', text: 'In Person (Online in League)' },
      { id: 'online', text: 'In Person (Online)' },
      { id: 'any', text: 'Any' },
    ]);
  });

  it('lists the price currencies, "Any" (Exalted Orb Equivalent) first with an empty id', () => {
    expect(data.priceOptions.slice(0, 3)).toEqual([
      { id: '', text: 'Exalted Orb Equivalent' },
      { id: 'exalted_divine', text: 'Exalted or Divine Orbs' },
      { id: 'aug', text: 'Orb of Augmentation' },
    ]);
  });

  it('lists items to search by: uniques with their base, and bases', () => {
    expect(data.items).toContainEqual({ text: 'Andvarius Gold Ring', name: 'Andvarius', type: 'Gold Ring' });
    expect(data.items).toContainEqual({ text: 'Gold Ring', type: 'Gold Ring' });
    expect(new Set(data.items.map((item) => item.text)).size).toBe(data.items.length);
  });

  it('offers only bases the trade site lists', () => {
    const gloves = data.possible!.bases('armour.gloves');
    expect(gloves).toContain('Fine Bracers');
    expect(gloves).not.toContain('Golden Bracers');
  });

  it('works without game data', () => {
    const plain = buildWorkspaceData({ stats: loadCatalog('stats'), filters: loadCatalog('filters'), leagues: loadCatalog('leagues'), static: loadCatalog('static'), items: loadCatalog('items') });
    expect(plain.possible).toBeNull();
  });

  it('knows currency names and icons by id', () => {
    expect(data.currencies.get('divine')).toMatchObject({ text: 'Divine Orb' });
    expect(data.currencies.get('divine')?.image).toMatch(/^\/gen\/image\//);
    expect(data.currencies.get('regal')?.text).toBe('Regal Orb');
  });
});
