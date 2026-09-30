import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { type Listing, parseListing } from '@/lib/listing/parse';
import { itemPresentation } from '@/lib/listing/presentation';
import { loadListings } from '../../../tests/fixtures/load';
import { ItemCard } from './ItemCard';

const RINGS = loadListings('listings-rings').listings.map(parseListing);
const RING = RINGS.find((listing) => listing.mods.length >= 6)!;

function renderCard(listing: Listing, matched: string[] = []) {
  const view = render(<ItemCard item={itemPresentation(listing)} matchedStats={new Set(matched)} />);
  return { ...view, card: view.container.querySelector('article')! };
}

describe('ItemCard', () => {
  it('has a header in the rarity frame with name and base', () => {
    const { card } = renderCard(RING);
    expect(card.classList.contains('p2t-item')).toBe(true);
    expect(card.getAttribute('data-rarity')).toBe('rare');
    const heading = within(card).getByRole('heading');
    expect(heading.textContent).toBe(`${RING.item.name}${RING.item.baseType}`);
  });

  it('shows every mod in full: nothing folds into "+N more"', () => {
    const { card } = renderCard(RING);
    const lines = [...card.querySelectorAll('.p2t-item__mods li .p2t-item__text')].map((item) => item.textContent);
    expect(lines).toEqual(RING.mods.map((mod) => mod.text));
    expect(card.textContent).not.toMatch(/more/);
  });

  it('shows item level, properties and requirements above the mods', () => {
    const { card } = renderCard(RING);
    const properties = card.querySelector('.p2t-item__properties')!;
    expect(properties.textContent).toContain(`Item Level: ${RING.item.ilvl}`);
    if (RING.item.requirements) expect(properties.textContent).toContain(`Requires: ${RING.item.requirements}`);
  });

  it('separates the mod sections with the divider and titles all but the explicit mods', () => {
    const listing: Listing = { ...RING, mods: [{ kind: 'implicit', text: '+10% to Cold Resistance' }, { kind: 'explicit', text: '+80 to maximum Life' }, { kind: 'crafted', text: '+5 to Strength' }] };
    const { card } = renderCard(listing);
    expect(card.querySelectorAll('hr.p2t-item__divider')).toHaveLength(3);
    expect([...card.querySelectorAll('.p2t-item__section-title')].map((title) => title.textContent)).toEqual(['Implicit', 'Crafted']);
  });

  it('marks the mods a stat filter matched exactly', () => {
    const matched = RING.mods.find((mod) => mod.statId)!;
    const { card } = renderCard(RING, [matched.statId!]);
    const marked = [...card.querySelectorAll('li[data-match="true"] .p2t-item__text')].map((item) => item.textContent);
    expect(marked).toEqual(RING.mods.filter((mod) => mod.statId === matched.statId).map((mod) => mod.text));
  });

  it('marks the lines of a searched parameter in its colour, for a total too, and nothing else', () => {
    const listing: Listing = {
      ...RING,
      mods: [
        { kind: 'implicit', text: '+22% to Cold Resistance', statId: 'implicit.stat_4220027924' },
        { kind: 'explicit', text: '+84 to maximum Life', statId: 'explicit.stat_3299347043' },
        { kind: 'explicit', text: '+36% to Fire Resistance', statId: 'explicit.stat_3372524247' },
        { kind: 'explicit', text: '+18 to Intelligence', statId: 'explicit.stat_328541901' },
        { kind: 'pseudo', text: '+84 total maximum Life', statId: 'pseudo.pseudo_total_life' },
      ],
    };
    const { card } = renderCard(listing, ['pseudo.pseudo_total_life', 'pseudo.pseudo_total_cold_resistance']);
    const marked = [...card.querySelectorAll('li[data-match="true"]')].map((line) => [line.getAttribute('data-stat'), line.querySelector('.p2t-item__text')!.textContent]);
    expect(marked).toEqual([
      ['cold', '+22% to Cold Resistance'],
      ['life', '+84 to maximum Life'],
      ['life', '+84 total maximum Life'],
    ]);
    expect(card.querySelector('.p2t-item__highlights')).toBeNull();
  });

  it('shows the server totals under the card, each sorting by its field, marked at max quality', () => {
    const onSort = vi.fn();
    const listing: Listing = { ...RING, item: { ...RING.item, totals: [{ key: 'dps', value: 180.5, augmented: true }, { key: 'pdps', value: 120 }] } };
    const view = render(<ItemCard item={itemPresentation(listing)} matchedStats={new Set()} onSort={onSort} />);
    const totals = view.container.querySelector('.p2t-item__totals')!;
    expect(totals.textContent).toBe('DPS: 180.5Physical DPS: 120');
    expect(totals.querySelector('[data-augmented]')!.getAttribute('title')).toBe('at max Quality');
    fireEvent.click(within(totals as HTMLElement).getByRole('button', { name: /^Sort by Physical DPS/ }));
    expect(onSort).toHaveBeenCalledWith('pdps');
  });

  it('says when the item is corrupted, and uses a neutral frame for other item kinds', () => {
    const { card } = renderCard({ ...RING, item: { ...RING.item, corrupted: true, rarity: 'Currency' } });
    expect(within(card).getByText('Corrupted')).toBeTruthy();
    expect(card.getAttribute('data-rarity')).toBe('other');
  });
});

describe('ItemCard names', () => {
  it('uses the type line as the title of an item without a name', () => {
    const listing: Listing = { ...RING, item: { ...RING.item, name: '', typeLine: 'Ruby Ring' } };
    render(<ItemCard item={itemPresentation(listing)} matchedStats={new Set()} />);
    expect(screen.getByRole('heading').textContent).toBe('Ruby Ring');
  });
});

describe('ItemCard for the site frames', () => {
  it('names its kind of card and how many lines its header has', () => {
    const { card, unmount } = renderCard(RING);
    expect(card.getAttribute('data-frame')).toBe('rare');
    expect(card.querySelector('.p2t-item__header')!.getAttribute('data-lines')).toBe('2');
    unmount();

    const { card: plain } = renderCard({ ...RING, item: { ...RING.item, name: '', typeLine: 'Ruby Ring', frameType: 0, rarity: 'Normal' } });
    expect(plain.getAttribute('data-frame')).toBe('normal');
    expect(plain.querySelector('.p2t-item__header')!.getAttribute('data-lines')).toBe('1');
  });

  it('tells each mod section its kind, for the game colours', () => {
    const listing: Listing = { ...RING, mods: [{ kind: 'implicit', text: 'a' }, { kind: 'fractured', text: 'b' }, { kind: 'explicit', text: 'c' }] };
    const { card } = renderCard(listing);
    expect([...card.querySelectorAll('.p2t-item__section')].map((section) => section.getAttribute('data-kind'))).toEqual(['implicit', 'fractured', 'explicit']);
  });
});

describe('ItemCard details', () => {
  it('opens the properties with the category line', () => {
    const { card } = renderCard(RING);
    expect(card.querySelector('.p2t-item__category')!.textContent).toBe(RING.item.category);
  });

  it('marks each mod with its tier and keeps the mod details for hover and focus', () => {
    const { card } = renderCard(RING);
    const line = [...card.querySelectorAll('.p2t-item__mods li')].find((item) => item.querySelector('.p2t-item__text')?.textContent === '+249 to Accuracy Rating')!;
    const tier = line.querySelector('.p2t-item__tier')!;
    expect([tier.textContent, tier.getAttribute('data-affix')]).toEqual(['P2', 'prefix']);
    expect(line.querySelector('.p2t-item__range')!.textContent).toBe('[237—346]');
    expect(line.querySelector('.p2t-item__mod-name')!.textContent).toBe("Hunter's (≥58)");
  });

  it('shows the server pseudo totals last, without a title', () => {
    const listing: Listing = { ...RING, mods: [...RING.mods, { kind: 'pseudo', text: '+37% total to Fire Resistance', statId: 'pseudo.pseudo_total_fire_resistance' }] };
    const { card } = renderCard(listing);
    const last = [...card.querySelectorAll('.p2t-item__section')].at(-1)!;
    expect(last.getAttribute('data-kind')).toBe('pseudo');
    expect(last.querySelector('.p2t-item__section-title')).toBeNull();
    expect(last.textContent).toContain('+37% total to Fire Resistance');
  });
});

describe('ItemCard sorting', () => {
  function renderSortable(sort: { field: string; direction: 'asc' | 'desc' } | null = null) {
    const onSort = vi.fn();
    const view = render(<ItemCard item={itemPresentation(RING)} matchedStats={new Set()} sort={sort} onSort={onSort} />);
    return { ...view, onSort, card: view.container.querySelector('article')! };
  }

  it('turns the lines the trade site can sort by into buttons', () => {
    const { onSort } = renderSortable();
    const accuracy = RING.mods.find((mod) => mod.text === '+249 to Accuracy Rating')!;
    fireEvent.click(screen.getByRole('button', { name: 'Sort by +249 to Accuracy Rating' }));
    expect(onSort).toHaveBeenLastCalledWith(`stat.${accuracy.statId}`);
    fireEvent.click(screen.getByRole('button', { name: `Sort by Item Level: ${RING.item.ilvl}` }));
    expect(onSort).toHaveBeenLastCalledWith('ilvl');
    fireEvent.click(screen.getByRole('button', { name: /^Sort by Level \d+$/ }));
    expect(onSort).toHaveBeenLastCalledWith('lvl');
  });

  it('sorts by each property and by each part of the requirements on its own', () => {
    const gloves = parseListing(loadListings('listings-online').listings[0]!);
    const onSort = vi.fn();
    render(<ItemCard item={itemPresentation(gloves)} matchedStats={new Set()} onSort={onSort} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Evasion Rating: 105' }));
    expect(onSort).toHaveBeenLastCalledWith('ev');
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Level 48' }));
    expect(onSort).toHaveBeenLastCalledWith('lvl');
    fireEvent.click(screen.getByRole('button', { name: 'Sort by 56 Dex' }));
    expect(onSort).toHaveBeenLastCalledWith('dex');
    expect(screen.getByText('Requires:', { exact: false }).closest('p')!.textContent).toBe('Requires: Level 48, 56 Dex');
  });

  it('marks the line the results are sorted by', () => {
    const accuracy = RING.mods.find((mod) => mod.text === '+249 to Accuracy Rating')!;
    const { card } = renderSortable({ field: `stat.${accuracy.statId}`, direction: 'desc' });
    const sorted = card.querySelectorAll('[data-sorted]');
    expect(sorted).toHaveLength(1);
    expect(sorted[0]!.getAttribute('data-sorted')).toBe('desc');
    expect(sorted[0]!.getAttribute('aria-label')).toBe('Sort by +249 to Accuracy Rating, sorted high to low');
  });

  it('keeps plain lines without a sort handler', () => {
    render(<ItemCard item={itemPresentation(RING)} matchedStats={new Set()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

