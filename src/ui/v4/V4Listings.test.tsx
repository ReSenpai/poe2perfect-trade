import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { parseListing } from '@/lib/listing/parse';
import type { ResultsState } from '@/lib/results/controller';
import { loadListings, loadWorkspaceData } from '../../../tests/fixtures/load';
import { V4Listings, type V4ListingsProps } from './V4Listings';

const DATA = loadWorkspaceData();
const LISTINGS = loadListings('listings-rings').listings.map(parseListing);
const NOW = Date.parse('2026-09-23T12:00:00Z');

const ready = (overrides: Partial<Extract<ResultsState, { status: 'ready' }>> = {}): ResultsState => ({
  status: 'ready',
  id: 'H4sIq',
  total: 25,
  listings: LISTINGS,
  hasMore: true,
  loadingMore: false,
  ...overrides,
});

function renderList(state: ResultsState) {
  const props: V4ListingsProps = {
    state,
    currencies: DATA.currencies,
    matchedStats: new Set(),
    now: NOW,
    idleText: 'Search loaded — Find items to view results',
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    onEditFilters: vi.fn(),
    onShowOriginal: vi.fn(),
  };
  const view = render(<V4Listings {...props} />);
  return { ...view, props };
}

describe('V4Listings', () => {
  it('lists every loaded listing as a game card', () => {
    const { container } = renderList(ready());
    expect(screen.getByRole('list', { name: 'Listings' })).toBeTruthy();
    expect(container.querySelectorAll('li.p2t-listing')).toHaveLength(LISTINGS.length);
    expect(container.querySelectorAll('article.p2t-item')).toHaveLength(LISTINGS.length);
  });

  it('loads more on request while the found ids last', () => {
    const { props, rerender } = renderList(ready());
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(props.onLoadMore).toHaveBeenCalled();

    rerender(<V4Listings {...props} state={ready({ loadingMore: true })} />);
    expect((screen.getByRole('button', { name: 'Loading…' }) as HTMLButtonElement).disabled).toBe(true);

    rerender(<V4Listings {...props} state={ready({ hasMore: false })} />);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('loads more by itself when the end of the list scrolls into view (infinite scroll), not while loading or after a failure', () => {
    const seen: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    const observed: Element[] = [];
    const options: IntersectionObserverInit[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void, init: IntersectionObserverInit = {}) {
        seen.push(callback);
        options.push(init);
      }
      observe(element: Element) { observed.push(element); }
      disconnect() {}
    });
    try {
      const { props, rerender } = renderList(ready());
      expect(observed).toContain(screen.getByRole('button', { name: 'Load more' }));
      // Well before the end of the scrolling list, so the next listings are there before it is reached.
      expect(options.at(-1)!.root).toBe(screen.getByRole('button', { name: 'Load more' }).closest('.p2t-listings-wrap'));
      expect(Number(/^0px 0px (\d+)px 0px$/.exec(String(options.at(-1)!.rootMargin))?.[1])).toBeGreaterThanOrEqual(1200);
      seen.at(-1)!([{ isIntersecting: false }]);
      expect(props.onLoadMore).not.toHaveBeenCalled();
      seen.at(-1)!([{ isIntersecting: true }]);
      expect(props.onLoadMore).toHaveBeenCalledTimes(1);
      rerender(<V4Listings {...props} state={ready({ loadingMore: true })} />);
      seen.at(-1)?.([{ isIntersecting: true }]);
      rerender(<V4Listings {...props} state={ready({ moreError: 'network' })} />);
      seen.at(-1)?.([{ isIntersecting: true }]);
      expect(props.onLoadMore).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('starts a new search at the top, and keeps the place while more of the same one loads', () => {
    const { props, rerender, container } = renderList(ready());
    const wrap = () => container.querySelector('.p2t-listings-wrap') as HTMLElement;
    wrap().scrollTop = 800;
    rerender(<V4Listings {...props} state={ready({ loadingMore: true })} />);
    rerender(<V4Listings {...props} state={ready({ listings: [...LISTINGS, ...LISTINGS.map((each) => ({ ...each, id: `${each.id}-2` }))] })} />);
    expect(wrap().scrollTop).toBe(800);

    // Find items with other filters: the previous results stay while it runs, then the new ones from their start.
    rerender(<V4Listings {...props} state={{ status: 'searching', previous: ready() as Extract<ResultsState, { status: 'ready' }> }} />);
    rerender(<V4Listings {...props} state={ready({ id: 'H4sIother' })} />);
    expect(wrap().scrollTop).toBe(0);
  });

  it('keeps the listings when loading more fails, with a retry of just that', () => {
    const { props, container } = renderList(ready({ moreError: 'HTTP 502' }));
    expect(container.querySelectorAll('li.p2t-listing')).toHaveLength(LISTINGS.length);
    expect(screen.getByRole('alert').textContent).toContain('Could not load more items');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onLoadMore).toHaveBeenCalled();
  });

  it('says when nothing was found, without calling the item impossible, and offers to edit the filters', () => {
    const { props, container } = renderList(ready({ total: 0, listings: [], hasMore: false }));
    expect(screen.getByText('No items found')).toBeTruthy();
    expect(container.querySelector('img.p2t-state__image')!.getAttribute('alt')).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Edit filters' }));
    expect(props.onEditFilters).toHaveBeenCalled();
  });

  it('waits for Apply before the first search, with the illustration of a new search', () => {
    const { container } = renderList({ status: 'idle' });
    expect(screen.getByText('Search loaded — Find items to view results')).toBeTruthy();
    expect(container.querySelector('img.p2t-state__image')!.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/);
  });

  it('shows placeholders while the first search runs', () => {
    const { container } = renderList({ status: 'searching' });
    expect(screen.getByRole('status').textContent).toBe('Searching…');
    expect(container.querySelectorAll('.p2t-skeleton').length).toBeGreaterThan(0);
  });

  it('keeps the previous results on screen while a new search runs, and says so', () => {
    const { container } = renderList({ status: 'searching', previous: ready() as Extract<ResultsState, { status: 'ready' }> });
    expect(screen.getByRole('status').textContent).toBe('Searching… Showing previous results');
    expect(container.querySelectorAll('li.p2t-listing')).toHaveLength(LISTINGS.length);
    expect(screen.getByRole('list', { name: 'Listings' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('sends a site verification to the original page, never calling it a sign-in problem', () => {
    const { props } = renderList({ status: 'error', kind: 'verification', message: 'x', retryAfter: null });
    expect(screen.getByText('The trade site requires verification. Open the original page.')).toBeTruthy();
    expect(screen.queryByText(/sign in/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open original page' }));
    expect(props.onShowOriginal).toHaveBeenCalled();
  });

  it('offers a retry when the items could not be loaded', () => {
    const { props } = renderList({ status: 'error', kind: 'network', message: 'Failed to fetch', retryAfter: null });
    expect(screen.getByText('Could not load items')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it('shows what the site said about a rejected search', () => {
    const { props } = renderList({ status: 'error', kind: 'bad-query', message: 'Unknown stat provided', retryAfter: null });
    expect(screen.getByText('The trade site rejected this search')).toBeTruthy();
    expect(screen.getByText('Unknown stat provided')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit filters' }));
    expect(props.onEditFilters).toHaveBeenCalled();
  });

  it('says a rate limit is being waited out, without a retry of its own', () => {
    renderList({ status: 'error', kind: 'rate-limited', message: 'x', retryAfter: 42 });
    expect(screen.getByText('Too many requests')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
