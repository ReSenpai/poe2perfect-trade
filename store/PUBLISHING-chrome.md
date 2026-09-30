# Publishing to the Chrome Web Store

Texts for every field are in [listing.md](listing.md); graphics are built into `store/` by
`python scripts/make-store-assets.py`; the privacy policy is [PRIVACY.md](../PRIVACY.md). Button names are as in the
English Developer Dashboard.

## 0. Before submitting

1. Tag the release (see [CONTRIBUTING.md](../CONTRIBUTING.md), "Releases") and take
   `poe2perfect-trade-<version>-chrome.zip` from the GitHub release — or build it with `npm ci && npm run zip`.
2. Check exactly this package: unzip it into a new folder, turn off the dev build in `chrome://extensions`, **Load
   unpacked** the folder, and on the trade site run a search, sort, compare and open a saved search.
3. Build the graphics: `python scripts/make-store-assets.py` (needs the raw captures in `store/raw/`).

## 1. Developer account

Open https://chrome.google.com/webstore/devconsole with the Google account that paid the one-time $5 fee.

In **Account**, check:
- **Publisher name** — the name shown in the store.
- **Contact email** — set and verified (required to submit).
- **Trader status** — a free fan project with no commercial activity: **non-trader**.
- **2-Step Verification** is on for the Google account (required to publish).

## 2. New item

1. **Items → New item**.
2. Upload `poe2perfect-trade-<version>-chrome.zip`. Name, summary, version and icon come from the manifest.

## 3. Store listing

From `listing.md`:
- **Description** — the description block.
- **Category** — Lifestyle → Games. **Language** — English.
- **Store icon** — `store-icon-128.png`.
- **Screenshots** — `screenshot-1-workspace.png` … `screenshot-5-saved.png`, in order (1280×800).
- **Small promo tile** — `promo-small-440x280.png`; **Marquee promo tile** — `promo-marquee-1400x560.png`.
- **Official URL** — leave empty. **Homepage URL** and **Support URL** — as in the table in `listing.md`.
- **Mature content** — No.

**Save draft**.

## 4. Privacy practices

From `listing.md`:
- **Single purpose** — the single purpose text.
- **Permission justification** for `storage` and **Host permission justification** — the two texts.
- **Remote code** — "No, I am not using remote code" and its explanation.
- **Data usage** — tick no data types, tick all three certifications.
- **Privacy policy URL** — `https://github.com/ReSenpai/poe2perfect-trade/blob/main/PRIVACY.md`.

**Save draft**.

## 5. Distribution

- **Payments** — Free.
- **Visibility** — **Public**; or **Unlisted** first to share by link with testers (not in search, installs by link).
- **Regions** — All regions.

## 6. Submit for review

1. **Submit for review**. Untick "publish automatically after review" if you want to choose the moment yourself
   (a **Publish** button appears after approval).
2. Review takes from hours to days; the first item and items that run on other sites' pages can take up to a couple
   of weeks. The status is in the dashboard; the result comes by e-mail.
3. If the form has **Test instructions**, paste the reviewer notes from `listing.md`.

## 7. After publishing

- The store page: `https://chromewebstore.google.com/detail/<id>` (the id is in the dashboard).
- Add the Chrome Web Store badge and link to the README's Installation section.
- Remove the unpacked build from your browser and install from the store, so there are not two copies.

## 8. Updates

1. Raise the version, update CHANGELOG, tag — CI builds the package (see CONTRIBUTING, "Releases"). Every upload needs
   a version higher than the last one; pre-releases are for testers and are not uploaded to the store.
2. In the dashboard: **Package → Upload new package** with the release's `-chrome.zip`, then **Submit for review**.
   The listing and images can change without a new package.

## Common reasons for rejection — and how this listing avoids them

- **Someone else's brand in the name or icon.** "poe2perfect trade" and its emblem use no Grinding Gear Games logo;
  the description says the project is unofficial.
- **Broad or unexplained permissions.** Only `storage` and the trade site's pages, each justified.
- **Description does not match the functionality / keyword spam.** The description lists what the screenshots show.
- **Does not work for the reviewer.** Searching needs no login; the reviewer notes say how to test and what not to press.
  If the site is down during review, answer the review e-mail with the notes and a search link.
