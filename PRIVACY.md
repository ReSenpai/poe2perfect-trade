# poe2perfect trade — Privacy Policy

_Last updated: September 30, 2026_

poe2perfect trade is a browser extension that shows the Path of Exile 2 trade site's search page
(`pathofexile.com/trade2`) as a two-pane workspace: filters on the left, listings on the right.

## What the extension does with data

- **Runs only on the trade site.** Its script runs on `pathofexile.com/trade2/*` pages and nowhere else.
- **Talks only to the trade site, as the site does.** Searches, listings and reference data (leagues, item and stat
  names) are requested from `pathofexile.com/api/trade2/` with your session, the same requests the site's own page
  makes. A search runs only when you press **Find items** (or ask to sort or refresh the results); opening a page,
  going Back or opening a saved search does not search.
- **Acts in the game only on your click.** **Direct whisper** and **Travel to hideout** call the trade site's own
  whisper endpoint, only when you press the button. **Copy whisper** puts the site's message on your clipboard.
- **Stores working data locally**, in your browser's extension storage:
  - whether the workspace or the original page is shown, and the filter panel's width and state;
  - the results of your last 5 searches, so a search opens again without a new request — listings as the site showed
    them (items, prices, seller account names), without the site's whisper and hideout tokens;
  - searches you save by name, and one draft of filters you changed but did not search yet;
  - the trade site's reference data, so it is not downloaded on every page.
- **Ships one data file.** Which stats each kind of item can have comes with the extension (built from the public
  repoe-fork game data); nothing is downloaded for it at run time.

## What the extension does not do

- It does not collect, store or transmit personal information, browsing history or analytics.
- It does not read your session cookies or the site's local storage; requests carry your session the way the page's
  own requests do.
- It does not send any data to the developer or to third parties.
- It does not search, whisper or travel on its own, and does not use tracking, advertising or remote code.

## Removing data

Removing the extension from your browser (Chrome, Firefox or another) deletes everything it stored.

## Contact

Questions about this policy: open an issue at https://github.com/ReSenpai/poe2perfect-trade/issues.

poe2perfect trade is an unofficial fan project, not affiliated with Grinding Gear Games.
