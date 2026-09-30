/**
 * The manifest fields we set ourselves, per browser (WXT adds the rest: version, icons, content scripts). One source
 * for Chrome and Firefox; Firefox also needs a lasting id, a minimum version and its data collection declaration.
 */

/** The Firefox add-on id: fixed forever, a new id would be a new add-on on addons.mozilla.org. */
export const FIREFOX_ID = 'poe2perfect-trade@resenpai.dev';

const SITE = ['https://www.pathofexile.com/*', 'https://pathofexile.com/*'];

/**
 * The Firefox version of a package version. addons.mozilla.org takes digits only and each upload once, so a
 * pre-release (`1.1.0-beta.2`) is numbered just below its release, after the one before it: `1.0.999.2`.
 * Chrome keeps the package version and shows the pre-release in `version_name`.
 */
export function firefoxVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[a-z]+\.(\d+))?$/.exec(version);
  if (!match) throw new Error(`Cannot number ${version} for Firefox: use X.Y.Z or X.Y.Z-beta.N`);
  const [major, minor, patch] = match.slice(1, 4).map(Number) as [number, number, number];
  const pre = match[4];
  if (pre === undefined) return `${major}.${minor}.${patch}`;
  const below = patch > 0 ? [major, minor, patch - 1] : minor > 0 ? [major, minor - 1, 999] : [major - 1, 999, 999];
  return [...below, Number(pre)].join('.');
}

export function manifestFor(browser: string, version?: string) {
  return {
    name: 'poe2perfect trade',
    description: 'A clean two-pane workspace for the Path of Exile 2 trade site',
    permissions: ['storage'],
    // Game data read by the content script (public/data/base-stats.json) and the category pictures it shows
    // (public/category, step 34).
    web_accessible_resources: [{ resources: ['data/base-stats.json', 'category/*'], matches: SITE }],
    ...(browser === 'firefox'
      ? {
          ...(version ? { version: firefoxVersion(version) } : {}),
          browser_specific_settings: {
            // 140: the first Firefox (and ESR) that reads data_collection_permissions, which new add-ons must declare.
            gecko: { id: FIREFOX_ID, strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } },
          },
        }
      : {}),
  };
}
