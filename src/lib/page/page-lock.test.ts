import { afterEach, describe, expect, it } from 'vitest';
import { setPageLocked } from './page-lock';

describe('setPageLocked', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-poe2-trade-locked');
  });

  it('stops the page from scrolling behind the overlay', () => {
    setPageLocked(document, true);

    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.documentElement.hasAttribute('data-poe2-trade-locked')).toBe(true);
  });

  it("restores the page's own overflow when unlocked", () => {
    document.documentElement.style.overflow = 'scroll';

    setPageLocked(document, true);
    setPageLocked(document, true);
    setPageLocked(document, false);

    expect(document.documentElement.style.overflow).toBe('scroll');
    expect(document.documentElement.hasAttribute('data-poe2-trade-locked')).toBe(false);
  });

  it('does nothing when unlocking an unlocked page', () => {
    document.documentElement.style.overflow = 'auto';

    setPageLocked(document, false);

    expect(document.documentElement.style.overflow).toBe('auto');
  });
});
