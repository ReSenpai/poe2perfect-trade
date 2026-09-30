import connectionError from './assets/states/connection-error.svg?raw';
import emptySearch from './assets/states/empty-search.svg?raw';
import noResults from './assets/states/no-results.svg?raw';
import verification from './assets/states/verification.svg?raw';

const dataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;

/** Illustrations of the result states from the kit, as data URIs: nothing is fetched from inside the site page. */
export const STATE_IMAGES = {
  emptySearch: dataUri(emptySearch),
  noResults: dataUri(noResults),
  connectionError: dataUri(connectionError),
  verification: dataUri(verification),
};
