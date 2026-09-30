import { describe, expect, it } from 'vitest';
import { inlineCssUrls } from './css';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path d="M0 0h4"/></svg>';

describe('inlineCssUrls', () => {
  it('replaces relative asset urls with SVG data URIs', () => {
    const css = ".a { --cap:url('../assets/frames/cap.svg'); } .b { background:url(\"../assets/frames/cap.svg\") no-repeat; }";
    const out = inlineCssUrls(css, { '../assets/frames/cap.svg': SVG });
    expect(out).not.toContain('../assets');
    expect(out.match(/url\("data:image\/svg\+xml,/g)).toHaveLength(2);
    expect(out).toContain('no-repeat');
  });

  it('encodes the SVG so quotes and # cannot break the declaration', () => {
    const out = inlineCssUrls("a{b:url('x.svg')}", { 'x.svg': '<svg fill="#fff"/>' });
    const uri = out.match(/url\("(.*)"\)/)?.[1] ?? '';
    expect(uri).not.toContain('"');
    expect(uri).not.toContain('#');
    expect(decodeURIComponent(uri.slice('data:image/svg+xml,'.length))).toBe('<svg fill="#fff"/>');
  });

  it('keeps urls that are already absolute or data URIs', () => {
    const css = 'a{b:url("data:image/png;base64,AA")} c{d:url(https://example.com/x.png)}';
    expect(inlineCssUrls(css, {})).toBe(css);
  });

  it('fails loudly on a relative url without a bundled file', () => {
    expect(() => inlineCssUrls("a{b:url('../assets/missing.svg')}", {})).toThrow(/missing\.svg/);
  });
});
