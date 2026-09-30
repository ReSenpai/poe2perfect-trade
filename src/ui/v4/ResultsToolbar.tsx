import type { ComponentChildren } from 'preact';
import type { SearchSort } from '@/lib/api/client';
import type { AppliedSearch } from '@/lib/editor/store';
import { formatAge } from '@/lib/listing/parse';
import type { ResultsState } from '@/lib/results/controller';
import { Icon } from '@/ui/kit/Icon';
import { SelectedValue } from './SelectedValue';

export const SORTS = {
  'price-asc': { label: 'Price: low to high', sort: { price: 'asc' } },
  'price-desc': { label: 'Price: high to low', sort: { price: 'desc' } },
} satisfies Record<string, { label: string; sort: SearchSort }>;
export type SortId = keyof typeof SORTS;

/** A price sort of the toolbar, or `field` for a sort by a line of the cards. */
export function sortIdOf(sort: SearchSort): SortId | 'field' {
  return (Object.keys(SORTS) as SortId[]).find((id) => JSON.stringify(SORTS[id].sort) === JSON.stringify(sort)) ?? 'field';
}

export interface ResultsToolbarProps {
  results: ResultsState;
  /** The search the results are for: its league and sort are shown over them. */
  applied: AppliedSearch | null;
  /** Sort of the draft. */
  sort: SearchSort;
  /** Words for a sort: "Price: low to high", "Sorted by # to maximum Life: high to low". */
  describeSort: (sort: SearchSort) => string;
  now: number;
  onSortChange: (sort: SortId) => void;
  onRefresh: () => void;
  /** Before the count: the summary of the applied filters while they are folded away, so one header stays. */
  leading?: ComponentChildren;
}

export function ResultsToolbar({ results, applied, sort, describeSort, now, onSortChange, onRefresh, leading }: ResultsToolbarProps) {
  const sortId = sortIdOf(sort);
  const savedAt = results.status === 'ready' ? results.savedAt : undefined;
  return (
    <div class="p2t-results-toolbar" data-leading={leading ? 'true' : undefined}>
      {leading}
      <div class="p2t-results-toolbar__heading">
        <span class="p2t-results-toolbar__total" aria-live="polite">
          {totalText(results)}
        </span>
        {savedAt != null && <span class="p2t-results-toolbar__meta">{`Results from ${formatAge(new Date(savedAt).toISOString(), now)}`}</span>}
      </div>
      <label class="p2t-field-inline">
        <Icon name="sort" size={18} />
        <select class="p2t-input" aria-label="Sort" value={sortId} onChange={(event) => event.currentTarget.value !== 'field' && onSortChange(event.currentTarget.value as SortId)}>
          <SelectedValue />
          {sortId === 'field' && <option value="field">{describeSort(sort)}</option>}
          {(Object.keys(SORTS) as SortId[]).map((id) => (
            <option key={id} value={id}>
              {SORTS[id].label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" class="p2t-btn p2t-btn--icon p2t-btn--quiet" aria-label="Refresh results" title="Refresh results" disabled={!applied} onClick={onRefresh}>
        <Icon name="refresh" size={18} />
      </button>
    </div>
  );
}

function totalText(results: ResultsState): ComponentChildren {
  if (results.status === 'idle') return 'No search yet';
  if (results.status === 'searching') return 'Searching…';
  if (results.status === 'error') return 'Search failed';
  if (results.total === 0) return 'No results';
  return (
    <>
      Results <span class="p2t-results-toolbar__count">({`${results.total.toLocaleString('en-US')}${results.total >= 10_000 ? '+' : ''}`})</span>
    </>
  );
}
