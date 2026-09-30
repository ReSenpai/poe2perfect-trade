import { describe, expect, it } from 'vitest';
import { buildBaseStats, CATEGORY_CLASSES, canSpawn, createStatLinker, type RepoeData } from './base-stats';

const T = {
  life: 'explicit.stat_1',
  esGlobal: 'explicit.stat_2',
  esLocal: 'explicit.stat_3',
  strength: 'explicit.stat_4',
  fireRes: 'explicit.stat_5',
  addsFire: 'explicit.stat_6',
  rarityImplicit: 'implicit.stat_7',
  runeFire: 'rune.stat_5',
  bondedLife: 'rune.stat_9',
  runeIgnite: 'rune.stat_10',
  attrReq: 'enchant.stat_8',
  desecratedLife: 'desecrated.stat_1',
};

const TRADE = {
  result: [
    {
      id: 'explicit',
      entries: [
        { id: T.life, text: '# to maximum Life', type: 'explicit' },
        { id: T.esGlobal, text: '# to maximum Energy Shield', type: 'explicit' },
        { id: T.esLocal, text: '# to maximum Energy Shield (Local)', type: 'explicit' },
        { id: T.strength, text: '# to Strength', type: 'explicit' },
        { id: T.fireRes, text: '#% to Fire Resistance', type: 'explicit' },
        { id: T.addsFire, text: 'Adds # to # Fire Damage', type: 'explicit' },
      ],
    },
    { id: 'implicit', entries: [{ id: T.rarityImplicit, text: '#% increased Rarity of Items found', type: 'implicit' }] },
    {
      id: 'rune',
      entries: [
        { id: T.runeFire, text: '#% to Fire Resistance', type: 'augment' },
        { id: T.bondedLife, text: 'Bonded: # to maximum Life', type: 'augment' },
        { id: T.runeIgnite, text: '#% increased Ignite Magnitude', type: 'augment' },
      ],
    },
    { id: 'enchant', entries: [{ id: T.attrReq, text: '#% reduced Attribute Requirements', type: 'enchant' }] },
    { id: 'desecrated', entries: [{ id: T.desecratedLife, text: '# to maximum Life', type: 'desecrated' }] },
  ],
};

const english = (string: string, format = ['#']) => [{ string, format }];

const DATA: RepoeData = {
  version: 'test-1',
  statDescriptions: [
    { ids: ['base_maximum_life'], English: english('{0} to maximum Life', ['+#']) },
    { ids: ['base_maximum_energy_shield'], English: english('{0} to maximum Energy Shield', ['+#']) },
    { ids: ['local_energy_shield'], English: english('{0} to maximum Energy Shield', ['+#']) },
    { ids: ['additional_strength'], English: english('{0} to [Strength|Strength]', ['+#']) },
    { ids: ['base_fire_damage_resistance_%'], English: english('{0}% to [Resistances|Fire Resistance]', ['+#']) },
    { ids: ['local_minimum_added_fire_damage', 'local_maximum_added_fire_damage'], English: english('Adds {0} to {1} [Fire] Damage') },
    { ids: ['base_item_found_rarity_+%'], English: [{ string: '{0}% increased Rarity of Items found' }, { string: '{0}% reduced Rarity of Items found' }] },
    { ids: ['local_attribute_requirements_+%'], English: [{ string: '{0}% increased Attribute Requirements' }, { string: '{0}% reduced Attribute Requirements' }] },
    { ids: ['dummy_stat_display_nothing'], English: english('') },
  ],
  mods: {
    IncreasedLife1: { domain: 'item', generation_type: 'prefix', stats: [{ id: 'base_maximum_life', min: 10, max: 19 }], spawn_weights: [] },
    IncreasedLife7: { domain: 'item', generation_type: 'prefix', stats: [{ id: 'base_maximum_life', min: 120, max: 149 }], spawn_weights: [] },
    LocalEnergyShield1: { domain: 'item', generation_type: 'prefix', stats: [{ id: 'local_energy_shield', min: 10, max: 20 }], spawn_weights: [] },
    Strength1: { domain: 'item', generation_type: 'suffix', stats: [{ id: 'additional_strength', min: 5, max: 8 }], spawn_weights: [] },
    FireResist3: { domain: 'item', generation_type: 'suffix', stats: [{ id: 'base_fire_damage_resistance_%', min: 21, max: 25 }], spawn_weights: [] },
    LocalAddedFire1: {
      domain: 'item',
      generation_type: 'prefix',
      stats: [
        { id: 'local_minimum_added_fire_damage', min: 3, max: 5 },
        { id: 'local_maximum_added_fire_damage', min: 6, max: 9 },
      ],
      spawn_weights: [],
    },
    EssenceDummy1: { domain: 'item', generation_type: 'suffix', stats: [{ id: 'dummy_stat_display_nothing', min: 0, max: 0 }], spawn_weights: [] },
    RingImplicitRarity1: { domain: 'item', generation_type: 'unique', stats: [{ id: 'base_item_found_rarity_+%', min: 6, max: 15 }], spawn_weights: [] },
    CorruptedAttributeRequirements1: {
      domain: 'item',
      generation_type: 'corrupted',
      stats: [{ id: 'local_attribute_requirements_+%', min: -20, max: -10 }],
      spawn_weights: [],
    },
    DesecratedLife1: {
      domain: 'desecrated',
      generation_type: 'prefix',
      stats: [{ id: 'base_maximum_life', min: 30, max: 60 }],
      spawn_weights: [
        { tag: 'ring', weight: 1 },
        { tag: 'default', weight: 0 },
      ],
    },
  },
  modsByBase: {
    Gloves: {
      'str_armour,gloves,default': {
        bases: ['Metadata/Gloves/Str1'],
        mods: {
          prefix: { IncreasedLife: { IncreasedLife1: 1, IncreasedLife7: 60 }, LocalEnergyShield: { LocalEnergyShield1: 1 } },
          suffix: { FireResistance: { FireResist3: 20 }, Essence: { EssenceDummy1: 1 } },
          corrupted: { LocalAttributeRequirements: { CorruptedAttributeRequirements1: 1 } },
        },
      },
      'int_armour,gloves,default': {
        bases: ['Metadata/Gloves/Int1'],
        mods: { prefix: { LocalEnergyShield: { LocalEnergyShield1: 1 } } },
      },
    },
    Rings: {
      'ring,default': {
        bases: ['Metadata/Rings/Gold'],
        mods: { prefix: { IncreasedLife: { IncreasedLife1: 1 } }, suffix: { Strength: { Strength1: 1 } } },
      },
    },
    'One Hand Maces': {
      'mace,default': { bases: ['Metadata/Maces/One1'], mods: { prefix: { LocalAddedFire: { LocalAddedFire1: 1 } } } },
    },
  },
  baseItems: {
    'Metadata/Gloves/Str1': { name: 'Stocky Mitts', item_class: 'Gloves', tags: ['str_armour', 'gloves', 'default'], implicits: [], release_state: 'released' },
    'Metadata/Gloves/Int1': { name: 'Silk Gloves', item_class: 'Gloves', tags: ['int_armour', 'gloves', 'default'], implicits: [], release_state: 'released' },
    'Metadata/Rings/Gold': { name: 'Gold Ring', item_class: 'Ring', tags: ['ring', 'default'], implicits: ['RingImplicitRarity1'], release_state: 'released' },
    'Metadata/Maces/One1': { name: 'Wooden Club', item_class: 'One Hand Mace', tags: ['mace', 'default'], implicits: [], release_state: 'released' },
  },
  augments: {
    'Metadata/Runes/Fire': {
      categories: {
        Gloves: { stats: [{ id: 'base_fire_damage_resistance_%' }], stat_text: ['+12% to [Resistances|Fire Resistance]'], target: ['Gloves'] },
      },
    },
  },
  tradeStats: TRADE,
};

describe('createStatLinker', () => {
  const link = createStatLinker(DATA.statDescriptions, TRADE);

  it('finds the trade stat of a game stat through its English template', () => {
    expect(link('base_maximum_life', 'explicit')).toBe(T.life);
    expect(link('additional_strength', 'explicit')).toBe(T.strength);
    expect(link('base_fire_damage_resistance_%', 'explicit')).toBe(T.fireRes);
    expect(link('base_fire_damage_resistance_%', 'rune')).toBe(T.runeFire);
  });

  it('prefers the (Local) trade stat for local game stats', () => {
    expect(link('local_energy_shield', 'explicit')).toBe(T.esLocal);
    expect(link('base_maximum_energy_shield', 'explicit')).toBe(T.esGlobal);
  });

  it('uses any of the wordings of a translation (increased / reduced)', () => {
    expect(link('local_attribute_requirements_+%', 'enchant')).toBe(T.attrReq);
  });

  it('links a stat shown together with another one (Adds # to #)', () => {
    expect(link('local_maximum_added_fire_damage', 'explicit')).toBe(T.addsFire);
  });

  it('returns null for stats without a trade counterpart', () => {
    expect(link('dummy_stat_display_nothing', 'explicit')).toBeNull();
    expect(link('unknown_stat', 'explicit')).toBeNull();
  });
});

describe('canSpawn', () => {
  it('follows the first spawn weight whose tag the base has', () => {
    const weights = [
      { tag: 'ring', weight: 1 },
      { tag: 'default', weight: 0 },
    ];
    expect(canSpawn(weights, ['ring', 'default'])).toBe(true);
    expect(canSpawn(weights, ['gloves', 'default'])).toBe(false);
    expect(canSpawn([{ tag: 'default', weight: 0 }, { tag: 'ring', weight: 1 }], ['ring', 'default'])).toBe(false);
    expect(canSpawn([], ['ring'])).toBe(false);
  });
});

describe('buildBaseStats', () => {
  const { data, report } = buildBaseStats(DATA);
  const stats = (cls: string) => Object.fromEntries(data.classes[cls]!.stats.map(([index, max, affix]) => [data.stats[index], [max, affix]]));

  it('lists what can roll on a class with the highest value and prefix / suffix', () => {
    expect(stats('Gloves')).toEqual({
      [T.life]: [149, 'p'],
      [T.esLocal]: [20, 'p'],
      [T.fireRes]: [25, 's'],
      [T.attrReq]: [-10, null],
      [T.runeFire]: [12, null],
    });
  });

  it('adds base implicits and desecrated mods by spawn tags', () => {
    expect(stats('Rings')).toEqual({
      [T.life]: [19, 'p'],
      [T.strength]: [8, 's'],
      [T.rarityImplicit]: [15, null],
      [T.desecratedLife]: [60, 'p'],
    });
  });

  it('takes the higher value of a two-stat mod', () => {
    expect(stats('One Hand Maces')).toEqual({ [T.addsFire]: [9, 'p'] });
  });

  it('keeps the base sets of a class with their base names and stat indexes', () => {
    const gloves = data.classes.Gloves!;
    const idsOf = (set: { stats: number[] }) => set.stats.map((index) => data.stats[gloves.stats[index]![0]]).sort();
    expect(gloves.sets.map((set) => set.bases)).toEqual([['Stocky Mitts'], ['Silk Gloves']]);
    expect(idsOf(gloves.sets[0]!)).toEqual([T.attrReq, T.fireRes, T.esLocal, T.life, T.runeFire].sort());
    expect(idsOf(gloves.sets[1]!)).toEqual([T.esLocal, T.runeFire].sort());
  });

  it('merges base sets that allow the same stats', () => {
    const twins = {
      ...DATA,
      modsByBase: {
        ...DATA.modsByBase,
        Rings: {
          ...DATA.modsByBase.Rings,
          'ring,another_tag,default': { bases: ['Metadata/Rings/Iron'], mods: DATA.modsByBase.Rings!['ring,default']!.mods },
        },
      },
      baseItems: { ...DATA.baseItems, 'Metadata/Rings/Iron': { name: 'Iron Ring', item_class: 'Ring', tags: ['ring', 'default'], implicits: ['RingImplicitRarity1'], release_state: 'released' } },
    } as RepoeData;
    expect(buildBaseStats(twins).data.classes.Rings!.sets.map((set) => set.bases)).toEqual([['Gold Ring', 'Iron Ring']]);
  });

  it('keeps every trade stat id once in a shared table', () => {
    expect(new Set(data.stats).size).toBe(data.stats.length);
    expect(data.stats).toEqual(expect.arrayContaining([T.life, T.esLocal, T.runeFire, T.desecratedLife]));
  });

  it('maps trade categories to classes, and records the data version', () => {
    expect(data.version).toBe('test-1');
    expect(data.categories['armour.gloves']).toEqual(['Gloves']);
    expect(data.categories['accessory.ring']).toEqual(['Rings']);
    expect(data.categories.accessory).toEqual(expect.arrayContaining(['Rings', 'Amulets', 'Belts']));
    expect(data.categories.weapon).toEqual(expect.arrayContaining(['One Hand Maces', 'Bows']));
  });

  it('reads augment targets given as a group name, and bonded stats', () => {
    const grouped = {
      ...DATA,
      augments: {
        'Metadata/Runes/Fire2': {
          categories: {
            Armour: { stats: [], stat_text: ['+14% to [Resistances|Fire Resistance]'], bonded_stat_text: ['+20 to maximum Life'], target: 'Armour' },
            'Martial Weapon': { stats: [], stat_text: ['30% increased [Ignite|Ignite] [BuffMagnitude|Magnitude]'], target: '[MartialWeapon|Martial Weapon]' },
          },
        },
      },
    } as unknown as RepoeData;
    const built = buildBaseStats(grouped).data;
    const of = (cls: string) => Object.fromEntries(built.classes[cls]!.stats.map(([index, max]) => [built.stats[index], max]));
    expect(of('Gloves')).toMatchObject({ [T.runeFire]: 14, [T.bondedLife]: 20 });
    expect(of('One Hand Maces')).toMatchObject({ [T.runeIgnite]: 30 });
    expect(of('Rings')[T.runeFire]).toBeUndefined();
  });

  it('skips augments without stat text or targets', () => {
    const odd = { ...DATA, augments: { ...DATA.augments, 'Metadata/Odd': { categories: { Gloves: { stats: [], stat_text: null, target: null } } } } } as unknown as RepoeData;
    const built = buildBaseStats(odd).data;
    expect(Object.fromEntries(built.classes.Gloves!.stats.map(([index, max]) => [built.stats[index], max]))[T.runeFire]).toBe(12);
  });

  it('reports mods it could not link', () => {
    expect(report.unlinked).toEqual(['EssenceDummy1']);
    expect(report.linked).toBeGreaterThan(0);
  });
});

describe('CATEGORY_CLASSES', () => {
  it('covers every gear category of the trade site', () => {
    for (const id of ['armour.helmet', 'armour.chest', 'armour.boots', 'armour.shield', 'armour.focus', 'armour.buckler', 'armour.quiver', 'accessory.amulet', 'accessory.belt', 'weapon.bow', 'weapon.crossbow', 'weapon.warstaff', 'weapon.talisman', 'weapon.wand', 'weapon.sceptre', 'weapon.staff', 'weapon.spear', 'weapon.flail', 'weapon.claw', 'weapon.dagger', 'jewel', 'flask.life', 'flask.mana', 'flask.charm', 'map.waystone', 'map.tablet']) {
      expect(CATEGORY_CLASSES[id], id).toBeDefined();
    }
  });
});
