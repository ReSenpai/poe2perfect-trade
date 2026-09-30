import { fireEvent, render, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { type Listing, parseListing } from '@/lib/listing/parse';
import { loadListings, loadWorkspaceData } from '../../../tests/fixtures/load';
import { ListingRow } from './ListingRow';

const DATA = loadWorkspaceData();
const NOW = Date.parse('2026-09-23T12:00:00Z');
const RING = parseListing(loadListings('listings-rings').listings[0]!);
const INSTANT = parseListing(loadListings('listings-securable').listings[0]!);

function renderRow(listing: Listing) {
  const { container } = render(
    <ul>
      <ListingRow listing={listing} currencies={DATA.currencies} matchedStats={new Set()} now={NOW} />
    </ul>,
  );
  return container.querySelector('li.p2t-listing') as HTMLElement;
}

describe('ListingRow', () => {
  it('shows the item icon from the trade data, the game card, and the trade column', () => {
    const row = renderRow(RING);
    const icon = row.querySelector('.p2t-listing__art img')!;
    expect(icon.getAttribute('src')).toBe(RING.item.icon);
    expect(icon.getAttribute('alt')).toBe('');
    expect(row.querySelector('article.p2t-item')).toBeTruthy();
    expect(row.querySelector('.p2t-listing__trade')).toBeTruthy();
  });

  it('shows the price from the listing with its currency name and icon, without the price type', () => {
    const trade = renderRow(RING).querySelector('.p2t-listing__trade') as HTMLElement;
    const currency = DATA.currencies.get(RING.price!.currency)!;
    expect(trade.querySelector('.p2t-price')!.textContent).toBe(`${RING.price!.amount} ${currency.text}`);
    expect(trade.querySelector('.p2t-price img')!.getAttribute('src')).toBe(currency.image);
    expect(within(trade).queryByText('Exact price')).toBeNull();
    const asking = renderRow({ ...RING, price: { ...RING.price!, type: 'b/o' } }).querySelector('.p2t-listing__trade') as HTMLElement;
    expect(within(asking).queryByText('Asking price')).toBeNull();
  });

  it('marks a verified listing under its icon', () => {
    expect(renderRow(RING).querySelector('.p2t-listing__art')!.textContent).toBe('Verified');
  });

  it('shows how the item is bought: an In person seller is online, Instant buyout is not called online', () => {
    const person = renderRow(RING).querySelector('.p2t-listing__trade') as HTMLElement;
    expect(within(person).getByText('Online')).toBeTruthy();
    expect(within(person).getByText(RING.seller.account)).toBeTruthy();

    const instant = renderRow(INSTANT).querySelector('.p2t-listing__trade') as HTMLElement;
    expect(within(instant).getByText('Instant buyout')).toBeTruthy();
    expect(within(instant).queryByText('Online')).toBeNull();
  });

  it('shows the age of the listing', () => {
    const row = renderRow({ ...RING, indexed: '2026-09-23T11:48:00Z' });
    expect(within(row.querySelector('.p2t-listing__trade') as HTMLElement).getByText('Listed 12 min ago')).toBeTruthy();
  });

  it('says when a listing has no price', () => {
    const row = renderRow({ ...RING, price: null });
    expect(row.querySelector('.p2t-price')!.textContent).toBe('No price');
  });

  it('offers the trade actions in the trade column', () => {
    const trade = renderRow(RING).querySelector('.p2t-listing__trade') as HTMLElement;
    expect(within(trade).getByRole('button', { name: 'Copy whisper' })).toBeTruthy();
    expect(within(trade).queryByRole('button', { name: 'Copy item' })).toBeNull();
  });
});

describe('ListingRow trade column', () => {
  it('names the price, and ends with the age of the listing', () => {
    const trade = renderRow(RING).querySelector('.p2t-listing__trade') as HTMLElement;
    expect(trade.firstElementChild!.textContent!.startsWith('Price')).toBe(true);
    expect(trade.lastElementChild!.classList.contains('p2t-listing__age')).toBe(true);
  });
});

describe('ListingRow sockets', () => {
  it('shows the sockets on the item icon, what sits in them by its picture and name', () => {
    const item = { ...RING.item, size: { w: 2, h: 3 }, socketList: [{ type: 'rune', item: { name: 'Lesser Iron Rune', icon: 'https://web.poecdn.com/filled.png' } }, { type: 'rune' }] };
    const icon = renderRow({ ...RING, item }).querySelector('.p2t-listing__icon') as HTMLElement;
    expect(icon.style.getPropertyValue('--w')).toBe('2');
    expect(icon.style.getPropertyValue('--h')).toBe('3');
    const sockets = [...icon.querySelectorAll('.p2t-socket')];
    expect(sockets.map((socket) => [socket.getAttribute('data-type'), socket.getAttribute('title')])).toEqual([
      ['rune', 'Lesser Iron Rune'],
      ['rune', 'Empty socket'],
    ]);
    expect(sockets[0]!.querySelector('img')!.getAttribute('src')).toBe('https://web.poecdn.com/filled.png');
    expect(sockets[1]!.querySelector('img')).toBeNull();
  });

  it('shows a remembered listing saved before sockets were read', () => {
    const { socketList: _gone, ...item } = RING.item;
    expect(renderRow({ ...RING, item: item as Listing['item'] }).querySelector('.p2t-sockets')).toBeNull();
  });

  it('has no sockets on an item without them', () => {
    expect(renderRow(RING).querySelector('.p2t-sockets')).toBeNull();
  });
});

describe('ListingRow compare', () => {
  it('has a Compare box under the icon, checked when the listing is compared', () => {
    const onCompare = vi.fn();
    const { container, rerender } = render(
      <ul>
        <ListingRow listing={RING} currencies={DATA.currencies} matchedStats={new Set()} now={NOW} compared={false} onCompare={onCompare} />
      </ul>,
    );
    const row = container.querySelector('li.p2t-listing') as HTMLElement;
    const box = within(row.querySelector('.p2t-listing__art') as HTMLElement).getByRole('checkbox', { name: `Compare ${RING.item.name}` }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(onCompare).toHaveBeenCalledWith(RING);
    rerender(
      <ul>
        <ListingRow listing={RING} currencies={DATA.currencies} matchedStats={new Set()} now={NOW} compared onCompare={onCompare} />
      </ul>,
    );
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
    expect(container.querySelector('li.p2t-listing')!.getAttribute('data-selected')).toBe('true');
  });
});
