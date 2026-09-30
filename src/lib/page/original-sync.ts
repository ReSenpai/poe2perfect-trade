import type { PageMode } from './controller';

/**
 * The site's SPA does not follow pushState / replaceState: once the extension has written the address (a search, a
 * league), the site under the overlay still shows the search it opened with. Going to the original then reloads the
 * page, so the site opens the address the user sees.
 */
export function createOriginalSync(reload: () => void) {
  let written = false;
  return {
    markWritten() {
      written = true;
    },
    onModeChange(mode: PageMode) {
      if (mode === 'original' && written) reload();
    },
  };
}
