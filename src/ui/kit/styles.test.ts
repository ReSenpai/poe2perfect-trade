import { describe, expect, it } from 'vitest';
import { V4_CSS } from './styles';

describe('V4_CSS', () => {
  it('bundles tokens, components and layout in order', () => {
    const tokens = V4_CSS.indexOf('--p2t-color-bg:');
    const components = V4_CSS.indexOf('.p2t .p2t-item');
    const layout = V4_CSS.indexOf('.p2t .p2t-workspace');
    expect(tokens).toBeGreaterThanOrEqual(0);
    expect(components).toBeGreaterThan(tokens);
    expect(layout).toBeGreaterThan(components);
  });

  it('has no relative urls left, so nothing is fetched from inside the site page', () => {
    const urls = [...V4_CSS.matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThanOrEqual(5);
    for (const url of urls) expect(url).toMatch(/^data:image\/svg\+xml,/);
  });
});
