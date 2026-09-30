// Builds public/data/base-stats.json: which trade stats can appear on which item class (docs/ARCHITECTURE.md, "Game data").
// Run by hand after a game patch: `node --experimental-strip-types scripts/build-base-stats.ts`.
// One request per file, no retries: repoe-fork (GitHub Pages) and the public, CDN-cached trade stats.
import { writeFile } from 'node:fs/promises';
import { buildBaseStats, type RepoeData } from '../src/lib/gamedata/base-stats.ts';

const REPOE = 'https://repoe-fork.github.io/poe2/';
const TRADE_STATS = 'https://www.pathofexile.com/api/trade2/data/stats';
// Shipped as an extension file (web-accessible on the trade site) and read when the workspace opens.
const OUT = new URL('../public/data/base-stats.json', import.meta.url);

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': 'poe2perfect-trade-dev' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

const index = await (await fetch(REPOE)).text();
const version = /version\s+([\d.]+)/i.exec(index)?.[1] ?? 'unknown';

const repoe: RepoeData = {
  version,
  statDescriptions: await json(`${REPOE}stat_translations/stat_descriptions.min.json`),
  mods: await json(`${REPOE}mods.min.json`),
  modsByBase: await json(`${REPOE}mods_by_base.min.json`),
  baseItems: await json(`${REPOE}base_items.min.json`),
  augments: await json(`${REPOE}augments.min.json`),
  tradeStats: await json(TRADE_STATS),
};

const { data, report } = buildBaseStats(repoe);
const text = JSON.stringify(data);
await writeFile(OUT, `${text}\n`);

const statCount = Object.values(data.classes).reduce((sum, cls) => sum + cls.stats.length, 0);
console.log(`game data ${version}: ${Object.keys(data.classes).length} classes, ${statCount} class stats, ${(text.length / 1024).toFixed(0)} KB`);
console.log(`mods linked: ${report.linked}, unlinked: ${report.unlinked.length}`);
console.log('unlinked sample:', report.unlinked.slice(0, 20).join(', '));
