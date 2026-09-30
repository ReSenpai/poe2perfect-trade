import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { fromTradeQuery } from '@/lib/editor/document';
import type { Issue } from '@/lib/editor/store';
import { loadWorkspaceData } from '../../../tests/fixtures/load';
import { MoreFilters, type MoreFiltersProps } from './MoreFilters';

const DATA = loadWorkspaceData();

function renderSection(query: unknown = {}, overrides: Partial<MoreFiltersProps> = {}) {
  const store = { setFixedRangeInput: vi.fn(), setFixedOption: vi.fn(), setFixedText: vi.fn() };
  const props: MoreFiltersProps = { groups: DATA.moreFilters, draft: fromTradeQuery(query), inputs: {}, issues: [], category: 'accessory.ring', store, ...overrides };
  const view = render(<MoreFilters {...props} />);
  return { ...view, store, props };
}

const toggle = () => screen.getByRole('button', { name: /^More filters/ });

describe('MoreFilters', () => {
  it('stays folded with nothing set, and opens to the groups that fit the item', () => {
    renderSection();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('group', { name: 'Requirements' })).toBeNull();
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('group', { name: 'Requirements' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Endgame' })).toBeNull(); // not for a ring
    expect(screen.queryByRole('textbox', { name: 'Physical DPS minimum' })).toBeNull();
  });

  it('shows the filters of other items behind Show all', () => {
    renderSection();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: /^Show all filters/ }));
    expect(screen.getByRole('group', { name: 'Endgame' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Physical DPS minimum' })).toBeTruthy();
  });

  it('opens by itself with a set filter, counts it, and keeps it in sight whatever the item', () => {
    renderSection({ filters: { equipment_filters: { filters: { pdps: { min: 300 } } }, req_filters: { filters: { lvl: { max: 60 } } } } });
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().textContent).toContain('2');
    expect((screen.getByRole('textbox', { name: 'Physical DPS minimum' }) as HTMLInputElement).value).toBe('300');
    expect((screen.getByRole('textbox', { name: 'Level maximum' }) as HTMLInputElement).value).toBe('60');
  });

  it('edits a range as typed, and shows its error at the filter', () => {
    const issues: Issue[] = [{ severity: 'error', code: 'not-a-number', message: 'Enter a number', filter: 'req_filters.lvl', field: 'min' }];
    const { store } = renderSection({}, { inputs: { 'fixed:req_filters.lvl': { min: 'x' } }, issues });
    fireEvent.click(toggle());
    const min = screen.getByRole('textbox', { name: 'Level minimum' }) as HTMLInputElement;
    expect(min.value).toBe('x');
    expect(min.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a number')).toBeTruthy();
    fireEvent.input(min, { target: { value: '60' } });
    expect(store.setFixedRangeInput).toHaveBeenCalledWith('req_filters', 'lvl', 'min', '60');
  });

  it('answers yes / no filters with Any, Yes or No', () => {
    const { store } = renderSection({ filters: { misc_filters: { filters: { corrupted: { option: 'false' } } } } });
    const corrupted = screen.getByRole('radiogroup', { name: 'Corrupted' });
    expect(within(corrupted).getByRole('radio', { name: 'No' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(corrupted).getByRole('radio', { name: 'Yes' }));
    expect(store.setFixedOption).toHaveBeenCalledWith('misc_filters', 'corrupted', 'true');
    fireEvent.click(within(corrupted).getByRole('radio', { name: 'Any' }));
    expect(store.setFixedOption).toHaveBeenLastCalledWith('misc_filters', 'corrupted', null);
  });

  it('picks from a list and types the seller', () => {
    const { store } = renderSection();
    fireEvent.click(toggle());
    fireEvent.change(screen.getByRole('combobox', { name: 'Listed' }), { target: { value: '1day' } });
    expect(store.setFixedOption).toHaveBeenCalledWith('trade_filters', 'indexed', '1day');
    fireEvent.change(screen.getByRole('combobox', { name: 'Listed' }), { target: { value: '' } });
    expect(store.setFixedOption).toHaveBeenLastCalledWith('trade_filters', 'indexed', null);
    fireEvent.input(screen.getByRole('textbox', { name: 'Seller Account' }), { target: { value: 'Seller#1' } });
    expect(store.setFixedText).toHaveBeenCalledWith('trade_filters', 'account', 'Seller#1');
  });
});
