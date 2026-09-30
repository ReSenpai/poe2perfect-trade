/**
 * The manifest fields we set ourselves, per browser (WXT adds the rest: version, icons, content scripts). One source
 * for Chrome and Firefox; Firefox also needs a lasting id, a minimum version and its data collection declaration.
 */

/** The Firefox add-on id: fixed forever, a new id would be a new add-on on addons.mozilla.org. */
export const FIREFOX_ID = 'poe2perfect-trade@resenpai';

const SITE = ['https://www.pathofexile.com/*', 'https://pathofexile.com/*'];

export function manifestFor(browser: string) {
  return {
    name: 'poe2perfect trade',
    description: 'A clean two-pane workspace for the Path of Exile 2 trade site',
    permissions: ['storage'],
    // Game data read by the content script (public/data/base-stats.json) and the category pictures it shows
    // (public/category, step 34).
    web_accessible_resources: [{ resources: ['data/base-stats.json', 'category/*'], matches: SITE }],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            // 140: the first Firefox (and ESR) that reads data_collection_permissions, which new add-ons must declare.
            gecko: { id: FIREFOX_ID, strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } },
          },
        }
      : {}),
  };
}
