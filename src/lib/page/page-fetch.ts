/** What pageFetch reads of the content script's globals. */
export interface FetchScope {
  fetch: typeof fetch;
  /** Firefox only: the page's window, whose fetch runs as the page (its origin, its cookies). */
  content?: { fetch: typeof fetch };
}

/**
 * The fetch that asks the trade site as the page itself. In Chrome the content script's fetch already is; in Firefox it
 * runs as the extension (another Origin, which the site may refuse), and `content.fetch` is the page's own.
 */
export function pageFetch(scope: FetchScope = globalThis as unknown as FetchScope): typeof fetch {
  const page = scope.content;
  if (page && typeof page.fetch === 'function') return page.fetch.bind(page);
  return scope.fetch.bind(scope);
}
