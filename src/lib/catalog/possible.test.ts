import { describe, expect, it } from 'vitest';
import { loadBaseStats, loadCatalog, loadListings } from '../../../tests/fixtures/load';
import { createPossibleStats } from './possible';

const catalog = loadCatalog('stats');
const texts = new Map(catalog.result.flatMap((group) => group.entries.map((entry) => [entry.id, entry.text] as const)));
const possible = createPossibleStats(loadBaseStats(), (id) => texts.get(id));

const LIFE = 'explicit.stat_3299347043';
const SPIRIT = 'explicit.stat_3981240776';
const FIRE_RES = 'explicit.stat_3372524247';
const LOCAL_ES = 'explicit.stat_4052037485';
const RUNE_FIRE_RES = 'rune.stat_3372524247';
const CHAOS_DAMAGE = 'explicit.stat_736967255';

describe('createPossibleStats', () => {
  it('puts no limit without an item category, or for categories the game data does not cover', () => {
    expect(possible.forItem(null)).toBeNull();
    expect(possible.forItem('currency.rune')).toBeNull();
  });

  it('knows what can roll on rings, with the highest value and prefix / suffix', () => {
    const rings = possible.forItem('accessory.ring')!;
    expect(rings.has(LIFE)).toBe(true);
    expect(rings.max(LIFE)).toBe(196); // 119 rolled, +65% catalyst quality
    expect(rings.affix(LIFE)).toBe('prefix');
    expect(rings.affix(FIRE_RES)).toBe('suffix');
    expect(rings.has(SPIRIT)).toBe(false);
    expect(rings.has(LOCAL_ES)).toBe(false);
    expect(rings.has(RUNE_FIRE_RES)).toBe(false);
  });

  it('knows runes and local stats of armour', () => {
    const gloves = possible.forItem('armour.gloves')!;
    expect(gloves.has(RUNE_FIRE_RES)).toBe(true);
    expect(gloves.has(LOCAL_ES)).toBe(true);
    expect(gloves.max(LIFE)).toBe(149);
  });

  it('treats fractured and crafted versions like the explicit stat', () => {
    const rings = possible.forItem('accessory.ring')!;
    expect(rings.has('fractured.stat_3299347043')).toBe(true);
    expect(rings.has('fractured.stat_3981240776')).toBe(false);
  });

  it('narrows to the bases of one type when it is known', () => {
    const intGloves = possible.forItem('armour.gloves', 'Silk Gloves');
    const anyGloves = possible.forItem('armour.gloves')!;
    expect(intGloves).not.toBeNull();
    expect(intGloves!.size).toBeLessThanOrEqual(anyGloves.size);
    expect(possible.forItem('armour.gloves', 'No Such Base')!.size).toBe(anyGloves.size);
  });

  it('joins the classes of an "Any" category', () => {
    const accessory = possible.forItem('accessory')!;
    expect(accessory.has(SPIRIT)).toBe(true);
    const members = ['accessory.ring', 'accessory.amulet', 'accessory.belt'].map((category) => possible.forItem(category)!.max(LIFE)!);
    expect(accessory.max(LIFE)).toBe(Math.max(...members));
  });

  it('allows stats the game data does not know about, so nothing is hidden by mistake', () => {
    const rings = possible.forItem('accessory.ring')!;
    expect(rings.has('explicit.stat_0000000001')).toBe(true);
    expect(rings.has('sanctum.stat_1')).toBe(true);
  });

  it('tells stats it knows can roll apart from stats it knows nothing about', () => {
    const rings = possible.forItem('accessory.ring')!;
    expect(rings.status(LIFE)).toBe('yes');
    expect(rings.status(SPIRIT)).toBe('no');
    expect(rings.status('explicit.stat_0000000001')).toBe('unknown');
    expect(rings.status('pseudo.pseudo_total_life')).toBe('yes');
    expect(rings.status('pseudo.pseudo_total_energy_shield')).toBe('no');
    expect(rings.status('pseudo.pseudo_number_of_empty_prefix_mods')).toBe('unknown');
  });

  it('gives a pseudo total the sum of the highest values of its parts, each stat once', () => {
    const rings = possible.forItem('accessory.ring')!;
    const fire = rings.max('pseudo.pseudo_total_fire_resistance')!;
    expect(fire).toBeGreaterThanOrEqual(rings.max(FIRE_RES)!);
    expect(fire).toBeLessThan(250);
    expect(rings.max('pseudo.pseudo_total_life')).toBeGreaterThanOrEqual(196);
    expect(rings.max('pseudo.pseudo_total_energy_shield')).toBeUndefined();
    expect(rings.max('pseudo.pseudo_number_of_empty_prefix_mods')).toBeUndefined();
  });

  it('counts catalyst quality on jewellery: rings up to +65%, amulets +50%, belts and armour none, implicits none', () => {
    const rings = possible.forItem('accessory.ring')!;
    expect(rings.max(CHAOS_DAMAGE)).toBe(49); // 30 rolled: the ring with +65% Chaos quality shows 49%
    expect(rings.max('implicit.stat_3372524247')).toBe(30); // Ruby Ring: implicits are not raised
    expect(possible.forItem('accessory.amulet')!.max(LIFE)).toBe(223); // 149 × 1.5
    expect(possible.forItem('accessory.belt')!.max(LIFE)).toBe(174);
    expect(possible.forItem('armour.gloves')!.max(LIFE)).toBe(149);
  });

  it('adds up in a total only what the site counts in it', () => {
    // Not the Intelligence requirement nor "Convert #% of Requirements to Intelligence": 36 + 24 + 15 + 50.
    expect(possible.forItem('armour.helmet')!.max('pseudo.pseudo_total_intelligence')).toBe(125);
    // Not the conditional runes (per Spirit, while Sprinting, on Low Life): 35 + 10 + 5 + 5.
    expect(possible.forItem('armour.boots')!.max('pseudo.pseudo_increased_movement_speed')).toBe(55);
  });

  it('takes one implicit, one corruption, one desecrated mod and one rune into a total, and every explicit stat', () => {
    // Fire on a ring: explicit Fire 45 and all Elemental 16 (× 1.65: 74 + 26), one implicit (Fire 30 of the Ruby Ring,
    // not with Fire and Cold 16 and the others), one corruption (all Elemental 10), one desecrated mod (Fire and Chaos 17 × 1.65).
    expect(possible.forItem('accessory.ring')!.max('pseudo.pseudo_total_fire_resistance')).toBe(74 + 26 + 30 + 10 + 28);
  });

  it('lists the explicit affixes of the item with prefix or suffix', () => {
    const rings = possible.forItem('accessory.ring')!.affixes();
    expect(rings).toContainEqual({ id: LIFE, affix: 'prefix' });
    expect(rings).toContainEqual({ id: FIRE_RES, affix: 'suffix' });
    expect(rings.every((entry) => entry.id.startsWith('explicit.'))).toBe(true);
    expect(rings.some((entry) => entry.id === SPIRIT)).toBe(false);
    expect(new Set(rings.map((entry) => entry.id)).size).toBe(rings.length);
  });

  it('allows a pseudo stat when one of its parts can roll', () => {
    const rings = possible.forItem('accessory.ring')!;
    expect(rings.has('pseudo.pseudo_total_life')).toBe(true);
    expect(rings.has('pseudo.pseudo_total_fire_resistance')).toBe(true);
    expect(rings.has('pseudo.pseudo_total_elemental_resistance')).toBe(true);
    expect(rings.has('pseudo.pseudo_total_energy_shield')).toBe(false);
    expect(possible.forItem('weapon.onemace')!.has('pseudo.pseudo_total_energy_shield')).toBe(false);
    // A life rune fits a mace: its total life is possible even without life mods.
    expect(possible.forItem('weapon.onemace')!.has('pseudo.pseudo_total_life')).toBe(true);
    expect(rings.has('pseudo.pseudo_number_of_empty_prefix_mods')).toBe(true);
  });

  it('lists the bases of a category, sorted and once each', () => {
    const gloves = possible.bases('armour.gloves');
    expect(gloves).toContain('Fine Bracers');
    expect(gloves).toEqual([...new Set(gloves)].sort((a, b) => a.localeCompare(b)));
    expect(possible.bases('accessory')).toEqual(expect.arrayContaining(['Gold Ring', ...possible.bases('accessory.belt')]));
    expect(possible.bases('currency.rune')).toEqual([]);
    expect(possible.bases(null)).toEqual([]);
  });

  it('allows every explicit mod seen on real gloves listings', () => {
    const gloves = possible.forItem('armour.gloves')!;
    const mods = (['listings-online', 'listings-securable'] as const).flatMap((name) => loadListings(name).listings.flatMap((entry) => (entry.item.explicitMods as { hash?: string }[] | undefined) ?? []));
    const missed = mods.map((mod) => mod.hash?.replace(/^stat\./, '')).filter((id): id is string => !!id && !gloves.has(id));
    expect(missed).toEqual([]);
  });
});
