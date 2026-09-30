import { h } from 'preact';
import { iconRegistry, type IconName } from './icon-registry';

type IconProps = { name: IconName; size?: number; title?: string; class?: string };
/** No title => decorative. Label icon-only buttons on the button itself. */
export function Icon({ name, size = 20, title, class: className }: IconProps) {
  return h('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
    stroke: 'currentColor', 'stroke-width': 1.7,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    focusable: 'false', class: className,
    role: title ? 'img' : undefined,
    'aria-label': title,
    'aria-hidden': title ? undefined : 'true',
  }, iconRegistry[name].map((node, key) => h(node.tag, { ...node.attrs, key })));
}
