import type { ItemPresentation, PresentationLine } from './presentation';

const SEPARATOR = '--------';
/** Kinds the game marks after the line when copying; explicit mods go unmarked. */
const MARKS: Record<string, string> = { enchant: 'enchant', implicit: 'implicit', rune: 'rune', fractured: 'fractured', desecrated: 'desecrated', crafted: 'crafted' };
/** Kinds with a block of their own; all other mods share the explicit block. */
const OWN_BLOCK = new Set(['enchant', 'implicit', 'rune']);

/**
 * The item as text, as the game copies it with details (Ctrl+Alt+C): class and rarity, name, properties with
 * `(augmented)`, requirements, sockets, item level, mods by block — explicit mods under their
 * `{ Prefix Modifier "Name" (Tier: N) }` header, every rolled value with its range `72(65-74)`. The mod tags the game
 * adds to the header are not in the trade data. Nothing about the listing or the seller; no server pseudo totals.
 */
export function itemText(item: ItemPresentation): string {
  const blocks: string[][] = [];
  blocks.push([...(item.category ? [`Item Class: ${item.category}`] : []), `Rarity: ${item.rarityText}`, item.title, ...(item.subtitle ? [item.subtitle] : [])]);

  const properties = item.stats.filter((stat) => stat.name !== 'Item Level').map((stat) => `${stat.name}: ${stat.value}${stat.augmented ? ' (augmented)' : ''}`);
  if (properties.length > 0) blocks.push(properties);
  if (item.requirements) blocks.push([`Requires: ${item.requirements}`]);
  if (item.sockets > 0) blocks.push([`Sockets: ${Array.from({ length: item.sockets }, () => 'S').join(' ')}`]);
  const level = item.stats.find((stat) => stat.name === 'Item Level');
  if (level) blocks.push([`Item Level: ${level.value}`]);

  let explicit: string[] | null = null;
  for (const section of item.sections) {
    if (section.kind === 'pseudo' || section.kind === 'socketed') continue;
    const mark = MARKS[section.kind];
    const lines = section.lines.flatMap((line) => [...(line.modName ? [`{ ${line.modName} }`] : []), `${withRanges(line)}${mark ? ` (${mark})` : ''}`]);
    if (OWN_BLOCK.has(section.kind)) {
      blocks.push(lines);
      continue;
    }
    if (!explicit) {
      explicit = [];
      blocks.push(explicit);
    }
    explicit.push(...lines);
  }
  if (item.corrupted) blocks.push(['Corrupted']);
  return blocks.map((block) => block.join('\n')).join(`\n${SEPARATOR}\n`);
}

/** "72% increased Chaos Damage" with ranges [[65, 74]] → "72(65-74)% increased Chaos Damage"; fixed values stay bare. */
function withRanges(line: PresentationLine): string {
  const ranges = line.ranges ?? [];
  let index = 0;
  return line.text.replace(/\d+(?:\.\d+)?/g, (number) => {
    const range = ranges[index++];
    return range && range[0] !== range[1] ? `${number}(${range[0]}-${range[1]})` : number;
  });
}
