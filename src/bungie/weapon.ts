import {
  itemDefinition,
  plugDescription,
  rollablePlugHashes,
  type SocketCategoryEntry,
  type SocketEntry,
  socketCategoryName,
} from "./manifest.js";
import type { FullProfile, ReusablePlug } from "./profile.js";
import { availablePlugHashes, mergedPlugSets } from "./sockets.js";

// The profile slice the perk grid reads for an owned copy: the instance's live sockets and reusable
// plugs, plus the account-wide plug sets availablePlugHashes consults. Requesting Component.ItemSockets
// supplies the plug-set fields too, so a getProfile that includes ItemSockets + ItemReusablePlugs is
// assignable here. Null for a manifest item, where there is no instance to read.
export type WeaponSocketProfile = Pick<
  FullProfile,
  "itemSockets" | "itemReusablePlugs" | "profilePlugSets" | "characterPlugSets"
>;

/** One candidate perk in a weapon's perk grid — a plug that can sit in a column's socket. */
export interface WeaponPlug {
  hash: number;
  name: string;
  /** Relative Bungie CDN icon path (prepend https://www.bungie.net). */
  icon?: string;
  /** Rules text, resolved via plugDescription so frame/origin-trait sandbox text reads correctly. */
  description: string;
}

/** Origin traits get their own labeled column in-game; everything else is a generic perk column. */
export type WeaponColumnKind = "perk" | "origin";

/** One column of the perk grid: a socket and the pool of perks that can fill it. */
export interface WeaponColumn {
  /** Heading from the plugs' shared item-type name — "Barrel", "Magazine", "Trait", "Origin Trait". */
  label: string;
  kind: WeaponColumnKind;
  plugs: WeaponPlug[];
  /** The plug hash rolled on the inspected copy (undefined for a manifest item), to mark the grid. */
  selected?: number;
}

/** A weapon's defining perk plus its perk grid — the inspect screen, minus the header attributes. */
export interface WeaponSockets {
  /** The frame/archetype (legendary) or the exotic's intrinsic perk — shown above the grid. */
  intrinsic?: WeaponPlug;
  columns: WeaponColumn[];
}

/**
 * Resolve a weapon's intrinsic frame and perk columns for the inspect card. The candidate pool per
 * column depends on whether a copy is named. Without an itemInstanceId (a manifest item), it's the
 * "what can roll" set — each socket's randomized plug set, falling back to its reusable/curated set —
 * the grid a vendor or Collections preview shows. WITH an itemInstanceId, it's what that copy actually
 * offers, read from its live reusable plugs: one perk per column for a fixed random roll, several for a
 * craftable/enhanceable copy — so an owned weapon shows the perks you have, not every perk that could
 * roll. The rolled plug per column is marked `selected`. Intrinsic-trait, perk, and origin-trait
 * sockets are kept; mods, masterwork, and cosmetic sockets are dropped — the perk grid, not every socket.
 *
 * @example
 * await weaponSockets(fatebringerHash, undefined, {})
 * // → { intrinsic: { name: "Adaptive Frame", … },
 * //     columns: [{ label: "Barrel", plugs: [… ] }, … { label: "Origin Trait", kind: "origin", … }] }
 */
export async function weaponSockets(
  hash: number,
  instanceId: string | undefined,
  profile: WeaponSocketProfile | null,
): Promise<WeaponSockets> {
  const definition = await itemDefinition(hash);
  const entries = definition.sockets?.socketEntries ?? [];
  const categoryByIndex = categoryHashByIndex(definition.sockets?.socketCategories ?? []);
  const live = instanceId && profile ? (profile.itemSockets[instanceId]?.sockets ?? []) : [];
  // The instance's per-socket reusable plugs (component 310) — the perks this copy can actually equip,
  // which for a random-roll drop is just the one it rolled. Account-wide plug sets ride along for the
  // few cosmetic-style sockets that resolve through them. Both are empty for a manifest item.
  const livePlugs =
    instanceId && profile ? (profile.itemReusablePlugs[instanceId]?.plugs ?? {}) : {};
  const plugSets = profile ? mergedPlugSets(profile) : new Map<number, ReusablePlug[]>();

  let intrinsic: WeaponPlug | undefined;
  const columns: WeaponColumn[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const categoryHash = categoryByIndex.get(index);
    const category =
      categoryHash === undefined ? undefined : await socketCategoryName(categoryHash);
    // The plug actually rolled on this copy — present only for an owned instance; the frame also
    // falls back to the socket's default so a manifest item still shows its archetype.
    const rolled = live[index]?.plugHash;

    if (category === "INTRINSIC TRAITS") {
      const frame = rolled ?? entry?.singleInitialItemHash;

      intrinsic = frame ? ((await weaponPlug(frame)) ?? intrinsic) : intrinsic;
      continue;
    }

    if (category !== "WEAPON PERKS") {
      continue;
    }

    const pool = await candidatePlugHashes(entry, index, instanceId, livePlugs, plugSets, rolled);
    const resolved = dedupeByName(
      (await Promise.all(pool.map(weaponPlug))).filter(
        (plug): plug is ResolvedPlug => plug !== undefined,
      ),
      rolled,
    );

    if (resolved.length === 0 || isCosmeticColumn(resolved)) {
      continue;
    }

    const typeName = resolved[0].typeName;

    columns.push({
      label: typeName || "Perk",
      kind: /origin/i.test(typeName ?? "") ? "origin" : "perk",
      plugs: resolved.map(({ hash, name, icon, description }) => ({
        hash,
        name,
        icon,
        description,
      })),
      selected: rolled,
    });
  }

  return { intrinsic, columns };
}

// A perk column's candidate pool. For an owned copy (instanceId set) it's what that copy actually
// offers in the socket, read from the live reusable plugs via availablePlugHashes — a single perk for a
// fixed random roll, several for a craftable one — so the card never implies you hold perks you don't.
// For a manifest item it's the full "what can roll" set: the socket's randomized plug set, then its
// curated set, then its inline reusable list or single default. Either way the rolled plug is folded in
// when missing (a crafted/enhanced perk can sit outside the pool) so the actual roll always shows.
async function candidatePlugHashes(
  entry: SocketEntry | undefined,
  index: number,
  instanceId: string | undefined,
  livePlugs: Record<string, ReusablePlug[]>,
  plugSets: Map<number, ReusablePlug[]>,
  rolled: number | undefined,
): Promise<number[]> {
  const pool =
    instanceId !== undefined
      ? await availablePlugHashes(index, livePlugs, entry, plugSets)
      : await manifestPlugPool(entry);

  return rolled !== undefined && !pool.includes(rolled) ? [rolled, ...pool] : pool;
}

// The manifest's full candidate pool for a socket, used for a not-owned (manifest) weapon.
async function manifestPlugPool(entry: SocketEntry | undefined): Promise<number[]> {
  const setHash = entry?.randomizedPlugSetHash ?? entry?.reusablePlugSetHash;

  if (setHash !== undefined) {
    return rollablePlugHashes(setHash);
  }

  return (
    entry?.reusablePlugItems?.map((plug) => plug.plugItemHash) ??
    (entry?.singleInitialItemHash ? [entry.singleInitialItemHash] : [])
  );
}

// A perk plug plus its manifest item-type name ("Barrel", "Trait", …) — the type names the column,
// and distinguishes a perk socket from a stray shader/ornament/masterwork that shares the category.
interface ResolvedPlug extends WeaponPlug {
  typeName?: string;
}

async function weaponPlug(plugHash: number): Promise<ResolvedPlug | undefined> {
  const definition = await itemDefinition(plugHash);
  const name = definition.displayProperties?.name;

  // Skip non-choices the way displayPlugs does: empty sockets and the kill/crucible trackers.
  if (!name || /^Empty\b/.test(name) || /Tracker$/.test(name)) {
    return undefined;
  }

  return {
    hash: plugHash,
    name,
    icon: definition.displayProperties?.icon || undefined,
    description: await plugDescription(definition),
    typeName: definition.itemTypeDisplayName || undefined,
  };
}

// A WEAPON PERKS socket can occasionally hold a cosmetic (a default ornament/shader) rather than a
// real perk choice; its plugs' type name gives it away, so the column is dropped from the perk grid.
function isCosmeticColumn(plugs: ResolvedPlug[]): boolean {
  return plugs.every((plug) => /Shader|Ornament|Masterwork/i.test(plug.typeName ?? ""));
}

// A plug set can list the same perk under several hashes (random-roll, fixed, and enhanced variants),
// but the grid shows each perk once per column. Collapse by name, preferring the rolled hash where a
// name has duplicates so the highlighted plug is the one the copy actually carries.
function dedupeByName(plugs: ResolvedPlug[], selected: number | undefined): ResolvedPlug[] {
  const byName = new Map<string, ResolvedPlug>();

  for (const plug of plugs) {
    const existing = byName.get(plug.name);

    if (!existing || plug.hash === selected) {
      byName.set(plug.name, plug);
    }
  }

  return [...byName.values()];
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
