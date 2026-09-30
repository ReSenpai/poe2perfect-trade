import type { ComponentChildren } from 'preact';
import type { ItemChecks } from '@/lib/catalog/applicability';
import type { FilterIndex } from '@/lib/catalog/index';
import { sourceLabel } from '@/lib/catalog/picker';
import { parameterOf, toneIcon, toneOf } from '@/lib/catalog/semantic';
import type { DocRow } from '@/lib/editor/document';
import type { EditorState, EditorStore, Issue } from '@/lib/editor/store';
import { NumericConditionRow } from './NumericConditionRow';

export interface ConditionBlockProps {
  row: DocRow;
  state: EditorState;
  store: Pick<EditorStore, 'setConditionInput' | 'setConditionStat' | 'removeCondition'>;
  checks: ItemChecks;
  index: FilterIndex;
  issues: Issue[];
  focus: boolean;
  /** Its mode or actions menu (step 39). */
  extra?: ComponentChildren;
  /** A row of a group is removed from its actions menu, not with a cross of its own. */
  removable?: boolean;
}

/** The name a condition goes by: the parameter's, the trade text, or the stat id. */
export function conditionLabel(statId: string, index: FilterIndex): string {
  const entry = index.get(`stat:${statId}`);
  return parameterOf(statId)?.parameter.label ?? (entry?.kind === 'stat' ? entry.text : undefined) ?? statId;
}

/** One condition of the draft as a parameter block: the same in Parameters and in the groups of Rules. */
export function ConditionBlock({ row, state, store, checks, index, issues, focus, extra, removable = true }: ConditionBlockProps) {
  const known = parameterOf(row.statId)?.parameter;
  const entry = index.get(`stat:${row.statId}`);
  const text = entry?.kind === 'stat' ? entry.text : undefined;
  const label = conditionLabel(row.statId, index);
  const tone = toneOf(row.statId, text);
  const issue = issues.find((candidate) => candidate.rowId === row.id && (candidate.field === 'min' || candidate.field === 'max'));
  return (
    <NumericConditionRow
      label={label}
      source={sourceLabel(row.statId)}
      statId={row.statId}
      sources={known?.variants.map((variant) => ({ statId: variant.statId, label: sourceLabel(variant.statId) }))}
      onSource={(statId) => store.setConditionStat(row.id, statId)}
      icon={known?.icon ?? toneIcon(tone)}
      tone={tone}
      unit={known?.unit ?? (label.includes('%') ? 'percent' : 'flat')}
      scale={checks.scale(row.statId)}
      min={state.inputs[row.id]?.min ?? numberText(row.value?.min)}
      max={state.inputs[row.id]?.max ?? numberText(row.value?.max)}
      active
      disabled={row.disabled}
      error={issue ? { field: issue.field as 'min' | 'max', message: issue.message } : undefined}
      warning={checks.applicability(row.statId).status === 'unsupported' ? 'Not on this item' : undefined}
      focus={focus}
      extra={extra}
      onMin={(value) => store.setConditionInput(row.id, 'min', value)}
      onMax={(value) => store.setConditionInput(row.id, 'max', value)}
      onRemove={removable ? () => store.removeCondition(row.id) : undefined}
    />
  );
}

function numberText(value: unknown): string {
  return typeof value === 'number' ? String(value) : '';
}
