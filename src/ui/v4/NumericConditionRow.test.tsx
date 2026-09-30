import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { NumericConditionRow, type NumericConditionRowProps } from './NumericConditionRow';

function renderRow(overrides: Partial<NumericConditionRowProps> = {}) {
  const props: NumericConditionRowProps = {
    label: 'Life',
    source: 'Total',
    icon: 'life',
    unit: 'flat',
    scale: { min: 0, max: 120, step: 1, basis: 'estimated' },
    min: '',
    max: '',
    active: false,
    onMin: vi.fn(),
    onMax: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  const view = render(<NumericConditionRow {...props} />);
  return { ...view, props };
}

const minField = () => screen.getByRole('textbox', { name: 'Life minimum' }) as HTMLInputElement;
const slider = () => screen.getByRole('slider', { name: 'Life minimum' }) as HTMLInputElement;

describe('NumericConditionRow', () => {
  it('shows Any for no bound, and tells it apart from 0', () => {
    renderRow();
    expect(minField().value).toBe('');
    expect(minField().placeholder).toBe('Any');
    expect(slider().getAttribute('aria-valuetext')).toBe('Any');
  });

  it('shows 0 as a bound of its own', () => {
    renderRow({ min: '0', active: true });
    expect(minField().value).toBe('0');
    expect(slider().getAttribute('aria-valuetext')).toBe('0');
  });

  it('reports typed text and slider moves as the minimum', () => {
    const { props } = renderRow({ min: '80', active: true });
    expect(slider().value).toBe('80');
    fireEvent.input(minField(), { target: { value: '9' } });
    expect(props.onMin).toHaveBeenLastCalledWith('9');
    fireEvent.input(slider(), { target: { value: '95' } });
    expect(props.onMin).toHaveBeenLastCalledWith('95');
  });

  it('widens the slider for a value above its scale instead of cutting the value', () => {
    renderRow({ min: '150', active: true });
    expect(slider().max).toBe('150');
    expect(minField().value).toBe('150');
  });

  it('says what the scale is based on', () => {
    const { unmount } = renderRow();
    expect(screen.getByText('Estimated scale: up to 120')).toBeTruthy();
    expect(slider().title).toBe('Estimated scale: up to 120');
    unmount();
    renderRow({ scale: { min: 0, max: 100, step: 1, basis: 'scale-only' } });
    expect(screen.getByText('Limit not verified')).toBeTruthy();
  });

  it('opens the maximum with the range button, or right away when one is set', () => {
    const { props, unmount } = renderRow({ active: true, min: '80' });
    expect(screen.queryByRole('textbox', { name: 'Life maximum' })).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show maximum for Life' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide maximum for Life' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.input(screen.getByRole('textbox', { name: 'Life maximum' }), { target: { value: '100' } });
    expect(props.onMax).toHaveBeenCalledWith('100');
    unmount();
    renderRow({ active: true, max: '100' });
    expect((screen.getByRole('textbox', { name: 'Life maximum' }) as HTMLInputElement).value).toBe('100');
  });

  it('shows a range in one field — minimum, the stat, maximum — and a second handle on the slider', () => {
    const { props, container } = renderRow({ active: true, min: '25', max: '102' });
    expect(screen.queryByText('Maximum (optional)')).toBeNull();
    const field = minField().closest('.p2t-condition__field')!;
    expect(field.contains(screen.getByRole('textbox', { name: 'Life maximum' }))).toBe(true);
    expect(field.querySelector('.p2t-condition__field-icon')).toBeTruthy(); // 25 ≤ ♥ ≤ 102
    expect(field.textContent).toContain('≤');
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(2);
    fireEvent.input(screen.getByRole('slider', { name: 'Life maximum' }), { target: { value: '90' } });
    expect(props.onMax).toHaveBeenLastCalledWith('90');
  });

  it('keeps the handles in order: the minimum does not pass the maximum, nor the maximum the minimum', () => {
    const { props } = renderRow({ active: true, min: '25', max: '60' });
    fireEvent.input(slider(), { target: { value: '80' } });
    expect(props.onMin).toHaveBeenLastCalledWith('60');
    fireEvent.input(screen.getByRole('slider', { name: 'Life maximum' }), { target: { value: '10' } });
    expect(props.onMax).toHaveBeenLastCalledWith('25');
  });

  it('hides the maximum again, clearing it', () => {
    const { props } = renderRow({ active: true, max: '100' });
    fireEvent.click(screen.getByRole('button', { name: 'Hide maximum for Life' }));
    expect(props.onMax).toHaveBeenCalledWith('');
  });

  it('switches between the sources of its parameter', () => {
    const onSource = vi.fn();
    const sources = [
      { statId: 'pseudo.pseudo_total_life', label: 'Total' },
      { statId: 'explicit.stat_3299347043', label: 'Explicit' },
    ];
    renderRow({ active: true, statId: 'pseudo.pseudo_total_life', sources, onSource });
    const select = screen.getByRole('combobox', { name: 'Life source' }) as HTMLSelectElement;
    expect([...select.options].map((option) => option.text)).toEqual(['Total', 'Explicit']);
    expect(select.value).toBe('pseudo.pseudo_total_life');
    fireEvent.change(select, { target: { value: 'explicit.stat_3299347043' } });
    expect(onSource).toHaveBeenCalledWith('explicit.stat_3299347043');
  });

  it('removes an active condition, and has nothing to remove otherwise', () => {
    const { props, unmount } = renderRow({ active: true, min: '80' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Life' }));
    expect(props.onRemove).toHaveBeenCalled();
    unmount();
    renderRow();
    expect(screen.queryByRole('button', { name: 'Remove Life' })).toBeNull();
  });

  it('shows an error next to its field', () => {
    renderRow({ active: true, min: '-', error: { field: 'min', message: 'Enter a number' } });
    expect(minField().getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(minField().getAttribute('aria-describedby')!)!.textContent).toBe('Enter a number');
  });

  it('warns about a condition the item cannot have, without removing it', () => {
    renderRow({ active: true, min: '10', warning: 'Not on this item' });
    expect(screen.getByText('Not on this item')).toBeTruthy();
    expect(minField().value).toBe('10');
  });

  it('shows the source of the condition, and the unit', () => {
    renderRow({ label: 'Fire Resistance', source: 'Total', unit: 'percent', min: '35', active: true });
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('%')).toBeTruthy();
  });

  it('puts the cursor into the minimum when asked', () => {
    renderRow({ focus: true });
    expect(document.activeElement).toBe(minField());
  });

  it('takes the colour of its stat', () => {
    const { container } = renderRow({ tone: 'fire' });
    expect(container.querySelector('.p2t-condition')!.getAttribute('data-stat')).toBe('fire');
  });
});
