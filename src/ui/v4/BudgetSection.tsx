import { useId, useState } from 'preact/hooks';
import type { Option } from '@/lib/catalog/workspace-data';
import type { Budget } from '@/lib/editor/context';
import type { Issue } from '@/lib/editor/store';
import { SelectedValue } from './SelectedValue';

type Bound = 'min' | 'max';

export interface BudgetSectionProps {
  budget: Budget;
  /** Text of the price fields as typed. */
  texts: { min?: string; max?: string };
  /** Currencies of the price filter; the empty id is "Exalted Orb Equivalent" (no currency set). */
  currencies: Option[];
  currencyInfo: Map<string, { text: string; image?: string }>;
  issues: Issue[];
  onInput: (field: Bound, text: string) => void;
  onCurrencyChange: (currency: string | null) => void;
}

/** Budget (v4 §8.3): an optional price range in an explicit currency; the minimum opens on request. */
export function BudgetSection({ budget, texts, currencies, currencyInfo, issues, onInput, onCurrencyChange }: BudgetSectionProps) {
  const [showMin, setShowMin] = useState(false);
  const id = useId();
  const icon = budget.currency ? currencyInfo.get(budget.currency)?.image : undefined;

  const field = (bound: Bound, label: string, prefix: string) => {
    const issue = issues.find((candidate) => candidate.section === 'budget' && candidate.field === bound);
    const value = texts[bound] ?? (budget[bound] === null ? '' : String(budget[bound]));
    return (
      <label class="p2t-budget__field">
        <span class="p2t-budget__prefix">{prefix}</span>
        <input
          type="text"
          class="p2t-input"
          inputMode="decimal"
          aria-label={label}
          placeholder="No limit"
          value={value}
          aria-invalid={issue ? 'true' : undefined}
          aria-describedby={issue ? `${id}-${bound}-error` : undefined}
          onInput={(event) => onInput(bound, event.currentTarget.value)}
        />
        {issue && (
          <p class="p2t-error" id={`${id}-${bound}-error`}>
            {issue.message}
          </p>
        )}
      </label>
    );
  };

  return (
    <section class="p2t-section" aria-label="Budget">
      <div class="p2t-budget">
        <span class="p2t-budget__title">Budget</span>
        {(showMin || budget.min !== null || texts.min !== undefined) && field('min', 'Min price', 'from')}
        {field('max', 'Max price', 'up to')}
        <label class="p2t-budget__currency">
          <span class="p2t-budget__currency-control">
            {icon && <img class="p2t-budget__currency-icon" src={icon} alt="" width={24} height={24} />}
            <select class="p2t-input" aria-label="Currency" value={budget.currency ?? ''} onChange={(event) => onCurrencyChange(event.currentTarget.value || null)}>
              <SelectedValue />
              {currencies.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.text}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
      {!showMin && budget.min === null && texts.min === undefined && (
        <button type="button" class="p2t-link" onClick={() => setShowMin(true)}>
          Minimum
        </button>
      )}
    </section>
  );
}
