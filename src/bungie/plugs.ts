import {
  itemDefinition,
  plugDescription,
  type SocketCategoryEntry,
  socketCategoryName,
} from "./manifest.js";
import type { ProfileResponse } from "./profile.js";

/** A socketed plug rendered on the loadout card: a weapon perk, armor mod, aspect, or fragment. */
export interface PlugView {
  name: string;
  /** Relative Bungie CDN icon path (prepend https://www.bungie.net). */
  icon?: string;
  /** Rules text, resolved via plugDescription so aspects/fragments (sandbox-perk text) read correctly. */
  description: string;
  /** In-game shape: round for perks & fragments, rounded-square for mods & aspects. */
  shape: PlugShape;
}

export type PlugShape = "circle" | "square";

/** The loadout card section an item belongs to — decides which socket categories count as display plugs. */
export type LoadoutSection = "WEAPONS" | "ARMOR" | "SUBCLASS";

/**
 * The plugs to surface for one equipped item instance: weapon perks (incl. the exotic intrinsic),
 * armor mods, or subclass aspects + fragments. Reads the inserted plug per socket from the live
 * ItemSockets component (falling back to the manifest's default plug), classifies each socket by
 * its category, and resolves name/icon/description from the manifest. Empty, disabled, tracker, and
 * "Upgrade Armor" sockets are dropped. The defining perk leads (weapon intrinsic, exotic armor perk,
 * aspects), then the rest — see classify's rank.
 *
 * @example
 * await displayPlugs(quicksilverHash, instanceId, profile, "WEAPONS")
 * // → [{ name: "Missile Tracers", shape: "circle", … }, { name: "Grenade Chaser", … }, …]
 */
export async function displayPlugs(
  hash: number,
  instanceId: string | undefined,
  profile: ProfileResponse,
  section: LoadoutSection,
): Promise<PlugView[]> {
  const definition = await itemDefinition(hash);
  const entries = definition.sockets?.socketEntries ?? [];
  const categoryByIndex = categoryHashByIndex(definition.sockets?.socketCategories ?? []);
  const live = instanceId
    ? (profile.itemComponents?.sockets?.data?.[instanceId]?.sockets ?? [])
    : [];

  const collected = await Promise.all(
    entries.map(async (entry, index) => {
      const socket = live[index];

      if (socket?.isVisible === false || socket?.isEnabled === false) {
        return undefined;
      }

      const categoryHash = categoryByIndex.get(index);
      const role = categoryHash === undefined ? undefined : await classify(section, categoryHash);

      if (!role) {
        return undefined;
      }

      const plugHash = socket?.plugHash ?? entry?.singleInitialItemHash;
      const plug = plugHash ? await plugView(plugHash, role.shape) : undefined;

      return plug ? { plug, rank: role.rank, index } : undefined;
    }),
  );

  // Lead with the defining perk (weapon intrinsic, exotic armor perk, aspects) — rank 0 — then the
  // rest, keeping socket order within a rank. Armor's exotic perk sits at a high socket index, so the
  // rank sort pulls it ahead of the mods that precede it, matching the in-game inspect order.
  return collected
    .filter((item): item is { plug: PlugView; rank: number; index: number } => item !== undefined)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.plug);
}

// Which socket categories become display plugs depends on the section, since the same category name
// (e.g. "WEAPON PERKS") only matters on a weapon. Classifying by name rather than hash avoids
// hardcoding the many class/element-specific aspect and fragment category hashes. rank orders the
// plugs within an item: 0 = the defining perk (weapon intrinsic, exotic armor perk, aspects), 1 = the
// rest (perk columns, armor mods, fragments).
async function classify(
  section: LoadoutSection,
  categoryHash: number,
): Promise<{ shape: PlugShape; rank: number } | undefined> {
  const name = await socketCategoryName(categoryHash);

  if (section === "WEAPONS") {
    if (name === "INTRINSIC TRAITS") {
      return { shape: "circle", rank: 0 };
    }

    return name === "WEAPON PERKS" ? { shape: "circle", rank: 1 } : undefined;
  }

  if (section === "ARMOR") {
    // Exotic armor's exotic perk lives in ARMOR PERKS (empty on legendaries); mods in ARMOR MODS.
    if (name === "ARMOR PERKS") {
      return { shape: "circle", rank: 0 };
    }

    return name === "ARMOR MODS" ? { shape: "square", rank: 1 } : undefined;
  }

  if (name === "ASPECTS") {
    return { shape: "square", rank: 0 };
  }

  return name === "FRAGMENTS" ? { shape: "circle", rank: 1 } : undefined;
}

async function plugView(plugHash: number, shape: PlugShape): Promise<PlugView | undefined> {
  const definition = await itemDefinition(plugHash);
  const name = definition.displayProperties?.name;

  // Skip sockets that aren't loadout-defining choices: empty sockets, the kill/crucible trackers, and
  // "Upgrade Armor" (the armor-leveling plug that rides in the ARMOR MODS category) — all just noise.
  if (!name || /^Empty\b/.test(name) || /Tracker$/.test(name) || name === "Upgrade Armor") {
    return undefined;
  }

  return {
    name,
    icon: definition.displayProperties?.icon || undefined,
    description: await plugDescription(definition),
    shape,
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
