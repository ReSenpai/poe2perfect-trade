# poe2perfect trade

Browser extension (WXT, Manifest V3, Chrome and Firefox from one source): replaces the Path of Exile 2 trade search
page on pathofexile.com (`/trade2/search/poe2/...`) with a two-pane workspace — filters on the left, listings on the
right. How the code is laid out and what is known about the trade API: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Sample search for checks (a rare ring: Life ≥ 80, Fire ≥ 35, Cold ≥ 30, ≤ 50 Exalted, In person; fixture
`tests/fixtures/listings-rings.json`): https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/H4sIAAAAAAAACn2QwWrEMAxE_2XOZgmUheJfKUsQtrIIXDvIStmw6N9LmkOzlOYkidE8NHqiG9nSEZ9os0mriGi1SGV4-BE74scTts6MCKoZAZMUY90FyYiYOy-5XfYyWjMqY5GJEfBFZeEN_ykV8X1wDyemSZRH5S7dqKa__rfruT-1kk_9g_vNb4cIe7TxMB_aRMb3puvLeygl7r3pelGp9-1NSir2uqSkDHcPMKX8H39WSftx9EC8DuEXwA8qxnljuH8DeLh6UacBAAA
(the league in the address may need updating when a league ends).

## Working style

- Strict TDD: write failing tests first, confirm red, implement to green, then refactor.
- Before a change is done: `npm test`, `npm run typecheck`, `npm run build` all pass (and `npm run build:firefox`
  when the manifest or browser APIs change).
- Check UI changes in a real browser on the sample search; compare with how the page looked before.
- All extension UI text is English (labels, buttons, empty states, errors, aria-labels).
- UI: compact, one screen, minimal chrome (quiet icon buttons); the listings get the space.
- Match the surrounding code: comment density, naming, idiom. Line endings as the file already has them.
- Personal preferences of a contributor (language of reports, pace) go in `CLAUDE.local.md`, which git ignores.

## Commands

- `npm test` · `npm run typecheck` · `npm run build` · `npm run build:firefox` · `npm run zip` · `npm run zip:firefox`.
- `npm run dev` — dev build in `.output/chrome-mv3-dev` (dev server on :3010), loaded unpacked in Chrome. Its
  auto-reload often misses content-script changes: reload the extension card before checking new code. Manifest
  changes (permissions, matches) always need that reload.
- `npm run dev:firefox` — the same for Firefox (`about:debugging` → Load Temporary Add-on).
- Game data for adaptive filters: `node --experimental-strip-types scripts/build-base-stats.ts` rebuilds
  `public/data/base-stats.json` from repoe-fork and the trade stats (after a game patch; commit the result).

## Checking the UI

- Content-script marker: `document.documentElement.getAttribute('data-poe2-trade')` — `search` on a trade2 search
  page, `idle` elsewhere on trade2.
- Shadow host `poe2perfect-trade`; in its shadow root the workspace is `[data-ui="v4"]` (`.p2t-filter-pane`,
  `.p2t-apply-bar`, `.p2t-results`, `.p2t-collapsed`, `.p2t-listing`); `.overlay` while loading, `.launcher` on the
  original page.
- The site's SPA does not follow `pushState` / `replaceState`: changing the URL from a check moves our UI only.
- API states that must not be provoked live (429, Cloudflare 403, fetch errors): `tests/fixtures/fake-client.ts`.

## Trade site rules

- API base `https://www.pathofexile.com/api/trade2/`; the content script calls it same-origin with the user's session
  (`pageFetch`: `content.fetch` in Firefox).
- Respect rate limits: read `X-Rate-Limit-*` headers; never loop requests in checks; keep live checks to a few calls.
  Search is 3 per 5 s per account and 15 per minute per IP (2 min lockout, which also blocks the user's own trading).
  Every reload of a search page costs one search (the site's own); the extension searches only on Find items.
- Never hand-copy an encoded search URL (`H4sI…`): build it with a script or in the page and check it by decoding.
- Never click or call **Travel to hideout** / **Direct whisper** while checking — they act in the user's game.
- `localStorage` may hold session data (`__POESESSION` etc.): never read, log or export it.
- Fixtures must be scrubbed: account names, character names, stash names, notes, `hideout_token`, `whisper`,
  `whisper_token` (`src/lib/dev/scrub.ts`; `tests/fixtures/fixtures.test.ts` checks it).
- Never set `innerHTML` (store review flags it; a test guards `src/`): build elements instead.
