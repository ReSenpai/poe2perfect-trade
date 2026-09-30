import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu';

function setup() {
  const onRemove = vi.fn();
  render(
    <Menu label="Actions for Life" items={[{ label: 'Make required separately', onSelect: vi.fn() }, { label: 'Remove', onSelect: onRemove }]}>
      ⋯
    </Menu>,
  );
  return { onRemove, button: screen.getByRole('button', { name: 'Actions for Life' }) };
}

describe('Menu', () => {
  it('opens with the first item focused, without scrolling the panel to it', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const { button } = setup();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Make required separately' }));
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it('keeps focus where it is on a mouse press of an item, so nothing moves under the pointer before the click', () => {
    const { button, onRemove } = setup();
    fireEvent.click(button);
    const remove = screen.getByRole('menuitem', { name: 'Remove' });
    expect(fireEvent.mouseDown(remove)).toBe(false); // default prevented
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens upwards when there is no room below it in its panel', () => {
    const { button } = setup();
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    const panel = document.createElement('div');
    panel.className = 'p2t-filter-scroll';
    button.closest('.p2t-menu')!.before(panel);
    panel.append(button.closest('.p2t-menu')!);
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(rect(0, 400));
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(360, 384));
    fireEvent.click(button);
    expect(screen.getByRole('menu').getAttribute('data-placement')).toBe('up');
  });

  it('closes with Esc and gives focus back to its button', () => {
    const { button } = setup();
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Remove' }), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
