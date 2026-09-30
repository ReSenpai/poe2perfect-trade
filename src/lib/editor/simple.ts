import type { DocGroup, EditableGroup } from './document';

/**
 * Why a stat group of a search stays as it is (step 39 C, the simple conditions design §13): the simple
 * editor — required, at least N of M, must not have — cannot express it without changing its meaning. It is shown, kept
 * and searched unchanged; the user may remove it or edit it on the original site.
 */
export type KeptKind = 'weighted' | 'if' | 'count-max' | 'not-range' | 'off' | 'advanced';

export function keptKind(group: DocGroup): KeptKind | null {
  if (group.opaque) {
    const type = (group.raw as { type?: unknown } | null)?.type;
    if (type === 'weight' || type === 'weight2') return 'weighted';
    if (type === 'if') return 'if';
    return 'advanced';
  }
  if (group.disabled) return 'off';
  // Rows turned off inside alternatives or exclusions would change what counts: kept whole. In All of a row turned off
  // is shown on its own.
  if (group.type !== 'and' && group.rows.some((row) => row.disabled)) return 'off';
  if (group.type === 'count' && typeof group.value?.max === 'number') return 'count-max';
  if (group.type === 'not' && group.rows.some((row) => row.value !== undefined && Object.keys(row.value).length > 0)) return 'not-range';
  return null;
}

/** A group the simple editor edits: All of, At least N of M (minimum only), None of (no ranges), in use. */
export function isSimple(group: DocGroup): group is EditableGroup {
  return keptKind(group) === null;
}
