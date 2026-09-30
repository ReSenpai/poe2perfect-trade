import { type ComponentChildren, Fragment } from 'preact';
import { relatedStats, toneOf } from '@/lib/catalog/semantic';
import type { ItemPresentation } from '@/lib/listing/presentation';
import { Icon } from '@/ui/kit/Icon';

export interface ItemCardProps {
  item: ItemPresentation;
  /** Trade stat ids the applied search filtered on: mods with exactly these ids are marked. */
  matchedStats: Set<string>;
  /** The field the results are sorted by, when it is one of the card's lines. */
  sort?: { field: string; direction: 'asc' | 'desc' } | null;
  /** Given: lines the site can sort by (`stat.<id>`, `ilvl`, `lvl`) become buttons that sort the results. */
  onSort?: (field: string) => void;
}

/**
 * The item as the game card shows it (v4 §13.2): the rarity frame with name and base, properties and requirements,
 * every mod section in full. Mods are marked as matched only by their exact trade id — a pseudo total is never pinned
 * on one line.
 */
export function ItemCard({ item, matchedStats, sort = null, onSort }: ItemCardProps) {
  /** A line as a sort button when the site can sort by it and sorting is on; as it is otherwise. */
  const sortable = (field: string | null, label: string, children: ComponentChildren) => {
    if (!field || !onSort) return children;
    const direction = sort?.field === field ? sort.direction : undefined;
    return (
      <button
        type="button"
        class="p2t-item__line"
        data-sorted={direction}
        aria-label={`Sort by ${label}${direction ? `, sorted ${direction === 'desc' ? 'high to low' : 'low to high'}` : ''}`}
        onClick={() => onSort(field)}
      >
        {children}
        {direction && <Icon name={direction === 'desc' ? 'chevron-down' : 'chevron-up'} size={12} class="p2t-item__sort-mark" />}
      </button>
    );
  };
  // A searched parameter is marked on every line of it, in its colour: Total Life marks the Life mods it adds up.
  const marked = relatedStats(matchedStats);
  const hasProperties = item.category !== null || item.stats.length > 0 || item.requirements !== null;
  return (
    <article class="p2t-item" data-rarity={item.rarity} data-frame={item.frame}>
      <h3 class="p2t-item__header" data-lines={item.subtitle ? 2 : 1}>
        <span class="p2t-item__name">{item.title}</span>
        {item.subtitle && <span class="p2t-item__base">{item.subtitle}</span>}
      </h3>
      {hasProperties && (
        <div class="p2t-item__properties">
          {item.category && <p class="p2t-item__category">{item.category}</p>}
          {item.stats.map((stat) => (
            <p key={stat.name} class="p2t-item__property">
              {sortable(
                stat.field ?? null,
                `${stat.name}: ${stat.value}`,
                <>
                  {stat.name}: <span class="p2t-item__value">{stat.value}</span>
                </>,
              )}
            </p>
          ))}
          {item.requirements && (
            <p class="p2t-item__property">
              Requires:{' '}
              {item.requirementParts.map((part, index) => (
                <Fragment key={part.text}>
                  {index > 0 && ', '}
                  {sortable(part.field ?? null, part.text, <span class="p2t-item__value">{part.text}</span>)}
                </Fragment>
              ))}
            </p>
          )}
        </div>
      )}
      {item.sections.map((section, index) => (
        <div key={`${section.kind}-${index}`} class="p2t-item__section" data-kind={section.kind} data-tone={section.tone}>
          {(index > 0 || hasProperties) && <hr class="p2t-item__divider" />}
          {section.title && <p class="p2t-item__section-title">{section.title}</p>}
          <ul class="p2t-item__mods">
            {section.lines.map((line, lineIndex) => (
              <li
                key={lineIndex}
                data-match={line.statId !== undefined && marked.has(line.statId) ? 'true' : undefined}
                data-stat={line.statId !== undefined && marked.has(line.statId) ? toneOf(line.statId, line.text) : undefined}
              >
                {sortable(
                  line.statId ? `stat.${line.statId}` : null,
                  line.text,
                  <>
                    {line.tag && (
                      <span class="p2t-item__tier" data-affix={line.affix}>
                        {line.tag}
                      </span>
                    )}
                    {line.detail?.ranges && <span class="p2t-item__range">{line.detail.ranges}</span>}
                    <span class="p2t-item__text">{line.text}</span>
                    {line.detail?.name && <span class="p2t-item__mod-name">{line.detail.name}</span>}
                  </>,
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {item.totals.length > 0 && (
        // Worked out by the server, as the site shows them under the card; "at max Quality" where marked so.
        <p class="p2t-item__totals">
          {item.totals.map((total) => (
            <span key={total.field} class="p2t-item__total" data-augmented={total.augmented ? 'true' : undefined} title={total.augmented ? 'at max Quality' : undefined}>
              {sortable(
                total.field,
                `${total.name}: ${total.value}`,
                <>
                  {total.name}: <span class="p2t-item__value">{total.value}</span>
                </>,
              )}
            </span>
          ))}
        </p>
      )}
      {item.flavour && <p class="p2t-item__flavour">{item.flavour}</p>}
      {item.corrupted && <p class="p2t-item__corrupted">Corrupted</p>}
    </article>
  );
}
