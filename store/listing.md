# Store listing — poe2perfect trade

Texts for the Chrome Web Store and Firefox Add-ons (addons.mozilla.org, AMO) listing forms. Copy each block into the
matching field. Both stores show descriptions as plain text: line breaks are kept, Markdown is not.

How to fill in each store step by step: [PUBLISHING-chrome.md](PUBLISHING-chrome.md),
[PUBLISHING-firefox.md](PUBLISHING-firefox.md). Graphics: `python scripts/make-store-assets.py` (see the table below).

## Name and summary

**Name** (from the manifest): `poe2perfect trade`

**Summary** (from the manifest; Chrome 132 characters max, AMO 250):

```
A clean two-pane workspace for the Path of Exile 2 trade site
```

## Description

```
poe2perfect trade turns the Path of Exile 2 trade search page into a clean two-pane workspace: what you are looking for on the left, the listings on the right, with the trade site's own item cards. Every search runs when you ask for it, and never on its own.

FILTERS THAT READ LIKE THE ITEM YOU WANT
• "Find a ring": category, rarity and base in one row, a budget in a currency, and only the parameters you add — Life, Fire Resistance, Spirit… — each with its value, an optional maximum and Total, Explicit or Implicit.
• Either, or — and never this: join parameters into alternatives ("Match at least 2 of 3") or exclude one (Must not have), right from its menu.
• Add parameter knows the item: popular and recent parameters first, and what the chosen item can have kept apart from what it cannot.
• The site's rarer filters (item level, quality, requirements, corrupted, seller…) under More filters.

THE SITE'S OWN ITEM CARDS
• Rarity frames, sockets and runes, mod tiers, roll ranges on hover, DPS and base percentile — with the stats you searched for marked in their colour.
• Click a mod, a property or a requirement to sort the results by it, or the price to sort by price. The next listings load as you scroll.
• Compare two listings side by side: price, the searched stats and every other property.

YOUR SEARCHES STAY YOURS
• Save searches by name; Back and Forward walk your searches; filters you changed but did not search yet survive a reload.
• Direct whisper, Travel to hideout or Copy whisper — one click, only when you press it.
• The original page is one click away, with your unsearched changes.

GENTLE WITH THE RATE LIMIT
The trade site allows only a few searches a minute. The extension makes one search per Find items, shows the results of a search you opened before without asking the site again, and counts down when the site says to wait.

PRIVACY
poe2perfect trade runs only on pathofexile.com/trade2 and talks only to the trade site, the same way the site's own page does. It keeps its working data (layout, recent results, saved searches) in your browser. No accounts, no tracking, no ads, nothing sent anywhere else.

FREE AND OPEN SOURCE
GPL-3.0: https://github.com/ReSenpai/poe2perfect-trade — bug reports and ideas welcome. Voluntary support: https://boosty.to/resenpai (it unlocks nothing; everything is free).

poe2perfect trade is an unofficial fan project, not affiliated with or endorsed by Grinding Gear Games. Path of Exile is a trademark of Grinding Gear Games.
```

## Category and links

| Field | Chrome Web Store | Firefox Add-ons |
| --- | --- | --- |
| Category | Lifestyle → Games | Games & Entertainment (+ Search Tools as a second one if offered) |
| Language | English | English (en-US) |
| Homepage | https://github.com/ReSenpai/poe2perfect-trade | same |
| Support | https://github.com/ReSenpai/poe2perfect-trade/issues | same (support site) |
| Privacy policy | https://github.com/ReSenpai/poe2perfect-trade/blob/main/PRIVACY.md | paste the text of `PRIVACY.md` |
| License | — | GNU General Public License v3.0 |
| Mature content | No | — |

## Graphics

Built by `python scripts/make-store-assets.py` into `store/` (not in git).

| Field | File |
| --- | --- |
| Store icon, 128×128 (Chrome) / add-on icon (AMO takes it from the package) | `store-icon-128.png` |
| Screenshots, 1280×800 — Chrome: the first five, in order | `screenshot-1-workspace.png` … `screenshot-5-saved.png` |
| Screenshots — AMO: all six, in order, with the captions below | `screenshot-1-workspace.png` … `screenshot-6-help.png` |
| Small promo tile 440×280 (Chrome) | `promo-small-440x280.png` |
| Marquee promo tile 1400×560 (Chrome, optional) | `promo-marquee-1400x560.png` |

Screenshot captions (AMO asks for one per screenshot):

1. Filters on the left, the site's own item cards on the right, searched stats marked in colour.
2. Life required, two of three resistances, and chaos resistance excluded.
3. Results sorted by maximum Life with a click on the card; roll ranges show on hover.
4. Two listings compared: price, the searched stats and every other property.
5. Saved searches by name; nothing searches until you press Find items.
6. A built-in guide to stat sources and the three ways a condition can match.

## Single purpose (Chrome)

```
poe2perfect trade replaces the Path of Exile 2 trade search page on pathofexile.com with a two-pane workspace — filters on the left, listings on the right — so players can build a search and read the results on one screen.
```

## Permission justifications

**storage:**

```
Stores the extension's working data locally in the browser: the layout of the workspace (panel width, collapsed state), the results of the last 5 searches so they can be shown again without a new request, searches the user saves by name, one draft of filters not searched yet, and the trade site's public reference data (leagues, item and stat names) so it is not downloaded on every page. Nothing is synced or sent anywhere.
```

**Host permission** (the content script runs on `https://www.pathofexile.com/trade2/*` and `https://pathofexile.com/trade2/*`):

```
The extension works only on the Path of Exile 2 trade site. Its content script replaces the trade search page with its own workspace and calls the site's own trade API (search, listings, reference data, whisper) from the page's origin, with the user's existing session, exactly as the site's page does. A search runs only when the user presses Find items; a whisper or hideout travel only when the user presses its button. It does not run on any other site.
```

## Remote code (Chrome)

**Are you using remote code?** No, I am not using remote code.

```
All JavaScript is bundled in the package. The extension does not load or evaluate code from the network; it only exchanges data (JSON) with the trade site's API.
```

## Data usage (Chrome) / data collection (AMO)

Declare **no data collected** (Chrome: tick none of the data types; AMO: the manifest already says
`data_collection_permissions: none`). Everything the extension keeps stays in the browser's extension storage and is
never sent to the developer or anyone else; the only requests go to the trade site, on the user's action, as the
site's own page makes them. Chrome: tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Notes for reviewers

```
How to test: open https://www.pathofexile.com/trade2/search/poe2/Standard — the workspace replaces the search page. Choose a category (e.g. Ring), add a parameter (e.g. Life, minimum 50) and press Find items. No account or login is needed to search.

Please do not press Direct whisper or Travel to hideout: they need a signed-in Path of Exile account and act in the game (they send a whisper to the seller or move the character). Copy whisper only copies text.

The site allows only a few searches a minute; if it asks to wait, the Find items button counts down.

Source code: https://github.com/ReSenpai/poe2perfect-trade (GPL-3.0). Build: Node 22, npm ci, npm run zip:firefox (Firefox) or npm run zip (Chrome); the output is in .output/. The only linter warning (innerHTML) comes from Preact's own support for dangerouslySetInnerHTML, which the extension does not use.
```
