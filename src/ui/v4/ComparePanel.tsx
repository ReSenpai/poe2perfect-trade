import { useState } from 'preact/hooks';
import { toneIcon } from '@/lib/catalog/semantic';
import type { Comparison } from '@/lib/compare/metrics';
import { formatAge, type Listing } from '@/lib/listing/parse';
import { itemPresentation } from '@/lib/listing/presentation';
import { Icon } from '@/ui/kit/Icon';

export interface CompareEntry {
  listing: Listing;
  /** Kept from an earlier search: when those results were received (ms). */
  previous?: number;
}

export interface ComparePanelProps {
  entries: [CompareEntry, CompareEntry];
  comparison: Comparison;
  now: number;
  onClose: () => void;
}

/**
 * Two listings side by side (v4 §14, sketch 3): name, base and icon of each over the price and the conditions of the
 * search; the other properties behind a toggle; right minus left where it means something. Nothing here searches.
 */
export function ComparePanel({ entries, comparison, now, onClose }: ComparePanelProps) {
  // With no parameters in the search there is nothing else to compare: the properties open right away.
  const [more, setMore] = useState(() => !comparison.rows.some((row) => row.group === 'parameter'));
  const properties = comparison.rows.filter((row) => row.group === 'property');
  const rows = comparison.rows.filter((row) => row.group !== 'property' || more);

  return (
    <aside class="p2t-compare-panel" aria-label="Compare">
      <div class="p2t-compare-panel__head">
        <h2 class="p2t-compare-panel__title">Compare · 2 items</h2>
        <button type="button" class="p2t-icon-button" aria-label="Close comparison" title="Close comparison" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div class="p2t-compare-panel__scroll">
        <table class="p2t-compare" aria-label="Comparison">
          <thead>
            <tr>
              <th scope="col">
                <span class="p2t-sr-only">Metric</span>
              </th>
              {entries.map(({ listing, previous }) => {
                const item = itemPresentation(listing);
                return (
                  <th key={listing.id} scope="col" class="p2t-compare__item" data-rarity={item.rarity}>
                    {item.iconUrl && <img src={item.iconUrl} alt="" loading="lazy" />}
                    <span class="p2t-compare__name">{item.title}</span>
                    {item.subtitle && <span class="p2t-compare__base">{item.subtitle}</span>}
                    {previous !== undefined && <span class="p2t-compare__previous">{`From previous search · ${formatAge(new Date(previous).toISOString(), now)}`}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const icon = toneIcon(row.tone);
              return (
                <tr key={row.key} data-group={row.group}>
                  <th scope="row" data-stat={row.tone}>
                    {icon && <Icon name={icon} size={16} class="p2t-compare__icon" />}
                    {row.label}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={index} data-preferred={cell.preferred ? 'true' : undefined}>
                      {cell.text}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {properties.length > 0 && (
          <button type="button" class="p2t-link p2t-compare__more" aria-expanded={more ? 'true' : 'false'} onClick={() => setMore(!more)}>
            {more ? 'Fewer properties' : `More properties (${properties.length})`}
          </button>
        )}
        {comparison.differences.length > 0 && (
          <div class="p2t-compare__difference">
            <span class="p2t-compare__difference-label">Difference</span>
            <span>{comparison.differences.join(' · ')}</span>
          </div>
        )}
        <p class="p2t-help">Green marks the better value for a condition of your search. Listed prices, no exchange rate.</p>
      </div>
    </aside>
  );
}
