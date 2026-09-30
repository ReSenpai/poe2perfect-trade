import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { SplitWorkspace } from './SplitWorkspace';

function renderSplit(width = 42, collapsed = false) {
  const onWidthChange = vi.fn();
  const view = render(<SplitWorkspace width={width} collapsed={collapsed} onWidthChange={onWidthChange} filters={<p>filters</p>} results={<p>results</p>} />);
  return { ...view, onWidthChange };
}

describe('SplitWorkspace', () => {
  it('gives the filters their share and describes the divider', () => {
    const { container } = renderSplit();
    const separator = screen.getByRole('separator', { name: 'Resize filters' });
    expect([separator.getAttribute('aria-valuenow'), separator.getAttribute('aria-valuemin'), separator.getAttribute('aria-valuemax')]).toEqual(['42', '30', '55']);
    expect((container.querySelector('.p2t-workspace') as HTMLElement).style.getPropertyValue('--filter-width')).toBe('42%');
    expect(screen.getByText('filters')).toBeTruthy();
  });

  it('moves with the keyboard within its limits', () => {
    const { onWidthChange } = renderSplit();
    const separator = screen.getByRole('separator', { name: 'Resize filters' });
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(onWidthChange).toHaveBeenLastCalledWith(44);
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(onWidthChange).toHaveBeenLastCalledWith(42);
    fireEvent.keyDown(separator, { key: 'End' });
    expect(onWidthChange).toHaveBeenLastCalledWith(55);
    fireEvent.keyDown(separator, { key: 'Home' });
    expect(onWidthChange).toHaveBeenLastCalledWith(30);
  });

  it('shows only the results while the filters are collapsed', () => {
    const { container } = renderSplit(42, true);
    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.queryByText('filters')).toBeNull();
    expect(container.querySelector('.p2t-workspace')!.getAttribute('data-collapsed')).toBe('true');
  });
});
