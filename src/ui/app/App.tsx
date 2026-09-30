import { LogOut } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TradeClient } from '@/lib/api/client';
import type { WorkspaceData } from '@/lib/catalog/workspace-data';
import type { PageController, PageMode, PageState } from '@/lib/page/controller';
import type { ResultsSnapshot } from '@/lib/results/snapshots';
import type { RememberedDraft } from '@/lib/saved/draft-memory';
import type { SavedSearch } from '@/lib/saved/saved-searches';
import { type V4Prefs, V4Workspace } from '@/ui/v4/V4Workspace';

const BRAND = 'poe2perfect trade';

export type DataState = { status: 'loading' } | { status: 'ready'; data: WorkspaceData } | { status: 'error'; message: string };

/** `whisper` (Travel to hideout, Direct whisper) only where the real client is. */
type SearchClient = Pick<TradeClient, 'search' | 'fetchListings'> & Partial<Pick<TradeClient, 'whisper'>>;

export interface AppProps {
  state: PageState;
  data: DataState;
  client: SearchClient;
  onModeChange: (mode: PageMode) => void;
  onRetry: () => void;
  snapshots: ResultsSnapshot[];
  onSnapshotsChange: (snapshots: ResultsSnapshot[]) => void;
  /** A search finished in `league`: `id` (the encoded query) belongs in the page URL. */
  onSearched: (league: string, id: string) => void;
  prefs: V4Prefs;
  onPrefsChange: (prefs: V4Prefs) => void;
  savedSearches: SavedSearch[];
  onSavedSearchesChange: (searches: SavedSearch[]) => void;
  draftMemory: RememberedDraft | null;
  onDraftMemoryChange: (memory: RememberedDraft | null) => void;
  /** The original site with a draft in its address. */
  onOpenInOriginal: (draft: { league: string; query: unknown }) => void;
}

/** The extension over the site's search page: the workspace once the search and reference data are there. */
export function App(props: AppProps) {
  const { state, data, client, onModeChange, onRetry } = props;
  if (!state.active) return null;

  if (state.mode === 'original') {
    return (
      <button type="button" class="launcher" onClick={() => onModeChange('extension')}>
        Open {BRAND}
      </button>
    );
  }

  if (state.status === 'ready' && data.status === 'ready') {
    return (
      <div class="overlay" role="dialog" aria-label={BRAND}>
        <V4Workspace
          league={state.league}
          query={state.raw ?? state.query}
          data={data.data}
          client={client}
          snapshots={props.snapshots}
          onSnapshotsChange={props.onSnapshotsChange}
          prefs={props.prefs}
          onPrefsChange={props.onPrefsChange}
          onApplied={props.onSearched}
          savedSearches={props.savedSearches}
          onSavedSearchesChange={props.onSavedSearchesChange}
          draftMemory={props.draftMemory}
          onDraftMemoryChange={props.onDraftMemoryChange}
          onShowOriginal={(draft) => (draft ? props.onOpenInOriginal(draft) : onModeChange('original'))}
        />
      </div>
    );
  }

  // Loading or a failure: a plain cover with the way back to the site.
  return (
    <div class="overlay" role="dialog" aria-label={BRAND}>
      <header class="app-header">
        <span class="app-header__brand">{BRAND}</span>
        <button type="button" class="icon-button app-header__original" aria-label="Show original page" title="Show original page" onClick={() => onModeChange('original')}>
          <LogOut size={16} aria-hidden="true" />
        </button>
      </header>
      <main class="overlay__body">
        {state.status === 'error' ? (
          <div class="notice" role="alert">
            <p class="notice__title">Couldn't open this search</p>
            <p class="notice__text">{state.message}</p>
            <div class="notice__actions">
              <button type="button" class="button button--accent" onClick={onRetry}>
                Try again
              </button>
              <button type="button" class="button" onClick={() => onModeChange('original')}>
                Open original page
              </button>
            </div>
          </div>
        ) : data.status === 'error' && state.status === 'ready' ? (
          <div class="notice" role="alert">
            <p class="notice__title">Couldn't load the trade site's filter list: {data.message}</p>
            <div class="notice__actions">
              <button type="button" class="button" onClick={() => onModeChange('original')}>
                Open original page
              </button>
            </div>
          </div>
        ) : (
          <p class="overlay__status" role="status">
            <span class="spinner" aria-hidden="true" />
            {state.status === 'loading' ? 'Loading search…' : 'Loading filters…'}
          </p>
        )}
      </main>
    </div>
  );
}

export interface ConnectedAppProps {
  controller: PageController;
  client: SearchClient;
  /** Reference data for the workspace; requested once, when a search is first shown. */
  loadData: () => Promise<WorkspaceData>;
  initialSnapshots: ResultsSnapshot[];
  onSnapshotsChange: (snapshots: ResultsSnapshot[]) => void;
  onSearched: (league: string, id: string) => void;
  initialPrefs: V4Prefs;
  onPrefsChange: (prefs: V4Prefs) => void;
  initialSavedSearches: SavedSearch[];
  onSavedSearchesChange: (searches: SavedSearch[]) => void;
  initialDraftMemory: RememberedDraft | null;
  onDraftMemoryChange: (memory: RememberedDraft | null) => void;
  onOpenInOriginal: (draft: { league: string; query: unknown }) => void;
}

export function ConnectedApp({
  controller,
  client,
  loadData,
  initialSnapshots,
  onSnapshotsChange,
  onSearched,
  initialPrefs,
  onPrefsChange,
  initialSavedSearches,
  onSavedSearchesChange,
  initialDraftMemory,
  onDraftMemoryChange,
  onOpenInOriginal,
}: ConnectedAppProps) {
  const [state, setState] = useState(controller.getState());
  const [data, setData] = useState<DataState>({ status: 'loading' });
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [savedSearches, setSavedSearches] = useState(initialSavedSearches);
  const dataRequested = useRef(false);
  const lastReady = useRef<Extract<PageState, { status: 'ready' }> | null>(null);

  useEffect(() => {
    setState(controller.getState());
    return controller.subscribe(setState);
  }, [controller]);

  // While another URL of the search loads (a rewritten address, Back), the workspace stays on screen with the last
  // loaded search, so a draft in progress is not thrown away.
  if (state.active && state.status === 'ready') lastReady.current = state;
  else if (!state.active || state.status === 'error') lastReady.current = null;
  const shown: PageState = state.active && state.status === 'loading' && lastReady.current ? { ...lastReady.current, mode: state.mode } : state;

  useEffect(() => {
    if (!state.active || dataRequested.current) return;
    dataRequested.current = true;
    loadData().then(
      (loaded) => setData({ status: 'ready', data: loaded }),
      (error: unknown) => setData({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
    );
  }, [state.active, loadData]);

  // Stored values live here, so they survive switching searches, and are reported to be kept.
  const remember =
    <T,>(set: (value: T) => void, store: (value: T) => void) =>
    (value: T) => {
      set(value);
      store(value);
    };

  return (
    <App
      state={shown}
      data={data}
      client={client}
      onModeChange={controller.setMode}
      onRetry={controller.retry}
      snapshots={snapshots}
      onSnapshotsChange={remember(setSnapshots, onSnapshotsChange)}
      onSearched={onSearched}
      prefs={prefs}
      onPrefsChange={remember(setPrefs, onPrefsChange)}
      savedSearches={savedSearches}
      onSavedSearchesChange={remember(setSavedSearches, onSavedSearchesChange)}
      draftMemory={initialDraftMemory}
      onDraftMemoryChange={onDraftMemoryChange}
      onOpenInOriginal={onOpenInOriginal}
    />
  );
}
