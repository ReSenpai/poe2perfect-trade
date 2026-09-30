import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { ReadyResults, ResultsState } from '@/lib/results/controller';
import { STATE_IMAGES } from '@/ui/kit/states';
import { ListingRow, type ListingRowProps } from './ListingRow';

const SKELETONS = 3;

export interface V4ListingsProps {
  state: ResultsState;
  currencies: Map<string, { text: string; image?: string }>;
  matchedStats: Set<string>;
  now: number;
  /** What to say before the first search. */
  idleText: string;
  sort?: ListingRowProps['sort'];
  onSort?: ListingRowProps['onSort'];
  priceSort?: ListingRowProps['priceSort'];
  whisper?: ListingRowProps['whisper'];
  /** Listing ids in the comparison. */
  compared?: Set<string>;
  onCompare?: ListingRowProps['onCompare'];
  onLoadMore: () => void;
  onRetry: () => void;
  /** Takes the user to the filters (they may be collapsed). */
  onEditFilters: () => void;
  onShowOriginal: () => void;
}

/** The listings of the applied search as game cards, 10 at a time, and every state around them (v4 §19). */
export function V4Listings(props: V4ListingsProps) {
  const { state, idleText, onRetry, onEditFilters, onShowOriginal } = props;

  if (state.status === 'idle') return <ResultState image={STATE_IMAGES.emptySearch} title={idleText} />;

  if (state.status === 'searching') {
    if (state.previous) return <Listings key={state.previous.id} {...props} results={state.previous} busy />;
    return (
      <div class="p2t-listings-wrap">
        <p class="p2t-sr-only" role="status">
          Searching…
        </p>
        {Array.from({ length: SKELETONS }, (_, index) => (
          <div key={index} class="p2t-listing p2t-listing--skeleton" aria-hidden="true">
            <span class="p2t-skeleton" />
            <span class="p2t-skeleton p2t-skeleton--card" />
            <span class="p2t-skeleton" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    if (state.kind === 'verification') {
      return (
        <ResultState image={STATE_IMAGES.verification} title="The trade site requires verification. Open the original page.">
          <button type="button" class="p2t-btn p2t-btn--primary" onClick={onShowOriginal}>
            Open original page
          </button>
        </ResultState>
      );
    }
    if (state.kind === 'rate-limited') {
      return <ResultState image={STATE_IMAGES.connectionError} title="Too many requests" text="Find items works again when the countdown in the filters ends." />;
    }
    if (state.kind === 'bad-query') {
      return (
        <ResultState image={STATE_IMAGES.noResults} title="The trade site rejected this search" text={state.message}>
          <button type="button" class="p2t-btn" onClick={onEditFilters}>
            Edit filters
          </button>
        </ResultState>
      );
    }
    return (
      <ResultState image={STATE_IMAGES.connectionError} title="Could not load items">
        <button type="button" class="p2t-btn" onClick={onRetry}>
          Retry
        </button>
      </ResultState>
    );
  }

  if (state.total === 0 || state.listings.length === 0) {
    return (
      <ResultState image={STATE_IMAGES.noResults} title="No items found" text="Try fewer or wider conditions.">
        <button type="button" class="p2t-btn" onClick={onEditFilters}>
          Edit filters
        </button>
      </ResultState>
    );
  }

  // Keyed by the search: another search starts from the top of its list, more of the same one keeps the place.
  return <Listings key={state.id} {...props} results={state} busy={false} />;
}

function Listings({ results, busy, currencies, matchedStats, now, sort, onSort, priceSort, whisper, compared, onCompare, onLoadMore }: V4ListingsProps & { results: ReadyResults; busy: boolean }) {
  return (
    <div class="p2t-listings-wrap">
      {busy && (
        <p class="p2t-banner p2t-listings__busy" role="status">
          Searching… Showing previous results
        </p>
      )}
      <ul class="p2t-listings" aria-label="Listings" aria-busy={busy ? 'true' : undefined}>
        {results.listings.map((listing) => (
          <ListingRow
            key={listing.id}
            listing={listing}
            currencies={currencies}
            matchedStats={matchedStats}
            now={now}
            sort={sort}
            onSort={onSort}
            priceSort={priceSort}
            whisper={whisper}
            compared={compared?.has(listing.id)}
            onCompare={onCompare}
          />
        ))}
      </ul>
      {!busy && results.moreError && (
        <div class="p2t-banner p2t-banner--warning" role="alert">
          <span>Could not load more items</span>
          <button type="button" class="p2t-link" onClick={onLoadMore}>
            Retry
          </button>
        </div>
      )}
      {!busy && results.hasMore && !results.moreError && (
        <LoadMore loading={results.loadingMore} onLoadMore={onLoadMore} />
      )}
    </div>
  );
}

/** How far below the visible list the next listings are asked for. */
const AHEAD_PX = 1600;

/**
 * Load more at the end of the list: the next listings come by themselves as it scrolls into view (as on the site), the
 * button stays for a click. Never while a page is loading; after a failure only Retry loads again.
 */
function LoadMore({ loading, onLoadMore }: { loading: boolean; onLoadMore: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const latest = useRef({ loading, onLoadMore });
  latest.current = { loading, onLoadMore };
  // Watched anew after each page: a fresh observer reports at once, so a list still too short to scroll goes on loading.
  useEffect(() => {
    const element = button.current;
    if (loading || !element || typeof IntersectionObserver === 'undefined') return;
    // Watched against the scrolling list with a margin below it: the next page is asked for about two screens ahead, so
    // scrolling does not reach the end while it loads.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !latest.current.loading) latest.current.onLoadMore();
      },
      { root: element.closest('.p2t-listings-wrap'), rootMargin: `0px 0px ${AHEAD_PX}px 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading]);
  return (
    <button ref={button} type="button" class="p2t-btn p2t-listings__more" disabled={loading} onClick={onLoadMore}>
      {loading ? 'Loading…' : 'Load more'}
    </button>
  );
}

function ResultState({ image, title, text, children }: { image: string; title: string; text?: string; children?: ComponentChildren }) {
  return (
    <div class="p2t-state">
      <img class="p2t-state__image" src={image} alt="" width={96} height={96} />
      <p class="p2t-state__title">{title}</p>
      {text && <p class="p2t-help">{text}</p>}
      {children && <div class="p2t-state__actions">{children}</div>}
    </div>
  );
}
