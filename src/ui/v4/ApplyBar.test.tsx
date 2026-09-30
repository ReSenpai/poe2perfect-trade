import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Issue, RequestState } from '@/lib/editor/store';
import { ApplyBar, type ApplyBarProps } from './ApplyBar';

const NOW = Date.parse('2026-09-23T12:00:00Z');

function renderBar(overrides: Partial<ApplyBarProps> = {}) {
  const props: ApplyBarProps = { request: { status: 'idle' }, dirty: false, issues: [], count: 4, now: NOW, onApply: vi.fn(), onReset: vi.fn(), ...overrides };
  const view = render(<ApplyBar {...props} />);
  return { ...view, props };
}

const apply = () => screen.getByRole('button', { name: 'Find items' }) as HTMLButtonElement;
const reset = () => screen.getByRole('button', { name: 'Reset changes' }) as HTMLButtonElement;
const status = () => screen.getByRole('status').textContent;

describe('ApplyBar', () => {
  it('counts the active conditions when nothing changed; Reset has nothing to undo', () => {
    const { props } = renderBar();
    expect(status()).toBe('4 active conditions');
    expect(reset().disabled).toBe(true);
    fireEvent.click(apply());
    expect(props.onApply).toHaveBeenCalled();
  });

  it('says one condition in the singular', () => {
    renderBar({ count: 1 });
    expect(status()).toBe('1 active condition');
  });

  it('asks to apply changed filters and offers Reset changes', () => {
    const { props } = renderBar({ dirty: true });
    expect(status()).toBe('Filters changed — Find items to update results');
    expect(apply().classList.contains('p2t-btn--primary')).toBe(true);
    fireEvent.click(reset());
    expect(props.onReset).toHaveBeenCalled();
  });

  it('blocks Apply on field errors, naming the first and how many there are', () => {
    const issues: Issue[] = [
      { severity: 'error', code: 'min-above-max', message: 'Minimum is higher than maximum', rowId: 'r1', field: 'min' },
      { severity: 'error', code: 'not-a-number', message: 'Enter a number', rowId: 'r2', field: 'max' },
    ];
    renderBar({ dirty: true, issues });
    expect(screen.getByRole('alert').textContent).toBe('Minimum is higher than maximum · 2 problems');
    expect(apply().disabled).toBe(true);
  });

  it('shows the search in progress', () => {
    renderBar({ request: { status: 'searching', revision: 1 } });
    expect(status()).toBe('Searching…');
    expect(apply().disabled).toBe(true);
  });

  it('counts down a rate limit and then lets Apply run again (no automatic search)', () => {
    const request: RequestState = { status: 'cooldown', until: NOW + 42_000 };
    const { rerender, props } = renderBar({ request });
    expect(status()).toBe('Too many requests — try again in 00:42');
    expect(apply().disabled).toBe(true);

    rerender(<ApplyBar {...props} now={NOW + 42_000} />);
    expect(apply().disabled).toBe(false);
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('says a search failed without replacing what is shown', () => {
    renderBar({ request: { status: 'error', kind: 'network', message: 'Failed to fetch' } });
    expect(screen.getByRole('alert').textContent).toBe('Search failed — try again');
    expect(apply().disabled).toBe(false);
  });

  it('is a main Apply without a list of the conditions (they are in sight above)', () => {
    const { container } = renderBar();
    expect(container.querySelector('.p2t-apply-bar__summary')).toBeNull();
    expect(apply().classList.contains('p2t-btn--primary')).toBe(true);
  });
});
