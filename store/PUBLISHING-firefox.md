# Publishing to Firefox Add-ons (addons.mozilla.org)

Texts for every field are in [listing.md](listing.md); graphics are built into `store/` by
`python scripts/make-store-assets.py`. The add-on id `poe2perfect-trade@resenpai` (`src/lib/build/manifest.ts`) is
fixed forever: a new id would be a new add-on.

## Two channels

- **Unlisted** — signed by AMO but not shown in the catalogue: a signed `.xpi` for testers, installed from a file.
  The Release workflow does this for every tag when the `AMO_JWT_ISSUER` / `AMO_JWT_SECRET` secrets are set, and
  attaches the `.xpi` to the GitHub release. Unlisted versions are reviewed automatically in minutes.
- **Listed** — the public page in the catalogue, with human review. Done by hand for a release, below.

A version number can be used once across both channels. Pre-releases are numbered below their release in Firefox
(`1.1.0-beta.2` → `1.0.999.2`), so the release `1.1.0` stays free for the listed upload.

## 0. Before submitting

1. Tag the release (see [CONTRIBUTING.md](../CONTRIBUTING.md), "Releases") and take from the GitHub release:
   `poe2perfect-trade-<version>-firefox.zip` and `poe2perfect-trade-<version>-sources.zip`.
2. Check exactly this package: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
   `manifest.json` from the unzipped folder; on the trade site run a search, sort, compare, open a saved search.
3. `npx web-ext@8 lint --source-dir <unzipped folder>` — no errors (CI runs it too; one warning from Preact is known).

## 1. Developer account

Sign in at https://addons.mozilla.org/developers/ with a Mozilla account (two-step authentication is required to
submit). In your profile set the display name the listing shows as the author.

## 2. Submit a New Add-on

1. **Submit a New Add-on** → **On this site** (listed).
2. Upload `poe2perfect-trade-<version>-firefox.zip`; platforms: Firefox (desktop). The validator runs; warnings about
   `innerHTML` come from Preact and are explained in the reviewer notes.
3. **Do you need to submit source code?** — **Yes**: the package is built (bundled and minified by Vite/WXT). Upload
   `poe2perfect-trade-<version>-sources.zip`. Its build instructions are in the reviewer notes of `listing.md`
   (Node 22, `npm ci`, `npm run zip:firefox`); the result in `.output/firefox-mv3` must match the package.

## 3. Describe the add-on

From `listing.md`:
- **Name** and **Summary** — from the manifest (the summary can be edited up to 250 characters).
- **Description** — the description block.
- **Categories** — Games & Entertainment (and Search Tools, if a second one is offered).
- **Support email / website** — the issues link; **Homepage** — the repository.
- **License** — GNU General Public License v3.0.
- **Privacy policy** — paste the text of `PRIVACY.md` (AMO asks for the text, not a link).
- **Notes to Reviewer** — the reviewer notes.

**Submit Version**.

## 4. Images

In **Edit Product Page → Images**: the icon comes from the package; add the six screenshots
`screenshot-1-workspace.png` … `screenshot-6-help.png` in order, with the captions from `listing.md`.

## 5. Review

Listed versions get a human review: from a day to a couple of weeks. Reviewers build the sources zip and compare the
result with the package, so a release must be built from the tagged commit with a clean `npm ci`. Questions come by
e-mail and in the Developer Hub; the reviewer notes answer the usual ones (how to test, what not to press, the
Preact warning).

## 6. After publishing

- The add-on page: `https://addons.mozilla.org/firefox/addon/<slug>/` (the slug is set on the product page).
- Add the Firefox Add-ons badge and link to the README's Installation section.
- Testers who installed an unlisted `.xpi` can switch to the listed add-on: same id, Firefox updates it from AMO.

## 7. Updates

1. Raise the version, update CHANGELOG, tag — CI builds the packages and signs the unlisted `.xpi`.
2. Listed update: Developer Hub → the add-on → **Upload New Version** with the release's `-firefox.zip` and
   `-sources.zip`, the same reviewer notes, and a short "What's new" from CHANGELOG.
3. A version number can be uploaded once: a failed listed review means a new version (e.g. `1.1.1`).
