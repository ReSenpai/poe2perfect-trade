// Downloads the public trade2 reference data (CDN-cached, no session needed) into tests/fixtures/data.
// Run by hand when the game data changes: `node scripts/fetch-catalogs.mjs`. One request per file, no retries.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://www.pathofexile.com/api/trade2/data/';
const NAMES = ['leagues', 'stats', 'filters', 'static', 'items'];

for (const name of NAMES) {
  const response = await fetch(BASE + name, { headers: { 'User-Agent': 'poe2perfect-trade-dev' } });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const json = await response.json();
  await writeFile(new URL(`../tests/fixtures/data/${name}.json`, import.meta.url), JSON.stringify(json, null, 1) + '\n');
  console.log(name, response.headers.get('cf-cache-status'));
}
