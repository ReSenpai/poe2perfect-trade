# Architecture

poe2perfect trade is a WXT browser extension (Manifest V3, Chrome and Firefox from one source) written in TypeScript
with Preact. A single content script runs on `pathofexile.com/trade2/*`, mounts a workspace in a shadow root over the
site's search page and talks to the trade site's own API from the page's origin, with the user's session.

## Code layout

| Path | What lives there |
| --- | --- |
| `src/entrypoints/trade-page.content.ts` | The content script: mounts the UI, wires the API client, storage and page state. |
| `src/entrypoints/popup/` | A dev-only popup (not in production builds) that captures a scrubbed listings fixture. |
| `src/lib/api/` | The trade API client (`client.ts`), response shapes (`raw.ts`) and rate-limit headers (`rate-limit.ts`). |
| `src/lib/query/` | The trade query model, its URL codec (gzip + base64url) and normalization. |
| `src/lib/editor/` | The editor store: the draft query document, applied search, results, validation, Undo. |
| `src/lib/catalog/` | Stat and filter catalogs: search index, parameter picker, applicability, filter registry, category art. |
| `src/lib/gamedata/` | Which stats each item class can have (`public/data/base-stats.json`, see "Game data"). |
| `src/lib/listing/` | Parsing listings, card presentation (frames, sort fields), item text for copying. |
| `src/lib/results/` | Search and fetch flow, paging, snapshots of recent results. |
| `src/lib/page/` | Page integration: SPA URL tracking, search history, preferences, storage cache, page-origin fetch. |
| `src/lib/saved/` | Saved searches and the remembered unsearched draft. |
| `src/lib/site/` | Reading what the site gives the page: `window.tradeOpts`, item card frames from the site's CSS. |
| `src/lib/build/` | The manifest per browser. |
| `src/lib/dev/` | Fixture capture and scrubbing for the dev popup. |
| `src/ui/app/` | Shadow-root mount, the overlay and the switch between the workspace and the original page. |
| `src/ui/kit/`, `src/ui/theme/` | Design tokens, icons, shell images, fonts. |
| `src/ui/v4/` | The workspace: filters, parameters, listings, compare, saved searches, dialogs. |
| `scripts/` | `build-base-stats.ts` (game data), `fetch-catalogs.mjs` (test fixtures of the reference data). |
| `tests/fixtures/` | Reference data and scrubbed listings captured from the live site, plus a fake API client. |

Comments cite the design documents the interface was built from ("v4 §N", "shell v5", "the unified filters design"
and so on) and the development step a piece came from. Those documents are not part of the repository; the code and
tests are the reference.

## Principles

- **One search per Find items.** Nothing searches on its own: not opening a page, not Back or Forward, not opening a
  saved search. Results of a recent search are shown again from a local snapshot.
- **The page's origin, the user's session.** Requests go to `https://www.pathofexile.com/api/trade2/` same-origin.
  In Firefox the content script's `fetch` would run as the extension, so `pageFetch` uses `content.fetch` there.
- **The site stays the site.** Item cards use the site's own frames and fonts; the original page is one click away.
- **Nothing leaves the browser** except requests to the trade site. See [PRIVACY.md](../PRIVACY.md).

## Trade API

Base `https://www.pathofexile.com/api/trade2/`. Findings from the live site; formats can change with the site.

### Reference data `data/*`

Public and CDN-cached (`cache-control: max-age=14400`), no rate-limit headers. `node scripts/fetch-catalogs.mjs`
refreshes the copies in `tests/fixtures/data/`.

| Request | Contents |
| --- | --- |
| `data/leagues` | `result[]`: `{ id, realm: 'poe2', text }` |
| `data/stats` | `result[]`: `{ id, label, entries[] }` by source (pseudo, explicit, implicit, fractured, crafted, enchant, rune, desecrated, sanctum, skill); an entry is `{ id: 'explicit.stat_3299347043', text: '# to maximum Life', type }` |
| `data/filters` | `result[]`: `{ id, title, hidden, filters[] }` — `status_filters`, `type_filters` (category, rarity, ilvl, quality), `equipment_filters`, `req_filters`, `map_filters`, `misc_filters`, `trade_filters` |
| `data/static` | `result[]`: `{ id, label, entries[] }` — currencies, fragments, runes…; an entry is `{ id, text, image }` |
| `data/items` | `result[]` by category; an entry is `{ type }`, uniques also `{ name, text, flags: { unique: true } }` |

### Search

- `POST search/poe2/{league}` with `{ query, sort }` → `{ id, complexity, result: [up to 100 listing hashes], total }`;
  `total` is capped at 10000.
- **The `id` is the query itself**: base64url(gzip(JSON `query`)), without `sort`. The page address
  `/trade2/search/poe2/{league}/{id}` carries the whole query (`src/lib/query/codec.ts`).
- The page's initial state is an inline `window.tradeOpts = {…}` with the decoded query of the address
  (`src/lib/site/trade-opts.ts`).
- Searching works without a session too (IP rules only, stricter).

### Listings

`GET fetch/{up to 10 hashes, comma-separated}?query={id}` → `result[]` (an element may be `null`) of
`{ id, listing, item }`.

- `listing`: `indexed`, `stash`, `price { type, amount, currency }`, `account { name, online, … }`; In Person listings
  carry `whisper` (the seller's language, copied as is) and `whisper_token`; Instant Buyout listings carry
  `hideout_token` and a gold `fee`.
- `item`: name, type, rarity, `frameType`, `ilvl`, properties, requirements, mods by kind, `extended.hashes` linking mods
  to catalog stats (used to mark the searched parameters on a card).

### Whisper and Travel to hideout

`POST whisper` with `{ token, continue?: true }`, the token being `whisper_token` (In Person: a whisper in the game) or
`hideout_token` (Instant Buyout: travel to the seller's hideout). `{ success: true }` on success; otherwise the site
says the item is in demand and the next press sends `continue: true`. Both act in the game: never call them in tests
or checks.

### Rate limits

Headers `X-Rate-Limit-Policy`, `X-Rate-Limit-Rules: Account,Ip`, `X-Rate-Limit-<Rule>: hits:period:penalty,…` and
`X-Rate-Limit-<Rule>-State: current:period:penalty,…`; a 429 carries `Retry-After`.

| Policy | Account | Ip |
| --- | --- | --- |
| `trade-search-request-limit` | 3 per 5 s (60 s penalty) | 8/10 s, 15/60 s, 60/300 s, 600/3 h |
| `trade-fetch-request-limit` | 6 per 4 s (10 s penalty) | 12/4 s, 16/12 s, 100/300 s, 1000/3 h |

A lockout also blocks the user's own trading, so the extension searches only on request and counts down when the site
asks to wait. States that must not be provoked live (429, Cloudflare 403, network errors) are covered with
`tests/fixtures/fake-client.ts`.

## Game data

Which trade stats an item class can have comes from [repoe-fork](https://repoe-fork.github.io/poe2/) (game files
exported with PyPoE; code MIT, data by Grinding Gear Games): `mods_by_base.json`, `mods.json`, `base_items.json`,
`augments.json` and `stat_translations/stat_descriptions.json`.

`node --experimental-strip-types scripts/build-base-stats.ts` matches game stats to trade stats by their text (the
template without markup, numbers as `#`, `(Local)` variants first) and writes `public/data/base-stats.json`, a
web-accessible extension file read once by the content script. About 84 % of item modifiers match; the rest (mostly
modifiers the trade site does not list) stay "Availability not verified" in the UI rather than hidden. Rebuild after a
game patch and commit the result.

## Fonts

The interface uses the trade site's own fonts (Fontin small caps for names, headings and controls, Fontin regular for
text and fields): the site declares and loads them, and the shadow root sees them by name. Inter (bundled) and Georgia
stand in when they have not loaded.

## Browser differences

- **Firefox**: `content.fetch` for requests as the page; no customizable `<select>` (the chosen category picture is
  drawn beside the native list); no `::-webkit-scrollbar` (standard `scrollbar-width` and `scrollbar-color` instead).
- **Chrome**: the customizable `<select>` (`appearance: base-select`) shows pictures in the category list; scrollbars
  are styled with `::-webkit-scrollbar`, since the standard properties bring back arrow buttons on Windows.
