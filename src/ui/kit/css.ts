const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/**
 * Replaces relative `url(...)` references with SVG data URIs from `files` (keyed by the path as written in the CSS).
 * Inside the site page a relative url would resolve against pathofexile.com, so every one has to be bundled.
 */
export function inlineCssUrls(css: string, files: Record<string, string>): string {
  return css.replace(URL_RE, (match, _quote: string, path: string) => {
    if (/^(data:|https?:|#)/.test(path)) return match;
    const svg = files[path];
    if (svg == null) throw new Error(`No bundled file for CSS url: ${path}`);
    return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}")`;
  });
}
