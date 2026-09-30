import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { alternativesOutcome, HELP_EXAMPLES, HelpDialog, totalFire } from './HelpDialog';

// the parameter help design: one screen, stat sources on the left, match modes on the right.

describe('help examples', () => {
  it('adds up the ring: 20% direct fire and 15% all elemental make 35% total fire', () => {
    expect(totalFire()).toBe(HELP_EXAMPLES.sourceItem.directFire + HELP_EXAMPLES.sourceItem.allElemental);
    expect(totalFire()).toBe(35);
  });

  it('counts conditions, not values: fire 41 and cold 35 meet, chaos is missing — 2 matched, a pass at 2', () => {
    expect(alternativesOutcome()).toEqual({
      conditions: [
        { stat: 'fire', value: 41, meets: true },
        { stat: 'cold', value: 35, meets: true },
        { stat: 'chaos', value: null, meets: false },
      ],
      matched: 2,
      pass: true,
    });
  });
});

describe('HelpDialog', () => {
  const open = (onClose = vi.fn()) => {
    render(<HelpDialog onClose={onClose} />);
    return { onClose, dialog: screen.getByRole('dialog', { name: 'How parameters work' }) };
  };

  it('shows the stat sources, the match modes and how they work together', () => {
    const { dialog } = open();
    expect(within(dialog).getByText('Choose what counts. Then choose what must match.')).toBeTruthy();
    const sources = within(dialog).getByRole('region', { name: 'Choose the stat source' });
    expect(within(sources).getByRole('heading', { name: 'Implicit Built into the base' })).toBeTruthy();
    expect(within(sources).getByRole('heading', { name: 'Explicit Rolled modifiers' })).toBeTruthy();
    expect(within(sources).getByRole('img', { name: '20 percent direct fire resistance plus 15 percent all elemental resistance equals 35 percent total fire resistance' })).toBeTruthy();
    expect((within(sources).getByRole('img', { hidden: true, name: '' }) as HTMLImageElement).getAttribute('src')).toBe('category/ring-large.png');
    const table = within(sources).getByRole('table', { name: 'Searching for Fire resistance ≥ 35%?' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Total'),
      expect.stringContaining('Explicit'),
      expect.stringContaining('Implicit'),
    ]);
    expect(within(table).getByText('Match: 35%')).toBeTruthy();
    expect(within(table).getByText('Only 20%')).toBeTruthy();

    const modes = within(dialog).getByRole('region', { name: 'Choose how it matches' });
    for (const name of ['Required', 'Alternatives', 'Must not have']) expect(within(modes).getByRole('heading', { name })).toBeTruthy();
    expect(within(modes).getByText('Example B · Another item')).toBeTruthy();
    expect(within(modes).getByText('2 matched · Pass')).toBeTruthy();
    expect(within(modes).getByText('Choose a modifier source. Total cannot be excluded here.')).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'All conditions work together' })).toBeTruthy();
  });

  it('draws the examples as static pictures: only Close and Got it take focus', () => {
    const { dialog } = open();
    const focusable = dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]');
    expect([...focusable].map((element) => element.getAttribute('aria-label') ?? element.textContent)).toEqual(['Close help', 'Got it']);
  });

  it('closes with Close, Got it, Esc, and a click that starts and ends on the backdrop', () => {
    const { dialog, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Close help' }));
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(3);
    // Selecting text that ends outside the box is not a click on the backdrop.
    fireEvent.mouseDown(within(dialog).getByText('Choose what counts. Then choose what must match.'));
    fireEvent.mouseUp(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.mouseDown(dialog);
    fireEvent.mouseUp(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(4);
  });
});
