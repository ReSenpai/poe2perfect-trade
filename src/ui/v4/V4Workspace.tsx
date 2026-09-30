import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SearchSort, TradeClient } from '@/lib/api/client';
import type { WorkspaceData } from '@/lib/catalog/workspace-data';
import { readBudget, readItemContext } from '@/lib/editor/context';
import { compile, rowsOf } from '@/lib/editor/document';
import { createItemCatalog } from '@/lib/editor/item-catalog';
import { itemPresentation, sortFieldLabel } from '@/lib/listing/presentation';
import type { Listing } from '@/lib/listing/parse';
import { compareListings, type CompareCondition } from '@/lib/compare/metrics';
import { parameterOf } from '@/lib/catalog/semantic';
import { createEditorStore, type EditorState, isDirty, type RestoredResults, validate } from '@/lib/editor/store';
import { activeFilters } from '@/lib/query/labels';
import { normalizeQuery, sameQuery } from '@/lib/query/normalize';
import { findSnapshot, rememberSnapshot, type ResultsSnapshot } from '@/lib/results/snapshots';
import { Icon } from '@/ui/kit/Icon';
import { SHELL_IMAGES } from '@/ui/kit/shell-images';
import { ApplyBar } from './ApplyBar';
import { BudgetSection } from './BudgetSection';
import { CollapsedSummary } from './CollapsedSummary';
import { ItemContextSection } from './ItemContextSection';
import { ParameterPicker } from './ParameterPicker';
import { ParametersView } from './ParametersView';
import { conditionLabel } from './ConditionBlock';
import { searchTitle } from './search-title';
import { createApplicability } from '@/lib/catalog/applicability';
import { ResultsToolbar, SORTS, type SortId, sortIdOf } from './ResultsToolbar';
import type { SearchSort as Sort } from '@/lib/api/client';
import { SplitWorkspace } from './SplitWorkspace';
import { FiltersDrawer } from './FiltersDrawer';
import { useMediaQuery } from './use-media';
import { V4Listings } from './V4Listings';
import { SelectedValue } from './SelectedValue';
import { type CompareEntry, ComparePanel } from './ComparePanel';
import { addSavedSearch, removeSavedSearch, replaceSavedSearch, type SavedSearch } from '@/lib/saved/saved-searches';
import { SavedSearchesDialog } from './SavedSearchesDialog';
import { draftFor, type RememberedDraft } from '@/lib/saved/draft-memory';
import { MoreFilters } from './MoreFilters';

/** Below this window width the filters are a drawer (v4 §6). */
const NARROW = '(max-width: 1099px)';

/** Below this window width the comparison takes the room of the filters while it is open. */
const COMPARE_ROOM = 1600;

/** Parameters the search offers as Recent. */
const RECENT_LIMIT = 8;

/** Listing modes named by what their listings let you do (the site names them by who sells). */
const LISTING_TEXT: Record<string, string> = {
  available: 'Instant buyout and in person',
  securable: 'Travel to hideout (instant buyout)',
  onlineleague: 'Direct whisper (in person, online in league)',
  online: 'Direct whisper (in person, online)',
  any: 'Any, offline sellers too',
};

export interface V4Prefs {
  /** Filter pane share in percent. */
  filterWidth: number;
  filtersCollapsed: boolean;
}

export interface V4WorkspaceProps {
  league: string;
  /** The search of the page as it came (not normalized). */
  query: unknown;
  data: WorkspaceData;
  client: Pick<TradeClient, 'search' | 'fetchListings'> & Partial<Pick<TradeClient, 'whisper'>>;
  snapshots: ResultsSnapshot[];
  onSnapshotsChange: (snapshots: ResultsSnapshot[]) => void;
  prefs: V4Prefs;
  onPrefsChange: (prefs: V4Prefs) => void;
  /** A search was applied: its id belongs in the page URL. */
  onApplied: (league: string, id: string) => void;
  /** Searches kept by name (`local:savedSearches`). */
  savedSearches: SavedSearch[];
  onSavedSearchesChange: (searches: SavedSearch[]) => void;
  /** A draft left unapplied (`local:v4Draft`): brought back when the page shows the search it was made on. */
  draftMemory: RememberedDraft | null;
  onDraftMemoryChange: (memory: RememberedDraft | null) => void;
  /** The original site: with a draft, that draft (its league and query) instead of the applied search. */
  onShowOriginal: (draft?: { league: string; query: unknown }) => void;
  now?: () => number;
}

/** The v4 redesign workspace (steps 22+): toolbar, filters with the Apply bar, results. */
export function V4Workspace(props: V4WorkspaceProps) {
  const { league, query, data, client, snapshots, onSnapshotsChange, prefs, onPrefsChange, onApplied, onShowOriginal, savedSearches, onSavedSearchesChange, draftMemory, onDraftMemoryChange, now = Date.now } = props;
  const latest = useRef({ snapshots, onSnapshotsChange, onApplied, onDraftMemoryChange, now });
  latest.current = { snapshots, onSnapshotsChange, onApplied, onDraftMemoryChange, now };

  const remembered = (searchLeague: string, search: unknown, sort: SearchSort): RestoredResults | undefined => {
    const saved = findSnapshot(latest.current.snapshots, searchLeague, normalizeQuery(search), sort);
    return saved ? { id: saved.id, total: saved.total, hashes: saved.hashes, listings: saved.listings, savedAt: saved.savedAt } : undefined;
  };

  const catalog = useMemo(() => createItemCatalog(data), [data]);
  const applicability = useMemo(() => createApplicability(data.possible), [data]);
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Add condition of a Rules group: where the picked stat goes (null: All of).
  // Add alternative: the required row or group the pick joins, and what the search says it is for.
  const [pickerTarget, setPickerTarget] = useState<{ anchor: string; label: string } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  // A narrow window (v4 §6): the filters live in a drawer over the listings.
  const narrow = useMediaQuery(NARROW);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const appRoot = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const closeDrawer = () => {
    setDrawerOpen(false);
    returnFocus.current = true;
  };
  useEffect(() => {
    if (!narrow) setDrawerOpen(false);
  }, [narrow]);
  // Back to the Filters button that opened it, once the drawer is gone.
  useEffect(() => {
    if (drawerOpen || !returnFocus.current) return;
    returnFocus.current = false;
    appRoot.current?.querySelector<HTMLButtonElement>('.p2t-collapsed .p2t-btn')?.focus();
  }, [drawerOpen]);
  // The comparison (v4 §14): up to two listings kept by id with the time they were shown; a third waits for a choice.
  const [compared, setCompared] = useState<{ listing: Listing; at: number }[]>([]);
  const [pendingCompare, setPendingCompare] = useState<Listing | null>(null);
  // Filters folded away for a comparison only: not the stored preference, so a page closed meanwhile keeps its filters.
  const [foldedForCompare, setFoldedForCompare] = useState(false);
  const focusAfterCompare = useRef<string | null>(null);
  useEffect(() => {
    const id = focusAfterCompare.current;
    if (id === null || compared.length > 0) return;
    focusAfterCompare.current = null;
    appRoot.current?.querySelector<HTMLInputElement>(`.p2t-listing[data-listing-id="${CSS.escape(id)}"] .p2t-compare-check input`)?.focus();
  }, [compared]);
  // A draft left on this very search comes back with the page (a reload, a return); nothing is searched.
  const restoredDraft = useRef(draftFor(draftMemory, league, query));
  const store = useMemo(() => {
    const created = createEditorStore({
        client,
        baseFits: (category, type) => catalog.baseFits(category, type),
        league,
        query,
        now: () => latest.current.now(),
        restore: remembered(league, query, SORTS['price-asc'].sort),
        onApplied: (applied, shown) => {
          const { snapshots: list, onSnapshotsChange: save, onApplied: report, now: clock } = latest.current;
          save(rememberSnapshot(list, { league: applied.league, query: normalizeQuery(compile(applied.doc)), sort: applied.sort, ...shown, savedAt: clock() }));
          report(applied.league, applied.id);
        },
      });
    const restored = restoredDraft.current;
    if (restored) created.loadDraft(restored.draft, restored.league, restored.sort);
    return created;
  }, [client]);
  const [state, setState] = useState<EditorState>(store.getState());
  // Rules opens by itself for a search with groups beyond All of: Parameters would show them only as cards.
  useEffect(() => store.subscribe(setState), [store]);

  // Another search in the address (back / forward) opens as a new draft; the address catching up with the applied
  // search (or the site rewriting it in its own form) changes nothing. Nothing here ever searches.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const current = store.getState();
    const same = (search: { doc: EditorState['draft']; league: string } | null) => search !== null && search.league === league && sameQuery(compile(search.doc), query);
    // The address catching up with the applied search, or the site rewriting the one the page opened with before
    // anything was applied: nothing to do. The opened search after another one was applied is a Back: it opens.
    if (same(current.applied) || (current.applied === null && same(current.imported))) return;
    store.importQuery(query, league, remembered(league, query, current.sort));
  }, [league, query]);

  // The rate limit countdown ticks while it runs.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state.request.status !== 'cooldown') return;
    const timer = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, [state.request]);

  const dirty = isDirty(state);

  // The draft is remembered while it has something to apply, with the search it changes; once nothing is left (applied,
  // reset) the memory of it goes.
  const rememberedHere = useRef(restoredDraft.current !== null);
  useEffect(() => {
    const base = state.applied ?? state.imported;
    if (dirty) {
      rememberedHere.current = true;
      latest.current.onDraftMemoryChange({ version: 1, baseLeague: base.league, base: compile(base.doc), league: state.league, draft: compile(state.draft), sort: state.sort, savedAt: latest.current.now() });
    } else if (rememberedHere.current) {
      rememberedHere.current = false;
      latest.current.onDraftMemoryChange(null);
    }
  }, [dirty, state.draft, state.league, state.sort, state.applied, state.imported]);
  const issues = validate(state);
  const draftChips = activeFilters(normalizeQuery(compile(state.draft)), data.labels);
  const context = readItemContext(state.draft);
  const checks = useMemo(
    () => applicability.forItem({ category: context.category, base: context.type, rarity: context.rarity, name: context.name }),
    [applicability, context.category, context.type, context.rarity, context.name],
  );
  const appliedChips = useMemo(() => (state.applied ? activeFilters(normalizeQuery(compile(state.applied.doc)), data.labels) : []), [state.applied, data.labels]);
  const matchedStats = useMemo(
    () => new Set(state.applied ? state.applied.doc.groups.filter((group) => group.opaque || !group.disabled).flatMap(rowsOf).filter((row) => !row.disabled).map((row) => row.statId) : []),
    [state.applied],
  );
  // Named by the item it looks for (shell v5): "Find a ring", "Find items".
  const title = searchTitle(catalog.categories.find((option) => option.id === context.category)?.text ?? null);
  // Comparing: nothing here searches; listings no longer in the results are kept, marked as from a previous search.
  const shown = state.results.status === 'ready' ? state.results : state.results.status === 'searching' ? state.results.previous : undefined;
  const shownIds = new Set(shown?.listings.map((listing) => listing.id) ?? []);
  const shownAt = shown?.savedAt ?? now();
  const collapsed = prefs.filtersCollapsed || foldedForCompare;
  const expandFilters = () => {
    setFoldedForCompare(false);
    if (prefs.filtersCollapsed) setPrefs({ filtersCollapsed: false });
  };
  // Filters in view again: the drawer on a narrow window, the pane otherwise.
  const showFilters = () => (narrow ? setDrawerOpen(true) : expandFilters());
  const hideFilters = narrow || collapsed;
  // Find items from the filters: on a narrow window the drawer gives way to the results once the search is taken;
  // with a field error nothing runs and it stays.
  const findItems = () => {
    if (issues.some((issue) => issue.severity === 'error')) return;
    void store.apply();
    if (narrow) closeDrawer();
  };
  const unfoldAfterCompare = () => setFoldedForCompare(false);
  const toggleCompare = (listing: Listing) => {
    if (compared.some((entry) => entry.listing.id === listing.id)) {
      setCompared(compared.filter((entry) => entry.listing.id !== listing.id));
      unfoldAfterCompare();
      return;
    }
    if (compared.length >= 2) {
      setPendingCompare(listing);
      return;
    }
    setCompared([...compared, { listing, at: shownAt }]);
    if (compared.length === 1 && !collapsed && window.innerWidth < COMPARE_ROOM) setFoldedForCompare(true);
  };
  const replaceCompared = (index: number) => {
    if (!pendingCompare) return;
    setCompared(compared.map((entry, at) => (at === index ? { listing: pendingCompare, at: shownAt } : entry)));
    setPendingCompare(null);
  };
  const closeCompare = () => {
    // Focus goes back to the Compare box of the listing that opened the comparison (v4 §20).
    focusAfterCompare.current = compared.at(-1)?.listing.id ?? null;
    setCompared([]);
    setPendingCompare(null);
    unfoldAfterCompare();
  };
  const compareConditions: CompareCondition[] = (state.applied?.doc.groups ?? [])
    .filter((group) => !group.opaque && !group.disabled)
    .flatMap(rowsOf)
    .filter((row) => !row.disabled)
    .map((row) => {
      const value = (row.value ?? {}) as { min?: unknown; max?: unknown };
      return { statId: row.statId, ...(typeof value.min === 'number' ? { min: value.min } : {}), ...(typeof value.max === 'number' ? { max: value.max } : {}) };
    });
  const statLabel = (statId: string) => {
    const known = parameterOf(statId)?.parameter.label;
    if (known) return known;
    const entry = data.index.get(`stat:${statId}`);
    return entry?.kind === 'stat' ? entry.text : statId;
  };
  const compareEntries = compared.map(({ listing, at }): CompareEntry => (shownIds.has(listing.id) ? { listing } : { listing, previous: at }));
  const comparison =
    compared.length === 2
      ? compareListings({ listings: [compared[0]!.listing, compared[1]!.listing], conditions: compareConditions, label: statLabel, currencyName: (id) => data.currencies.get(id)?.text ?? id })
      : null;

  const listingMode = typeof state.draft.status.option === 'string' ? state.draft.status.option : '';
  const setPrefs = (patch: Partial<V4Prefs>) => onPrefsChange({ ...prefs, ...patch });

  // A sort by a line of the cards: `stat.<id>`, `ilvl`, `lvl`.
  const fieldLabel = (field: string) => {
    const named = sortFieldLabel(field);
    if (named) return named;
    const statId = field.replace(/^stat\./, '');
    const entry = data.index.get(`stat:${statId}`);
    return entry?.kind === 'stat' ? entry.text : statId;
  };
  const describeSort = (sort: Sort) => {
    const id = sortIdOf(sort);
    if (id !== 'field') return SORTS[id].label;
    const [field, direction] = Object.entries(sort)[0] ?? ['', 'desc'];
    return `Sorted by ${fieldLabel(field)}: ${direction === 'desc' ? 'high to low' : 'low to high'}`;
  };
  const appliedSort = state.applied ? Object.entries(state.applied.sort)[0] : undefined;
  const cardSort = appliedSort && sortIdOf(state.applied!.sort) === 'field' ? { field: appliedSort[0], direction: appliedSort[1] } : null;
  const priceSort = appliedSort && appliedSort[0] === 'price' ? (appliedSort[1] as 'asc' | 'desc') : null;

  /** A stat from Add parameter: a block in All of (or the one already there), the cursor in its value. */
  const addParameter = (statId: string) => {
    const rowId = pickerTarget ? store.addAlternative(pickerTarget.anchor, { statId }) : store.addCondition(null, statId);
    setFocusRow(rowId || null);
    setRecent((list) => [statId, ...list.filter((id) => id !== statId)].slice(0, RECENT_LIMIT));
    setPickerOpen(false);
    setPickerTarget(null);
  };
  /** Already in your search: a required parameter joins the alternatives with its range. */
  const moveIntoAlternatives = (rowId: string) => {
    if (!pickerTarget) return;
    setFocusRow(store.addAlternative(pickerTarget.anchor, { rowId }) || null);
    setPickerOpen(false);
    setPickerTarget(null);
  };
  const alreadyRequired = pickerTarget
    ? state.draft.groups
        .filter((group) => !group.opaque && group.type === 'and')
        .flatMap(rowsOf)
        .filter((row) => row.id !== pickerTarget.anchor && !row.statId.startsWith('pseudo.pseudo_number_of_empty_'))
        .map((row) => ({ rowId: row.id, label: conditionLabel(row.statId, data.index) }))
    : [];
  const openPicker = (open: boolean) => {
    setPickerOpen(open);
    if (!open) setPickerTarget(null);
  };

  const filters = (
    <section class="p2t-filter-pane" aria-label="Filters">
      <div class="p2t-filter-head">
        <h2 class="p2t-filter-head__title">{title}</h2>
        <button
          type="button"
          class="p2t-icon-button"
          aria-label={narrow ? 'Close filters' : 'Collapse filters'}
          title={narrow ? 'Close filters' : 'Collapse filters'}
          onClick={() => (narrow ? closeDrawer() : setPrefs({ filtersCollapsed: true }))}
        >
          <Icon name="chevron-left" size={18} />
        </button>
      </div>
      <div class="p2t-filter-scroll">
        {state.notice && (
          <div class="p2t-banner" aria-live="polite">
            <Icon name="info" size={16} />
            <span>{state.notice.message}</span>
            {state.notice.undo && (
              <button type="button" class="p2t-link" onClick={store.undo}>
                Undo
              </button>
            )}
            <button type="button" class="p2t-condition__remove p2t-banner__dismiss" aria-label="Dismiss" title="Dismiss" onClick={store.dismissNotice}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        <ItemContextSection context={context} catalog={catalog} onChange={store.setItemContext} />
        <BudgetSection
          budget={readBudget(state.draft)}
          texts={state.inputs.budget ?? {}}
          currencies={data.priceOptions}
          currencyInfo={data.currencies}
          issues={issues}
          onInput={store.setBudgetInput}
          onCurrencyChange={(currency) => store.setBudget({ currency })}
        />
        <ParametersView
          state={state}
          store={store}
          checks={checks}
          index={data.index}
          issues={issues}
          focusRow={focusRow}
          filters={data.filters}
          category={context.category}
          onOpenOriginal={() => onShowOriginal({ league: state.league, query: compile(state.draft) })}
          onAddAlternative={(anchor, label) => {
            setPickerTarget({ anchor, label });
            setPickerOpen(true);
          }}
        >
          <ParameterPicker
            index={data.index}
            checks={checks}
            recent={recent}
            open={pickerOpen}
            onOpenChange={openPicker}
            onPick={addParameter}
            title={pickerTarget ? `Add an alternative to ${pickerTarget.label}` : undefined}
            already={alreadyRequired}
            onMove={moveIntoAlternatives}
          />
        </ParametersView>
        <MoreFilters groups={data.moreFilters} draft={state.draft} inputs={state.inputs} issues={issues} category={context.category} store={store} />
      </div>
      <ApplyBar request={state.request} dirty={dirty} issues={issues} count={draftChips.length} now={now()} onApply={findItems} onReset={store.resetChanges} />
    </section>
  );

  const results = (
    <main class="p2t-results" aria-label="Results">
      <ResultsToolbar
        results={state.results}
        applied={state.applied}
        sort={state.sort}
        describeSort={describeSort}
        now={now()}
        onSortChange={(id: SortId) => store.setSort(SORTS[id].sort)}
        onRefresh={() => void store.refresh()}
        leading={hideFilters ? <CollapsedSummary chips={appliedChips} dirty={dirty} onEdit={showFilters} /> : undefined}
      />
      <div class="p2t-results__body" data-compare={comparison ? 'true' : undefined}>
      <V4Listings
        state={state.results}
        currencies={data.currencies}
        matchedStats={matchedStats}
        now={now()}
        idleText={draftChips.length > 0 ? 'Search loaded — Find items to view results' : 'Choose an item and add requirements'}
        sort={cardSort}
        priceSort={priceSort}
        onSort={(field) => void store.sortResults(field)}
        whisper={client.whisper ? (token, options) => client.whisper!(token, options) : undefined}
        onEditFilters={expandFilters}
        onShowOriginal={() => onShowOriginal()}
        onLoadMore={() => void store.loadMore()}
        onRetry={() => void (state.applied ? store.refresh() : store.apply())}
        compared={new Set(compared.map((entry) => entry.listing.id))}
        onCompare={toggleCompare}
      />
      {comparison && <ComparePanel entries={compareEntries as [CompareEntry, CompareEntry]} comparison={comparison} now={now()} onClose={closeCompare} />}
      </div>
      {pendingCompare ? (
        <div class="p2t-compare-strip" role="group" aria-label="Replace which listing?">
          <span>{`Compare ${itemPresentation(pendingCompare).title} instead of:`}</span>
          {compared.map((entry, index) => {
            const title = itemPresentation(entry.listing).title;
            return (
              <button key={entry.listing.id} type="button" class="p2t-toolbar__button" aria-label={`Replace ${title}`} onClick={() => replaceCompared(index)}>
                {title}
              </button>
            );
          })}
          <button type="button" class="p2t-link" onClick={() => setPendingCompare(null)}>
            Cancel
          </button>
        </div>
      ) : (
        compared.length === 1 && (
          <div class="p2t-compare-strip" role="status" aria-label="Comparison">
            <span>1 selected — Select another item</span>
            <button type="button" class="p2t-link" onClick={closeCompare}>
              Clear
            </button>
          </div>
        )
      )}
    </main>
  );

  return (
    <div
      ref={appRoot}
      class="p2t p2t-app"
      data-ui="v4"
      data-narrow={narrow ? 'true' : undefined}
      style={{ '--p2t-splitter-handle': `url("${SHELL_IMAGES.splitterHandle}")` }}
      onKeyDown={(event) => {
        const target = event.composedPath?.()[0] ?? event.target;
        const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
        // "/" outside a field, or Ctrl+K anywhere: the parameter search (v4 §9.3).
        if ((event.key === '/' && !typing) || (event.key === 'k' && (event.ctrlKey || event.metaKey))) {
          event.preventDefault();
          if (hideFilters && !drawerOpen) showFilters();
          setPickerOpen(true);
          return;
        }
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        findItems();
      }}
    >
      <header class="p2t-toolbar">
        {/* As the site's logo: back to an empty search in this league and listing mode, searched right away. */}
        <button
          type="button"
          class="p2t-toolbar__brand"
          aria-label="Clear filters and search"
          title="Clear filters and search everything"
          onClick={() => {
            store.clearFilters();
            void store.apply();
          }}
        >
          <img src={SHELL_IMAGES.leagueEmblem} alt="" width={36} height={36} />
          <span>
            <span class="p2t-toolbar__brand-name">poe2perfect / </span>
            <span class="p2t-toolbar__brand-trade">trade</span>
          </span>
        </button>
        <span class="p2t-toolbar__divider" aria-hidden="true" />
        <label class="p2t-field-inline p2t-toolbar__league">
          <img src={SHELL_IMAGES.leagueEmblem} alt="" width={35} height={35} />
          <select class="p2t-input" aria-label="League" value={state.league} onChange={(event) => store.setLeague(event.currentTarget.value)}>
            <SelectedValue />
            {data.leagues.map((option) => (
              <option key={option.id} value={option.id}>
                {option.text}
              </option>
            ))}
          </select>
        </label>
        <label class="p2t-field-inline p2t-toolbar__status" data-online={listingMode === 'any' ? 'false' : 'true'}>
          <select class="p2t-input" aria-label="Listing" value={listingMode} onChange={(event) => store.setListingMode(event.currentTarget.value)}>
            <SelectedValue />
            {data.statuses.map((option) => (
              <option key={option.id} value={option.id}>
                {LISTING_TEXT[option.id] ?? option.text}
              </option>
            ))}
          </select>
        </label>
        <span class="p2t-toolbar__spacer" />
        <button type="button" class="p2t-toolbar__button" aria-label="Saved searches" aria-haspopup="dialog" onClick={() => setSavedOpen(true)}>
          <Icon name="star" size={20} />
          <span class="p2t-toolbar__button-label">Saved searches</span>
          <Icon name="chevron-down" size={14} />
        </button>
        {/* With changes to apply, the original opens the draft (encoded in its address) rather than the applied search. */}
        <button
          type="button"
          class="p2t-toolbar__button"
          aria-label={dirty ? 'Open draft in original' : 'Show original page'}
          title={dirty ? 'Open draft in original' : 'Show original page'}
          onClick={() => (dirty ? onShowOriginal({ league: state.league, query: compile(state.draft) }) : onShowOriginal())}
        >
          <Icon name="external" size={22} />
          <span class="p2t-toolbar__button-label">{dirty ? 'Draft in original' : 'Original site'}</span>
        </button>
      </header>
      {savedOpen && (
        <SavedSearchesDialog
          searches={savedSearches}
          leagues={data.leagues.map((option) => option.id)}
          league={state.league}
          defaultName={title}
          now={now()}
          onSave={(name) => onSavedSearchesChange(addSavedSearch(savedSearches, { name, league: state.league, query: compile(state.draft), sort: state.sort }, now()))}
          onReplace={(id, name) => onSavedSearchesChange(replaceSavedSearch(savedSearches, id, { name, league: state.league, query: compile(state.draft), sort: state.sort }, now()))}
          onOpen={(search, openLeague) => {
            // A saved search is a draft: its results only when remembered, Find items runs it.
            store.importQuery(search.query, openLeague, remembered(openLeague, search.query, search.sort), search.sort);
            setSavedOpen(false);
          }}
          onDelete={(id) => onSavedSearchesChange(removeSavedSearch(savedSearches, id))}
          onClose={() => setSavedOpen(false)}
        />
      )}
      <SplitWorkspace width={prefs.filterWidth} collapsed={hideFilters} onWidthChange={(filterWidth) => setPrefs({ filterWidth })} filters={filters} results={results} />
      {narrow && drawerOpen && <FiltersDrawer onClose={closeDrawer}>{filters}</FiltersDrawer>}
    </div>
  );
}

