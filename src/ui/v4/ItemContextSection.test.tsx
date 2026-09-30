import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { ItemContext } from '@/lib/editor/context';
import { createItemCatalog } from '@/lib/editor/item-catalog';
import { loadWorkspaceData } from '../../../tests/fixtures/load';
import { ItemContextSection } from './ItemContextSection';

const catalog = createItemCatalog(loadWorkspaceData());
const EMPTY: ItemContext = { category: null, rarity: null, type: null, name: null };

function renderSection(context: Partial<ItemContext> = {}) {
  const onChange = vi.fn();
  const view = render(<ItemContextSection context={{ ...EMPTY, ...context }} catalog={catalog} onChange={onChange} />);
  return { ...view, onChange };
}

const search = () => screen.getByRole('combobox', { name: 'Base or unique item' }) as HTMLInputElement;

describe('ItemContextSection', () => {
  it('edits category and rarity, Any clearing them', () => {
    const { onChange } = renderSection({ category: 'accessory.ring', rarity: 'rare' });
    const category = screen.getByRole('combobox', { name: 'Category' }) as HTMLSelectElement;
    const rarity = screen.getByRole('combobox', { name: 'Rarity' }) as HTMLSelectElement;
    expect([category.value, rarity.value]).toEqual(['accessory.ring', 'rare']);
    fireEvent.change(category, { target: { value: 'armour.gloves' } });
    expect(onChange).toHaveBeenLastCalledWith({ category: 'armour.gloves' });
    fireEvent.change(category, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ category: null });
    fireEvent.change(rarity, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ rarity: null });
  });

  it('offers no category shortcuts: the category list is where a category is chosen', () => {
    renderSection();
    expect(screen.queryByRole('group', { name: 'Popular categories' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ring' })).toBeNull();
  });

  it('shows each category with its picture in the list, and none for Any', () => {
    renderSection({ category: 'accessory.ring' });
    const options = [...(screen.getByRole('combobox', { name: 'Category' }) as HTMLSelectElement).options];
    const art = (value: string) => options.find((option) => option.value === value)!.querySelector('img')?.getAttribute('src');
    expect(art('accessory.ring')).toBe('category/ring.png');
    expect(art('armour.helmet')).toBe('category/helmet.png');
    expect(art('')).toBeUndefined();
    expect(options.find((option) => option.value === 'accessory.ring')!.text).toBe('Ring');
  });

  it('puts the chosen category picture beside a native list (Firefox), where options show no pictures', () => {
    const native = (category: string | null) =>
      render(<ItemContextSection context={{ ...EMPTY, category }} catalog={catalog} onChange={vi.fn()} customSelect={false} />).container.querySelector('.p2t-item-context__category');
    const field = native('accessory.ring')!;
    expect(field.getAttribute('data-native')).toBe('true');
    expect(field.querySelector(':scope > img.p2t-category-art')?.getAttribute('src')).toBe('category/ring.png');
    expect(native(null)!.querySelector(':scope > img')).toBeNull();

    // Chrome's customizable select copies the picture of the option into the field itself.
    const custom = render(<ItemContextSection context={{ ...EMPTY, category: 'accessory.ring' }} catalog={catalog} onChange={vi.fn()} customSelect />).container;
    const customField = custom.querySelector('.p2t-item-context__category')!;
    expect(customField.getAttribute('data-native')).toBeNull();
    expect(customField.querySelector(':scope > img')).toBeNull();
  });

  it('searches bases and uniques in one field, labelling each result', () => {
    const { onChange } = renderSection();
    fireEvent.input(search(), { target: { value: 'andvarius' } });
    const option = within(screen.getByRole('listbox', { name: 'Items' })).getByRole('option');
    expect(option.textContent).toBe('Andvarius Gold RingUnique');
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith({ name: 'Andvarius', type: 'Gold Ring', rarity: 'unique', category: 'accessory.ring' });
    expect(search().value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('picks with the keyboard and closes with Escape', () => {
    const { onChange } = renderSection();
    fireEvent.input(search(), { target: { value: 'ruby ring' } });
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    expect(search().getAttribute('aria-activedescendant')).toBeTruthy();
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ type: 'Ruby Ring', name: null });

    fireEvent.input(search(), { target: { value: 'ruby' } });
    fireEvent.keyDown(search(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps to the chosen category and says when nothing matches', () => {
    renderSection({ category: 'accessory.ring' });
    fireEvent.input(search(), { target: { value: 'gauntlets' } });
    expect(screen.getByText('No matching items')).toBeTruthy();
  });

  it('shows the chosen item with what it is, and clears it', () => {
    const { onChange, rerender } = renderSection({ category: 'accessory.ring', type: 'Ruby Ring' });
    const chosen = screen.getByRole('group', { name: 'Chosen item' });
    expect(chosen.textContent).toContain('Ruby Ring');
    expect(chosen.textContent).toContain('Base');
    fireEvent.click(within(chosen).getByRole('button', { name: 'Clear item' }));
    expect(onChange).toHaveBeenCalledWith({ name: null, type: null });

    rerender(<ItemContextSection context={{ ...EMPTY, name: 'Andvarius', type: 'Gold Ring', rarity: 'unique' }} catalog={catalog} onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Chosen item' }).textContent).toContain('Andvarius Gold Ring');
    expect(screen.getByRole('group', { name: 'Chosen item' }).textContent).toContain('Unique');
  });
});
