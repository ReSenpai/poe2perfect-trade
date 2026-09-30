import { describe, expect, it, vi } from 'vitest';
import { normalizeQuery } from '@/lib/query/normalize';
import { createPageController, isOverlayVisible, type PageState } from './controller';
import type { LoadResult } from './query-loader';

const ORIGIN = 'https://www.pathofexile.com';
const SEARCH_A = `${ORIGIN}/trade2/search/poe2/Standard/H4sIa`;
const SEARCH_B = `${ORIGIN}/trade2/search/poe2/Standard/H4sIb`;
const QUERY = normalizeQuery({ status: 'online' });

function deferred() {
  let resolve!: (result: LoadResult) => void;
  const promise = new Promise<LoadResult>((done) => (resolve = done));
  return { promise, resolve };
}

function setup(load: (url: string) => Promise<LoadResult> = async () => ({ ok: true, league: 'Standard', query: QUERY })) {
  const onModeChange = vi.fn();
  const controller = createPageController({ load: vi.fn(load), initialMode: 'extension', onModeChange });
  const states: PageState[] = [];
  controller.subscribe((state) => states.push(state));
  return { controller, onModeChange, states };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createPageController', () => {
  it('is inactive until a search page is opened', () => {
    const { controller } = setup();
    expect(controller.getState()).toEqual({ active: false, mode: 'extension' });
    controller.handleUrl(`${ORIGIN}/trade2/exchange/poe2/Standard`);
    expect(controller.getState()).toEqual({ active: false, mode: 'extension' });
  });

  it('loads the search of the URL and becomes ready', async () => {
    const { controller, states } = setup();
    controller.handleUrl(SEARCH_A);
    expect(controller.getState()).toEqual({ active: true, mode: 'extension', url: SEARCH_A, status: 'loading' });

    await flush();
    expect(controller.getState()).toEqual({ active: true, mode: 'extension', url: SEARCH_A, status: 'ready', league: 'Standard', query: QUERY });
    expect(states.map((state) => (state.active ? state.status : 'inactive'))).toEqual(['loading', 'ready']);
  });

  it('shows a load failure and retries it', async () => {
    let fail = true;
    const { controller } = setup(async () => (fail ? { ok: false, message: 'broken' } : { ok: true, league: 'Standard', query: QUERY }));
    controller.handleUrl(SEARCH_A);
    await flush();
    expect(controller.getState()).toMatchObject({ status: 'error', message: 'broken' });

    fail = false;
    controller.retry();
    await flush();
    expect(controller.getState()).toMatchObject({ status: 'ready' });
  });

  it('turns a thrown loader error into a failure', async () => {
    const { controller } = setup(async () => {
      throw new Error('boom');
    });
    controller.handleUrl(SEARCH_A);
    await flush();
    expect(controller.getState()).toMatchObject({ status: 'error', message: 'boom' });
  });

  it('drops the result of a superseded load', async () => {
    const first = deferred();
    const second = deferred();
    const { controller } = setup((url) => (url === SEARCH_A ? first.promise : second.promise));

    controller.handleUrl(SEARCH_A);
    controller.handleUrl(SEARCH_B);
    second.resolve({ ok: true, league: 'Standard', query: QUERY });
    await flush();
    first.resolve({ ok: false, message: 'stale' });
    await flush();

    expect(controller.getState()).toMatchObject({ url: SEARCH_B, status: 'ready' });
  });

  it('does not reload the same URL', async () => {
    const load = vi.fn(async () => ({ ok: true as const, league: 'Standard', query: QUERY }));
    const controller = createPageController({ load, initialMode: 'extension' });
    controller.handleUrl(SEARCH_A);
    await flush();
    controller.handleUrl(SEARCH_A);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('goes inactive when the page leaves search, ignoring a load still running', async () => {
    const pending = deferred();
    const { controller } = setup(() => pending.promise);
    controller.handleUrl(SEARCH_A);
    controller.handleUrl(`${ORIGIN}/trade2/exchange/poe2/Standard`);
    pending.resolve({ ok: true, league: 'Standard', query: QUERY });
    await flush();
    expect(controller.getState()).toEqual({ active: false, mode: 'extension' });
  });

  it('switches between the extension and the original page and reports the choice', async () => {
    const { controller, onModeChange } = setup();
    controller.handleUrl(SEARCH_A);
    await flush();

    controller.setMode('original');
    expect(controller.getState()).toMatchObject({ mode: 'original', status: 'ready' });
    expect(isOverlayVisible(controller.getState())).toBe(false);
    expect(onModeChange).toHaveBeenCalledWith('original');

    controller.setMode('original');
    expect(onModeChange).toHaveBeenCalledTimes(1);
    controller.setMode('extension');
    expect(isOverlayVisible(controller.getState())).toBe(true);
  });
});
