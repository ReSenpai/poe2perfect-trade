import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Budget } from '@/lib/editor/context';
import type { Issue } from '@/lib/editor/store';
import { loadWorkspaceData } from '../../../tests/fixtures/load';
import { BudgetSection, type BudgetSectionProps } from './BudgetSection';

const DATA = loadWorkspaceData();

function renderBudget(budget: Partial<Budget> = {}, overrides: Partial<BudgetSectionProps> = {}) {
  const props: BudgetSectionProps = {
    budget: { min: null, max: null, currency: null, ...budget },
    texts: {},
    currencies: DATA.priceOptions,
    currencyInfo: DATA.currencies,
    issues: [],
    onInput: vi.fn(),
    onCurrencyChange: vi.fn(),
    ...overrides,
  };
  render(<BudgetSection {...props} />);
  return props;
}

const maxPrice = () => screen.getByRole('textbox', { name: 'Max price' }) as HTMLInputElement;

describe('BudgetSection', () => {
  it('shows the maximum and currency; an empty maximum means no limit', () => {
    renderBudget();
    expect(maxPrice().value).toBe('');
    expect(maxPrice().placeholder).toBe('No limit');
    expect((screen.getByRole('combobox', { name: 'Currency' }) as HTMLSelectElement).value).toBe('');
  });

  it('reports typed prices and a new currency', () => {
    const props = renderBudget({ max: 50, currency: 'exalted' });
    expect(maxPrice().value).toBe('50');
    fireEvent.input(maxPrice(), { target: { value: '60' } });
    expect(props.onInput).toHaveBeenCalledWith('max', '60');
    fireEvent.change(screen.getByRole('combobox', { name: 'Currency' }), { target: { value: 'divine' } });
    expect(props.onCurrencyChange).toHaveBeenCalledWith('divine');
    fireEvent.change(screen.getByRole('combobox', { name: 'Currency' }), { target: { value: '' } });
    expect(props.onCurrencyChange).toHaveBeenLastCalledWith(null);
  });

  it('shows the text as typed rather than the number in the query', () => {
    renderBudget({ max: 50 }, { texts: { max: '5.' } });
    expect(maxPrice().value).toBe('5.');
  });

  it('shows the currency icon from the trade data', () => {
    renderBudget({ currency: 'divine' });
    const icon = document.querySelector('.p2t-budget__currency-icon') as HTMLImageElement;
    expect(icon.getAttribute('src')).toBe(DATA.currencies.get('divine')!.image);
    expect(icon.getAttribute('alt')).toBe('');
  });

  it('opens the minimum on request, or right away when one is set', () => {
    const props = renderBudget();
    expect(screen.queryByRole('textbox', { name: 'Min price' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Minimum' }));
    fireEvent.input(screen.getByRole('textbox', { name: 'Min price' }), { target: { value: '5' } });
    expect(props.onInput).toHaveBeenCalledWith('min', '5');
  });

  it('keeps an existing minimum in view', () => {
    renderBudget({ min: 5 });
    expect((screen.getByRole('textbox', { name: 'Min price' }) as HTMLInputElement).value).toBe('5');
  });

  it('marks a field with an error and explains it next to it', () => {
    const issues: Issue[] = [{ severity: 'error', code: 'not-a-number', message: 'Enter a number', section: 'budget', field: 'max' }];
    renderBudget({}, { texts: { max: 'abc' }, issues });
    expect(maxPrice().getAttribute('aria-invalid')).toBe('true');
    const described = document.getElementById(maxPrice().getAttribute('aria-describedby')!)!;
    expect(described.textContent).toBe('Enter a number');
  });
});
