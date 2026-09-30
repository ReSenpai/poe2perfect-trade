import { type LucideIcon, BicepsFlexed, Brain, Clock, Coins, Eye, EyeOff, Feather, Funnel, Hammer, Layers, Shield, Skull, Sparkles, Split, Sprout, Sun, Tag, User } from 'lucide-preact';
import type { FilterIconKey } from '@/lib/catalog/filter-registry';

/** The icons of the filters beyond stats (the unified filters design §10), Lucide by our own keys. */
const ICONS: Record<FilterIconKey, LucideIcon> = {
  itemLevel: Layers,
  quality: Sparkles,
  corrupted: Shield,
  identified: Eye,
  fractured: Split,
  sanctified: Sun,
  twiceCorrupted: Shield,
  cultivated: Sprout,
  unrevealed: EyeOff,
  desecrated: Skull,
  crafted: Hammer,
  itemProperty: Tag,
  requiredLevel: User,
  strength: BicepsFlexed,
  dexterity: Feather,
  intelligence: Brain,
  price: Coins,
  seller: User,
  sellerStatus: Tag,
  listedTime: Clock,
  tradeOption: Tag,
  filter: Funnel,
};

/** Attributes keep their colour wherever they are: the bonus and the requirement alike (§9). */
const TONES: Partial<Record<FilterIconKey, string>> = { strength: 'strength', dexterity: 'dexterity', intelligence: 'intelligence' };

/** Decorative: the name next to it says what the filter is. */
export function FilterIcon({ iconKey, size = 20 }: { iconKey: FilterIconKey; size?: number }) {
  const Glyph = ICONS[iconKey] ?? Funnel;
  return <Glyph size={size} strokeWidth={1.75} class="p2t-filter-icon" data-icon={iconKey} data-tone={TONES[iconKey]} aria-hidden="true" />;
}
