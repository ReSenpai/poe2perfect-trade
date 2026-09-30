// The notes of a GitHub release: the version's section of CHANGELOG.md, without its heading.
//   node scripts/release-notes.mjs 1.1.0 > notes.md
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** @param {string} changelog @param {string} version @returns {string} */
export function releaseNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) throw new Error(`CHANGELOG.md has no "## ${version}" section: add it before tagging`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) throw new Error('Usage: node scripts/release-notes.mjs <version>');
  console.log(releaseNotes(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), version));
}
