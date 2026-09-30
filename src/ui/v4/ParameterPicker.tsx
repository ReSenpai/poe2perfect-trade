import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import type { ItemChecks } from '@/lib/catalog/applicability';
import type { FilterIndex } from '@/lib/catalog/index';
import { type PickerItem, pickerResults, sourceLabel } from '@/lib/catalog/picker';
import { Icon } from '@/ui/kit/Icon';

export interface ParameterPickerProps {
  index: FilterIndex;
  checks: ItemChecks;
  /** Stat ids added recently, newest first. */
  recent: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A stat to add as a condition (to All of). */
  onPick: (statId: string) => void;
  /** Add parameter in place (false: opened from elsewhere). */
  showOpener?: boolean;
  /** The heading: "Add parameter", or "Add an alternative to Fire Resistance". */
  title?: string;
  /** Required parameters that can join the alternatives as they are (Already in your search). */
  already?: { rowId: string; label: string }[];
  onMove?: (rowId: string) => void;
}

/** A list to browse longer than this starts folded: its header says how many, a click opens it. */
const FOLD_AT = 100;
/** Rows of a list to browse drawn at a time: thousands at once freeze the page. */
const PAGE = 100;

/** The rest of a list to browse: drawn when this comes into view as the list scrolls, or on a click. */
function MoreRows({ left, onMore }: { left: number; onMore: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = button.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onMore();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onMore]);
  return (
    <button ref={button} type="button" class="p2t-link p2t-picker__more" onClick={onMore}>
      {`Show more · ${left.toLocaleString('en-US')} left`}
    </button>
  );
}

const STATUS_TAG: Record<PickerItem['status'], string | null> = { supported: null, unknown: 'Not verified', unsupported: 'Not on this item' };

/** Add parameter (v4 §9.3): a search right in the filter panel; incompatible parameters stay reachable, marked. */
export function ParameterPicker({ index, checks, recent, open, onOpenChange, onPick, showOpener = true, title = 'Add parameter', already = [], onMove }: ParameterPickerProps) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(-1);
  const [showIncompatible, setShowIncompatible] = useState(false);
  // Browse lists by title the user folded or unfolded; a large one (the whole catalog's explicit mods) starts folded.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  // How many rows of a list to browse are drawn: a page at a time, more as it is scrolled.
  const [shown, setShown] = useState<Record<string, number>>({});
  const field = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    setText('');
    setActive(-1);
    setShowIncompatible(false);
    // Over the page (top layer) where the browser can; open in place otherwise.
    const box = dialog.current;
    if (box && !box.open) {
      if (typeof box.showModal === 'function') box.showModal();
      else box.setAttribute('open', '');
    }
    field.current?.focus();
    setOpened({});
    setShown({});
  }, [open]);

  const results = useMemo(() => pickerResults({ index, checks, text, recent }), [index, checks, text, recent]);
  const groups = [...results.sections, ...(showIncompatible && results.incompatible.length > 0 ? [{ title: 'Not on this item', items: results.incompatible }] : [])];
  const isOpen = (group: { title: string; items: unknown[]; browse?: boolean }) => !group.browse || (opened[group.title] ?? group.items.length <= FOLD_AT);
  const visible = <T,>(group: { title: string; items: T[]; browse?: boolean }): T[] => (!isOpen(group) ? [] : group.browse ? group.items.slice(0, shown[group.title] ?? PAGE) : group.items);
  const flat = groups.flatMap(visible);
  const browseTotal = results.sections.filter((section) => section.browse).reduce((sum, section) => sum + section.items.length, 0);
  // Already in your search, narrowed by the words typed like the rest of the search.
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const alreadyShown = already.filter((each) => words.every((word) => each.label.toLowerCase().includes(word)));

  const opener = showOpener && (
    <>
      <button type="button" class="p2t-picker__open" onClick={() => onOpenChange(true)}>
        <Icon name="plus" size={18} />
        <span>Add parameter</span>
        <Icon name="chevron-down" size={14} class="p2t-picker__open-arrow" />
      </button>
      <p class="p2t-picker__hint">Add only what matters to your search.</p>
    </>
  );
  if (!open) return opener || null;

  const pick = (statId: string) => onPick(statId);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (flat.length === 0 ? -1 : (current + step + flat.length) % flat.length));
    } else if (event.key === 'Enter' && !(event.ctrlKey || event.metaKey)) {
      const item = flat[active] ?? flat[0];
      if (!item) return;
      event.preventDefault();
      pick(item.statId);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    }
  };

  let position = 0;
  return (
    <>
      {opener}
      <dialog
        ref={dialog}
        class="p2t-modal"
        aria-labelledby={`${id}-title`}
        onCancel={(event) => {
          event.preventDefault();
          onOpenChange(false);
        }}
        onClick={(event) => {
          // A click on the backdrop (the dialog itself, outside its box) closes it.
          if (event.target === event.currentTarget) onOpenChange(false);
        }}
      >
      <div class="p2t-modal__header">
        <h2 class="p2t-modal__title" id={`${id}-title`}>
          {title}
        </h2>
        <button type="button" class="p2t-icon-button" aria-label="Close parameter search" title="Close" onClick={() => onOpenChange(false)}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <div class="p2t-modal__body p2t-picker">
      <div class="p2t-picker__search">
        <Icon name="search" size={16} class="p2t-item-context__search-icon" />
        <input
          ref={field}
          type="text"
          role="combobox"
          class="p2t-input"
          aria-label="Search parameters"
          placeholder="Search parameters: life, fire res…"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
          value={text}
          onInput={(event) => {
            setText(event.currentTarget.value);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {alreadyShown.length > 0 && onMove && (
        <div class="p2t-picker__already" role="group" aria-label="Already in your search">
          <p class="p2t-section-title">Already in your search</p>
          {alreadyShown.map((each) => (
            <button key={each.rowId} type="button" class="p2t-picker__option p2t-picker__move" aria-label={`Move ${each.label} into alternatives`} onClick={() => onMove(each.rowId)}>
              <span class="p2t-picker__label">{each.label}</span>
              <span class="p2t-tag">Move into alternatives</span>
            </button>
          ))}
        </div>
      )}
      {results.note && <p class="p2t-help">{results.note}</p>}
      <div class="p2t-picker__results" id={`${id}-list`} role="listbox" aria-label="Parameters">
        {groups.map((group) => (
          <div key={group.title} role="group" aria-label={group.title} class="p2t-picker__group">
            {group.browse ? (
              <button
                type="button"
                class="p2t-section-title p2t-picker__fold"
                aria-expanded={isOpen(group) ? 'true' : 'false'}
                onClick={() => setOpened({ ...opened, [group.title]: !isOpen(group) })}
              >
                <span>{group.title}</span> <span class="p2t-picker__count">{group.items.length.toLocaleString('en-US')}</span>
                <Icon name={isOpen(group) ? 'chevron-up' : 'chevron-down'} size={12} />
              </button>
            ) : (
              <p class="p2t-section-title" aria-hidden="true">
                {group.title}
              </p>
            )}
            {visible(group).map((item) => {
              const index_ = position++;
              const tag = STATUS_TAG[item.status];
              return (
                <div
                  key={item.key}
                  id={`${id}-${index_}`}
                  role="option"
                  aria-selected={index_ === active}
                  data-label={item.label}
                  class="p2t-picker__option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(item.statId)}
                >
                  <span class="p2t-picker__label" title={item.detail}>
                    {item.label}
                  </span>
                  {item.variants && item.variants.length > 1 ? (
                    <span class="p2t-picker__sources">
                      {item.variants.map((variant) => (
                        <button
                          key={variant.statId}
                          type="button"
                          class="p2t-tag p2t-picker__source"
                          aria-label={`${item.label}: ${sourceLabel(variant.statId)}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            pick(variant.statId);
                          }}
                        >
                          {sourceLabel(variant.statId)}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span class="p2t-tag">{item.source}</span>
                  )}
                  {tag && <span class={`p2t-picker__status p2t-picker__status--${item.status}`}>{tag}</span>}
                </div>
              );
            })}
            {isOpen(group) && group.items.length > visible(group).length && (
              <MoreRows left={group.items.length - visible(group).length} onMore={() => setShown({ ...shown, [group.title]: visible(group).length + PAGE })} />
            )}
          </div>
        ))}
        {text.trim() !== '' && flat.length === 0 && results.incompatible.length === 0 && <p class="p2t-help">No matching parameters</p>}
      </div>
      {results.incompatible.length > 0 && !showIncompatible && (
        <button type="button" class="p2t-link p2t-picker__toggle" onClick={() => setShowIncompatible(true)}>
          {`Show incompatible (${results.incompatible.length})`}
        </button>
      )}
      {/* How many there are to browse, under the lists. */}
      {text.trim() === '' && browseTotal > 0 && (
        <p class="p2t-help p2t-picker__total">{`${browseTotal.toLocaleString('en-US')} parameters ${results.note === null ? 'on this item' : 'in the catalog'}`}</p>
      )}
      </div>
      </dialog>
    </>
  );
}
