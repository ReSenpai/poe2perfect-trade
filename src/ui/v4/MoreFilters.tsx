import { useId, useState } from 'preact/hooks';
import { type MoreFilter, type MoreFilterGroup, visibleFilters } from '@/lib/catalog/more-filters';
import { readFixedOption, readFixedRange, readFixedText } from '@/lib/editor/context';
import type { QueryDocument } from '@/lib/editor/document';
import type { EditorState, EditorStore, Issue } from '@/lib/editor/store';
import { Icon } from '@/ui/kit/Icon';
import { SelectedValue } from './SelectedValue';

export interface MoreFiltersProps {
  groups: MoreFilterGroup[];
  draft: QueryDocument;
  inputs: EditorState['inputs'];
  issues: Issue[];
  /** The chosen item category: groups that do not fit it wait behind Show all. */
  category: string | null;
  store: Pick<EditorStore, 'setFixedRangeInput' | 'setFixedOption' | 'setFixedText'>;
}

/**
 * The site's rarer filters (step 36): item level and quality, equipment, requirements, endgame, miscellaneous and trade
 * filters, folded under the parameters. A set filter is counted in the header and stays in sight whatever the item.
 */
export function MoreFilters({ groups, draft, inputs, issues, category, store }: MoreFiltersProps) {
  const isSet = (filter: MoreFilter) => {
    if (filter.kind === 'range') {
      const range = readFixedRange(draft, filter.section, filter.key);
      return range.min !== null || range.max !== null;
    }
    if (filter.kind === 'text') return readFixedText(draft, filter.section, filter.key) !== null;
    return readFixedOption(draft, filter.section, filter.key) !== null;
  };
  const set = new Set(groups.flatMap((group) => group.filters.filter(isSet).map((filter) => `${filter.section}.${filter.key}`)));
  const [open, setOpen] = useState(set.size > 0);
  const [all, setAll] = useState(false);
  const fitting = visibleFilters(groups, category, set);
  const shown = all ? groups : fitting;
  const hidden = groups.reduce((sum, group) => sum + group.filters.length, 0) - fitting.reduce((sum, group) => sum + group.filters.length, 0);

  return (
    <section class="p2t-more" aria-label="More filters">
      <button type="button" class="p2t-more__toggle" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(!open)}>
        <Icon name="filters" size={18} />
        <span>More filters</span>
        {set.size > 0 && <span class="p2t-parameters-head__count">{set.size}</span>}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} class="p2t-more__arrow" />
      </button>
      {open && (
        <div class="p2t-more__body">
          {shown.map((group) => (
            <fieldset key={group.section} class="p2t-more__group">
              <legend class="p2t-more__title">{group.title}</legend>
              {group.filters.map((filter) => (
                <FilterRow key={filter.key} filter={filter} draft={draft} inputs={inputs} issues={issues} store={store} />
              ))}
            </fieldset>
          ))}
          {hidden > 0 && (
            <button type="button" class="p2t-link p2t-more__all" onClick={() => setAll(!all)}>
              {all ? 'Show only the filters for this item' : `Show all filters (${hidden} more)`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function FilterRow({ filter, draft, inputs, issues, store }: { filter: MoreFilter; draft: QueryDocument; inputs: EditorState['inputs']; issues: Issue[]; store: MoreFiltersProps['store'] }) {
  const id = useId();
  const name = `${filter.section}.${filter.key}`;

  if (filter.kind === 'range') {
    const range = readFixedRange(draft, filter.section, filter.key);
    const typed = inputs[`fixed:${name}`] ?? {};
    const issue = issues.find((candidate) => candidate.filter === name);
    const field = (end: 'min' | 'max') => (
      <input
        type="text"
        class="p2t-more__input"
        inputMode="decimal"
        aria-label={`${filter.text} ${end === 'min' ? 'minimum' : 'maximum'}`}
        placeholder={end === 'min' ? 'Min' : 'Max'}
        value={typed[end] ?? (range[end] === null ? '' : String(range[end]))}
        aria-invalid={issue?.field === end ? 'true' : undefined}
        aria-describedby={issue?.field === end ? `${id}-error` : undefined}
        onInput={(event) => store.setFixedRangeInput(filter.section, filter.key, end, event.currentTarget.value)}
      />
    );
    return (
      <div class="p2t-more__row">
        <span class="p2t-more__label">{filter.text}</span>
        <span class="p2t-more__range">
          {field('min')}
          <span aria-hidden="true">–</span>
          {field('max')}
        </span>
        {issue && (
          <p class="p2t-error p2t-more__error" id={`${id}-error`}>
            {issue.message}
          </p>
        )}
      </div>
    );
  }

  if (filter.kind === 'yes-no') {
    const value = readFixedOption(draft, filter.section, filter.key);
    const choices: [string, string | null][] = [
      ['Any', null],
      ['Yes', 'true'],
      ['No', 'false'],
    ];
    return (
      <div class="p2t-more__row">
        <span class="p2t-more__label" id={`${id}-label`}>
          {filter.text}
        </span>
        <span class="p2t-segments" role="radiogroup" aria-labelledby={`${id}-label`}>
          {choices.map(([text, option]) => (
            <button key={text} type="button" role="radio" aria-checked={value === option ? 'true' : 'false'} class="p2t-segments__option" onClick={() => store.setFixedOption(filter.section, filter.key, option)}>
              {text}
            </button>
          ))}
        </span>
      </div>
    );
  }

  if (filter.kind === 'option') {
    const value = readFixedOption(draft, filter.section, filter.key) ?? '';
    return (
      <label class="p2t-more__row">
        <span class="p2t-more__label">{filter.text}</span>
        <select class="p2t-input p2t-more__select" aria-label={filter.text} value={value} onChange={(event) => store.setFixedOption(filter.section, filter.key, event.currentTarget.value || null)}>
          <SelectedValue />
          {filter.options!.map((option) => (
            <option key={option.id} value={option.id}>
              {option.text}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label class="p2t-more__row">
      <span class="p2t-more__label">{filter.text}</span>
      <input
        type="text"
        class="p2t-more__input p2t-more__text"
        aria-label={filter.text}
        placeholder="Any"
        value={readFixedText(draft, filter.section, filter.key) ?? ''}
        onInput={(event) => store.setFixedText(filter.section, filter.key, event.currentTarget.value)}
      />
    </label>
  );
}
