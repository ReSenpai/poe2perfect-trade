import { act, fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { parseListing } from '@/lib/listing/parse';
import type { SavedSearch } from '@/lib/saved/saved-searches';
import type { RememberedDraft } from '@/lib/saved/draft-memory';
import { normalizeQuery } from '@/lib/query/normalize';
import type { ResultsSnapshot } from '@/lib/results/snapshots';
import { createFakeClient, type FakeScenario } from '../../../tests/fixtures/fake-client';
import { loadListings, loadWorkspaceData } from '../../../tests/fixtures/load';
import { V4Workspace, type V4WorkspaceProps } from './V4Workspace';

const DATA = loadWorkspaceData();
const RINGS = loadListings('listings-rings');
const QUERY = RINGS.request.query as Record<string, unknown>;
const NOW = Date.parse('2026-09-23T12:00:00Z');

type Happy = { happyDOM: { setViewport: (size: { width: number; height: number }) => void } };
/** A wide window unless a test says otherwise (happy-dom starts at 1024 px, the narrow layout). */
const viewport = (width: number) => (window as unknown as Happy).happyDOM.setViewport({ width, height: 900 });

function setup(overrides: Partial<V4WorkspaceProps> = {}, scenario: FakeScenario = 'normal', width = 1440) {
  viewport(width);
  const fake = createFakeClient(scenario, 'listings-rings');
  const client = { search: vi.fn(fake.search), fetchListings: vi.fn(fake.fetchListings) };
  const props: V4WorkspaceProps = {
    league: 'Forbidden Rites',
    query: QUERY,
    data: DATA,
    client,
    snapshots: [],
    onSnapshotsChange: vi.fn(),
    prefs: { filterWidth: 42, filtersCollapsed: false },
    onPrefsChange: vi.fn(),
    onApplied: vi.fn(),
    onShowOriginal: vi.fn(),
    savedSearches: [],
    onSavedSearchesChange: vi.fn(),
    draftMemory: null,
    onDraftMemoryChange: vi.fn(),
    now: () => NOW,
    ...overrides,
  };
  const view = render(<V4Workspace {...props} />);
  return { ...view, props, client };
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const apply = () => screen.getByRole('button', { name: 'Find items' }) as HTMLButtonElement;
const status = () => within(screen.getByRole('region', { name: 'Filters' })).getByRole('status').textContent;
const minimum = (label: string) => screen.getByRole('textbox', { name: `${label} minimum` }) as HTMLInputElement;

describe('V4Workspace', () => {
  it('has the toolbar: league, listing mode and the way back to the site', () => {
    const { props } = setup();
    const toolbar = screen.getByRole('banner');
    expect(toolbar.querySelector('.p2t-toolbar__brand')!.textContent).toBe('poe2perfect / trade');
    expect((within(toolbar).getByRole('combobox', { name: 'League' }) as HTMLSelectElement).value).toBe('Forbidden Rites');
    const listing = within(toolbar).getByRole('combobox', { name: 'Listing' }) as HTMLSelectElement;
    expect(listing.value).toBe('online');
    // Named by what the listings let you do: travel to the hideout or whisper the seller.
    expect([...listing.options].map((option) => [option.value, option.text])).toEqual([
      ['available', 'Instant buyout and in person'],
      ['securable', 'Travel to hideout (instant buyout)'],
      ['onlineleague', 'Direct whisper (in person, online in league)'],
      ['online', 'Direct whisper (in person, online)'],
      ['any', 'Any, offline sellers too'],
    ]);
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Show original page' }));
    expect(props.onShowOriginal).toHaveBeenCalled();
  });

  it('draws the value of every list in one element it can cut short (customizable select)', () => {
    const { container } = setup();
    const selects = [...container.querySelectorAll('select')];
    expect(selects.length).toBeGreaterThanOrEqual(6);
    for (const select of selects) expect(select.querySelector(':scope > button.p2t-select__value > selectedcontent'), select.getAttribute('aria-label')!).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Rarity' }) as HTMLSelectElement).value).toBe('rare');
  });

  it('compares two listings without a search: a hint for one, the panel for two, a choice for a third', async () => {
    const { client } = setup();
    fireEvent.click(apply());
    await flush();
    const results = screen.getByRole('main', { name: 'Results' });
    const boxes = () => within(results).getAllByRole('checkbox', { name: /^Compare / });
    const names = RINGS.listings.slice(0, 3).map((raw) => parseListing(raw).item.name);

    fireEvent.click(boxes()[0]!);
    expect(within(results).getByRole('status', { name: 'Comparison' }).textContent).toContain('1 selected — Select another item');
    fireEvent.click(boxes()[1]!);
    const panel = screen.getByRole('complementary', { name: 'Compare' });
    expect(within(panel).getAllByRole('columnheader').slice(1).map((head) => head.querySelector('.p2t-compare__name')!.textContent)).toEqual([names[0], names[1]]);
    expect(within(panel).getByRole('rowheader', { name: 'Life' })).toBeTruthy();

    fireEvent.click(boxes()[2]!);
    const choice = within(results).getByRole('group', { name: 'Replace which listing?' });
    fireEvent.click(within(choice).getByRole('button', { name: `Replace ${names[0]}` }));
    expect(within(screen.getByRole('complementary', { name: 'Compare' })).getAllByRole('columnheader').slice(1).map((head) => head.querySelector('.p2t-compare__name')!.textContent)).toEqual([names[2], names[1]]);

    fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }));
    expect(screen.queryByRole('complementary', { name: 'Compare' })).toBeNull();
    expect(boxes().every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(client.fetchListings).toHaveBeenCalledTimes(1);
  });

  it('folds the filters away while comparing on a mid-size screen, and brings them back after', async () => {
    const { props } = setup({}, 'normal', 1280);
    fireEvent.click(apply());
    await flush();
    const boxes = within(screen.getByRole('main', { name: 'Results' })).getAllByRole('checkbox', { name: /^Compare / });
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[1]!);
    expect(screen.queryByRole('region', { name: 'Filters' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }));
    expect(screen.getByRole('region', { name: 'Filters' })).toBeTruthy();
    // Only for the comparison: the stored preference is not touched, so a page closed meanwhile keeps its filters.
    expect(props.onPrefsChange).not.toHaveBeenCalled();
  });

  it('saves the current search and opens a saved one as the draft, without searching', () => {
    const { props, client, rerender } = setup();
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Saved searches' }));
    const dialog = screen.getByRole('dialog', { name: 'Saved searches' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save current search' }));
    const saved = (props.onSavedSearchesChange as ReturnType<typeof vi.fn>).mock.lastCall![0] as SavedSearch[];
    expect(saved).toEqual([expect.objectContaining({ name: 'Find a ring', league: 'Forbidden Rites', query: QUERY, sort: { price: 'asc' } })]);

    const stats = (QUERY as { stats: { filters: { id: string; value?: { min?: number } }[] }[] }).stats;
    const richer = { ...QUERY, stats: [{ ...stats[0]!, filters: stats[0]!.filters.map((filter) => (filter.id === 'pseudo.pseudo_total_life' ? { ...filter, value: { min: 95 } } : filter)) }, ...stats.slice(1)] };
    rerender(<V4Workspace {...props} savedSearches={[{ ...saved[0]!, name: 'Richer rings', query: richer }]} />);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Saved searches' })).getByRole('button', { name: 'Open Richer rings' }));
    expect(screen.queryByRole('dialog', { name: 'Saved searches' })).toBeNull();
    expect(minimum('Life').value).toBe('95');
    expect(client.search).not.toHaveBeenCalled();
  });

  const withLife = (min: number) => {
    const stats = (QUERY as { stats: { filters: { id: string; value?: { min?: number } }[] }[] }).stats;
    return { ...QUERY, stats: [{ ...stats[0]!, filters: stats[0]!.filters.map((filter) => (filter.id === 'pseudo.pseudo_total_life' ? { ...filter, value: { min } } : filter)) }, ...stats.slice(1)] };
  };
  const memory = (base: unknown, draft: unknown): RememberedDraft => ({ version: 1, baseLeague: 'Forbidden Rites', base, league: 'Forbidden Rites', draft, sort: { price: 'asc' }, savedAt: NOW });

  it('brings back a draft left unapplied on this search, as changes, without searching', () => {
    const { client } = setup({ draftMemory: memory(QUERY, withLife(95)) });
    expect(minimum('Life').value).toBe('95');
    expect(screen.getByText('Unapplied changes restored')).toBeTruthy();
    expect(status()).toBe('Filters changed — Find items to update results');
    expect(client.search).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Unapplied changes restored')).toBeNull();
    expect(minimum('Life').value).toBe('95'); // only the notice goes
  });

  it('leaves alone a draft made on another search', () => {
    setup({ draftMemory: memory({ status: { option: 'any' } }, withLife(95)) });
    expect(minimum('Life').value).toBe('80');
  });

  it('remembers a changed draft with the search it changes, and forgets it when nothing is left to apply', () => {
    const { props } = setup();
    fireEvent.input(minimum('Life'), { target: { value: '95' } });
    const change = props.onDraftMemoryChange as ReturnType<typeof vi.fn>;
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ version: 1, baseLeague: 'Forbidden Rites', base: QUERY, league: 'Forbidden Rites', draft: withLife(95), sort: { price: 'asc' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset changes' }));
    expect(change).toHaveBeenLastCalledWith(null);
  });

  it('remembers a draft over the applied search once one is applied', async () => {
    const { props } = setup();
    fireEvent.input(minimum('Life'), { target: { value: '95' } });
    fireEvent.click(apply());
    await flush();
    fireEvent.input(minimum('Life'), { target: { value: '90' } });
    expect(props.onDraftMemoryChange).toHaveBeenLastCalledWith(expect.objectContaining({ base: withLife(95), draft: withLife(90) }));
  });

  it('opens a changed draft in the original site, and the applied search otherwise', () => {
    const { props } = setup();
    const original = () => within(screen.getByRole('banner')).getByRole('button', { name: /original/i });
    fireEvent.click(original());
    expect(props.onShowOriginal).toHaveBeenLastCalledWith();
    fireEvent.input(minimum('Life'), { target: { value: '95' } });
    expect(original().getAttribute('aria-label')).toBe('Open draft in original');
    fireEvent.click(original());
    expect(props.onShowOriginal).toHaveBeenLastCalledWith({ league: 'Forbidden Rites', query: withLife(95) });
  });

  it('on a narrow window keeps the filters in a drawer; Esc closes it with the draft kept and focus back on Filters', () => {
    setup({}, 'normal', 900);
    expect(screen.queryByRole('region', { name: 'Filters' })).toBeNull();
    const open = screen.getByRole('button', { name: /^Filters/ });
    fireEvent.click(open);
    const drawer = screen.getByRole('dialog', { name: 'Filters' });
    expect(within(drawer).getByRole('region', { name: 'Filters' })).toBeTruthy();
    fireEvent.input(minimum('Life'), { target: { value: '95' } });
    fireEvent(drawer, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Filters/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    expect(minimum('Life').value).toBe('95');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Filters' })).getByRole('button', { name: 'Close filters' }));
    expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull();
  });

  it('closes the drawer when Find items runs the search, and keeps it open on a field error', async () => {
    const { client } = setup({}, 'normal', 900);
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    fireEvent.input(minimum('Life'), { target: { value: 'abc' } });
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Filters' }), { key: 'Enter', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy();
    fireEvent.input(minimum('Life'), { target: { value: '90' } });
    fireEvent.click(apply());
    await flush();
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull();
  });

  it('gives focus back to the Compare box that opened the comparison when it closes', async () => {
    setup();
    fireEvent.click(apply());
    await flush();
    const boxes = within(screen.getByRole('main', { name: 'Results' })).getAllByRole('checkbox', { name: /^Compare / });
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }));
    expect(document.activeElement).toBe(within(screen.getByRole('main', { name: 'Results' })).getAllByRole('checkbox', { name: /^Compare / })[1]);
  });

  it('announces the number of results politely', async () => {
    setup();
    fireEvent.click(apply());
    await flush();
    expect(screen.getByRole('main', { name: 'Results' }).querySelector('.p2t-results-toolbar__total')!.getAttribute('aria-live')).toBe('polite');
  });

  it('names every field, list and button for a screen reader', async () => {
    setup();
    fireEvent.click(apply());
    await flush();
    // Controls whose accessible name is empty (the value parts inside a list do not count: the list has the name).
    const unnamed = ['button', 'textbox', 'combobox', 'slider', 'checkbox', 'switch']
      .flatMap((role) => screen.queryAllByRole(role, { name: '' }))
      .filter((control) => !control.closest('select'))
      .map((control) => control.outerHTML.slice(0, 120));
    expect(unnamed).toEqual([]);
  });

  it('starts over from its name: clears the filters and searches everything, keeping league and listing mode', async () => {
    const { client } = setup();
    const brand = within(screen.getByRole('banner')).getByRole('button', { name: 'Clear filters and search' });
    expect(brand.textContent).toBe('poe2perfect / trade');
    fireEvent.click(brand);
    await flush();
    expect(client.search).toHaveBeenCalledTimes(1);
    const [league, query, sort] = client.search.mock.calls[0]!;
    expect(league).toBe('Forbidden Rites');
    expect(query).toMatchObject({ status: { option: 'online' } });
    expect(JSON.stringify(query)).not.toContain('accessory.ring');
    expect(JSON.stringify(query)).not.toContain('pseudo_total_life');
    expect(sort).toEqual({ price: 'asc' });
    expect((screen.getByRole('combobox', { name: 'Category' }) as HTMLSelectElement).value).toBe('');
    expect(within(screen.getByRole('region', { name: 'Parameters' })).getByText('Add stats or item properties to narrow your search.')).toBeTruthy();
  });

  it('searches with a filter from More filters, and blocks Find items on its error', async () => {
    const { client } = setup();
    const more = screen.getByRole('region', { name: 'More filters' });
    fireEvent.click(within(more).getByRole('button', { name: /^More filters/ }));
    fireEvent.input(within(more).getByRole('textbox', { name: 'Level minimum' }), { target: { value: 'x' } });
    expect(apply().disabled).toBe(true);
    fireEvent.input(within(more).getByRole('textbox', { name: 'Level minimum' }), { target: { value: '60' } });
    fireEvent.click(within(within(more).getByRole('radiogroup', { name: 'Mirrored' })).getByRole('radio', { name: 'No' }));
    fireEvent.click(apply());
    await flush();
    expect(client.search.mock.calls[0]![1]).toMatchObject({ filters: { req_filters: { filters: { lvl: { min: 60 } } }, misc_filters: { filters: { mirrored: { option: 'false' } } } } });
  });

  describe('alternatives and exclusions (step 39)', () => {
    const FIRE_ID = 'pseudo.pseudo_total_fire_resistance';
    const COLD_ID = 'pseudo.pseudo_total_cold_resistance';
    const CHAOS_ID = 'pseudo.pseudo_total_chaos_resistance';
    const RARITY_ID = 'explicit.stat_3917489142';
    const parameters = () => screen.getByRole('region', { name: 'Parameters' });
    const group = (name: string | RegExp) => screen.getByRole('group', { name });
    const menu = (button: string, item: string) => {
      fireEvent.click(screen.getByRole('button', { name: button }));
      fireEvent.click(screen.getByRole('menuitem', { name: item }));
    };
    const pick = (text: string) => {
      const search = screen.getByRole('combobox', { name: 'Search parameters' });
      fireEvent.input(search, { target: { value: text } });
      fireEvent.keyDown(search, { key: 'Enter' });
    };
    const searched = async (client: ReturnType<typeof setup>['client']) => {
      fireEvent.click(apply());
      await flush();
      return (client.search.mock.calls.at(-1)![1] as { stats: unknown[] }).stats;
    };

    it('moves focus to the next card after a removal, and to Add parameter after the last', async () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'Remove Life' }));
      await flush();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mode of Fire Resistance' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove Fire Resistance' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove Cold Resistance' }));
      await flush();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Add parameter/ }));
    });

    it('announces the shape of the list when it changes', () => {
      const { container } = setup();
      const live = () => container.querySelector('.p2t-parameters__live')!;
      expect(live().getAttribute('aria-live')).toBe('polite');
      expect(live().textContent).toBe('3 required');
      menu('Mode of Fire Resistance', 'Add alternative');
      pick('chaos res');
      expect(live().textContent).toBe('2 required · 1 group of alternatives');
    });

    it('opens the help on parameters from its header, and gives focus back when it closes', () => {
      setup();
      const info = within(parameters()).getByRole('button', { name: 'How parameters work' });
      fireEvent.click(info);
      expect(screen.getByRole('dialog', { name: 'How parameters work' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Close help' }));
      expect(screen.queryByRole('dialog', { name: 'How parameters work' })).toBeNull();
      expect(document.activeElement).toBe(info);
    });

    it('has one list of parameters: no Rules mode, each parameter required', () => {
      setup();
      expect(within(screen.getByRole('region', { name: 'Filters' })).queryByRole('button', { name: 'Rules' })).toBeNull();
      expect(within(parameters()).getByText('Your filters')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Mode of Life' }).textContent).toContain('Required');
    });

    it('adds an alternative: the parameter and the new one become Match at least 1 of 2, searched as a count', async () => {
      const { client } = setup();
      menu('Mode of Fire Resistance', 'Add alternative');
      expect(screen.getByRole('heading', { name: 'Add an alternative to Fire Resistance' })).toBeTruthy();
      pick('chaos res');
      const alternatives = group('Match at least 1 of 2');
      expect(within(alternatives).getByRole('textbox', { name: 'Fire Resistance minimum' })).toBeTruthy();
      expect(document.activeElement).toBe(within(alternatives).getByRole('textbox', { name: 'Chaos Resistance minimum' }));
      expect(within(alternatives).queryByRole('button', { name: /^Mode of/ })).toBeNull(); // rows have no mode of their own
      const stats = await searched(client);
      expect(stats).toContainEqual({ type: 'count', value: { min: 1 }, filters: [{ id: FIRE_ID, value: { min: 35 } }, { id: CHAOS_ID }] });
    });

    it('sets how many must match, and moves a parameter already in the search into the group', async () => {
      const { client } = setup();
      menu('Mode of Fire Resistance', 'Add alternative');
      pick('chaos res');
      fireEvent.click(within(group('Match at least 1 of 2')).getByRole('button', { name: 'Add alternative' }));
      expect(screen.getByRole('heading', { name: 'Add an alternative to this group' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Move Cold Resistance into alternatives' }));
      fireEvent.change(within(group('Match at least 1 of 3')).getByRole('combobox', { name: 'How many must match' }), { target: { value: '2' } });
      const stats = await searched(client);
      expect(stats).toContainEqual({ type: 'count', value: { min: 2 }, filters: [{ id: FIRE_ID, value: { min: 35 } }, { id: CHAOS_ID }, { id: COLD_ID, value: { min: 30 } }] });
    });

    it('narrows Already in your search by the words typed', () => {
      setup();
      menu('Mode of Fire Resistance', 'Add alternative');
      expect(screen.getByRole('button', { name: 'Move Cold Resistance into alternatives' })).toBeTruthy();
      fireEvent.input(screen.getByRole('combobox', { name: 'Search parameters' }), { target: { value: 'chaos' } });
      expect(screen.queryByRole('button', { name: 'Move Cold Resistance into alternatives' })).toBeNull();
      fireEvent.input(screen.getByRole('combobox', { name: 'Search parameters' }), { target: { value: 'resist cold' } });
      expect(screen.getByRole('button', { name: 'Move Cold Resistance into alternatives' })).toBeTruthy();
    });

    it('never lowers N quietly: a removal that leaves too few rows blocks Find items with the error at the group', () => {
      setup();
      menu('Mode of Fire Resistance', 'Add alternative');
      pick('chaos res');
      fireEvent.click(within(group('Match at least 1 of 2')).getByRole('button', { name: 'Add alternative' }));
      fireEvent.click(screen.getByRole('button', { name: 'Move Cold Resistance into alternatives' }));
      fireEvent.change(within(group('Match at least 1 of 3')).getByRole('combobox', { name: 'How many must match' }), { target: { value: '3' } });
      menu('Actions for Chaos Resistance', 'Remove');
      expect(within(group('Match at least 3 of 2')).getByText('Choose a count from 1 to 2')).toBeTruthy();
      expect(apply().disabled).toBe(true);
    });

    it('makes a row required separately, and a group of one becomes a required parameter', () => {
      setup();
      menu('Mode of Fire Resistance', 'Add alternative');
      pick('chaos res');
      menu('Actions for Chaos Resistance', 'Make required separately');
      expect(screen.queryByRole('group', { name: /^Match at least/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Mode of Chaos Resistance' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Mode of Fire Resistance' })).toBeTruthy();
    });

    it('requires all of a group separately, with Undo', () => {
      setup();
      menu('Mode of Fire Resistance', 'Add alternative');
      pick('chaos res');
      menu('Actions for Match at least 1 of 2', 'Require all separately');
      expect(screen.queryByRole('group', { name: /^Match at least/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(group('Match at least 1 of 2')).toBeTruthy();
    });

    it('excludes a modifier regardless of value, and Require brings its range back', async () => {
      const query = { ...QUERY, stats: [{ type: 'and', filters: [{ id: RARITY_ID, value: { min: 10 } }] }] };
      const { client } = setup({ query });
      menu('Mode of Rarity of Items found', 'Must not have');
      expect(screen.getByRole('button', { name: 'Mode of Rarity of Items found' }).textContent).toContain('Must not have');
      expect(screen.getByText('Explicit modifier · any value')).toBeTruthy();
      expect(screen.queryByRole('textbox', { name: 'Rarity of Items found minimum' })).toBeNull();
      expect(await searched(client)).toContainEqual({ type: 'not', filters: [{ id: RARITY_ID }] });
      menu('Mode of Rarity of Items found', 'Require');
      expect(minimum('Rarity of Items found').value).toBe('10');
    });

    it('asks for a specific modifier to exclude instead of a total', () => {
      setup();
      menu('Mode of Life', 'Must not have');
      expect(screen.getByText('Choose a specific modifier to exclude')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Mode of Life' }).textContent).toContain('Required'); // nothing changed yet
      fireEvent.click(screen.getByRole('button', { name: 'Exclude Life: Explicit' }));
      expect(screen.getByRole('button', { name: 'Mode of Life' }).textContent).toContain('Must not have');
      expect(screen.getByText('Explicit modifier · any value')).toBeTruthy();
    });

    it('opens a link with count and not groups as a group of alternatives and exclusions', () => {
      const query = {
        ...QUERY,
        stats: [
          { type: 'count', value: { min: 2 }, filters: [{ id: FIRE_ID, value: { min: 35 } }, { id: COLD_ID, value: { min: 30 } }, { id: 'pseudo.pseudo_total_lightning_resistance', value: { min: 30 } }] },
          { type: 'not', filters: [{ id: RARITY_ID }] },
        ],
      };
      setup({ query });
      expect((within(group('Match at least 2 of 3')).getByRole('combobox', { name: 'How many must match' }) as HTMLSelectElement).value).toBe('2');
      expect(screen.getByRole('button', { name: 'Mode of Rarity of Items found' }).textContent).toContain('Must not have');
    });
  });

  it('names the search by its item', () => {
    setup();
    const filters = screen.getByRole('region', { name: 'Filters' });
    expect(within(filters).getByRole('heading', { level: 2 }).textContent).toBe('Find a ring');
    expect(filters.querySelector('.p2t-apply-bar__summary')).toBeNull();
  });

  it('does not search on its own: it waits for Apply', async () => {
    const { client } = setup();
    await flush();
    expect(client.search).not.toHaveBeenCalled();
    expect(screen.getByText('Search loaded — Find items to view results')).toBeTruthy();
    expect(status()).toBe('6 active conditions');
  });

  it('lists the stat conditions of the draft; item and budget have their own sections', () => {
    setup();
    const filters = screen.getByRole('region', { name: 'Filters' });
    expect(minimum('Life').value).toBe('80');
    expect(minimum('Fire Resistance').value).toBe('35');
    expect(minimum('Cold Resistance').value).toBe('30');
    expect((within(filters).getByRole('combobox', { name: 'Category' }) as HTMLSelectElement).value).toBe('accessory.ring');
    expect((within(filters).getByRole('combobox', { name: 'Rarity' }) as HTMLSelectElement).value).toBe('rare');
    expect((within(filters).getByRole('textbox', { name: 'Max price' }) as HTMLInputElement).value).toBe('50');
    expect((within(filters).getByRole('combobox', { name: 'Currency' }) as HTMLSelectElement).value).toBe('exalted');
  });

  it('clears a base that does not fit a new category, says so, and Undo brings it back (Gloves → Ring)', () => {
    const gloves = { status: { option: 'online' }, type: 'Doubled Gauntlets', stats: [{ type: 'and', filters: [{ id: 'pseudo.pseudo_total_life', value: { min: 80 } }] }], filters: { type_filters: { filters: { category: { option: 'armour.gloves' } } } } };
    const { client } = setup({ query: gloves });
    const filters = screen.getByRole('region', { name: 'Filters' });
    expect(within(filters).getByRole('group', { name: 'Chosen item' }).textContent).toContain('Doubled Gauntlets');

    fireEvent.change(within(filters).getByRole('combobox', { name: 'Category' }), { target: { value: 'accessory.ring' } });
    expect(within(filters).queryByRole('group', { name: 'Chosen item' })).toBeNull();
    expect(within(filters).getByText('Base cleared for the new category')).toBeTruthy();
    expect(minimum('Life').value).toBe('80'); // conditions stay

    fireEvent.click(within(filters).getByRole('button', { name: 'Undo' }));
    expect((within(filters).getByRole('combobox', { name: 'Category' }) as HTMLSelectElement).value).toBe('armour.gloves');
    expect(within(filters).getByRole('group', { name: 'Chosen item' }).textContent).toContain('Doubled Gauntlets');
    expect(client.search).not.toHaveBeenCalled();
  });

  it('picks a unique in the item search: name, base, rarity and its category', async () => {
    const { client } = setup({ query: { status: { option: 'online' } } });
    const filters = screen.getByRole('region', { name: 'Filters' });
    fireEvent.input(within(filters).getByRole('combobox', { name: 'Base or unique item' }), { target: { value: 'andvarius' } });
    fireEvent.click(within(within(filters).getByRole('listbox', { name: 'Items' })).getByRole('option'));
    fireEvent.click(apply());
    await flush();
    expect(client.search.mock.calls[0]![1]).toMatchObject({
      name: 'Andvarius',
      type: 'Gold Ring',
      filters: { type_filters: { filters: { category: { option: 'accessory.ring' }, rarity: { option: 'unique' } } } },
    });
  });

  it('searches with the typed budget, and blocks Apply on an unfinished price', async () => {
    const { client } = setup();
    const maxPrice = within(screen.getByRole('region', { name: 'Budget' })).getByRole('textbox', { name: 'Max price' });
    fireEvent.input(maxPrice, { target: { value: '6.' } });
    expect(apply().disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe('Enter a number');

    fireEvent.input(maxPrice, { target: { value: '60' } });
    fireEvent.change(within(screen.getByRole('region', { name: 'Budget' })).getByRole('combobox', { name: 'Currency' }), { target: { value: 'divine' } });
    expect(screen.getByText('Amount kept; currency changed')).toBeTruthy();
    fireEvent.click(apply());
    await flush();
    expect(client.search.mock.calls[0]![1]).toMatchObject({ filters: { trade_filters: { filters: { price: { max: 60, option: 'divine' } } } } });
  });

  it('applies once, shows the results with the league and sort they are for, and remembers them', async () => {
    const { client, props } = setup();
    fireEvent.click(apply());
    await flush();
    expect(client.search).toHaveBeenCalledExactlyOnceWith('Forbidden Rites', expect.objectContaining({ status: { option: 'online' } }), { price: 'asc' });
    const results = screen.getByRole('main', { name: 'Results' });
    expect(results.querySelector('.p2t-results-toolbar__total')!.textContent).toBe('Results (1,135)');
    expect(results.querySelectorAll('li.p2t-listing article.p2t-item')).toHaveLength(10);
    expect(props.onApplied).toHaveBeenCalledWith('Forbidden Rites', 'H4sIfake-normal');
    const saved = (props.onSnapshotsChange as ReturnType<typeof vi.fn>).mock.lastCall![0] as ResultsSnapshot[];
    expect(saved[0]).toMatchObject({ league: 'Forbidden Rites', id: 'H4sIfake-normal', savedAt: NOW });
    expect(saved[0]!.query).toEqual(normalizeQuery(QUERY));
  });

  it('applies with Ctrl+Enter', async () => {
    const { client } = setup();
    fireEvent.keyDown(screen.getByRole('region', { name: 'Filters' }), { key: 'Enter', ctrlKey: true });
    await flush();
    expect(client.search).toHaveBeenCalledTimes(1);
  });

  it('takes sort and listing mode into the draft without searching; Reset changes takes them back', async () => {
    const { client } = setup();
    fireEvent.click(apply());
    await flush();
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'price-desc' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Listing' }), { target: { value: 'securable' } });
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(status()).toBe('Filters changed — Find items to update results');

    fireEvent.click(screen.getByRole('button', { name: 'Reset changes' }));
    expect((screen.getByRole('combobox', { name: 'Sort' }) as HTMLSelectElement).value).toBe('price-asc');
    expect((screen.getByRole('combobox', { name: 'Listing' }) as HTMLSelectElement).value).toBe('online');
    expect(status()).toBe('6 active conditions');
  });

  it('shows remembered results of the page search with their age, and refreshes them on request', async () => {
    const snapshot: ResultsSnapshot = {
      league: 'Forbidden Rites',
      query: normalizeQuery(QUERY),
      sort: { price: 'asc' },
      id: 'H4sIold',
      total: 5,
      hashes: RINGS.listings.map((entry) => entry.id),
      listings: RINGS.listings.map(parseListing),
      savedAt: NOW - 12 * 60_000,
    };
    const { client } = setup({ snapshots: [snapshot] });
    expect(screen.getByRole('main', { name: 'Results' }).querySelector('.p2t-results-toolbar__total')!.textContent).toBe('Results (5)');
    expect(screen.getByText('Results from 12 min ago')).toBeTruthy();
    expect(client.search).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
    await flush();
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^Results from/)).toBeNull();
  });

  it('does not search when the page URL catches up with the applied search', async () => {
    const { client, props, rerender } = setup();
    fireEvent.click(apply());
    await flush();
    rerender(<V4Workspace {...props} query={{ ...QUERY, stats: [...(QUERY as { stats: unknown[] }).stats, { type: 'and', filters: [] }] }} />);
    await flush();
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('main', { name: 'Results' }).querySelector('.p2t-results-toolbar__total')!.textContent).toBe('Results (1,135)');
  });

  it('goes Back to the search the page opened with after another one, with its remembered results, without searching', async () => {
    const { client, props, rerender } = setup();
    const saved = () => (props.onSnapshotsChange as ReturnType<typeof vi.fn>).mock.lastCall![0] as ResultsSnapshot[];
    fireEvent.click(apply());
    await flush();
    // Remembered results come back as props, as the app keeps them.
    rerender(<V4Workspace {...props} snapshots={saved()} />);
    fireEvent.input(minimum('Life'), { target: { value: '95' } });
    fireEvent.click(apply());
    await flush();
    expect(client.search).toHaveBeenCalledTimes(2);
    const remembered = saved();
    // The address follows the second search, then Back gives the first one again (a new object each time, as parsed).
    rerender(<V4Workspace {...props} snapshots={remembered} query={withLife(95)} />);
    await flush();
    rerender(<V4Workspace {...props} snapshots={remembered} query={structuredClone(QUERY)} />);
    await flush();
    expect(minimum('Life').value).toBe('80');
    expect(status()).toBe('6 active conditions');
    expect(screen.getByRole('main', { name: 'Results' }).querySelector('.p2t-results-toolbar__total')!.textContent).toBe('Results (1,135)');
    expect(client.search).toHaveBeenCalledTimes(2);
  });

  it('opens another search from the address (back / forward) as a new draft, without searching', async () => {
    const { client, props, rerender } = setup();
    fireEvent.click(apply());
    await flush();
    rerender(<V4Workspace {...props} query={{ status: { option: 'any' } }} />);
    await flush();
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Choose an item and add requirements')).toBeTruthy();
    expect(status()).toBe('0 active conditions');
  });

  it('collapses the filters to a summary of the applied search, marking unapplied changes', async () => {
    const { props, rerender } = setup();
    fireEvent.click(apply());
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse filters' }));
    expect(props.onPrefsChange).toHaveBeenCalledWith({ filterWidth: 42, filtersCollapsed: true });

    rerender(<V4Workspace {...props} prefs={{ filterWidth: 42, filtersCollapsed: true }} />);
    expect(screen.queryByRole('region', { name: 'Filters' })).toBeNull();
    const summary = screen.getByRole('region', { name: 'Applied filters' });
    // One header over the results: the summary sits in the row with the count and the sort, not in a bar of its own.
    const toolbar = screen.getByRole('main', { name: 'Results' }).querySelector('.p2t-results-toolbar')!;
    expect(toolbar.contains(summary)).toBe(true);
    expect(toolbar.contains(screen.getByRole('combobox', { name: 'Sort' }))).toBe(true);
    expect(within(summary).getByRole('button', { name: 'Filters · 6' })).toBeTruthy();
    expect(within(summary).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Category: Ring', 'Rarity: Rare', 'Buyout Price: ≤50 Exalted Orb', 'Total Life: 80+']);
    fireEvent.click(within(summary).getByRole('button', { name: '+2 more' }));
    expect(within(summary).getAllByRole('listitem')).toHaveLength(6);
    expect(within(summary).queryByText('Unapplied changes')).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'price-desc' } });
    expect(within(summary).getByText('Unapplied changes')).toBeTruthy();
    fireEvent.click(within(summary).getByRole('button', { name: 'Edit' }));
    expect(props.onPrefsChange).toHaveBeenLastCalledWith({ filterWidth: 42, filtersCollapsed: false });
  });

  it('keeps the filter width in the preferences', () => {
    const { props } = setup();
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize filters' }), { key: 'ArrowRight' });
    expect(props.onPrefsChange).toHaveBeenCalledWith({ filterWidth: 44, filtersCollapsed: false });
  });

  it('counts down a rate limit in the Apply bar', async () => {
    setup({}, 'rate-limited');
    fireEvent.click(apply());
    await flush();
    expect(status()).toBe('Too many requests — try again in 00:42');
    expect(apply().disabled).toBe(true);
  });

  it('sorts the results by a line of a card: one search of the applied search, labelled over the results', async () => {
    const { client } = setup();
    fireEvent.click(apply());
    await flush();
    const line = screen.getAllByRole('button', { name: /^Sort by \+\d+ to maximum Life/ })[0]!;
    fireEvent.click(line);
    await flush();
    expect(client.search).toHaveBeenCalledTimes(2);
    const [, , sort] = client.search.mock.calls[1]!;
    expect(Object.values(sort!)).toEqual(['desc']);
    expect(Object.keys(sort!)[0]).toMatch(/^stat\.explicit\.stat_/);
    const results = screen.getByRole('main', { name: 'Results' });
    const select = within(results).getByRole('combobox', { name: 'Sort' }) as HTMLSelectElement;
    expect(select.value).toBe('field');
    expect(select.selectedOptions[0]!.text).toBe('Sorted by # to maximum Life: high to low');
    expect(status()).toBe('6 active conditions');
  });

  it('sorts by price from the price of a listing: high to low, then back, one search each, as the site does', async () => {
    const { client } = setup();
    fireEvent.click(apply());
    await flush();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sort by price, now low to high' })[0]!);
    await flush();
    expect(client.search).toHaveBeenCalledTimes(2);
    expect(client.search.mock.calls[1]![2]).toEqual({ price: 'desc' });
    const select = within(screen.getByRole('main', { name: 'Results' })).getByRole('combobox', { name: 'Sort' }) as HTMLSelectElement;
    expect(select.value).toBe('price-desc');
    fireEvent.click(screen.getAllByRole('button', { name: 'Sort by price, now high to low' })[0]!);
    await flush();
    expect(client.search).toHaveBeenCalledTimes(3);
    expect(client.search.mock.calls[2]![2]).toEqual({ price: 'asc' });
  });

  describe('Your filters: compact rows (step 41 C)', () => {
    const FILTERS = {
      type_filters: { filters: { category: { option: 'accessory.ring' }, ilvl: { min: 80 } } },
      misc_filters: { filters: { corrupted: { option: 'false' }, future_filter: { option: 'x' } } },
      req_filters: { filters: { str: { max: 100 } } },
    };
    const row = (name: string) => screen.getByRole('group', { name });
    const searched = async (client: ReturnType<typeof setup>['client']) => {
      fireEvent.click(apply());
      await flush();
      return client.search.mock.calls.at(-1)![1] as { filters: Record<string, { filters: Record<string, unknown> }> };
    };

    it('shows the filters beyond stats as compact rows, counted with the rest; the pinned ones stay at the top', () => {
      setup({ query: { ...QUERY, filters: FILTERS } });
      expect(within(row('Item level')).getByRole('button', { name: 'Edit Item level: ≥ 80' })).toBeTruthy();
      expect(within(row('Corrupted')).getByRole('button', { name: 'Edit Corrupted: No' })).toBeTruthy();
      expect(within(row('Required Strength')).getByRole('button', { name: 'Edit Required Strength: ≤ 100' })).toBeTruthy();
      expect(screen.queryByRole('group', { name: 'Category' })).toBeNull();
      // 3 stats (Life, Fire, Cold) + 3 rows + the field the extension does not know
      expect(screen.getByRole('region', { name: 'Parameters' }).querySelector('.p2t-parameters-head')!.textContent).toBe('Your filters7');
      expect(row('misc_filters.future_filter').textContent).toContain('Kept from the link');
    });

    it('edits a row in place: Corrupted No to Yes, a range typed', async () => {
      const { client } = setup({ query: { ...QUERY, filters: FILTERS } });
      fireEvent.click(within(row('Corrupted')).getByRole('button', { name: 'Edit Corrupted: No' }));
      fireEvent.click(within(row('Corrupted')).getByRole('radio', { name: 'Yes' }));
      fireEvent.click(within(row('Item level')).getByRole('button', { name: 'Edit Item level: ≥ 80' }));
      fireEvent.input(within(row('Item level')).getByRole('textbox', { name: 'Item level maximum' }), { target: { value: '84' } });
      const query = await searched(client);
      expect(query.filters.misc_filters!.filters.corrupted).toEqual({ option: 'true' });
      expect(query.filters.type_filters!.filters.ilvl).toEqual({ min: 80, max: 84 });
      expect(within(row('Item level')).getByRole('button', { name: 'Edit Item level: 80–84' })).toBeTruthy();
    });

    it('removes a row as no condition at all, Undo bringing it back', async () => {
      const { client } = setup({ query: { ...QUERY, filters: FILTERS } });
      fireEvent.click(screen.getByRole('button', { name: 'Remove Corrupted filter' }));
      expect(screen.queryByRole('group', { name: 'Corrupted' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(row('Corrupted')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Remove Corrupted filter' }));
      expect(JSON.stringify((await searched(client)).filters)).not.toContain('corrupted');
    });

    it('warns about a filter that does not fit the item, and keeps it', () => {
      setup({ query: { ...QUERY, filters: { ...FILTERS, equipment_filters: { filters: { pdps: { min: 300 } } } } } });
      expect(row('Physical DPS').textContent).toContain('Not available for this item category');
      expect(apply().disabled).toBe(false);
    });

    it('says what to do when there is nothing yet', () => {
      setup({ query: { status: { option: 'online' } } });
      expect(screen.getByText('Add stats or item properties to narrow your search.')).toBeTruthy();
    });
  });

  it('shows only the parameters of the draft, a block each, and the button to add one', () => {
    setup();
    expect(screen.queryByRole('tablist')).toBeNull();
    const parameters = screen.getByRole('region', { name: 'Parameters' });
    expect(within(parameters).getAllByRole('textbox', { name: / minimum$/ }).map((field) => field.getAttribute('aria-label'))).toEqual([
      'Life minimum',
      'Fire Resistance minimum',
      'Cold Resistance minimum',
    ]);
    expect(minimum('Life').closest('.p2t-condition')!.textContent).toContain('Total');
    expect(minimum('Life').value).toBe('80');
    expect(within(parameters).getByRole('button', { name: 'Add parameter' })).toBeTruthy();
  });

  it('counts the parameters, and switches the source of one in place', () => {
    setup();
    const parameters = screen.getByRole('region', { name: 'Parameters' });
    expect(parameters.querySelector('.p2t-parameters-head')!.textContent).toBe('Your filters3');
    const source = within(parameters).getByRole('combobox', { name: 'Life source' }) as HTMLSelectElement;
    expect(source.value).toBe('pseudo.pseudo_total_life');
    fireEvent.change(source, { target: { value: 'explicit.stat_3299347043' } });
    expect((within(parameters).getByRole('combobox', { name: 'Life source' }) as HTMLSelectElement).value).toBe('explicit.stat_3299347043');
    expect(minimum('Life').value).toBe('80');
    expect(status()).toBe('Filters changed — Find items to update results');
  });

  it('says there are no parameters yet', () => {
    setup({ query: { status: { option: 'online' } } });
    expect(within(screen.getByRole('region', { name: 'Parameters' })).getByText('Add stats or item properties to narrow your search.')).toBeTruthy();
  });

  it('edits a parameter in its block and removes the block', () => {
    setup();
    fireEvent.input(minimum('Life'), { target: { value: '95' } });
    expect(minimum('Life').value).toBe('95');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Life' }));
    expect(screen.queryByRole('textbox', { name: 'Life minimum' })).toBeNull();
    expect(status()).toBe('Filters changed — Find items to update results');
  });

  it('keeps every condition of the query in view and editable, named by its parameter when known', () => {
    const query = { ...QUERY, stats: [{ type: 'and', filters: [...(QUERY as { stats: { filters: unknown[] }[] }).stats[0]!.filters, { id: 'explicit.stat_3032590688', value: { min: 5 } }, { id: 'explicit.stat_1754445556', value: { min: 2 } }] }] };
    setup({ query });
    expect(minimum('Added Physical Damage to Attacks').value).toBe('5');
    expect(minimum('Adds # to # Lightning damage to Attacks').value).toBe('2');
  });

  describe('conditions the simple editor cannot represent (step 39 C)', () => {
    const LIFE_ID = 'pseudo.pseudo_total_life';
    const FIRE_ID = 'pseudo.pseudo_total_fire_resistance';
    const COLD_ID = 'pseudo.pseudo_total_cold_resistance';
    const kept = (name: string) => screen.getByRole('group', { name });
    const notice = () => screen.getByText('This search uses conditions the simple editor cannot represent.');
    const searched = async (client: ReturnType<typeof setup>['client']) => {
      fireEvent.click(apply());
      await flush();
      return (client.search.mock.calls.at(-1)![1] as { stats: unknown[] }).stats;
    };

    it('keeps a weighted sum as a card with its conditions, says so once, and searches it unchanged', async () => {
      const weight = { type: 'weight', value: { min: 10 }, filters: [{ id: 'explicit.stat_3299347043', value: { weight: 1 } }] };
      const { client } = setup({ query: { ...QUERY, stats: [...(QUERY as { stats: unknown[] }).stats, weight] } });
      expect(kept('Weighted sum').textContent).toContain('Life');
      expect(notice()).toBeTruthy();
      expect(await searched(client)).toContainEqual(weight);
    });

    it('opens the search in the original site from the notice, with every condition', () => {
      const weight = { type: 'weight', value: { min: 10 }, filters: [{ id: 'explicit.stat_3299347043', value: { weight: 1 } }] };
      const { props } = setup({ query: { ...QUERY, stats: [weight] } });
      fireEvent.click(screen.getByRole('button', { name: 'Open in original' }));
      expect(props.onShowOriginal).toHaveBeenLastCalledWith({ league: 'Forbidden Rites', query: expect.objectContaining({ stats: [weight] }) });
    });

    it('does not offer At least N for a count with a maximum: it is kept as it is', async () => {
      const exact = { type: 'count', value: { min: 1, max: 1 }, filters: [{ id: FIRE_ID, value: { min: 35 } }, { id: COLD_ID, value: { min: 30 } }] };
      const { client } = setup({ query: { ...QUERY, stats: [exact] } });
      expect(kept('At least 1 and at most 1 of 2')).toBeTruthy();
      expect(screen.queryByRole('combobox', { name: 'How many must match' })).toBeNull();
      expect(await searched(client)).toEqual([exact]);
    });

    it('keeps None of with ranges as it is', () => {
      setup({ query: { ...QUERY, stats: [{ type: 'not', filters: [{ id: FIRE_ID, value: { min: 10 } }] }] } });
      expect(kept('None of, with ranges').textContent).toContain('Fire Resistance');
      expect(screen.queryByRole('button', { name: 'Mode of Fire Resistance' })).toBeNull();
    });

    it('keeps a group turned off on the site, and a row turned off, which can be turned on', () => {
      const query = {
        ...QUERY,
        stats: [
          { type: 'and', filters: [{ id: LIFE_ID, value: { min: 80 } }, { id: FIRE_ID, value: { min: 35 }, disabled: true }] },
          { type: 'count', disabled: true, value: { min: 1 }, filters: [{ id: COLD_ID, value: { min: 30 } }] },
        ],
      };
      setup({ query });
      expect(kept('Turned off on the site').textContent).toContain('Cold Resistance');
      const off = kept('Fire Resistance, turned off on the site');
      fireEvent.click(within(off).getByRole('button', { name: 'Turn on Fire Resistance' }));
      expect(screen.getByRole('button', { name: 'Mode of Fire Resistance' })).toBeTruthy();
    });

    it('removes a kept condition only when asked, with Undo', () => {
      setup({ query: { ...QUERY, stats: [{ type: 'weight', value: { min: 10 }, filters: [{ id: 'explicit.stat_3299347043', value: { weight: 1 } }] }] } });
      fireEvent.click(within(kept('Weighted sum')).getByRole('button', { name: 'Remove Weighted sum' }));
      expect(screen.queryByRole('group', { name: 'Weighted sum' })).toBeNull();
      expect(screen.queryByText('This search uses conditions the simple editor cannot represent.')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(kept('Weighted sum')).toBeTruthy();
    });
  });

  it('warns about a condition the chosen item cannot have, and keeps it', () => {
    const query = { ...QUERY, stats: [{ type: 'and', filters: [{ id: 'explicit.stat_3981240776', value: { min: 30 } }] }] };
    setup({ query });
    expect(minimum('Spirit').value).toBe('30');
    expect(minimum('Spirit').closest('.p2t-condition')!.textContent).toContain('Not on this item');
  });

  it('adds a parameter from the search as a block and puts the cursor into its value', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add parameter' }));
    const search = screen.getByRole('combobox', { name: 'Search parameters' });
    fireEvent.input(search, { target: { value: 'lightning res' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(screen.queryByRole('combobox', { name: 'Search parameters' })).toBeNull();
    expect(document.activeElement).toBe(minimum('Lightning Resistance'));
    expect(minimum('Lightning Resistance').value).toBe('');
  });

  it('focuses the block already there instead of adding it twice', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add parameter' }));
    fireEvent.input(screen.getByRole('combobox', { name: 'Search parameters' }), { target: { value: 'maximum life' } });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search parameters' }), { key: 'Enter' });
    expect(document.activeElement).toBe(minimum('Life'));
    expect(screen.getAllByRole('textbox', { name: 'Life minimum' })).toHaveLength(1);
  });

  it('opens the parameter search with / outside a field', () => {
    setup();
    fireEvent.keyDown(screen.getByRole('region', { name: 'Filters' }), { key: '/' });
    expect(screen.getByRole('combobox', { name: 'Search parameters' })).toBeTruthy();
  });

  it('remembers added parameters as recent', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add parameter' }));
    fireEvent.input(screen.getByRole('combobox', { name: 'Search parameters' }), { target: { value: 'explicit.stat_3032590688' } });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search parameters' }), { key: 'Enter' });
    expect(minimum('Added Physical Damage to Attacks')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add parameter' }));
    expect(within(screen.getByRole('group', { name: 'Recent' })).getAllByRole('option')[0]!.getAttribute('data-label')).toBe('Added Physical Damage to Attacks');
  });

  it('asks for open prefixes or suffixes and an item that is not corrupted with switches', async () => {
    const { client } = setup();
    fireEvent.click(screen.getByRole('switch', { name: 'Open prefix' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Not corrupted' }));
    expect(screen.getByRole('switch', { name: 'Open prefix' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('textbox', { name: /Empty Prefix/ })).toBeNull(); // a switch, not a block
    fireEvent.click(apply());
    await flush();
    const query = client.search.mock.calls[0]![1] as { stats: { filters: { id: string; value?: unknown }[] }[]; filters: { misc_filters?: { filters: Record<string, unknown> } } };
    expect(query.stats[0]!.filters).toContainEqual({ id: 'pseudo.pseudo_number_of_empty_prefix_mods', value: { min: 1 } });
    expect(query.filters.misc_filters!.filters.corrupted).toEqual({ option: 'false' });
    fireEvent.click(screen.getByRole('switch', { name: 'Open prefix' }));
    expect(screen.getByRole('switch', { name: 'Open prefix' }).getAttribute('aria-checked')).toBe('false');
  });

  it('takes a value typed right after picking a parameter', async () => {
    const { client } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add parameter' }));
    fireEvent.input(screen.getByRole('combobox', { name: 'Search parameters' }), { target: { value: 'rarity of items' } });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search parameters' }), { key: 'Enter' });
    const field = document.activeElement as HTMLInputElement;
    expect(field.getAttribute('aria-label')).toBe('Rarity of Items found minimum');
    fireEvent.input(field, { target: { value: '10' } });
    fireEvent.click(apply());
    await flush();
    const query = client.search.mock.calls[0]![1] as { stats: { filters: { id: string; value?: unknown }[] }[] };
    expect(query.stats[0]!.filters).toContainEqual({ id: 'explicit.stat_3917489142', value: { min: 10 } });
  });

  it('colours each block by its stat', () => {
    setup();
    expect(['Life', 'Fire Resistance', 'Cold Resistance'].map((label) => minimum(label).closest('.p2t-condition')!.getAttribute('data-stat'))).toEqual(['life', 'fire', 'cold']);
  });
});
