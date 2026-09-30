import { afterEach, describe, expect, it } from 'vitest';
import { applySiteFrames, itemFramesCss, probeItemFrames, probeSockets, socketsCss, type ItemFrames } from './item-frames';

const SITE_CSS = `
.poe2Popup.rarePopup .itemHeader { background-image: url("https://web.poecdn.com/protected/image/item/popup/header-rare-left.png?v=1&key=a"), url("https://web.poecdn.com/protected/image/item/popup/header-rare-right.png?v=1&key=b"), url("https://web.poecdn.com/protected/image/item/popup/header-rare-middle.png?v=1&key=c"); background-position: 0% 0%, 100% 0%, 50% 0%; background-repeat: no-repeat, no-repeat, repeat-x; }
.poe2Popup.rarePopup .itemHeader.doubleLine { background-image: url("https://web.poecdn.com/protected/image/item/popup/header-double-rare-left.png?v=1&key=d"); }
.poe2Popup.rarePopup .separator { background-image: url("https://web.poecdn.com/protected/image/item/popup/separator-rare.png?v=1&key=e"); }
.poe2Popup.rarePopup .itemName { color: rgb(255, 255, 119); }
`;

function withSiteCss(css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('probeItemFrames', () => {
  it('reads the frame images the site CSS gives its cards, per kind and line count', () => {
    withSiteCss(SITE_CSS);
    const frames = probeItemFrames(document, ['rare', 'gem'])!;
    expect(frames.rare!.header.image).toContain('header-rare-left.png');
    expect(frames.rare!.header.image).toContain('header-rare-middle.png');
    expect(frames.rare!.headerDouble.image).toContain('header-double-rare-left.png');
    expect(frames.rare!.separator.image).toContain('separator-rare.png');
    expect(frames.rare!.nameColor).toBe('rgb(255, 255, 119)');
    expect(frames.gem).toBeUndefined(); // no card in the site CSS: left to the fallback
    expect(document.body.children).toHaveLength(0); // the probe is removed
  });

  it('gives null when the site CSS has no cards (not loaded, classes renamed)', () => {
    expect(probeItemFrames(document, ['rare'])).toBeNull();
  });

  it('ignores images from other hosts', () => {
    withSiteCss(SITE_CSS.replaceAll('https://web.poecdn.com', 'https://evil.example'));
    expect(probeItemFrames(document, ['rare'])).toBeNull();
  });
});

describe('itemFramesCss', () => {
  const layers = (image: string) => ({ image, position: '0% 0%', repeat: 'no-repeat', size: 'auto' });
  const FRAMES: ItemFrames = {
    normal: { header: layers('url("https://web.poecdn.com/n.png")'), headerDouble: layers('url("https://web.poecdn.com/n2.png")'), separator: layers('url("https://web.poecdn.com/ns.png")'), nameColor: 'rgb(200, 200, 200)' },
    rare: { header: layers('url("https://web.poecdn.com/r.png")'), headerDouble: layers('url("https://web.poecdn.com/r2.png")'), separator: layers('url("https://web.poecdn.com/rs.png")'), nameColor: 'rgb(255, 255, 119)' },
  };

  it('styles each kind of card by data-frame, with the normal card as the default', () => {
    const css = itemFramesCss(FRAMES);
    expect(css).toContain(':host(.p2t-site-frames) .p2t-item .p2t-item__header');
    expect(css).toContain(':host(.p2t-site-frames) .p2t-item[data-frame="rare"] .p2t-item__header');
    expect(css).toContain(':host(.p2t-site-frames) .p2t-item[data-frame="rare"] .p2t-item__header[data-lines="2"]');
    expect(css).toContain(':host(.p2t-site-frames) .p2t-item[data-frame="rare"] .p2t-item__divider');
    expect(css).toContain('r2.png');
    expect(css).toContain('color:rgb(255, 255, 119)');
  });

  it('drops values that could break out of the rule', () => {
    const css = itemFramesCss({ rare: { ...FRAMES.rare!, nameColor: 'red} body{display:none' } });
    expect(css).not.toContain('display:none');
  });
});

describe('applySiteFrames', () => {
  function shadowHost() {
    const host = document.createElement('poe2perfect-trade');
    document.body.appendChild(host);
    return { host, root: host.attachShadow({ mode: 'open' }) };
  }

  it('styles the shadow root with the site frames and marks the host', () => {
    withSiteCss(SITE_CSS);
    const { host, root } = shadowHost();
    expect(applySiteFrames(document, host, root)).toBe(true);
    expect(host.classList.contains('p2t-site-frames')).toBe(true);
    const styles = root.querySelectorAll('style[data-p2t="site-frames"]');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toContain('[data-frame="rare"]');

    applySiteFrames(document, host, root); // again: replaced, not added
    expect(root.querySelectorAll('style[data-p2t="site-frames"]')).toHaveLength(1);
  });

  it('leaves the kit frames in place when the site has none', () => {
    const { host, root } = shadowHost();
    expect(applySiteFrames(document, host, root)).toBe(false);
    expect(host.classList.contains('p2t-site-frames')).toBe(false);
    expect(root.querySelector('style')).toBeNull();
  });
});

describe('site sockets', () => {
  const SOCKETS_CSS = `.newItemContainer .socket { background-image: url("https://web.poecdn.com/protected/image/trade/layout/socket2.png?key=a"); background-size: 35px auto; }
.newItemContainer .socket.socket--rune { background-position: 0px -140px; }`;

  it('reads the empty socket picture per socket type from the site CSS', () => {
    withSiteCss(SOCKETS_CSS);
    const sockets = probeSockets(document, ['rune'])!;
    expect(sockets.rune!.image).toContain('socket2.png');
    expect(sockets.rune!.position).toBe('0px -140px');
    expect(document.body.children).toHaveLength(0);
  });

  it('gives null without the site CSS, and styles sockets by type', () => {
    expect(probeSockets(document, ['rune'])).toBeNull();
    const css = socketsCss({ rune: { image: 'url("https://web.poecdn.com/s.png")', position: '0px -140px', repeat: 'no-repeat', size: '35px auto' } });
    expect(css).toContain(':host(.p2t-site-frames) .p2t-socket[data-type="rune"]{background-image:url("https://web.poecdn.com/s.png");background-position:0px -140px;');
  });
});
