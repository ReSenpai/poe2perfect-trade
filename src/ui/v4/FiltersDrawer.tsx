import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export interface FiltersDrawerProps {
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * The filters on a narrow window (v4 §6): a panel over the listings, modal — focus stays inside, the page behind is
 * inert. Esc, the backdrop or Close filters close it; the draft stays as it is.
 */
export function FiltersDrawer({ onClose, children }: FiltersDrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const box = dialog.current;
    if (!box || box.open) return;
    if (typeof box.showModal === 'function') box.showModal();
    else box.setAttribute('open', '');
  }, []);
  return (
    <dialog
      ref={dialog}
      class="p2t-drawer"
      aria-label="Filters"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
