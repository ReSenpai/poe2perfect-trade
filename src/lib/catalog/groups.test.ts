import { describe, expect, it } from 'vitest';
import { classifyStat } from './groups';

describe('classifyStat', () => {
  it.each([
    ['# to maximum Life', 'core'],
    ['#% increased maximum Life', 'core'],
    ['+# total maximum Mana', 'core'],
    ['# to Spirit', 'core'],
    ['#% increased Attack Speed', 'core'],
    ['#% increased Cast Speed', 'core'],
    ['#% increased Critical Hit Chance', 'core'],
    ['#% increased Movement Speed', 'core'],
    ['# to Level of all Spell Skills', 'core'],
    ['Adds # to # Fire Damage', 'core'],
    ['Damage Penetrates #% Fire Resistance', 'core'],
    ['#% increased Weapon Damage per 10 Strength', 'core'],
    ['#% to Fire Resistance', 'resistances'],
    ['+#% total Elemental Resistance', 'resistances'],
    ['#% to Maximum Chaos Resistance', 'resistances'],
    ['# total Resistances', 'resistances'],
    ['# to Strength', 'attributes'],
    ['+# total to all Attributes', 'attributes'],
    ['#% increased Intelligence', 'attributes'],
    ['# to Strength and Dexterity', 'attributes'],
    ['# to Armour', 'defensive'],
    ['#% increased Evasion Rating', 'defensive'],
    ['# to maximum Energy Shield', 'defensive'],
    ['#% to Block chance', 'defensive'],
    ['# Life Regeneration per second', 'defensive'],
    ['#% of Damage taken Recouped as Life', 'defensive'],
    ['#% increased Stun Threshold', 'defensive'],
    ['#% increased Rarity of Items found', 'special'],
    ['Allocates Barbaric Strength', 'special'],
    ['# Prefix Modifiers', 'special'],
    ['Small Passive Skills in Radius also grant #% increased Freeze Buildup', 'special'],
    ['Notable Passive Skills in Radius also grant #% to Fire Resistance', 'special'],
    ['Conquered Small Passive Skills also grant #% increased Stun Threshold', 'special'],
    ['Monsters have #% increased Stun Threshold', 'special'],
    ['+#% Monster Elemental Resistances', 'special'],
    ['Map has #% increased chance to contain Shrines', 'special'],
    ['Area has #% increased chance to contain Essences', 'special'],
  ])('%s → %s', (text, group) => {
    expect(classifyStat(text, 'explicit')).toBe(group);
  });

  it('puts sanctum and skill stats in Special whatever they say', () => {
    expect(classifyStat('#% to Fire Resistance', 'sanctum')).toBe('special');
    expect(classifyStat('# to maximum Life', 'skill')).toBe('special');
  });
});
