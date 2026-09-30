import { createTradeClient } from '@/lib/api/client';
import { buildWorkspaceData, type ItemsCatalog, type LeaguesCatalog, type StaticCatalog } from '@/lib/catalog/workspace-data';
import type { BaseStatsData } from '@/lib/gamedata/base-stats';
import { listenForCapture } from '@/lib/dev/capture-messaging';
import { captureListingsFixture } from '@/lib/dev/fixture';
import { createPageController, isOverlayVisible } from '@/lib/page/controller';
import { createOriginalSync } from '@/lib/page/original-sync';
import { setPageLocked } from '@/lib/page/page-lock';
import { forgetLegacyPreferences, pageModeItem, resultsSnapshotsItem, savedSearchesItem, v4DraftItem, v4PrefsItem } from '@/lib/page/preferences';
import { createQueryLoader } from '@/lib/page/query-loader';
import { createStorageCache } from '@/lib/page/storage-cache';
import { pageFetch } from '@/lib/page/page-fetch';
import type { FiltersCatalog, StatsCatalog } from '@/lib/query/labels';
import { applySiteFrames } from '@/lib/site/item-frames';
import { readTradeOpts } from '@/lib/site/trade-opts';
import { buildSearchPath, isTradeSearchUrl } from '@/lib/trade-url';
import { mountApp } from '@/ui/app/mount';
import { clampV4FilterWidth } from '@/ui/v4/SplitWorkspace';
import { readSavedSearches } from '@/lib/saved/saved-searches';
import { followSearch } from '@/lib/page/search-history';
import { readRememberedDraft } from '@/lib/saved/draft-memory';
import { encodeQueryParam } from '@/lib/query/codec';
import { setAssetUrl } from '@/lib/catalog/category-art';
import type { PublicPath } from 'wxt/browser';

const MARKER_ATTRIBUTE = 'data-poe2-trade';

/**
 * Game data for adaptive filters (docs/ARCHITECTURE.md, "Game data"): an extension file rather than part of this script, so
 * trade pages do not parse it on every load. Without it the filters simply do not adapt to the item.
 */
async function loadBaseStats(): Promise<BaseStatsData | undefined> {
  try {
    const response = await fetch(browser.runtime.getURL('/data/base-stats.json'));
    return response.ok ? ((await response.json()) as BaseStatsData) : undefined;
  } catch {
    return undefined;
  }
}

/** Requests to the trade site go as the page (Firefox: content.fetch), never as the extension. */
const sitePageFetch = pageFetch();

async function fetchHtml(url: string): Promise<string> {
  const response = await sitePageFetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export default defineContentScript({
  // The whole trade2 app: it is an SPA, so a search page can be reached without a full page load.
  matches: ['https://www.pathofexile.com/trade2/*', 'https://pathofexile.com/trade2/*'],
  runAt: 'document_idle',
  async main(ctx) {
    // Category pictures are extension files (public/category): addressed through the extension, loaded when shown.
    setAssetUrl((path) => browser.runtime.getURL(`/${path}` as PublicPath));
    const client = createTradeClient({ fetchFn: sitePageFetch, cache: createStorageCache(browser.storage.local) });
    const loadData = async () => {
      const [stats, filters, leagues, statics, items, baseStats] = await Promise.all([
        client.getCatalog<StatsCatalog>('stats'),
        client.getCatalog<FiltersCatalog>('filters'),
        client.getCatalog<LeaguesCatalog>('leagues'),
        client.getCatalog<StaticCatalog>('static'),
        client.getCatalog<ItemsCatalog>('items'),
        loadBaseStats(),
      ]);
      return buildWorkspaceData({ stats, filters, leagues, static: statics, items, baseStats });
    };

    // The legacy workspace and the dev switch are gone: what they stored goes too (step 32).
    void forgetLegacyPreferences();
    const originalSync = createOriginalSync(() => location.reload());
    const controller = createPageController({
      load: createQueryLoader({ initialUrl: location.href, initialDocument: document, fetchHtml }),
      initialMode: await pageModeItem.getValue(),
      // The mode is stored before a reload, so the reloaded page opens as the original.
      onModeChange: (mode) => void pageModeItem.setValue(mode).then(() => originalSync.onModeChange(mode)),
    });
    controller.subscribe((state) => {
      setPageLocked(document, isOverlayVisible(state));
      document.documentElement.setAttribute(MARKER_ATTRIBUTE, state.active ? 'search' : 'idle');
    });
    ctx.onInvalidated(() => {
      setPageLocked(document, false);
      document.documentElement.removeAttribute(MARKER_ATTRIBUTE);
    });
    document.documentElement.setAttribute(MARKER_ATTRIBUTE, 'idle');

    let mounting: Promise<unknown> | null = null;
    let framesTried = false;
    // The site's item cards (step 24a): its CSS may arrive after us, so a few later tries.
    const useSiteFrames = (host: HTMLElement) => {
      const root = host.shadowRoot;
      if (!root) return;
      const delays = [0, 1500, 5000, 15000];
      const attempt = () => {
        if (applySiteFrames(document, host, root)) return;
        const delay = delays.shift();
        if (delay !== undefined) ctx.setTimeout(attempt, delay);
      };
      attempt();
    };
    const handleUrl = async (url: string) => {
      if (isTradeSearchUrl(url)) {
        mounting ??= Promise.all([resultsSnapshotsItem.getValue(), v4PrefsItem.getValue(), savedSearchesItem.getValue(), v4DraftItem.getValue()]).then(
          ([snapshots, prefs, saved, draft]) =>
            mountApp(ctx, {
              controller,
              client,
              loadData,
              initialSnapshots: Array.isArray(snapshots) ? snapshots : [],
              onSnapshotsChange: (next) => void resultsSnapshotsItem.setValue(next),
              initialPrefs: { filterWidth: clampV4FilterWidth(prefs?.filterWidth), filtersCollapsed: prefs?.filtersCollapsed === true },
              onPrefsChange: (next) => void v4PrefsItem.setValue(next),
              initialSavedSearches: readSavedSearches(saved),
              onSavedSearchesChange: (next) => void savedSearchesItem.setValue(next),
              initialDraftMemory: readRememberedDraft(draft),
              onDraftMemoryChange: (next) => void (next ? v4DraftItem.setValue(next) : v4DraftItem.removeValue()),
              onOpenInOriginal: ({ league, query }) =>
                void encodeQueryParam(query).then((encoded) => {
                  // The draft goes into the address, and the original page opens it (reloaded, as the site reads it).
                  history.pushState(history.state, '', buildSearchPath(league, encoded));
                  originalSync.markWritten();
                  controller.setMode('original');
                }),
              onSearched: (league, id) => {
                // The address follows the search, as on the site, one history entry per search: reloads and shared
                // links open it again, Back and Forward walk the searches.
                if (!followSearch(history, location.pathname, league, id)) return;
                originalSync.markWritten();
                void handleUrl(location.href);
              },
            }),
        );
        const host = (await mounting) as HTMLElement;
        if (!framesTried) {
          framesTried = true;
          useSiteFrames(host);
        }
      }
      controller.handleUrl(url);
    };
    ctx.addEventListener(window, 'wxt:locationchange', (event) => void handleUrl(event.newUrl.href));
    await handleUrl(location.href);

    if (import.meta.env.DEV) {
      // The server renders the decoded query of the current URL into tradeOpts, so after SPA navigation the page is
      // fetched again rather than read from the stale document.
      const capture = async () => {
        const opts = readTradeOpts(await fetchHtml(location.href));
        if (!opts.ok) return { ok: false as const, message: `Could not read tradeOpts (${opts.error})` };
        return captureListingsFixture({ league: opts.opts.league, query: opts.opts.state, client });
      };
      ctx.onInvalidated(listenForCapture(browser.runtime.onMessage as never, capture));
    }
  },
});
