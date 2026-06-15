import type { ArmorPlug, ArmorSockets, ArmorStat } from "../../bungie/armor.js";

/** One of an armor set's bonuses and the equipped-piece count that unlocks it (typically 2 and 4). */
export interface ArmorSetBonus {
  requiredCount: number;
  name: string;
  description: string;
}

/** The armor set a piece belongs to, with its set bonuses — a small section on the card. */
export interface ArmorSet {
  name: string;
  bonuses: ArmorSetBonus[];
}

/**
 * The shared shape every armor-card renderer consumes — the in-game inspect screen reduced to data.
 * Unlike a weapon (a perk grid), an armor piece's headline is its six archetype `stats`; below that
 * sit the exotic intrinsic perk, the set bonuses, and (on an owned copy) the slotted mods. The text
 * card, the HTML iframe template, and the icon collectors all read this. `instance` is true when the
 * card was built from a specific owned copy, so the stats are that copy's real roll and `mods` are
 * what's actually slotted; a manifest piece shows the definition's (small) base stats and no mods.
 */
export interface ArmorCard extends ArmorSockets {
  name: string;
  /** Armor type display name, e.g. "Helmet", "Hunter Cloak" (the manifest's item-type name). */
  type: string;
  /** Rarity tier name — "Exotic", "Legendary", … — drives the name color and the exotic mark. */
  rarity: string;
  /** The class the piece is restricted to — "Titan"/"Hunter"/"Warlock", or "Any". */
  className?: string;
  /** Equip slot — "Helmet"/"Gauntlets"/"Chest Armor"/"Leg Armor"/"Class Armor". */
  slot?: string;
  /** Gear tier (1-5, the Edge of Fate quality scale) — armor only, resolved only for an owned copy. */
  gearTier?: number;
  /** Relative Bungie CDN icon path for the piece's art (prepend https://www.bungie.net). */
  icon?: string;
  /** Relative Bungie CDN path of the season/episode watermark, overlaid on the icon's top corner. */
  watermark?: string;
  /** The armor's manifest hash, used to link the card name to its light.gg page. */
  hash: number;
  /**
   * The six archetype stats with their values, in canonical order — the headline of the card. Stats
   * are per-copy, so this is populated only for an owned instance; a manifest piece (no instance) has
   * no real roll and leaves this empty, and the renderers note that in the stat block's place.
   */
  stats: ArmorStat[];
  /** The armor set and its 2/4-piece bonuses, if the piece belongs to a set. */
  set?: ArmorSet;
  /** True when built from an owned instance — stats are the real roll and mods are what's slotted. */
  instance?: boolean;
  /**
   * Curated "how to use" blurbs for an exotic (see armorTip) — the build nuance the manifest omits,
   * e.g. stacking Star-Eater Scales before a Super. Absent for legendaries and plain-stat exotics.
   * Rendered as a "HOW TO USE" section.
   */
  tips?: { perk: string; tip: string }[];
}

export type { ArmorPlug, ArmorStat };
