import { describe, expect, it } from 'vitest';
import { readBudget, readFixedOption, readFixedRange, readFixedText, readItemContext, setBudget, setFixedOption, setFixedRange, setFixedText, setItemContext } from './context';
import { compile, fromTradeQuery } from './document';

const RING = {
  status: { option: 'online' },
  type: 'Ruby Ring',
  stats: [],
  filters: {
    type_filters: { filters: { category: { option: 'accessory.ring' }, rarity: { option: 'rare' }, ilvl: { min: 75 } } },
    trade_filters: { filters: { price: { max: 50, option: 'exalted' }, collapse: { option: 'true' } } },
  },
};

describe('item context', () => {
  it('reads category, rarity, base and name', () => {
    expect(readItemContext(fromTradeQuery(RING))).toEqual({ category: 'accessory.ring', rarity: 'rare', type: 'Ruby Ring', name: null });
    expect(readItemContext(fromTradeQuery({}))).toEqual({ category: null, rarity: null, type: null, name: null });
    expect(readItemContext(fromTradeQuery({ type: { option: 'Ruby Ring', discriminator: 'x' } })).type).toBe('Ruby Ring');
  });

  it('changes only the given parts and keeps the other type filters', () => {
    const next = compile(setItemContext(fromTradeQuery(RING), { category: 'armour.gloves', type: null }));
    expect(next).toEqual({
      ...RING,
      type: undefined,
      filters: { ...RING.filters, type_filters: { filters: { category: { option: 'armour.gloves' }, rarity: { option: 'rare' }, ilvl: { min: 75 } } } },
    });
    expect(Object.keys(next)).not.toContain('type');
  });

  it('removes a cleared category and drops a section left empty', () => {
    const next = compile(setItemContext(fromTradeQuery({ filters: { type_filters: { filters: { category: { option: 'accessory.ring' } } } } }), { category: null, name: 'Andvarius' }));
    expect(next).toEqual({ status: { option: 'securable' }, name: 'Andvarius', filters: {} });
  });
});

describe('budget', () => {
  it('reads the price range and currency', () => {
    expect(readBudget(fromTradeQuery(RING))).toEqual({ min: null, max: 50, currency: 'exalted' });
    expect(readBudget(fromTradeQuery({}))).toEqual({ min: null, max: null, currency: null });
  });

  it('keeps the amount when the currency changes, and the other trade filters', () => {
    const next = compile(setBudget(fromTradeQuery(RING), { currency: 'divine' })) as typeof RING;
    expect(next.filters.trade_filters).toEqual({ filters: { price: { max: 50, option: 'divine' }, collapse: { option: 'true' } } });
  });

  it('treats an empty maximum as no limit, not zero', () => {
    const next = compile(setBudget(fromTradeQuery(RING), { max: null })) as typeof RING;
    expect(next.filters.trade_filters.filters.price).toEqual({ option: 'exalted' });
    expect((compile(setBudget(fromTradeQuery(RING), { max: 0 })) as typeof RING).filters.trade_filters.filters.price).toEqual({ max: 0, option: 'exalted' });
  });
});

describe('fixed options', () => {
  it('reads and sets an option filter, keeping the rest of its section', () => {
    const doc = fromTradeQuery({ filters: { misc_filters: { filters: { ilvl: { min: 80 } } } } });
    expect(readFixedOption(doc, 'misc_filters', 'corrupted')).toBeNull();
    const next = setFixedOption(doc, 'misc_filters', 'corrupted', 'false');
    expect(readFixedOption(next, 'misc_filters', 'corrupted')).toBe('false');
    expect(compile(next)).toEqual({ status: { option: 'securable' }, filters: { misc_filters: { filters: { ilvl: { min: 80 }, corrupted: { option: 'false' } } } } });
    expect(compile(setFixedOption(next, 'misc_filters', 'corrupted', null))).toEqual({ status: { option: 'securable' }, filters: { misc_filters: { filters: { ilvl: { min: 80 } } } } });
  });
});

describe('fixed ranges and text', () => {
  it('reads a range filter, Any as null', () => {
    const doc = fromTradeQuery(RING);
    expect(readFixedRange(doc, 'type_filters', 'ilvl')).toEqual({ min: 75, max: null });
    expect(readFixedRange(doc, 'req_filters', 'lvl')).toEqual({ min: null, max: null });
  });

  it('sets one end of a range, keeping the other and the rest of the section, and drops an emptied filter', () => {
    let doc = setFixedRange(fromTradeQuery(RING), 'type_filters', 'ilvl', { max: 82 });
    expect(compile(doc)).toMatchObject({ filters: { type_filters: { filters: { category: { option: 'accessory.ring' }, ilvl: { min: 75, max: 82 } } } } });
    doc = setFixedRange(doc, 'type_filters', 'ilvl', { min: null, max: null });
    expect((compile(doc) as typeof RING).filters.type_filters.filters).not.toHaveProperty('ilvl');
    doc = setFixedRange(doc, 'req_filters', 'lvl', { min: 0 });
    expect(compile(doc)).toMatchObject({ filters: { req_filters: { filters: { lvl: { min: 0 } } } } });
  });

  it('reads and sets a text filter (seller account), an empty text removing it', () => {
    let doc = setFixedText(fromTradeQuery(RING), 'trade_filters', 'account', 'Someone#1234');
    expect(readFixedText(doc, 'trade_filters', 'account')).toBe('Someone#1234');
    expect(compile(doc)).toMatchObject({ filters: { trade_filters: { filters: { account: { input: 'Someone#1234' }, collapse: { option: 'true' } } } } });
    doc = setFixedText(doc, 'trade_filters', 'account', '  ');
    expect(readFixedText(doc, 'trade_filters', 'account')).toBeNull();
  });
});
