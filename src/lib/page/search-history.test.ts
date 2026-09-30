import { describe, expect, it, vi } from 'vitest';
import { followSearch } from './search-history';

const fakeHistory = () => ({ state: { site: 1 }, pushState: vi.fn(), replaceState: vi.fn() });

describe('followSearch', () => {
  it('adds one history entry for a search with a new address, so Back returns to the one before', () => {
    const history = fakeHistory();
    expect(followSearch(history, '/trade2/search/poe2/Standard/A', 'Standard', 'B')).toBe(true);
    expect(history.pushState).toHaveBeenCalledExactlyOnceWith({ site: 1 }, '', '/trade2/search/poe2/Standard/B');
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('leaves the history alone when the address already is that search', () => {
    const history = fakeHistory();
    expect(followSearch(history, '/trade2/search/poe2/Forbidden%20Rites/A', 'Forbidden Rites', 'A')).toBe(false);
    expect(history.pushState).not.toHaveBeenCalled();
  });
});
