import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { addSavedSearch } from '@/lib/saved/saved-searches';
import { SavedSearchesDialog, type SavedSearchesDialogProps } from './SavedSearchesDialog';

const NOW = Date.parse('2026-09-24T12:00:00Z');
const input = (name: string, league = 'Forbidden Rites') => ({ name, league, query: { status: { option: 'online' } }, sort: { price: 'asc' as const } });
const SEARCHES = addSavedSearch(addSavedSearch([], input('Rings'), NOW - 2 * 3_600_000, 'a'), input('Old gloves', 'Dawn of the Hunt'), NOW - 60_000, 'b');

function renderDialog(overrides: Partial<SavedSearchesDialogProps> = {}) {
  const props: SavedSearchesDialogProps = {
    searches: SEARCHES,
    leagues: ['Forbidden Rites', 'Standard'],
    league: 'Forbidden Rites',
    defaultName: 'Find a ring',
    now: NOW,
    onSave: vi.fn(),
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<SavedSearchesDialog {...props} />);
  return props;
}

const dialog = () => screen.getByRole('dialog', { name: 'Saved searches' });

describe('SavedSearchesDialog', () => {
  it('saves the current search under a name, suggested from the item', () => {
    const props = renderDialog();
    const name = within(dialog()).getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    expect(name.value).toBe('Find a ring');
    fireEvent.input(name, { target: { value: 'Cheap life rings' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save current search' }));
    expect(props.onSave).toHaveBeenCalledWith('Cheap life rings');
  });

  it('asks before saving over a search of the same name: replace it, or keep both under a free name', () => {
    const props = renderDialog({ onReplace: vi.fn() });
    const name = within(dialog()).getByRole('textbox', { name: 'Name' });
    fireEvent.input(name, { target: { value: ' Rings ' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save current search' }));
    expect(props.onSave).not.toHaveBeenCalled();
    // A modal of its own over the list, the safe choice under the cursor.
    const ask = () => screen.getByRole('dialog', { name: '"Rings" is already saved' });
    expect(document.activeElement).toBe(within(ask()).getByRole('button', { name: 'Save as "Rings (2)"' }));
    fireEvent.click(within(ask()).getByRole('button', { name: 'Save as "Rings (2)"' }));
    expect(props.onSave).toHaveBeenCalledWith('Rings (2)');
    expect(screen.queryByRole('dialog', { name: '"Rings" is already saved' })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save current search' }));
    fireEvent.click(within(ask()).getByRole('button', { name: 'Replace' }));
    expect(props.onReplace).toHaveBeenCalledWith('a', 'Rings');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save current search' }));
    fireEvent(ask(), new Event('cancel', { cancelable: true })); // Esc: nothing saved
    expect(screen.queryByRole('dialog', { name: '"Rings" is already saved' })).toBeNull();
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('does not save without a name', () => {
    renderDialog({ defaultName: '' });
    expect((within(dialog()).getByRole('button', { name: 'Save current search' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists the saved searches with league and age, and opens one in its league', () => {
    const props = renderDialog();
    const items = within(dialog()).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([expect.stringContaining('Old gloves'), expect.stringContaining('Rings')]);
    expect(items[1]!.textContent).toContain('Forbidden Rites · 2 h ago');
    fireEvent.click(within(items[1]!).getByRole('button', { name: 'Open Rings' }));
    expect(props.onOpen).toHaveBeenCalledWith(SEARCHES[1], 'Forbidden Rites');
  });

  it('asks before opening a search of a league that is gone, in the current one', () => {
    const props = renderDialog();
    const gloves = within(dialog()).getAllByRole('listitem')[0]!;
    fireEvent.click(within(gloves).getByRole('button', { name: 'Open Old gloves' }));
    expect(props.onOpen).not.toHaveBeenCalled();
    expect(gloves.textContent).toContain('Dawn of the Hunt is not available');
    fireEvent.click(within(gloves).getByRole('button', { name: 'Open in Forbidden Rites' }));
    expect(props.onOpen).toHaveBeenCalledWith(SEARCHES[0], 'Forbidden Rites');
  });

  it('deletes one only when confirmed; Cancel is where the cursor is', () => {
    const props = renderDialog();
    const confirm = () => screen.getByRole('dialog', { name: 'Delete "Rings"?' });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete Rings' }));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(within(confirm()).getByText('This cannot be undone.')).toBeTruthy();
    expect(document.activeElement).toBe(within(confirm()).getByRole('button', { name: 'Cancel' }));
    expect(within(confirm()).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete']); // Delete last, on the right
    fireEvent.click(within(confirm()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Delete "Rings"?' })).toBeNull();
    expect(props.onDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete Rings' }));
    fireEvent(confirm(), new Event('cancel', { cancelable: true })); // Esc
    expect(screen.queryByRole('dialog', { name: 'Delete "Rings"?' })).toBeNull();
    expect(props.onDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete Rings' }));
    fireEvent.click(within(confirm()).getByRole('button', { name: 'Delete' }));
    expect(props.onDelete).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('dialog', { name: 'Delete "Rings"?' })).toBeNull();
  });

  it('says when nothing is saved yet, and closes', () => {
    const props = renderDialog({ searches: [] });
    expect(within(dialog()).getByText('No saved searches yet')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close saved searches' }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
