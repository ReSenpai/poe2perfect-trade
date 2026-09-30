import { buildSearchPath } from '@/lib/trade-url';

/**
 * The address follows a finished search, as on the site, with one history entry per search (step 31): Back and
 * Forward then walk the searches, each opened from the address with its remembered results, without a new request.
 * Returns whether the address changed.
 */
export function followSearch(history: Pick<History, 'state' | 'pushState'>, pathname: string, league: string, id: string): boolean {
  const path = buildSearchPath(league, id);
  if (pathname === path) return false;
  history.pushState(history.state, '', path);
  return true;
}
