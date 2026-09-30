import { describe, expect, it, vi } from 'vitest';
import { pageFetch } from './page-fetch';

describe('pageFetch', () => {
  it("asks as the page in Firefox: the content script's content.fetch, bound to the page", async () => {
    const page = { fetch: vi.fn(async () => new Response('page')) };
    const own = vi.fn(async () => new Response('extension'));
    const fetchFn = pageFetch({ content: page, fetch: own });
    const response = await fetchFn('/api/trade2/data/stats', { credentials: 'same-origin' });
    expect(await response.text()).toBe('page');
    expect(page.fetch).toHaveBeenCalledWith('/api/trade2/data/stats', { credentials: 'same-origin' });
    expect(page.fetch.mock.contexts[0]).toBe(page);
    expect(own).not.toHaveBeenCalled();
  });

  it('uses the ordinary fetch in Chrome, where it is already the page', async () => {
    const own = vi.fn(async () => new Response('chrome'));
    const scope = { fetch: own };
    const response = await pageFetch(scope)('/x');
    expect(await response.text()).toBe('chrome');
    expect(own.mock.contexts[0]).toBe(scope);
  });
});
