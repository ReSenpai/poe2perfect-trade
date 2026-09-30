import { useId, useState } from 'preact/hooks';
import type { FilterDefinition } from '@/lib/catalog/filter-registry';
import type { FilterValue } from '@/lib/editor/selected-filters';
import type { EditorState, EditorStore, Issue } from '@/lib/editor/store';
import { Icon } from '@/ui/kit/Icon';
import { FilterIcon } from './FilterIcon';
import { SelectedValue } from './SelectedValue';

export interface CompactFilterRowProps {
  definition: FilterDefinition;
  value: FilterValue;
  inputs: EditorState['inputs'];
  issues: Issue[];
  /** The filter does not fit the chosen item (a guess by category family): said, not blocked. */
  misfit?: boolean;
  store: Pick<EditorStore, 'setFilter' | 'setFixedRangeInput'>;
}

/** "≥ 80", "≤ 70", "80–84", "No", the chosen option's words. */
export function filterValueText(definition: FilterDefinition, value: FilterValue): string {
  switch (value.kind) {
    case 'boolean':
      return value.value ? 'Yes' : 'No';
    case 'range':
      if (value.min !== null && value.max !== null) return `${value.min}–${value.max}`;
      return value.min !== null ? `≥ ${value.min}` : `≤ ${value.max}`;
    case 'enum':
      return definition.options?.find((option) => option.id === value.value)?.text ?? value.value;
    case 'text':
      return value.value;
  }
}

/**
 * A filter beyond stats in Your filters (step 41 C, the unified filters design §9): its icon, name and value;
 * the value is a button that opens its editor in place, the cross removes the filter (no condition at all, never Yes).
 */
export function CompactFilterRow({ definition, value, inputs, issues, misfit, store }: CompactFilterRowProps) {
  const [editing, setEditing] = useState(false);
  const id = useId();
  const text = filterValueText(definition, value);
  const { section, key } = definition.binding;
  const issue = issues.find((candidate) => candidate.filter === `${section}.${key}`);

  const editor = () => {
    if (value.kind === 'boolean') {
      return (
        <span class="p2t-segments" role="radiogroup" aria-label={definition.label}>
          {[true, false].map((choice) => (
            <button
              key={String(choice)}
              type="button"
              role="radio"
              aria-checked={value.value === choice ? 'true' : 'false'}
              class="p2t-segments__option"
              onClick={() => store.setFilter(definition, { kind: 'boolean', value: choice })}
            >
              {choice ? 'Yes' : 'No'}
            </button>
          ))}
        </span>
      );
    }
    if (value.kind === 'range') {
      const typed = inputs[`fixed:${section}.${key}`] ?? {};
      const field = (end: 'min' | 'max') => (
        <input
          type="text"
          class="p2t-more__input"
          inputMode="decimal"
          aria-label={`${definition.label} ${end === 'min' ? 'minimum' : 'maximum'}`}
          placeholder={end === 'min' ? 'Min' : 'Max'}
          value={typed[end] ?? (value[end] === null ? '' : String(value[end]))}
          aria-invalid={issue?.field === end ? 'true' : undefined}
          aria-describedby={issue ? `${id}-error` : undefined}
          onInput={(event) => store.setFixedRangeInput(section, key, end, event.currentTarget.value)}
        />
      );
      return (
        <span class="p2t-more__range">
          {field('min')}
          <span aria-hidden="true">–</span>
          {field('max')}
        </span>
      );
    }
    if (value.kind === 'enum') {
      return (
        <select class="p2t-input p2t-more__select" aria-label={definition.label} value={value.value} onChange={(event) => store.setFilter(definition, { kind: 'enum', value: event.currentTarget.value })}>
          <SelectedValue />
          {definition.options?.map((option) => (
            <option key={option.id} value={option.id}>
              {option.text}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        class="p2t-more__input p2t-more__text"
        aria-label={definition.label}
        value={value.value}
        onInput={(event) => store.setFilter(definition, { kind: 'text', value: event.currentTarget.value })}
      />
    );
  };

  return (
    <div class="p2t-compact" role="group" aria-label={definition.label} data-misfit={misfit ? 'true' : undefined}>
      <div class="p2t-compact__line">
        <FilterIcon iconKey={definition.iconKey} />
        <span class="p2t-compact__label" title={definition.description}>
          {definition.label}
        </span>
        <button type="button" class="p2t-compact__value" aria-expanded={editing ? 'true' : 'false'} aria-label={`Edit ${definition.label}: ${text}`} onClick={() => setEditing(!editing)}>
          {text}
        </button>
        <button type="button" class="p2t-condition__remove" aria-label={`Remove ${definition.label} filter`} title={`Remove ${definition.label} filter`} onClick={() => store.setFilter(definition, null)}>
          <Icon name="close" size={15} />
        </button>
      </div>
      {editing && <div class="p2t-compact__editor">{editor()}</div>}
      {issue && (
        <p class="p2t-error" id={`${id}-error`}>
          {issue.message}
        </p>
      )}
      {misfit && (
        <p class="p2t-condition__warning">
          <Icon name="warning" size={14} />
          Not available for this item category
        </p>
      )}
    </div>
  );
}
