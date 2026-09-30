import type { Issue, RequestState } from '@/lib/editor/store';
import { Icon } from '@/ui/kit/Icon';

export interface ApplyBarProps {
  request: RequestState;
  dirty: boolean;
  issues: Issue[];
  /** Active conditions of the draft, all of them (not an expected number of listings). */
  count: number;
  now: number;
  onApply: () => void;
  onReset: () => void;
}

/** The pinned footer of the filters: what the draft means for the results, Reset changes and Find items. */
export function ApplyBar({ request, dirty, issues, count, now, onApply, onReset }: ApplyBarProps) {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const coolingDown = request.status === 'cooldown' && now < request.until;
  const searching = request.status === 'searching';

  let message;
  if (errors.length > 0) {
    message = (
      <p class="p2t-apply-bar__message p2t-apply-bar__message--error" role="alert">
        {errors[0]!.message}
        {errors.length > 1 && ` · ${errors.length} problems`}
      </p>
    );
  } else if (searching) {
    message = <p class="p2t-apply-bar__message" role="status">Searching…</p>;
  } else if (coolingDown) {
    message = (
      <p class="p2t-apply-bar__message" role="status">
        Too many requests — try again in {countdown(request.until - now)}
      </p>
    );
  } else if (request.status === 'error') {
    message = (
      <p class="p2t-apply-bar__message p2t-apply-bar__message--error" role="alert">
        Search failed — try again
      </p>
    );
  } else {
    message = (
      <p class="p2t-apply-bar__message" role="status">
        {dirty ? 'Filters changed — Find items to update results' : `${count} active condition${count === 1 ? '' : 's'}`}
      </p>
    );
  }

  return (
    <div class="p2t-apply-bar">
      <div class="p2t-apply-bar__head">
        {message}
        <button type="button" class="p2t-link p2t-apply-bar__reset" disabled={!dirty} onClick={onReset}>
          Reset changes
        </button>
      </div>
      <button
        type="button"
        class="p2t-btn p2t-btn--primary p2t-apply-bar__apply"
        disabled={errors.length > 0 || searching || coolingDown}
        aria-busy={searching}
        onClick={onApply}
      >
        {coolingDown ? <Icon name="clock" size={20} /> : <Icon name="search" size={20} />}
        Find items
      </button>
    </div>
  );
}

/** "00:42" */
function countdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
