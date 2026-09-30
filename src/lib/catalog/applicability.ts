import type { PossibleSet, PossibleStats } from './possible';

/**
 * Whether a stat applies to the item being searched for, and what is known about its limits (v4 §12, §16). Three
 * separate answers: applicability (supported / unsupported / unknown), bounds (estimated / unknown), and the scale of
 * a slider. "Unsupported" only where the game data covers the item and the stat; missing data is "unknown", never a
 * ban. No limit is "proven" in this version: the highest roll, or a sum of the highest rolls for a total, is an
 * estimate — mods can exclude each other and the whole item is not solved.
 */

export interface ItemScope {
  category: string | null;
  base: string | null;
  rarity: string | null;
  /** A unique's name: its stats are not those of the rare mod pool. */
  name: string | null;
}

export type ApplicabilityReason =
  | 'rolls-here'
  | 'no-roll-here'
  | 'total-has-parts'
  | 'total-has-no-parts'
  | 'stat-not-covered'
  | 'unique'
  | 'no-item'
  | 'category-not-covered'
  | 'no-game-data';

export interface Applicability {
  status: 'supported' | 'unsupported' | 'unknown';
  reason: ApplicabilityReason;
}

export type Bounds = { kind: 'estimated'; upper: number } | { kind: 'unknown' };

export interface ControlScale {
  min: number;
  max: number;
  step: number;
  /** `estimated`: from the highest known roll; `scale-only`: nothing is known, just a range to work with. */
  basis: 'estimated' | 'scale-only';
}

export interface ItemChecks {
  applicability(statId: string): Applicability;
  bounds(statId: string): Bounds;
  scale(statId: string): ControlScale;
}

const PLAIN_SCALE: ControlScale = { min: 0, max: 100, step: 1, basis: 'scale-only' };

export function createApplicability(possible: PossibleStats | null) {
  return {
    forItem(scope: ItemScope): ItemChecks {
      const unknown = (reason: ApplicabilityReason): ItemChecks => ({
        applicability: () => ({ status: 'unknown', reason }),
        bounds: () => ({ kind: 'unknown' }),
        scale: () => PLAIN_SCALE,
      });
      if (!possible) return unknown('no-game-data');
      if (!scope.category) return unknown('no-item');
      if (scope.rarity === 'unique' || scope.name) return unknown('unique');
      const set: PossibleSet | null = possible.forItem(scope.category, scope.base);
      if (!set) return unknown('category-not-covered');

      const bounds = (statId: string): Bounds => {
        const upper = set.max(statId);
        return upper === undefined ? { kind: 'unknown' } : { kind: 'estimated', upper };
      };
      return {
        applicability(statId) {
          const status = set.status(statId);
          const total = statId.startsWith('pseudo.');
          if (status === 'yes') return { status: 'supported', reason: total ? 'total-has-parts' : 'rolls-here' };
          if (status === 'no') return { status: 'unsupported', reason: total ? 'total-has-no-parts' : 'no-roll-here' };
          return { status: 'unknown', reason: 'stat-not-covered' };
        },
        bounds,
        scale(statId) {
          const known = bounds(statId);
          return known.kind === 'estimated' && known.upper > 0 ? { min: 0, max: Math.ceil(known.upper / 5) * 5, step: 1, basis: 'estimated' } : PLAIN_SCALE;
        },
      };
    },
  };
}
