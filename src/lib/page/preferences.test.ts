import { describe, expect, it, vi } from 'vitest';
import { forgetLegacyPreferences } from './preferences';

describe('forgetLegacyPreferences', () => {
  it('clears only what the legacy workspace and the dev switch kept', async () => {
    const removeItems = vi.fn(async () => {});
    await forgetLegacyPreferences(removeItems);
    expect(removeItems).toHaveBeenCalledExactlyOnceWith(['local:filterWidth', 'local:filtersCollapsed', 'local:listingView', 'local:filterMode', 'local:recentFilters', 'local:uiVersion']);
  });
});
