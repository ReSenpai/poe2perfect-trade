import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { createApplicability } from '@/lib/catalog/applicability';
import { loadWorkspaceData } from '../../../tests/fixtures/load';
import { ParameterPicker } from './ParameterPicker';

const DATA = loadWorkspaceData();
const ring = createApplicability(DATA.possible).forItem({ category: 'accessory.ring', base: null, rarity: 'rare', name: null });

function renderPicker(open = true, checks = ring) {
  const onPick = vi.fn();
  const onOpenChange = vi.fn();
  const view = render(<ParameterPicker index={DATA.index} checks={checks} recent={[]} open={open} onOpenChange={onOpenChange} onPick={onPick} />);
  return { ...view, onPick, onOpenChange };
}

const search = () => screen.getByRole('combobox', { name: 'Search parameters' }) as HTMLInputElement;

describe('ParameterPicker', () => {
  it('opens from its button', () => {
    const { onOpenChange } = renderPicker(false);
    expect(screen.queryByRole('combobox', { name: 'Search parameters' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add parameter' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('puts the cursor into the search and offers the popular parameters of the item', () => {
    renderPicker();
    expect(document.activeElement).toBe(search());
    expect(within(screen.getByRole('group', { name: 'Popular for this item' })).getAllByRole('option').map((option) => option.getAttribute('data-label'))).toContain('Life');
  });

  it('counts what there is to browse, each source with its number, all open for an item', () => {
    renderPicker();
    expect(screen.getByText(/^\d+ parameters on this item$/)).toBeTruthy();
    const total = screen.getByText(/parameters on this item$/);
    // Under the lists, a footer of the search.
    expect(screen.getByRole('listbox', { name: 'Parameters' }).compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const explicit = screen.getByRole('button', { name: /^Explicit · all on this item \d+$/ });
    expect(explicit.getAttribute('aria-expanded')).toBe('true');
    expect(within(screen.getByRole('group', { name: 'Explicit · all on this item' })).getAllByRole('option').length).toBeGreaterThan(5);
  });

  it('browses the whole catalog without an item, a large source folded until it is opened', () => {
    const noItem = createApplicability(DATA.possible).forItem({ category: null, base: null, rarity: null, name: null });
    renderPicker(true, noItem);
    expect(screen.getByText(/^[\d,]+ parameters in the catalog$/)).toBeTruthy();
    const explicit = screen.getByRole('button', { name: /^Explicit · all [\d,]+$/ });
    expect(explicit.getAttribute('aria-expanded')).toBe('false');
    expect(within(screen.getByRole('group', { name: 'Explicit · all' })).queryAllByRole('option')).toHaveLength(0);
    fireEvent.click(explicit);
    expect(explicit.getAttribute('aria-expanded')).toBe('true');
    // Thousands of rows at once freeze the page: they come a hundred at a time, as the list is scrolled.
    const group = () => screen.getByRole('group', { name: 'Explicit · all' });
    expect(within(group()).getAllByRole('option')).toHaveLength(100);
    fireEvent.click(within(group()).getByRole('button', { name: /^Show more · [\d,]+ left$/ }));
    expect(within(group()).getAllByRole('option')).toHaveLength(200);
  });

  it('adds the highlighted parameter with Enter, by its default source', () => {
    const { onPick } = renderPicker();
    fireEvent.input(search(), { target: { value: 'life' } });
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('pseudo.pseudo_total_life');
  });

  it('adds a parameter by the source picked on its row', () => {
    const { onPick } = renderPicker();
    fireEvent.input(search(), { target: { value: 'life' } });
    const life = within(screen.getByRole('group', { name: 'Available for this item' })).getAllByRole('option')[0]!;
    fireEvent.click(within(life).getByRole('button', { name: 'Life: Explicit' }));
    expect(onPick).toHaveBeenCalledWith('explicit.stat_3299347043');
  });

  it('keeps the incompatible ones behind a toggle, marked', () => {
    renderPicker();
    fireEvent.input(search(), { target: { value: 'spirit' } });
    expect(screen.getByRole('group', { name: 'Availability not verified' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Not on this item' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Show incompatible/ }));
    const incompatible = screen.getByRole('group', { name: 'Not on this item' });
    expect(within(incompatible).getAllByRole('option')[0]!.getAttribute('data-label')).toBe('Spirit');
  });

  it('says when nothing matches', () => {
    renderPicker();
    fireEvent.input(search(), { target: { value: 'zzzqqq' } });
    expect(screen.getByText('No matching parameters')).toBeTruthy();
  });

  it('opens as a dialog over the page, with a way to close it', () => {
    const { onOpenChange } = renderPicker();
    const dialog = screen.getByRole('dialog', { name: 'Add parameter' });
    expect(within(dialog).getByRole('combobox', { name: 'Search parameters' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close parameter search' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes with Escape', () => {
    const { onOpenChange } = renderPicker();
    fireEvent.keyDown(search(), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
