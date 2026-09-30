const LOCK_ATTRIBUTE = 'data-poe2-trade-locked';

/** Locks page scrolling while the overlay covers it; the attribute remembers the page's own inline overflow. */
export function setPageLocked(doc: Document, locked: boolean): void {
  const root = doc.documentElement;
  const isLocked = root.hasAttribute(LOCK_ATTRIBUTE);
  if (locked && !isLocked) {
    root.setAttribute(LOCK_ATTRIBUTE, root.style.overflow);
    root.style.overflow = 'hidden';
  } else if (!locked && isLocked) {
    root.style.overflow = root.getAttribute(LOCK_ATTRIBUTE) ?? '';
    root.removeAttribute(LOCK_ATTRIBUTE);
  }
}
