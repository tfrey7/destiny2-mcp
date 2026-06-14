import {
  ARMOR_ARCHETYPE_STATS,
  itemDefinition,
  plugDescription,
  type SocketCategoryEntry,
  socketCategoryName,
  statName,
} from "./manifest.js";
import type { FullProfile } from "./profile.js";

/** A plug shown on an armor card — the exotic's intrinsic perk, or a slotted armor mod. */
export interface ArmorPlug {
  hash: number;
  name: string;
  /** Relative Bungie CDN icon path (prepend https://www.bungie.net). */
  icon?: string;
  /** Rules text, resolved via plugDescription so sandbox-perk-backed text reads correctly. */
  description: string;
}

/** One of the six Armor 3.0 archetype stats with its value on this piece. */
export interface ArmorStat {
  hash: number;
  /** Stat display name — "Weapons", "Health", "Grenade", "Super", "Class", "Melee". */
  name: string;
  value: number;
}

/**
 * An armor piece's defining sockets — the inspect screen minus the header and stat block: the exotic
 * intrinsic perk (exotics only) and the slotted armor mods (an owned copy only). Armor has no perk
 * grid: there are no random perk columns to roll, so this is far simpler than a weapon's sockets.
 */
export interface ArmorSockets {
  /** The exotic's intrinsic perk (ARMOR PERKS category); absent on legendaries. */
  exoticPerk?: ArmorPlug;
  /** The mods slotted on an owned copy (ARMOR MODS); empty for a manifest piece (none inserted). */
  mods: ArmorPlug[];
}

// The live profile slice the socket walk reads — just the per-instance ItemSockets component. Armor
// has no rollable perk columns, so unlike weaponSockets it needs no reusable-plug / plug-set data.
export type ArmorSocketProfile = Pick<FullProfile, "itemSockets">;

/**
 * Resolve an armor piece's exotic intrinsic perk and slotted mods for the inspect card. The exotic
 * perk lives in the ARMOR PERKS socket category (empty on legendaries) and resolves from the live
 * plug on an owned copy, falling back to the socket's default so a manifest exotic still shows its
 * intrinsic. Mods live in ARMOR MODS and are read from what's actually inserted on an owned copy — a
 * manifest piece's mod sockets hold only "Empty Mod Socket" / "Upgrade Armor", which drop out, so it
 * yields no mods. Mirrors weaponSockets, minus the perk grid armor doesn't have.
 *
 * @example
 * await armorSockets(starEaterScalesHash, undefined, null)
 * // → { exoticPerk: { name: "Feast of Light", … }, mods: [] }  // manifest exotic: intrinsic, no mods
 */
export async function armorSockets(
  hash: number,
  instanceId: string | undefined,
  profile: ArmorSocketProfile | null,
): Promise<ArmorSockets> {
  const definition = await itemDefinition(hash);
  const entries = definition.sockets?.socketEntries ?? [];
  const categoryByIndex = categoryHashByIndex(definition.sockets?.socketCategories ?? []);
  const live = instanceId && profile ? (profile.itemSockets[instanceId]?.sockets ?? []) : [];

  let exoticPerk: ArmorPlug | undefined;
  const mods: ArmorPlug[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const socket = live[index];

    if (socket?.isVisible === false || socket?.isEnabled === false) {
      continue;
    }

    const categoryHash = categoryByIndex.get(index);
    const category =
      categoryHash === undefined ? undefined : await socketCategoryName(categoryHash);
    // The plug actually inserted on this copy, falling back to the socket's manifest default so a
    // manifest exotic still shows its intrinsic (mod sockets default to an empty plug, dropped below).
    const plugHash = socket?.plugHash ?? entry?.singleInitialItemHash;

    if (category === "ARMOR PERKS") {
      exoticPerk = plugHash ? ((await armorPlug(plugHash)) ?? exoticPerk) : exoticPerk;
      continue;
    }

    if (category !== "ARMOR MODS") {
      continue;
    }

    const mod = plugHash ? await armorPlug(plugHash) : undefined;

    if (mod) {
      mods.push(mod);
    }
  }

  return { exoticPerk, mods };
}

/**
 * Project the six Armor 3.0 archetype stats from a stat block, in canonical order (Weapons, Health,
 * Grenade, Super, Class, Melee), each defaulting to 0 when absent so the card always shows all six.
 * Feed it an owned instance's live ItemStats (the real rolled spread) or a manifest definition's base
 * stats (small fixed values — armor's real stats are roll-dependent and only exist on an instance).
 */
export async function armorStats(stats: Record<string, { value?: number }>): Promise<ArmorStat[]> {
  return Promise.all(
    [...ARMOR_ARCHETYPE_STATS].map(async (hash) => ({
      hash,
      name: await statName(hash),
      value: stats[String(hash)]?.value ?? 0,
    })),
  );
}

// Resolve a plug hash to an ArmorPlug, dropping the non-choices that aren't real slotted mods: empty
// sockets ("Empty Mod Socket"), locked/unfilled slots ("Locked Artifice Socket"), the kill/crucible
// trackers, and the "Upgrade Armor" leveling plug (which rides in ARMOR MODS). Returns undefined for
// those so the caller leaves the slot out — only actual mods reach the card.
async function armorPlug(plugHash: number): Promise<ArmorPlug | undefined> {
  const definition = await itemDefinition(plugHash);
  const name = definition.displayProperties?.name;

  if (
    !name ||
    /^Empty\b/.test(name) ||
    /^Locked\b/.test(name) ||
    /Tracker$/.test(name) ||
    name === "Upgrade Armor"
  ) {
    return undefined;
  }

  return {
    hash: plugHash,
    name,
    icon: definition.displayProperties?.icon || undefined,
    description: await plugDescription(definition),
  };
}

function categoryHashByIndex(categories: SocketCategoryEntry[]): Map<number, number> {
  const map = new Map<number, number>();

  for (const category of categories) {
    for (const index of category.socketIndexes) {
      map.set(index, category.socketCategoryHash);
    }
  }

  return map;
}
