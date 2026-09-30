import { describe, expect, it, vi } from 'vitest';
import { createOriginalSync } from './original-sync';

describe('createOriginalSync', () => {
  it('shows the original page as it is when the extension did not touch the address', () => {
    const reload = vi.fn();
    const sync = createOriginalSync(reload);
    sync.onModeChange('original');
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads the page for the original once the extension has written the address', () => {
    const reload = vi.fn();
    const sync = createOriginalSync(reload);
    sync.markWritten();
    sync.onModeChange('extension');
    expect(reload).not.toHaveBeenCalled();
    sync.onModeChange('original');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
