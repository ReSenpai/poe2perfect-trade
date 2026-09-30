import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../../../tests/fixtures/load';
import { PARAMETERS, parameterOf, toneIcon, toneOf } from './semantic';

const CATALOG = new Map(loadCatalog('stats').result.flatMap((group) => group.entries.map((entry) => [entry.id, entry] as const)));

describe('semantic parameters', () => {
  it('points every source of every parameter at a stat of the trade catalog of that type', () => {
    for (const parameter of PARAMETERS) {
      expect(parameter.variants.length, parameter.id).toBeGreaterThan(0);
      for (const variant of parameter.variants) {
        const entry = CATALOG.get(variant.statId);
        expect(entry, variant.statId).toBeDefined();
        expect(variant.statId.startsWith(variant.source === 'total' ? 'pseudo.' : `${variant.source}.`), variant.statId).toBe(true);
      }
    }
  });

  it('gives each trade stat at most one parameter', () => {
    const ids = PARAMETERS.flatMap((parameter) => parameter.variants.map((variant) => variant.statId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('knows the parameter and source of a stat', () => {
    expect(parameterOf('explicit.stat_3299347043')).toMatchObject({ parameter: { id: 'life', label: 'Life' }, variant: { source: 'explicit' } });
    expect(parameterOf('pseudo.pseudo_total_fire_resistance')).toMatchObject({ parameter: { id: 'fire-resistance', group: 'resistance' }, variant: { source: 'total' } });
    expect(parameterOf('explicit.stat_1')).toBeNull();
  });

  it('takes Spirit and All Attributes from the ids the game data knows, not a same-text twin', () => {
    expect(parameterOf('explicit.stat_3981240776')?.parameter.id).toBe('spirit');
    expect(parameterOf('explicit.stat_2704225257')).toBeNull();
    expect(parameterOf('explicit.stat_1379411836')?.parameter.id).toBe('all-attributes');
  });
});

describe('stat tones', () => {
  it('gives the parameters of the registry the colour of what they are', () => {
    const tones = Object.fromEntries(PARAMETERS.map((parameter) => [parameter.id, parameter.tone]));
    expect(tones).toMatchObject({
      life: 'life',
      'energy-shield': 'energy-shield',
      'fire-resistance': 'fire',
      'cold-resistance': 'cold',
      'lightning-resistance': 'lightning',
      'chaos-resistance': 'chaos',
      'elemental-resistance': 'elemental',
      mana: 'mana',
      spirit: 'spirit',
      strength: 'strength',
      dexterity: 'dexterity',
      intelligence: 'intelligence',
    });
    expect(tones['attack-speed']).toBeUndefined();
  });

  it('colours other stats by their words', () => {
    expect(toneOf('fractured.stat_3372524247', '+#% to Fire Resistance')).toBe('fire');
    expect(toneOf('explicit.stat_1', '#% of Damage taken Recouped as Life')).toBe('life');
    expect(toneOf('explicit.stat_2', '#% increased maximum Energy Shield')).toBe('energy-shield');
    expect(toneOf('explicit.stat_3', '+# to Strength and Dexterity')).toBe('strength');
    expect(toneOf('explicit.stat_4', 'Adds # to # Cold damage to Attacks')).toBe('cold');
    expect(toneOf('pseudo.pseudo_total_life', 'anything')).toBe('life'); // the registry first
    expect(toneOf('explicit.stat_681332047', '#% increased Attack Speed')).toBe('speed'); // a parameter without a colour of its own
    expect(toneOf('explicit.stat_6', '#% increased Movement Speed')).toBe('speed');
    expect(toneOf('explicit.stat_7', '#% increased Critical Hit Chance')).toBe('critical');
    expect(toneOf('explicit.stat_8', 'Adds # to # Physical Damage to Attacks')).toBe('physical');
    expect(toneOf('explicit.stat_9', '+# to Armour')).toBe('armour');
    expect(toneOf('explicit.stat_10', '+# to Evasion Rating')).toBe('evasion');
    expect(toneOf('explicit.stat_11', '+# to Accuracy Rating')).toBe('accuracy');
    expect(toneOf('explicit.stat_12', 'Minions have #% increased maximum Life')).toBe('life'); // what it is about wins
    expect(toneOf('explicit.stat_13', 'Minions deal #% increased Damage')).toBe('minion');
    expect(toneOf('explicit.stat_14', '+# to Level of all Spell Skills')).toBe('skill');
    expect(toneOf('explicit.stat_15', '#% increased Spell Damage')).toBe('spell');
    expect(toneOf('explicit.stat_16', '#% increased Rarity of Items found')).toBe('utility');
    expect(toneOf('explicit.stat_17', '+#% to all Elemental Resistances')).toBe('elemental');
    expect(toneOf('explicit.stat_18', '#% increased Stun Buildup')).toBe('generic');
  });

  it('gives every stat of the catalog a colour and an icon: no parameter is plain', () => {
    const plain = [...CATALOG.values()].filter((entry) => {
      const tone = toneOf(entry.id, entry.text);
      return !tone || !toneIcon(tone);
    });
    expect(plain).toEqual([]);
  });
});
