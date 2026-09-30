import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { compareListings } from '@/lib/compare/metrics';
import { type Listing, parseListing } from '@/lib/listing/parse';
import { loadListings } from '../../../tests/fixtures/load';
import { ComparePanel, type ComparePanelProps } from './ComparePanel';

const NOW = Date.parse('2026-09-23T12:00:00Z');
const [A, B] = loadListings('listings-rings').listings.slice(0, 2).map(parseListing) as [Listing, Listing];
const LIFE = 'pseudo.pseudo_total_life';
const withLife = (listing: Listing, life: number, amount: number): Listing => ({
  ...listing,
  price: { amount, currency: 'exalted', type: 'price' },
  mods: [...listing.mods.filter((mod) => mod.kind !== 'pseudo'), { kind: 'pseudo', text: `+${life} total maximum Life`, statId: LIFE }],
});

function renderPanel(overrides: Partial<ComparePanelProps> = {}) {
  const left = withLife(A, 92, 25);
  const right = withLife(B, 108, 32);
  const comparison = compareListings({ listings: [left, right], conditions: [{ statId: LIFE, min: 80 }, { statId: 'pseudo.pseudo_total_chaos_resistance', min: 5 }], label: (id) => (id === LIFE ? 'Life' : 'Chaos Resistance'), currencyName: () => 'Exalted Orb' });
  const props: ComparePanelProps = { entries: [{ listing: left }, { listing: right }], comparison, now: NOW, onClose: vi.fn(), ...overrides };
  render(<ComparePanel {...props} />);
  return { props, left, right };
}

describe('ComparePanel', () => {
  it('heads each column with the name, base and icon of its listing', () => {
    const { left, right } = renderPanel();
    const panel = screen.getByRole('complementary', { name: 'Compare' });
    const heads = within(panel).getAllByRole('columnheader').slice(1);
    expect(heads.map((head) => head.querySelector('.p2t-compare__name')!.textContent)).toEqual([left.item.name, right.item.name]);
    expect(heads.map((head) => head.querySelector('img')!.getAttribute('src'))).toEqual([left.item.icon, right.item.icon]);
  });

  it('shows the price and the conditions, the better value marked, the unknown as a dash', () => {
    renderPanel();
    const table = screen.getByRole('table', { name: 'Comparison' });
    const cells = (label: string) => within(within(table).getByRole('rowheader', { name: label }).closest('tr')!).getAllByRole('cell');
    expect(cells('Price').map((cell) => [cell.textContent, cell.getAttribute('data-preferred')])).toEqual([
      ['25 Exalted Orb', 'true'],
      ['32 Exalted Orb', null],
    ]);
    expect(cells('Life').map((cell) => [cell.textContent, cell.getAttribute('data-preferred')])).toEqual([
      ['92', null],
      ['108', 'true'],
    ]);
    expect(cells('Chaos Resistance').map((cell) => cell.textContent)).toEqual(['—', '—']);
    expect(screen.getByText('+7 Exalted Orb · Life +16')).toBeTruthy();
  });

  it('keeps the other properties behind a toggle', () => {
    renderPanel();
    expect(screen.queryByRole('rowheader', { name: 'Item Level' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^More properties/ }));
    expect(screen.getByRole('rowheader', { name: 'Item Level' })).toBeTruthy();
  });

  it('opens the properties right away when the search has no parameters to compare', () => {
    const left = withLife(A, 92, 25);
    const right = withLife(B, 108, 32);
    const comparison = compareListings({ listings: [left, right], conditions: [], label: String, currencyName: () => 'Exalted Orb' });
    render(<ComparePanel entries={[{ listing: left }, { listing: right }]} comparison={comparison} now={NOW} onClose={vi.fn()} />);
    expect(screen.getByRole('rowheader', { name: 'Item Level' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fewer properties' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('says which listing comes from a previous search, and closes', () => {
    const left = withLife(A, 92, 25);
    const right = withLife(B, 108, 32);
    const comparison = compareListings({ listings: [left, right], conditions: [], label: String, currencyName: String });
    const onClose = vi.fn();
    render(<ComparePanel entries={[{ listing: left, previous: NOW - 5 * 60_000 }, { listing: right }]} comparison={comparison} now={NOW} onClose={onClose} />);
    const heads = screen.getAllByRole('columnheader').slice(1);
    expect(heads[0]!.textContent).toContain('From previous search · 5 min ago');
    expect(heads[1]!.textContent).not.toContain('From previous search');
    fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }));
    expect(onClose).toHaveBeenCalled();
  });
});
