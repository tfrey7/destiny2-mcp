import type { WeaponColumn, WeaponPlug, WeaponSockets } from "../../bungie/weapon.js";

/**
 * The shared shape every weapon-card renderer consumes — the in-game inspect screen reduced to data:
 * the header attributes (icon, name, type, rarity, element, ammo) plus the resolved perk grid
 * (`intrinsic` + `columns`, from weaponSockets). The text card, the HTML iframe template, and the
 * icon collectors all read this. `instance` is true when the card was built from a specific owned
 * copy, so renderers know a column's `selected` perk is a real roll worth highlighting (a manifest
 * item leaves every `selected` undefined and shows the full candidate pool unmarked).
 */
export interface WeaponCard extends WeaponSockets {
  name: string;
  /** Weapon type display name, e.g. "Hand Cannon". */
  type: string;
  /** Rarity tier name — "Exotic", "Legendary", … — drives the name color and the exotic mark. */
  rarity: string;
  /** Damage type, e.g. "Solar"; absent only for the rare weapon with no element. */
  element?: string;
  /** Ammo the weapon draws — "Primary", "Special", or "Heavy". */
  ammoType?: string;
  /** Relative Bungie CDN icon path for the weapon's art (prepend https://www.bungie.net). */
  icon?: string;
  /** The weapon's manifest hash, used to link the card name to its light.gg page. */
  hash: number;
  /** True when built from an owned instance — a column's `selected` perk is the actual roll. */
  instance?: boolean;
  /**
   * Curated "how to use" blurbs for the notable perks on the card (see perkTip) — the playstyle nuance
   * the manifest omits, e.g. activating Bait and Switch before a damage phase. One entry per perk that
   * has a tip; absent when none of the weapon's perks do. Rendered as a "HOW TO USE" section.
   */
  tips?: { perk: string; tip: string }[];
}

export type { WeaponColumn, WeaponPlug };
