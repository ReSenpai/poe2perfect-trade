import type { TradeQuery } from '@/lib/query/model';
import { isTradeSearchUrl } from '@/lib/trade-url';
import type { LoadResult } from './query-loader';

export type PageMode = 'extension' | 'original';

interface ActiveBase {
  active: true;
  mode: PageMode;
  url: string;
}

export type PageState =
  | { active: false; mode: PageMode }
  | (ActiveBase & { status: 'loading' })
  | (ActiveBase & { status: 'ready'; league: string; query: TradeQuery; /** The query as it came, for the v4 editor. */ raw?: unknown })
  | (ActiveBase & { status: 'error'; message: string });

export interface PageController {
  getState(): PageState;
  handleUrl(url: string): void;
  /** Loads the current search again after a failure. */
  retry(): void;
  setMode(mode: PageMode): void;
  subscribe(listener: (state: PageState) => void): () => void;
}

/**
 * Page state for the current URL: which search is open, whether it is loaded, and whether the extension or the
 * original site is in front. Results of superseded loads are dropped.
 */
export function createPageController({
  load,
  initialMode,
  onModeChange,
}: {
  load: (url: string) => Promise<LoadResult>;
  initialMode: PageMode;
  onModeChange?: (mode: PageMode) => void;
}): PageController {
  let state: PageState = { active: false, mode: initialMode };
  let loadId = 0;
  const listeners = new Set<(state: PageState) => void>();

  const set = (next: PageState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  const start = (url: string) => {
    const id = ++loadId;
    set({ active: true, mode: state.mode, url, status: 'loading' });
    void load(url)
      .catch((error: unknown): LoadResult => ({ ok: false, message: error instanceof Error ? error.message : String(error) }))
      .then((result) => {
        if (id !== loadId || !state.active) return;
        const base = { active: true as const, mode: state.mode, url };
        set(result.ok ? { ...base, status: 'ready', league: result.league, query: result.query, raw: result.raw } : { ...base, status: 'error', message: result.message });
      });
  };

  return {
    getState: () => state,

    handleUrl(url) {
      if (!isTradeSearchUrl(url)) {
        loadId++;
        if (state.active) set({ active: false, mode: state.mode });
        return;
      }
      if (state.active && state.url === url) return;
      start(url);
    },

    retry() {
      if (state.active && state.status === 'error') start(state.url);
    },

    setMode(mode) {
      if (mode === state.mode) return;
      set({ ...state, mode });
      onModeChange?.(mode);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function isOverlayVisible(state: PageState): boolean {
  return state.active && state.mode === 'extension';
}
