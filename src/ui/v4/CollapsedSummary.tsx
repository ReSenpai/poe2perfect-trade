import { useState } from 'preact/hooks';
import type { FilterChip } from '@/lib/query/labels';
import { Icon } from '@/ui/kit/Icon';

/** Chips shown before "+N more". */
const VISIBLE = 4;

export interface CollapsedSummaryProps {
  /** Conditions of the applied search: the summary describes the listings on screen, not the draft. */
  chips: FilterChip[];
  /** The draft differs from the applied search. */
  dirty: boolean;
  onEdit: () => void;
}

/** What stays over the results while the filters are collapsed. */
export function CollapsedSummary({ chips, dirty, onEdit }: CollapsedSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? chips : chips.slice(0, VISIBLE);
  const hidden = chips.length - shown.length;
  return (
    <section class="p2t-collapsed" aria-label="Applied filters">
      <button type="button" class="p2t-btn" onClick={onEdit}>
        <Icon name="filters" size={16} />
        {`Filters · ${chips.length}`}
      </button>
      <ul class="p2t-chips">
        {shown.map((chip) => (
          <li key={chip.key} class="p2t-chip" title={chip.title}>
            {chip.text}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" class="p2t-link" onClick={() => setExpanded(true)}>
          {`+${hidden} more`}
        </button>
      )}
      {dirty && <span class="p2t-collapsed__dirty">Unapplied changes</span>}
      <button type="button" class="p2t-link" onClick={onEdit}>
        Edit
      </button>
    </section>
  );
}
