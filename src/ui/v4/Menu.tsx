import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Icon } from '@/ui/kit/Icon';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** The current choice (a mode): marked with a check. */
  checked?: boolean;
  /** It removes what the menu belongs to: focus then goes on to the next card. */
  removes?: boolean;
}

/** Height of an item (CSS min-height 32 px and a little): enough to tell whether the list fits below. */
const ITEM_HEIGHT = 34;

export interface MenuProps {
  /** Accessible name of the button: "Mode of Life", "Actions for Chaos Resistance". */
  label: string;
  /** What the button shows. */
  children: ComponentChildren;
  items: MenuItem[];
  class?: string;
  /** Tone of the button (`data-tone`): an exclusion is marked. */
  tone?: string;
}

/**
 * A menu button (step 39): the list opens under it, the first item focused; arrows move, Enter picks, Esc / Tab / a click
 * outside close it and focus goes back to the button. It opens to the left of the button, over the name and slider rather
 * than the value field.
 */
export function Menu({ label, children, items, class: className, tone }: MenuProps) {
  const [open, setOpen] = useState(false);
  // Below the button unless its panel (or the window) has no room there: then above.
  const [placement, setPlacement] = useState<'down' | 'up'>('down');
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  const entries = () => [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // The list is in view next to its button: focusing it must not scroll the panel under the pointer.
    entries()[0]?.focus({ preventScroll: true });
    // A click anywhere else closes it; composedPath sees through the shadow root.
    const outside = (event: MouseEvent) => {
      const path = event.composedPath();
      if (!path.includes(list.current!) && !path.includes(button.current!)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent) => {
    const all = entries();
    const at = all.indexOf(event.target as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      all[(at + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  return (
    <span class={`p2t-menu ${className ?? ''}`.trim()}>
      <button
        ref={button}
        type="button"
        class="p2t-menu__button"
        data-tone={tone}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => {
          if (!open) {
            const own = button.current!.getBoundingClientRect();
            const panel = button.current!.closest('.p2t-filter-scroll, dialog')?.getBoundingClientRect();
            const bottom = panel ? panel.bottom : window.innerHeight;
            setPlacement(bottom - own.bottom < items.length * ITEM_HEIGHT + 12 ? 'up' : 'down');
          }
          setOpen(!open);
        }}
      >
        {children}
      </button>
      {open && (
        <div ref={list} id={`${id}-menu`} class="p2t-menu__list" data-placement={placement} role="menu" aria-label={label} onKeyDown={onKeyDown}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              class="p2t-menu__item"
              data-checked={item.checked ? 'true' : undefined}
              data-removes={item.removes ? 'true' : undefined}
              // A press keeps focus and layout still, so the click lands on the item it started on.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
            >
              <span class="p2t-menu__check" aria-hidden="true">
                {item.checked && <Icon name="check" size={14} />}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
