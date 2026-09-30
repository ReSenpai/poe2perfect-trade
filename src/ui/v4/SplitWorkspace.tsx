import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/** Filter pane share in percent; the layout also keeps it within 400–620 px and the results at 620 px or more. */
export const V4_FILTER_WIDTH_MIN = 30;
export const V4_FILTER_WIDTH_MAX = 55;
export const V4_FILTER_WIDTH_DEFAULT = 42;
const KEY_STEP = 2;

export function clampV4FilterWidth(width: unknown): number {
  if (typeof width !== 'number' || !Number.isFinite(width)) return V4_FILTER_WIDTH_DEFAULT;
  return Math.min(V4_FILTER_WIDTH_MAX, Math.max(V4_FILTER_WIDTH_MIN, width));
}

export interface SplitWorkspaceProps {
  width: number;
  collapsed: boolean;
  /** Called once the width is settled (a key press, a drop), not on every pointer move. */
  onWidthChange: (width: number) => void;
  /** The filter pane: a `.p2t-filter-pane` element. */
  filters: ComponentChildren;
  results: ComponentChildren;
}

/** Filters and results side by side with a divider that drags and takes arrow keys; the results alone when collapsed. */
export function SplitWorkspace({ width, collapsed, onWidthChange, filters, results }: SplitWorkspaceProps) {
  const [current, setCurrent] = useState(clampV4FilterWidth(width));
  const dragWidth = useRef<number | null>(null);
  const dragging = useRef(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => setCurrent(clampV4FilterWidth(width)), [width]);

  const commit = (next: number) => {
    const clamped = clampV4FilterWidth(next);
    setCurrent(clamped);
    onWidthChange(clamped);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const next = { ArrowLeft: current - KEY_STEP, ArrowRight: current + KEY_STEP, Home: V4_FILTER_WIDTH_MIN, End: V4_FILTER_WIDTH_MAX }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    commit(next);
  };

  const onPointerMove = (event: PointerEvent) => {
    const rect = container.current?.getBoundingClientRect();
    if (!dragging.current || !rect || rect.width <= 0) return;
    dragWidth.current = clampV4FilterWidth(Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10);
    setCurrent(dragWidth.current);
  };

  // The width saved is the one shown last: pointercancel carries no usable position.
  const onPointerEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragWidth.current !== null) commit(dragWidth.current);
    dragWidth.current = null;
  };

  return (
    <div class="p2t-workspace" ref={container} data-collapsed={collapsed ? 'true' : 'false'} style={{ '--filter-width': `${current}%` }}>
      {!collapsed && filters}
      {!collapsed && (
        <div
          class="p2t-splitter"
          role="separator"
          aria-label="Resize filters"
          aria-orientation="vertical"
          aria-valuenow={current}
          aria-valuemin={V4_FILTER_WIDTH_MIN}
          aria-valuemax={V4_FILTER_WIDTH_MAX}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            dragging.current = true;
            (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        />
      )}
      {results}
    </div>
  );
}
