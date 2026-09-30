import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { ControlScale } from '@/lib/catalog/applicability';
import { Icon } from '@/ui/kit/Icon';
import type { IconName } from '@/ui/kit/icon-registry';
import { SelectedValue } from './SelectedValue';

export interface NumericConditionRowProps {
  label: string;
  /** Total / Explicit / Implicit… */
  source?: string;
  /** The trade stat of the row; with `sources`, the one chosen. */
  statId?: string;
  /** Other sources of the same parameter to switch to (more than one: a choice instead of the tag). */
  sources?: { statId: string; label: string }[];
  onSource?: (statId: string) => void;
  icon?: IconName;
  /** Colour of the stat (`data-stat`): an element, a resource, an attribute. */
  tone?: string;
  unit: 'flat' | 'percent';
  scale: ControlScale;
  /** Field texts as typed; empty — no bound (Any). */
  min: string;
  max: string;
  /** The condition is in the draft (a row without one only offers to add it). */
  active: boolean;
  error?: { field: 'min' | 'max'; message: string };
  /** Something about this item and condition to look at: "Not on this item". */
  warning?: string;
  /** Put the cursor into the minimum (a condition just added). */
  focus?: boolean;
  onMin: (text: string) => void;
  onMax: (text: string) => void;
  onRemove?: () => void;
  /** Controls of its own before remove (Rules: use, move to). */
  extra?: ComponentChildren;
  /** Turned off: kept in the draft, not searched. */
  disabled?: boolean;
}

const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * One numeric condition (v4 §10.3, laid out as a parameter of shell v5): name, source and remove over a slider and the
 * exact minimum; the maximum opens with the range button. The slider's scale is not the filter: a value above it widens
 * it, and nothing on the slider removes the condition — an empty field is Any, 0 is 0.
 */
export function NumericConditionRow(props: NumericConditionRowProps) {
  const { label, source, statId, sources, onSource, icon, tone, unit, scale, min, max, active, error, warning, focus, onMin, onMax, onRemove, extra, disabled } = props;
  const [showMax, setShowMax] = useState(false);
  const minField = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    if (focus) minField.current?.focus();
  }, [focus]);

  const value = NUMBER.test(min.trim()) ? Number(min) : null;
  const upper = NUMBER.test(max.trim()) ? Number(max) : null;
  const sliderMax = Math.max(scale.max, value ?? scale.min, upper ?? scale.min);
  const at = (number: number) => (sliderMax <= scale.min ? 0 : Math.min(100, Math.max(0, ((number - scale.min) / (sliderMax - scale.min)) * 100)));
  const fill = value === null ? 0 : at(value);
  const errorId = error ? `${id}-error` : undefined;
  const maxOpen = showMax || max !== '';
  // The handles keep their order: the minimum stops at the maximum, the maximum at the minimum.
  const slideMin = (text: string) => onMin(upper !== null && Number(text) > upper ? String(upper) : text);
  const slideMax = (text: string) => onMax(value !== null && Number(text) < value ? String(value) : text);
  const unitMark = unit === 'percent' ? '%' : null;
  const hint = scale.basis === 'estimated' ? `Estimated scale: up to ${scale.max}` : 'Limit not verified';
  const hintId = `${id}-hint`;

  const input = (bound: 'min' | 'max') => (
      <input
        ref={bound === 'min' ? minField : undefined}
        type="text"
        class="p2t-condition__input"
        inputMode="decimal"
        aria-label={`${label} ${bound === 'min' ? 'minimum' : 'maximum'}`}
        placeholder="Any"
        value={bound === 'min' ? min : max}
        aria-invalid={error?.field === bound ? 'true' : undefined}
        aria-describedby={error?.field === bound ? errorId : undefined}
        onInput={(event) => (bound === 'min' ? onMin : onMax)(event.currentTarget.value)}
      />
  );
  // One field: "≥ 80", or with a maximum "25 ≤ ♥ ≤ 102" — the stat between its bounds.
  const field = (
    <span class="p2t-condition__field" data-range={maxOpen ? 'true' : undefined}>
      {maxOpen ? (
        <>
          {input('min')}
          <span class="p2t-condition__bound">≤</span>
          <span class="p2t-condition__field-icon">{icon ? <Icon name={icon} size={14} /> : null}</span>
          <span class="p2t-condition__bound">≤</span>
          {input('max')}
        </>
      ) : (
        <>
          <span class="p2t-condition__bound">≥</span>
          {input('min')}
        </>
      )}
      {unitMark && <span class="p2t-condition__unit">{unitMark}</span>}
    </span>
  );

  const toggleMax = () => {
    if (maxOpen) {
      setShowMax(false);
      if (max !== '') onMax('');
    } else {
      setShowMax(true);
    }
  };

  return (
    <div class="p2t-condition" data-active={active ? 'true' : 'false'} data-stat={tone} data-disabled={disabled ? 'true' : undefined}>
      <div class="p2t-condition__top">
        <span class="p2t-condition__icon-slot">{icon && <Icon name={icon} size={20} class="p2t-condition__icon" />}</span>
        <span class="p2t-condition__label" title={label}>
          {label}
        </span>
        {sources && sources.length > 1 && active ? (
          <select class="p2t-input p2t-condition__source" aria-label={`${label} source`} value={statId} onChange={(event) => onSource?.(event.currentTarget.value)}>
            <SelectedValue />
            {sources.map((each) => (
              <option key={each.statId} value={each.statId}>
                {each.label}
              </option>
            ))}
          </select>
        ) : (
          source && active && <span class="p2t-tag">{source}</span>
        )}
        {extra}
        {active && onRemove && (
          <button type="button" class="p2t-condition__remove" aria-label={`Remove ${label}`} title={`Remove ${label}`} onClick={onRemove}>
            <Icon name="close" size={15} />
          </button>
        )}
      </div>
      <div class="p2t-condition__value" data-range={maxOpen ? 'true' : undefined}>
        <span
          class="p2t-condition__slider"
          data-range={maxOpen ? 'true' : undefined}
          style={{ '--from': `${maxOpen ? fill : 0}%`, '--to': `${maxOpen ? (upper === null ? 100 : at(upper)) : fill}%` }}
        >
          <input
            type="range"
            class="p2t-range"
            aria-label={`${label} minimum`}
            aria-valuetext={value === null ? 'Any' : `${value}${unitMark ?? ''}`}
            aria-describedby={hintId}
            title={hint}
            min={scale.min}
            max={sliderMax}
            step={scale.step}
            value={value ?? scale.min}
            style={{ '--fill': `${fill}%` }}
            onInput={(event) => slideMin(event.currentTarget.value)}
          />
          {maxOpen && (
            <input
              type="range"
              class="p2t-range p2t-range--max"
              aria-label={`${label} maximum`}
              aria-valuetext={upper === null ? 'Any' : `${upper}${unitMark ?? ''}`}
              aria-describedby={hintId}
              title={hint}
              min={scale.min}
              max={sliderMax}
              step={scale.step}
              value={upper ?? sliderMax}
              onInput={(event) => slideMax(event.currentTarget.value)}
            />
          )}
        </span>
        {field}
        <button
          type="button"
          class="p2t-condition__range-toggle"
          aria-expanded={maxOpen ? 'true' : 'false'}
          aria-label={`${maxOpen ? 'Hide' : 'Show'} maximum for ${label}`}
          title={maxOpen ? 'Remove the maximum' : 'Set a maximum'}
          onClick={toggleMax}
        >
          <Icon name="range" size={18} />
        </button>
      </div>
      <span class="p2t-sr-only" id={hintId}>
        {hint}
      </span>
      {error && (
        <p class="p2t-error" id={errorId}>
          {error.message}
        </p>
      )}
      {warning && (
        <p class="p2t-condition__warning">
          <Icon name="warning" size={14} />
          {warning}
        </p>
      )}
    </div>
  );
}
