import type { ItemFrame } from '@/lib/listing/presentation';

/**
 * The trade site's own item cards (step 24a): header and separator images per kind of card. They live on
 * the CDN behind signed URLs, so nothing is copied or hard-coded: a hidden probe with the site's classes is laid out
 * in the page, and the backgrounds the site CSS gives it are read back and restyled into the extension's shadow root.
 */

export interface FrameLayers {
  image: string;
  position: string;
  repeat: string;
  size: string;
}

export interface ItemFrameStyle {
  header: FrameLayers;
  headerDouble: FrameLayers;
  separator: FrameLayers;
  nameColor: string;
}

export type ItemFrames = Partial<Record<ItemFrame, ItemFrameStyle>>;

export const ITEM_FRAMES: ItemFrame[] = ['normal', 'magic', 'rare', 'unique', 'gem', 'currency', 'quest', 'prophecy', 'relic', 'supporterFoil', 'necropolis', 'breachGem'];

/** Where the site's card images come from; anything else is not taken over. */
const ALLOWED = /^https:\/\/(web\.poecdn\.com|www\.pathofexile\.com)\//;

/** A tree of divs by class, text in the leaves: the site's card markup for a probe. */
type Markup = [className: string, content?: Markup[] | string];

/** Builds markup as elements (no innerHTML: nothing is parsed as HTML). */
function build(doc: Document, [className, content]: Markup): HTMLElement {
  const element = doc.createElement('div');
  element.className = className;
  if (typeof content === 'string') element.textContent = content;
  else for (const child of content ?? []) element.appendChild(build(doc, child));
  return element;
}

/** The frames the site CSS gives each kind of card, or null when it gives none (not loaded, classes renamed). */
export function probeItemFrames(doc: Document, kinds: readonly ItemFrame[] = ITEM_FRAMES): ItemFrames | null {
  const view = doc.defaultView;
  if (!view) return null;
  const probe = doc.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:-10000px;top:0;width:400px;visibility:hidden;pointer-events:none';
  doc.body.appendChild(probe);

  const frames: ItemFrames = {};
  try {
    for (const kind of kinds) {
      probe.replaceChildren(
        build(doc, [
          `itemPopupContainer newItemPopup poe2Popup ${kind}Popup`,
          [['itemHeader', [['itemName', 'x']]], ['itemHeader doubleLine', [['itemName', 'x'], ['itemName typeLine', 'x']]], ['separator']],
        ]),
      );
      const [single, double] = [...probe.querySelectorAll('.itemHeader')];
      const layers = (element: Element): FrameLayers | null => {
        const style = view.getComputedStyle(element);
        return imageOk(style.backgroundImage) ? { image: style.backgroundImage, position: style.backgroundPosition, repeat: style.backgroundRepeat, size: style.backgroundSize } : null;
      };
      const header = layers(single!);
      if (!header) continue;
      frames[kind] = {
        header,
        headerDouble: layers(double!) ?? header,
        separator: layers(probe.querySelector('.separator')!) ?? { image: 'none', position: '', repeat: '', size: '' },
        nameColor: view.getComputedStyle(probe.querySelector('.itemName')!).color,
      };
    }
  } finally {
    probe.remove();
  }
  return Object.keys(frames).length > 0 ? frames : null;
}

/** CSS for the shadow root: cards by `data-frame`, the normal card as the default. Active under `:host(.p2t-site-frames)`. */
export function itemFramesCss(frames: ItemFrames): string {
  const scope = ':host(.p2t-site-frames) .p2t-item';
  const rules: string[] = [];
  const add = (selector: string, style: ItemFrameStyle, withColor: boolean) => {
    rules.push(`${selector} .p2t-item__header{${background(style.header)}${withColor && colorOk(style.nameColor) ? `color:${style.nameColor};` : ''}}`);
    rules.push(`${selector} .p2t-item__header[data-lines="2"]{${background(style.headerDouble)}}`);
    if (style.separator.image !== 'none') rules.push(`${selector} .p2t-item__divider{${background(style.separator)}}`);
  };
  if (frames.normal) add(scope, frames.normal, false);
  for (const kind of ITEM_FRAMES) {
    const style = frames[kind];
    if (style) add(`${scope}[data-frame="${kind}"]`, style, true);
  }
  return rules.join('\n');
}

function background(layers: FrameLayers): string {
  if (!imageOk(layers.image)) return '';
  const safe = (value: string) => (value && !/[{}<;]/.test(value) ? value : undefined);
  return [
    `background-image:${layers.image};`,
    safe(layers.position) ? `background-position:${layers.position};` : '',
    safe(layers.repeat) ? `background-repeat:${layers.repeat};` : '',
    safe(layers.size) ? `background-size:${layers.size};` : '',
  ].join('');
}

function imageOk(image: string | undefined): image is string {
  if (!image || image === 'none' || /[{}<;]/.test(image)) return false;
  const urls = [...image.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]!);
  return urls.length > 0 && urls.every((url) => ALLOWED.test(url));
}

function colorOk(color: string): boolean {
  return /^rgba?\([\d.,\s%]+\)$/.test(color);
}

/** Socket types the trade API gives (`item.sockets[].type`). */
export const SOCKET_TYPES = ['rune', 'jewel', 'gem', 'soulcore'];

/** The empty socket picture the site CSS gives each socket type (a sprite), or null when it gives none. */
export function probeSockets(doc: Document, types: readonly string[] = SOCKET_TYPES): Partial<Record<string, FrameLayers>> | null {
  const view = doc.defaultView;
  if (!view) return null;
  const probe = doc.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none';
  probe.appendChild(build(doc, ['newItemContainer itemRendered poe2', [['iconContainer', [['icon', [['sockets']]]]]]]));
  doc.body.appendChild(probe);
  const sockets: Partial<Record<string, FrameLayers>> = {};
  try {
    const box = probe.querySelector('.sockets')!;
    for (const type of types) {
      const socket = doc.createElement('div');
      socket.className = `socket socket--${type}`;
      box.appendChild(socket);
      const style = view.getComputedStyle(socket);
      if (imageOk(style.backgroundImage)) sockets[type] = { image: style.backgroundImage, position: style.backgroundPosition, repeat: style.backgroundRepeat, size: style.backgroundSize };
    }
  } finally {
    probe.remove();
  }
  return Object.keys(sockets).length > 0 ? sockets : null;
}

/** CSS for the shadow root: empty sockets by `data-type`. Active under `:host(.p2t-site-frames)`. */
export function socketsCss(sockets: Partial<Record<string, FrameLayers>>): string {
  return Object.entries(sockets)
    .filter((entry): entry is [string, FrameLayers] => entry[1] !== undefined && /^[a-z]+$/.test(entry[0]))
    .map(([type, layers]) => `:host(.p2t-site-frames) .p2t-socket[data-type="${type}"]{${background(layers)}}`)
    .join('\n');
}

/**
 * Probes the site frames and, when there are any, puts them into the shadow root and marks the host with
 * `p2t-site-frames`; otherwise the kit frames stay. Calling it again replaces the style (the site CSS may load late).
 */
export function applySiteFrames(doc: Document, host: Element, root: ShadowRoot): boolean {
  const frames = probeItemFrames(doc);
  if (!frames) return false;
  let style = root.querySelector<HTMLStyleElement>('style[data-p2t="site-frames"]');
  if (!style) {
    style = doc.createElement('style');
    style.setAttribute('data-p2t', 'site-frames');
    root.appendChild(style);
  }
  const sockets = probeSockets(doc);
  style.textContent = [itemFramesCss(frames), sockets ? socketsCss(sockets) : ''].join('\n');
  host.classList.add('p2t-site-frames');
  return true;
}
