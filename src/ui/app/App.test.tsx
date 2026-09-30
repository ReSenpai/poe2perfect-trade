import { act, fireEvent, render, screen, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceData } from '@/lib/catalog/workspace-data';
import { createPageController, type PageState } from '@/lib/page/controller';
import { normalizeQuery } from '@/lib/query/normalize';
import { loadListings, loadWorkspaceData } from '../../../tests/fixtures/load';
import { App, type AppProps, ConnectedApp, type ConnectedAppProps, type DataState } from './App';

const URL_A = 'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/H4sIa';
const QUERY = normalizeQuery(loadListings('listings-online').request.query);
const DATA = loadWorkspaceData();
const READY: PageState = { active: true, mode: 'extension', url: URL_A, status: 'ready', league: 'Forbidden Rites', query: QUERY };
const ENTRIES = loadListings('listings-online').listings;

// A wide window: the filters as a pane, not a drawer (happy-dom starts at 1024 px).
beforeEach(() => (window as unknown as { happyDOM: { setViewport: (size: { width: number; height: number }) => void } }).happyDOM.setViewport({ width: 1440, height: 900 }));

function fakeClient() {
  return {
    search: vi.fn(async () => ({ id: 'H4sIfound', total: 1135, hashes: ENTRIES.map((entry) => entry.id), inexact: false })),
    fetchListings: vi.fn(async (hashes: string[]) => hashes.map((hash) => ENTRIES.find((entry) => entry.id === hash)!)),
  };
}

function appProps(state: PageState, data: DataState = { status: 'ready', data: DATA }): AppProps {
  return {
    state,
    data,
    client: fakeClient(),
    onModeChange: vi.fn(),
    onRetry: vi.fn(),
    snapshots: [],
    onSnapshotsChange: vi.fn(),
    onSearched: vi.fn(),
    prefs: { filterWidth: 42, filtersCollapsed: false },
    onPrefsChange: vi.fn(),
    savedSearches: [],
    onSavedSearchesChange: vi.fn(),
    draftMemory: null,
    onDraftMemoryChange: vi.fn(),
    onOpenInOriginal: vi.fn(),
  };
}

function connectedProps(controller: ReturnType<typeof createPageController>, overrides: Partial<ConnectedAppProps> = {}): ConnectedAppProps {
  return {
    controller,
    client: fakeClient(),
    loadData: async () => DATA,
    initialSnapshots: [],
    onSnapshotsChange: vi.fn(),
    onSearched: vi.fn(),
    initialPrefs: { filterWidth: 42, filtersCollapsed: false },
    onPrefsChange: vi.fn(),
    initialSavedSearches: [],
    onSavedSearchesChange: vi.fn(),
    initialDraftMemory: null,
    onDraftMemoryChange: vi.fn(),
    onOpenInOriginal: vi.fn(),
    ...overrides,
  };
}

function renderApp(state: PageState, data?: DataState) {
  const props = appProps(state, data);
  const view = render(<App {...props} />);
  return { ...view, ...props };
}

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe('App', () => {
  it('renders nothing away from search pages', () => {
    const { container } = renderApp({ active: false, mode: 'extension' });
    expect(container.innerHTML).toBe('');
  });

  it('offers to open the workspace while the original page is shown', () => {
    const { onModeChange } = renderApp({ ...READY, mode: 'original' });
    fireEvent.click(screen.getByRole('button', { name: 'Open poe2perfect trade' }));
    expect(onModeChange).toHaveBeenCalledWith('extension');
  });

  it('covers the page while the search loads, with a way back to the original', () => {
    const { onModeChange } = renderApp({ active: true, mode: 'extension', url: URL_A, status: 'loading' });
    expect(screen.getByRole('status').textContent).toBe('Loading search…');
    fireEvent.click(screen.getByRole('button', { name: 'Show original page' }));
    expect(onModeChange).toHaveBeenCalledWith('original');
  });

  it('explains a failure and offers a retry and the original page', () => {
    const { onRetry, onModeChange } = renderApp({ active: true, mode: 'extension', url: URL_A, status: 'error', message: 'Broken link' });
    expect(screen.getByRole('alert').textContent).toContain('Broken link');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open original page' }));
    expect(onRetry).toHaveBeenCalled();
    expect(onModeChange).toHaveBeenCalledWith('original');
  });

  it('shows the workspace with its league, and the way back to the site — with the draft when it has changes', () => {
    const { container, onModeChange, onOpenInOriginal } = renderApp(READY);
    expect(container.querySelector('[data-ui="v4"]')).toBeTruthy();
    const toolbar = screen.getByRole('banner');
    expect((within(toolbar).getByRole('combobox', { name: 'League' }) as HTMLSelectElement).value).toBe('Forbidden Rites');
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Show original page' }));
    expect(onModeChange).toHaveBeenCalledWith('original');
    fireEvent.change(screen.getByRole('combobox', { name: 'Rarity' }), { target: { value: 'unique' } });
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Open draft in original' }));
    expect(onOpenInOriginal).toHaveBeenCalledWith({ league: 'Forbidden Rites', query: expect.objectContaining({ filters: expect.anything() }) });
  });

  it('waits for the reference data, and says when it could not be loaded', () => {
    const { rerender } = renderApp(READY, { status: 'loading' });
    expect(screen.getByRole('status').textContent).toBe('Loading filters…');
    rerender(<App {...appProps(READY, { status: 'error', message: 'HTTP 503' })} />);
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load the trade site's filter list: HTTP 503");
  });
});

describe('ConnectedApp', () => {
  it('follows the controller, loads the reference data once and keeps the layout preferences', async () => {
    const controller = createPageController({ load: async () => ({ ok: true, league: 'Standard', query: QUERY }), initialMode: 'extension' });
    let resolveData!: (data: WorkspaceData) => void;
    const loadData = vi.fn(() => new Promise<WorkspaceData>((resolve) => (resolveData = resolve)));
    const onPrefsChange = vi.fn();
    render(<ConnectedApp {...connectedProps(controller, { loadData, initialPrefs: { filterWidth: 45, filtersCollapsed: false }, onPrefsChange })} />);

    expect(document.body.textContent).toBe('');
    await act(async () => {
      controller.handleUrl(URL_A);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('status').textContent).toBe('Loading filters…');

    await act(async () => resolveData(DATA));
    const separator = screen.getByRole('separator', { name: 'Resize filters' });
    expect(separator.getAttribute('aria-valuenow')).toBe('45');
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(onPrefsChange).toHaveBeenCalledWith({ filterWidth: 47, filtersCollapsed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse filters' }));
    expect(onPrefsChange).toHaveBeenLastCalledWith({ filterWidth: 47, filtersCollapsed: true });

    act(() => controller.setMode('original'));
    expect(screen.getByRole('button', { name: 'Open poe2perfect trade' })).toBeTruthy();
    expect(loadData).toHaveBeenCalledTimes(1);
  });

  it('keeps the workspace (and its draft) on screen while another URL of the search loads', async () => {
    let finish!: () => void;
    const controller = createPageController({
      load: (url) =>
        url === URL_A
          ? Promise.resolve({ ok: true as const, league: 'Forbidden Rites', query: QUERY })
          : new Promise((resolve) => (finish = () => resolve({ ok: true, league: 'Standard', query: QUERY }))),
      initialMode: 'extension',
    });
    render(<ConnectedApp {...connectedProps(controller)} />);
    await act(async () => {
      controller.handleUrl(URL_A);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await tick();
    fireEvent.change(screen.getByRole('combobox', { name: 'Rarity' }), { target: { value: 'unique' } });

    await act(async () => controller.handleUrl('https://www.pathofexile.com/trade2/search/poe2/Standard/H4sIa'));
    expect(screen.queryByText('Loading search…')).toBeNull();
    expect((screen.getByRole('combobox', { name: 'Rarity' }) as HTMLSelectElement).value).toBe('unique');

    await act(async () => {
      finish();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect((screen.getByRole('combobox', { name: 'League' }) as HTMLSelectElement).value).toBe('Standard');
  });

  it('does not search for a URL that carries a search; Find items searches, reports its id and remembers the results', async () => {
    const controller = createPageController({ load: async () => ({ ok: true, league: 'Forbidden Rites', query: QUERY }), initialMode: 'extension' });
    const props = connectedProps(controller);
    render(<ConnectedApp {...props} />);
    await act(async () => {
      controller.handleUrl(URL_A);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await tick();
    expect(props.client.search).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Find items' }));
    await tick();
    await tick();

    expect(props.client.search).toHaveBeenCalledExactlyOnceWith('Forbidden Rites', QUERY, { price: 'asc' });
    expect(props.onSearched).toHaveBeenCalledWith('Forbidden Rites', 'H4sIfound');
    expect(props.onSnapshotsChange).toHaveBeenCalledWith([expect.objectContaining({ league: 'Forbidden Rites', id: 'H4sIfound' })]);
  });

  it('does not search a league page without a search', async () => {
    const controller = createPageController({ load: async () => ({ ok: true, league: 'Standard', query: normalizeQuery({}) }), initialMode: 'extension' });
    const props = connectedProps(controller);
    render(<ConnectedApp {...props} />);
    await act(async () => {
      controller.handleUrl('https://www.pathofexile.com/trade2/search/poe2/Standard');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await tick();
    expect(screen.getByText('No search yet')).toBeTruthy();
    expect(props.client.search).not.toHaveBeenCalled();
  });

  it('reports a failed reference data load', async () => {
    const controller = createPageController({ load: async () => ({ ok: true, league: 'Standard', query: QUERY }), initialMode: 'extension' });
    render(<ConnectedApp {...connectedProps(controller, { loadData: async () => Promise.reject(new Error('HTTP 503')) })} />);
    await act(async () => {
      controller.handleUrl(URL_A);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // The reference data is requested by an effect at the end of the act above; their failure lands in the next one.
    await tick();
    expect(screen.getByRole('alert').textContent).toContain('HTTP 503');
  });
});
