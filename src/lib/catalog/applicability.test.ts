import { describe, expect, it } from 'vitest';
import { loadWorkspaceData } from '../../../tests/fixtures/load';
import { type Bounds, createApplicability, type ItemScope } from './applicability';

const upperOf = (bounds: Bounds) => (bounds.kind === 'estimated' ? bounds.upper : undefined);

const DATA = loadWorkspaceData();
const RING: ItemScope = { category: 'accessory.ring', base: null, rarity: 'rare', name: null };
const LIFE = 'explicit.stat_3299347043';
const SPIRIT = 'explicit.stat_3981240776';
const FIRE_TOTAL = 'pseudo.pseudo_total_fire_resistance';

const checks = createApplicability(DATA.possible);

describe('applicability', () => {
  it('knows what rolls on a ring and what cannot', () => {
    const ring = checks.forItem(RING);
    expect(ring.applicability(LIFE)).toEqual({ status: 'supported', reason: 'rolls-here' });
    expect(ring.applicability(SPIRIT)).toEqual({ status: 'unsupported', reason: 'no-roll-here' });
    expect(ring.applicability(FIRE_TOTAL)).toEqual({ status: 'supported', reason: 'total-has-parts' });
  });

  it('says unknown, never unsupported, for a stat the game data does not cover', () => {
    expect(checks.forItem(RING).applicability('explicit.stat_1')).toEqual({ status: 'unknown', reason: 'stat-not-covered' });
  });

  it('does not forbid anything on a unique item by the rules of rare mods', () => {
    const unique = checks.forItem({ ...RING, rarity: 'unique' });
    expect(unique.applicability(SPIRIT)).toEqual({ status: 'unknown', reason: 'unique' });
    expect(checks.forItem({ ...RING, rarity: null, name: 'Andvarius' }).applicability(SPIRIT).reason).toBe('unique');
  });

  it('says why nothing can be checked', () => {
    expect(checks.forItem({ ...RING, category: null }).applicability(LIFE)).toEqual({ status: 'unknown', reason: 'no-item' });
    expect(checks.forItem({ ...RING, category: 'currency' }).applicability(LIFE)).toEqual({ status: 'unknown', reason: 'category-not-covered' });
    expect(createApplicability(null).forItem(RING).applicability(LIFE)).toEqual({ status: 'unknown', reason: 'no-game-data' });
  });

  it('narrows to a chosen base', () => {
    const gloves = checks.forItem({ category: 'armour.gloves', base: 'Doubled Gauntlets', rarity: 'rare', name: null });
    expect(gloves.applicability(LIFE).status).toBe('supported');
  });
});

describe('bounds and scale', () => {
  it('gives the highest roll as an estimate, never as a proven limit', () => {
    const ring = checks.forItem(RING);
    expect(ring.bounds(LIFE)).toEqual({ kind: 'estimated', upper: DATA.possible!.forItem('accessory.ring')!.max(LIFE) });
    expect(ring.bounds(FIRE_TOTAL).kind).toBe('estimated');
    expect(upperOf(ring.bounds(FIRE_TOTAL))).toBeGreaterThan(0);
    expect(ring.bounds('explicit.stat_1')).toEqual({ kind: 'unknown' });
  });

  it('builds a slider scale from the estimate, and a plain one when nothing is known', () => {
    const ring = checks.forItem(RING);
    const upper = upperOf(ring.bounds(LIFE))!;
    expect(ring.scale(LIFE)).toEqual({ min: 0, max: Math.ceil(upper / 5) * 5, step: 1, basis: 'estimated' });
    expect(ring.scale('explicit.stat_1')).toEqual({ min: 0, max: 100, step: 1, basis: 'scale-only' });
  });

  it('knows nothing about limits without an item', () => {
    expect(checks.forItem({ ...RING, category: null }).bounds(LIFE)).toEqual({ kind: 'unknown' });
  });
});
