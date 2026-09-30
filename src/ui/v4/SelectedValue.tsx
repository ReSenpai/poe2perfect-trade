import { h } from 'preact';

/**
 * The value of a `<select>` in Chrome's customizable select: the browser copies the chosen option into
 * `<selectedcontent>`, and this button gives it a box that can cut a long value short under the chevron. Browsers
 * without it ignore the button and keep the native list.
 */
/** Whether the browser has the customizable select (Chrome); Firefox keeps the native list, options without pictures. */
export function supportsCustomSelect(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('appearance', 'base-select');
}

export function SelectedValue() {
  return h('button', { type: 'button', class: 'p2t-select__value' }, h('selectedcontent', null));
}
