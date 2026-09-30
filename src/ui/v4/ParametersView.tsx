import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ItemChecks } from '@/lib/catalog/applicability';
import type { FilterIndex } from '@/lib/catalog/index';
import { sourceLabel } from '@/lib/catalog/picker';
import { parameterOf } from '@/lib/catalog/semantic';
import { readFixedOption } from '@/lib/editor/context';
import { type DocGroup, type DocRow, type EditableGroup, rowsOf } from '@/lib/editor/document';
import { isSimple, type KeptKind, keptKind } from '@/lib/editor/simple';
import type { EditorState, EditorStore, Issue } from '@/lib/editor/store';
import { Icon } from '@/ui/kit/Icon';
import { ConditionBlock, conditionLabel } from './ConditionBlock';
import { CompactFilterRow } from './CompactFilterRow';
import { filterApplies, type FilterDefinition } from '@/lib/catalog/filter-registry';
import { selectedFilters } from '@/lib/editor/selected-filters';
import { HelpDialog } from './HelpDialog';
import { Menu } from './Menu';
import { SelectedValue } from './SelectedValue';

/** Open affixes are asked with switches, not as blocks: trade conditions of their own, not a count of lines. */
const EMPTY_AFFIXES = [
  { label: 'Open prefix', statId: 'pseudo.pseudo_number_of_empty_prefix_mods' },
  { label: 'Open suffix', statId: 'pseudo.pseudo_number_of_empty_suffix_mods' },
];
const SWITCHED = new Set(EMPTY_AFFIXES.map((affix) => affix.statId));

export interface ParametersViewProps {
  state: EditorState;
  store: Pick<
    EditorStore,
    | 'addCondition'
    | 'setConditionInput'
    | 'setConditionStat'
    | 'removeCondition'
    | 'setFixedOption'
    | 'setGroupCount'
    | 'removeGroup'
    | 'requireSeparately'
    | 'requireAllSeparately'
    | 'exclude'
    | 'require'
    | 'setConditionEnabled'
    | 'setFilter'
    | 'setFixedRangeInput'
  >;
  /** The filters beyond stats (the registry), shown as compact rows. */
  filters: FilterDefinition[];
  /** The chosen category: a filter that does not fit it is said so. */
  category: string | null;
  checks: ItemChecks;
  index: FilterIndex;
  issues: Issue[];
  /** A block just added: its minimum gets the cursor. */
  focusRow: string | null;
  /** Add alternative: the parameter search, adding next to a required row or into a group. */
  onAddAlternative: (anchorId: string, label: string) => void;
  /** The search with every condition on the original site (for conditions kept as they are). */
  onOpenOriginal: () => void;
  /** Add parameter. */
  children?: ComponentChildren;
}

/** What a kept group is called: "Weighted sum", "At least 1 and at most 1 of 2". */
function keptTitle(group: DocGroup, kind: KeptKind): string {
  if (kind === 'weighted') return 'Weighted sum';
  if (kind === 'if') return 'If condition';
  if (kind === 'not-range') return 'None of, with ranges';
  if (kind === 'off') return 'Turned off on the site';
  if (kind === 'count-max' && !group.opaque) return `At least ${String(group.value?.min ?? 0)} and at most ${String(group.value?.max)} of ${group.rows.length}`;
  return 'Advanced condition';
}

/** The stat filters of a group as they came, an opaque one included. */
function filtersOf(group: DocGroup): { id: string; value: Record<string, unknown> | undefined }[] {
  if (!group.opaque) return group.rows.map((row) => ({ id: row.statId, value: row.value }));
  const filters = (group.raw as { filters?: unknown } | null)?.filters;
  return Array.isArray(filters) ? filters.flatMap((filter) => (filter && typeof filter.id === 'string' ? [{ id: filter.id as string, value: filter.value }] : [])) : [];
}

/** "Life ≥ 80", "Fire Resistance 10–20", "Life × 1" (a weight). */
function describe(name: string, value: Record<string, unknown> | undefined): string {
  const { min, max, weight } = value ?? {};
  const range = typeof min === 'number' && typeof max === 'number' ? ` ${min}–${max}` : typeof min === 'number' ? ` ≥ ${min}` : typeof max === 'number' ? ` ≤ ${max}` : '';
  return `${name}${range}${typeof weight === 'number' ? ` × ${weight}` : ''}`;
}

/** The cards of the list, in order: a removal hands focus to the one after it. */
const CARDS = '.p2t-parameter, .p2t-alternatives, .p2t-alternatives .p2t-condition, .p2t-excluded, .p2t-kept';

/** The shape of the list, for screen readers: "2 required · 1 group of alternatives · 1 excluded". */
function shape(required: number, groups: number, excluded: number): string {
  const parts = [
    required > 0 ? `${required} required` : '',
    groups > 0 ? `${groups} ${groups === 1 ? 'group' : 'groups'} of alternatives` : '',
    excluded > 0 ? `${excluded} excluded` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'No parameters';
}

/** The title of a group of alternatives: "Match at least 2 of 3". */
export function alternativesTitle(group: EditableGroup): string {
  return `Match at least ${String(group.value?.min ?? '?')} of ${group.rows.length}`;
}

/**
 * Your parameters (step 39, the simple conditions design): one list — required parameters, groups of
 * alternatives (Match at least N of M), exclusions (Must not have) — in that order; groups the simple editor cannot
 * express stay as cards, kept and searched as they are. A few yes / no switches, and Add parameter.
 */
export function ParametersView({ state, store, checks, index, issues, focusRow, onAddAlternative, onOpenOriginal, children, filters, category }: ParametersViewProps) {
  // A total asked to be excluded: which specific modifier to exclude instead (§6.5).
  const [asking, setAsking] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const helpButton = useRef<HTMLButtonElement>(null);
  // Back to the info button once the modal is gone: while it is open everything behind it is inert.
  const helpClosed = useRef(false);
  useEffect(() => {
    if (help || !helpClosed.current) return;
    helpClosed.current = false;
    helpButton.current?.focus();
  }, [help]);
  // After a removal focus goes to the card that took its place, or to Add parameter (§11).
  const section = useRef<HTMLElement>(null);
  const focusAt = useRef<number | null>(null);
  useEffect(() => {
    const at = focusAt.current;
    if (at === null || !section.current) return;
    focusAt.current = null;
    const next = section.current.querySelectorAll(CARDS)[at];
    const target = next?.querySelector<HTMLElement>('.p2t-menu__button, .p2t-condition__remove') ?? section.current.querySelector<HTMLElement>('.p2t-picker__open');
    target?.focus();
  });
  const noteRemoval = (event: MouseEvent) => {
    const control = (event.target as Element).closest('.p2t-condition__remove, [data-removes]');
    const card = control?.closest(CARDS);
    if (!card || !section.current) return;
    focusAt.current = [...section.current.querySelectorAll(CARDS)].indexOf(card);
  };
  const editable = state.draft.groups.filter(isSimple);
  const allOfRows = editable.filter((group) => group.type === 'and').flatMap(rowsOf);
  const required = allOfRows.filter((row) => !row.disabled && !SWITCHED.has(row.statId));
  // Rows turned off on the site: shown on their own, to turn on or remove.
  const offRows = allOfRows.filter((row) => row.disabled && !SWITCHED.has(row.statId));
  const kept = state.draft.groups.flatMap((group) => {
    const kind = keptKind(group);
    return kind ? [{ group, kind }] : [];
  });
  const alternatives = editable.filter((group) => group.type === 'count');
  const excluded = editable.filter((group) => group.type === 'not').flatMap(rowsOf);
  // Filters beyond stats: the ones the registry names as rows, the ones it does not know kept apart.
  const compact = selectedFilters(state.draft, filters, state.filterOrder);
  // Conditions of the top level: a group of alternatives is one, as the switches are not counted.
  const count = required.length + alternatives.length + excluded.length + kept.length + offRows.length + compact.known.length + compact.unknown.length;
  const label = (row: DocRow) => conditionLabel(row.statId, index);
  const block = (row: DocRow, extra: ComponentChildren, removable = true) => (
    <ConditionBlock key={row.id} row={row} state={state} store={store} checks={checks} index={index} issues={issues} focus={row.id === focusRow} extra={extra} removable={removable} />
  );

  // Not corrupted is the fixed option Corrupted: No, not an excluded stat (v4 §11.1).
  const corruptedOff = readFixedOption(state.draft, 'misc_filters', 'corrupted') === 'false';
  const switches = [
    ...EMPTY_AFFIXES.map(({ label: text, statId }) => {
      const row = allOfRows.find((candidate) => candidate.statId === statId);
      return {
        label: text,
        on: row !== undefined,
        toggle: () => {
          if (row) store.removeCondition(row.id);
          else {
            const rowId = store.addCondition(null, statId);
            if (rowId) store.setConditionInput(rowId, 'min', '1');
          }
        },
      };
    }),
    { label: 'Not corrupted', on: corruptedOff, toggle: () => store.setFixedOption('misc_filters', 'corrupted', corruptedOff ? null : 'false') },
  ];

  const requiredCard = (row: DocRow) => {
    const name = label(row);
    const mode = (
      <Menu
        label={`Mode of ${name}`}
        class="p2t-mode-menu"
        items={[
          { label: 'Require', checked: true, onSelect: () => setAsking(null) },
          { label: 'Add alternative', onSelect: () => onAddAlternative(row.id, name) },
          { label: 'Must not have', onSelect: () => setAsking(store.exclude(row.id) ? null : row.id) },
        ]}
      >
        Required
        <Icon name="chevron-down" size={12} />
      </Menu>
    );
    // Other sources of the parameter that name a modifier (a total does not).
    const specific = (parameterOf(row.statId)?.parameter.variants ?? []).filter((variant) => !variant.statId.startsWith('pseudo.'));
    return (
      <div key={row.id} class="p2t-parameter" data-mode="required">
        {block(row, mode)}
        {asking === row.id && (
          <div class="p2t-parameter__ask" role="group" aria-label={`Exclude ${name}`}>
            <p class="p2t-help">
              <Icon name="info" size={14} />
              Choose a specific modifier to exclude
            </p>
            <p class="p2t-help">A total adds up every source, so it cannot be excluded as one modifier.</p>
            <div class="p2t-parameter__ask-actions">
              {specific.map((variant) => (
                <button
                  key={variant.statId}
                  type="button"
                  class="p2t-btn"
                  aria-label={`Exclude ${name}: ${sourceLabel(variant.statId)}`}
                  onClick={() => {
                    if (store.exclude(row.id, variant.statId)) setAsking(null);
                  }}
                >
                  {sourceLabel(variant.statId)}
                </button>
              ))}
              {specific.length === 0 && <span class="p2t-help">Add the specific modifier with Add parameter, then exclude it.</span>}
              <button type="button" class="p2t-link" onClick={() => setAsking(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const groupCard = (group: EditableGroup) => {
    const title = alternativesTitle(group);
    const n = typeof group.value?.min === 'number' ? group.value.min : 1;
    const countIssue = issues.find((issue) => issue.groupId === group.id && issue.field === 'count');
    const choices = Array.from({ length: Math.max(group.rows.length, n, 1) }, (_, at) => at + 1);
    return (
      <div key={group.id} class="p2t-alternatives" role="group" aria-label={title} data-group={group.id}>
        <div class="p2t-alternatives__head">
          <Icon name="compare" size={18} class="p2t-alternatives__icon" />
          <span class="p2t-alternatives__title">
            <span class="p2t-alternatives__line">
              Match at least
              <select
                class="p2t-input p2t-alternatives__count"
                aria-label="How many must match"
                value={String(n)}
                aria-invalid={countIssue ? 'true' : undefined}
                onChange={(event) => store.setGroupCount(group.id, Number(event.currentTarget.value))}
              >
                <SelectedValue />
                {choices.map((choice) => (
                  <option key={choice} value={String(choice)}>
                    {choice}
                  </option>
                ))}
              </select>
              {`of ${group.rows.length}`}
            </span>
            <span class="p2t-alternatives__explain">Each value must meet its minimum</span>
          </span>
          <Menu
            label={`Actions for ${title}`}
            class="p2t-actions-menu"
            items={[
              { label: 'Require all separately', onSelect: () => store.requireAllSeparately(group.id) },
              { label: 'Delete group', removes: true, onSelect: () => store.removeGroup(group.id) },
            ]}
          >
            <Icon name="more" size={16} />
          </Menu>
        </div>
        {countIssue && (
          <p class="p2t-error" role="alert">
            {countIssue.message}
          </p>
        )}
        <div class="p2t-conditions">
          {group.rows.map((row) => {
            const name = label(row);
            return block(
              row,
              <Menu
                label={`Actions for ${name}`}
                class="p2t-actions-menu"
                items={[
                  { label: 'Make required separately', onSelect: () => store.requireSeparately(row.id) },
                  { label: 'Remove', removes: true, onSelect: () => store.removeCondition(row.id) },
                ]}
              >
                <Icon name="more" size={16} />
              </Menu>,
              false,
            );
          })}
        </div>
        <button type="button" class="p2t-link p2t-alternatives__add" onClick={() => onAddAlternative(group.id, 'this group')}>
          <Icon name="plus" size={14} />
          Add alternative
        </button>
      </div>
    );
  };

  const excludedCard = (row: DocRow) => {
    const name = label(row);
    const issue = issues.find((candidate) => candidate.rowId === row.id);
    return (
      <div key={row.id} class="p2t-excluded" data-mode="excluded" title="Items with this modifier will be excluded, regardless of value.">
        <div class="p2t-excluded__top">
          <Icon name="exclude" size={20} class="p2t-excluded__icon" />
          <span class="p2t-excluded__text">
            <span class="p2t-excluded__label" title={name}>
              {name}
            </span>
            <span class="p2t-excluded__scope">{`${sourceLabel(row.statId)} modifier · any value`}</span>
          </span>
          <Menu
            label={`Mode of ${name}`}
            class="p2t-mode-menu"
            tone="excluded"
            items={[
              { label: 'Require', onSelect: () => store.require(row.id) },
              { label: 'Must not have', checked: true, onSelect: () => undefined },
            ]}
          >
            <Icon name="exclude" size={13} />
            Must not have
            <Icon name="chevron-down" size={12} />
          </Menu>
          <button type="button" class="p2t-condition__remove" aria-label={`Remove ${name}`} title={`Remove ${name}`} onClick={() => store.removeCondition(row.id)}>
            <Icon name="close" size={15} />
          </button>
        </div>
        {issue && (
          <p class="p2t-error" role="alert">
            {issue.message}
          </p>
        )}
      </div>
    );
  };

  return (
    <section ref={section} class="p2t-section" aria-label="Parameters" onClickCapture={noteRemoval}>
      <span class="p2t-sr-only p2t-parameters__live" aria-live="polite">
        {shape(required.length, alternatives.length, excluded.length)}
      </span>
      <p class="p2t-parameters-head">
        <span>Your filters</span>
        <button ref={helpButton} type="button" class="p2t-icon-button p2t-parameters-head__help" aria-label="How parameters work" title="How parameters work" onClick={() => setHelp(true)}>
          <Icon name="info" size={14} />
        </button>
        <span class="p2t-parameters-head__count">{count}</span>
      </p>
      {help && (
        <HelpDialog
          onClose={() => {
            helpClosed.current = true;
            setHelp(false);
          }}
        />
      )}
      {(kept.length > 0 || offRows.length > 0) && (
        <div class="p2t-banner p2t-kept-notice" role="status">
          <Icon name="info" size={16} />
          <span>This search uses conditions the simple editor cannot represent.</span>
          <button type="button" class="p2t-link" onClick={onOpenOriginal}>
            Open in original
          </button>
        </div>
      )}
      {count === 0 && <p class="p2t-help">Add stats or item properties to narrow your search.</p>}
      {required.length > 0 && <div class="p2t-parameters">{required.map(requiredCard)}</div>}
      {alternatives.map(groupCard)}
      {excluded.map(excludedCard)}

      {offRows.map((row) => {
        const name = label(row);
        return (
          <div key={row.id} class="p2t-kept" role="group" aria-label={`${name}, turned off on the site`}>
            <div class="p2t-kept__head">
              <span class="p2t-kept__title">{name}</span>
              <span class="p2t-tag">Turned off</span>
              <button type="button" class="p2t-condition__remove" aria-label={`Remove ${name}`} title={`Remove ${name}`} onClick={() => store.removeCondition(row.id)}>
                <Icon name="close" size={15} />
              </button>
            </div>
            <p class="p2t-help">
              {`${describe(name, row.value)} · turned off on the site, not searched. `}
              <button type="button" class="p2t-link" aria-label={`Turn on ${name}`} onClick={() => store.setConditionEnabled(row.id, true)}>
                Turn on
              </button>
            </p>
          </div>
        );
      })}
      {kept.map(({ group, kind }) => {
        const title = keptTitle(group, kind);
        return (
          <div key={group.id} class="p2t-kept" role="group" aria-label={title}>
            <div class="p2t-kept__head">
              <span class="p2t-kept__title">{title}</span>
              <button type="button" class="p2t-condition__remove" aria-label={`Remove ${title}`} title={`Remove ${title}`} onClick={() => store.removeGroup(group.id)}>
                <Icon name="close" size={15} />
              </button>
            </div>
            <ul class="p2t-kept__list">
              {filtersOf(group).map((filter, at) => (
                <li key={at}>{describe(conditionLabel(filter.id, index), filter.value)}</li>
              ))}
            </ul>
            <p class="p2t-help">Kept as it is and searched with the rest.</p>
          </div>
        );
      })}

      {(compact.known.length > 0 || compact.unknown.length > 0) && (
        <div class="p2t-compact-list">
          {compact.known.map(({ definition, value }) => (
            <CompactFilterRow
              key={definition.id}
              definition={definition}
              value={value}
              inputs={state.inputs}
              issues={issues}
              misfit={filterApplies(definition, category) === false}
              store={store}
            />
          ))}
          {compact.unknown.map(({ section, key }) => (
            <div key={`${section}.${key}`} class="p2t-compact p2t-compact--unknown" role="group" aria-label={`${section}.${key}`}>
              <div class="p2t-compact__line">
                <span class="p2t-compact__label">{`${section}.${key}`}</span>
              </div>
              <p class="p2t-help">Kept from the link and searched as it is; edit it on the original site.</p>
            </div>
          ))}
        </div>
      )}

      {children}

      <div class="p2t-toggles">
        {switches.map((each) => (
          <button key={each.label} type="button" role="switch" aria-checked={each.on} class="p2t-toggle" onClick={each.toggle}>
            <span class="p2t-toggle__track" aria-hidden="true" />
            {each.label}
          </button>
        ))}
      </div>
    </section>
  );
}
