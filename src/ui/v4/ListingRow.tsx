import { formatAge, type Listing, type SellerStatus } from '@/lib/listing/parse';
import { Icon } from '@/ui/kit/Icon';
import { itemPresentation } from '@/lib/listing/presentation';
import { ItemCard, type ItemCardProps } from './ItemCard';
import { TradeActions, type TradeActionsProps } from './TradeActions';

const STATUS: Record<SellerStatus, { text: string; tone: string }> = {
  online: { text: 'Online', tone: 'online' },
  afk: { text: 'AFK', tone: 'afk' },
  offline: { text: 'Offline', tone: 'offline' },
  // How the item is bought, not whether someone is online.
  instant: { text: 'Instant buyout', tone: 'instant' },
};

export interface ListingRowProps {
  listing: Listing;
  currencies: Map<string, { text: string; image?: string }>;
  matchedStats: Set<string>;
  now: number;
  sort?: ItemCardProps['sort'];
  onSort?: ItemCardProps['onSort'];
  /** The applied search's price sort, if it is one: the price of a listing sorts by price, the other way round. */
  priceSort?: 'asc' | 'desc' | null;
  whisper?: TradeActionsProps['whisper'];
  /** In the comparison. */
  compared?: boolean;
  onCompare?: (listing: Listing) => void;
}

/** One listing: the item icon, the full game card, and the trade column (price, how to buy, seller, age). */
export function ListingRow({ listing, currencies, matchedStats, now, sort, onSort, priceSort = null, whisper, compared = false, onCompare }: ListingRowProps) {
  const item = itemPresentation(listing);
  const { price, seller } = listing;
  const currency = price ? currencies.get(price.currency) : undefined;
  const status = STATUS[seller.status];
  // Results remembered before sockets were read have none.
  const sockets = listing.item.socketList ?? [];
  return (
    <li class="p2t-listing" data-listing-id={listing.id} data-selected={compared ? 'true' : undefined}>
      <div class="p2t-listing__art">
        <div
          class="p2t-listing__icon"
          style={listing.item.size ? { '--w': String(listing.item.size.w), '--h': String(listing.item.size.h) } : undefined}
        >
          {item.iconUrl && <img src={item.iconUrl} alt="" loading="lazy" />}
          {sockets.length > 0 && (
            // As on the site: over the icon, what sits in a socket by its picture and name.
            <div class="p2t-sockets">
              {sockets.map((socket, index) => (
                <span key={index} class="p2t-socket" data-type={socket.type} title={socket.item?.name ?? 'Empty socket'}>
                  {socket.item ? <img src={socket.item.icon} alt={socket.item.name} loading="lazy" /> : <span class="p2t-sr-only">Empty socket</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        {item.verified && <span class="p2t-listing__verified">Verified</span>}
        {onCompare && (
          <label class="p2t-compare-check">
            <input type="checkbox" checked={compared} aria-label={`Compare ${item.title}`} onChange={() => onCompare(listing)} />
            <span aria-hidden="true">Compare</span>
          </label>
        )}
      </div>
      <ItemCard item={item} matchedStats={matchedStats} sort={sort} onSort={onSort} />
      <div class="p2t-listing__trade">
        <div>
          <p class="p2t-listing__price-label">Price</p>
          {price && onSort ? (
            // As on the site: the price sorts the results by price, high to low, then low to high.
            <button
              type="button"
              class="p2t-price p2t-price--sort"
              data-sorted={priceSort ?? undefined}
              aria-label={`Sort by price${priceSort ? `, now ${priceSort === 'desc' ? 'high to low' : 'low to high'}` : ''}`}
              title={priceSort === 'desc' ? 'Sort by price: low to high' : 'Sort by price: high to low'}
              onClick={() => onSort('price')}
            >
              {price.amount} {currency?.image && <img class="p2t-price__icon" src={currency.image} alt="" width={24} height={24} />}
              <span class="p2t-price__currency">{currency?.text ?? price.currency}</span>
              {priceSort && <Icon name={priceSort === 'desc' ? 'chevron-down' : 'chevron-up'} size={12} class="p2t-price__sort-mark" />}
            </button>
          ) : (
            <p class="p2t-price">
              {price ? (
                <>
                  {price.amount} {currency?.image && <img class="p2t-price__icon" src={currency.image} alt="" width={24} height={24} />}
                  <span class="p2t-price__currency">{currency?.text ?? price.currency}</span>
                </>
              ) : (
                'No price'
              )}
            </p>
          )}
        </div>
        <div class="p2t-listing__seller" data-status={status.tone}>
          <span class="p2t-listing__dot" aria-hidden="true" />
          <span class="p2t-listing__account">{seller.account}</span>
          <span class={`p2t-status p2t-status--${status.tone}`}>{status.text}</span>
        </div>
        <TradeActions listing={listing} whisper={whisper} />
        <span class="p2t-listing__age">Listed {formatAge(listing.indexed, now)}</span>
      </div>
    </li>
  );
}
