# Contributing to poe2perfect trade

Thanks for taking a look. Bug reports, ideas and pull requests are welcome.

## Licensing of contributions

poe2perfect trade is licensed under the [GNU GPL v3.0 or later](LICENSE). By sending a pull request you agree that
your contribution is licensed under the same terms, and that you have the right to license it.

Sign your commits off with `git commit -s` (the [Developer Certificate of Origin](https://developercertificate.org/)),
which adds a `Signed-off-by` line to the commit message.

## Getting started

```sh
npm install
npm run dev              # Chrome dev build in .output/chrome-mv3-dev
npm run dev:firefox      # Firefox dev build
npm test                 # Vitest
npm run typecheck
npm run build            # Chrome production build
npm run build:firefox    # Firefox production build
```

Chrome: load `.output/chrome-mv3-dev` through `chrome://extensions` → Developer mode → Load unpacked. Its auto-reload
often misses content-script changes, so reload the extension card before checking new code; manifest changes
(permissions, matches) always need that reload.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json` of the build.

Then open a search on [the PoE 2 trade site](https://www.pathofexile.com/trade2/search/poe2).

## How the code is laid out

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the folders, the principles (one search per Find items, requests as
the page), what is known about the trade API, the game data and the differences between browsers.

## Working style

- Tests first: write a failing test, then make it pass. `npm test`, `npm run typecheck`, `npm run build` (and
  `npm run build:firefox` for manifest or browser API changes) must all pass before a pull request.
- Every string the user sees is in English.
- Layouts stay compact: the filters and the listings fit one screen; the listings get the space.
- Check UI changes in a real browser, and say in the pull request what you checked (Chrome, Firefox or both).

## Be gentle with the trade site

The site allows only a few searches a minute, and a lockout also blocks the person's own trading.

- Never loop requests, in code or while checking. The extension searches only when the user presses Find items.
- Error states (429, Cloudflare 403, network errors) are tested with `tests/fixtures/fake-client.ts`, not provoked
  on the live site.
- Never press or call Travel to hideout or Direct whisper while checking: they act in your game.
- Never read, log or export the site's `localStorage` or cookies (they may hold your session).

## Test fixtures

`tests/fixtures/data/*.json` is the site's public reference data (`node scripts/fetch-catalogs.mjs`).
`tests/fixtures/listings-*.json` are real search results captured with the dev popup (`npm run dev`, the extension's
toolbar button → Export fixture) and scrubbed on capture: account, character and stash names, notes, whisper texts and
tokens are replaced. `tests/fixtures/fixtures.test.ts` checks that; please keep it that way.

## Screenshots and store graphics

`python scripts/make-store-assets.py` (Pillow, numpy) builds the store screenshots, promo tiles and icon into `store/`
and the README images into `docs/images/` from raw captures in `store/raw/`: 1568×710 captures of the
workspace on the sample search. Replace seller, account and character names with neutral ones before capturing.

## Releases

1. Raise `version` in `package.json` and add its section to [CHANGELOG.md](CHANGELOG.md).
2. Tag the commit `v<version>` (`v1.2.0`, or `v1.2.0-beta.1` for a pre-release) and push the tag.
3. The Release workflow checks that the tag matches `package.json`, takes the notes from the version's CHANGELOG
   section, builds the Chrome and Firefox packages and the sources archive and attaches them to a GitHub release.
   - A pre-release (`-beta.N` / `-rc.N`) is a GitHub pre-release; with the `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`
     secrets (addons.mozilla.org → Developer Hub → Manage API Keys) the Firefox package is signed, unlisted, and the
     `.xpi` attached for testers.
   - A release goes to the stores for review, each once its repository variable is `true`: `PUBLISH_CHROME` (with
     the variables `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_SERVICE_ACCOUNT_EMAIL` and the secret
     `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`, Chrome Web Store API v2) and `PUBLISH_FIREFOX` (the AMO secrets, listed
     channel). The first version in a store is published by hand; **Actions → Check store access** tests the keys
     without uploading anything.

4. While a release waits for review on addons.mozilla.org, give Firefox users a signed `.xpi` of it: **Actions → Sign
   the Firefox package → Run workflow** (use the workflow from the release's tag, build `1`). It signs the same code
   unlisted under a fourth number (`1.1.1` → `1.1.1.1`) and attaches the `.xpi` to the release.

addons.mozilla.org takes digit-only versions, each once: a pre-release is numbered just below its release in Firefox
(`1.1.0-beta.2` → `1.0.999.2`) and a signed build of a release just above it (`1.1.1.1`, `src/lib/build/manifest.ts`),
while Chrome shows a pre-release as `version_name`.
