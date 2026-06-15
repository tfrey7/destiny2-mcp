import { itemDefinition, plugSetItemHashes, type SocketEntry } from "./manifest.js";
import type { FullProfile, ReusablePlug } from "./profile.js";

// Live per-instance sockets and reusable plugs plus the account-wide plug sets — everything needed to
// decide which plugs can go into an equipped item's sockets right now.
type SocketProfile = Pick<
  FullProfile,
  "itemSockets" | "itemReusablePlugs" | "profilePlugSets" | "characterPlugSets"
>;

// Find the socket on an equipped item instance into which a given plug can be inserted right now, or
// undefined if the plug isn't unlocked or doesn't fit the item. This both locates the socketIndex and
// confirms ownership in one pass, which is exactly what applying a shader/ornament needs.
export async function insertableSocketIndex(
  profile: SocketProfile,
  itemInstanceId: string,
  itemHash: number,
  plugItemHash: number,
): Promise<number | undefined> {
  const definition = await itemDefinition(itemHash);
  const entries = definition.sockets?.socketEntries ?? [];
  const liveSockets = profile.itemSockets[itemInstanceId]?.sockets ?? [];
  const livePlugs = profile.itemReusablePlugs[itemInstanceId]?.plugs ?? {};
  const plugSets = mergedPlugSets(profile);

  for (let index = 0; index < liveSockets.length; index++) {
    const hashes = await availablePlugHashes(index, livePlugs, entries[index], plugSets);

    if (hashes.includes(plugItemHash)) {
      return index;
    }
  }

  return undefined;
}

// Assign each of a list of plugs to a DISTINCT insertable socket on one item instance, in input
// order. A subclass has two aspect sockets and several fragment sockets that all share one plug set,
// and armor has several general-mod sockets that accept overlapping mods — so resolving each plug to
// "the first socket that accepts it" (insertableSocketIndex) would pile duplicates onto one socket.
// This greedily takes the lowest-indexed socket that accepts the plug AND isn't already claimed, so
// two aspects land in two sockets and two of the same mod fill two slots. socketIndex is undefined
// when the plug isn't unlocked or no free socket accepts it (reported, not inserted, by the caller).
export async function assignPlugSockets(
  profile: SocketProfile,
  itemInstanceId: string,
  itemHash: number,
  plugItemHashes: number[],
): Promise<PlugAssignment[]> {
  const definition = await itemDefinition(itemHash);
  const entries = definition.sockets?.socketEntries ?? [];
  const liveSockets = profile.itemSockets[itemInstanceId]?.sockets ?? [];
  const livePlugs = profile.itemReusablePlugs[itemInstanceId]?.plugs ?? {};
  const plugSets = mergedPlugSets(profile);

  // The acceptable plug set per socket, computed once. Capacity (a fragment socket disabled until
  // aspects grant room) lives in the live socket's isEnabled, not here — the caller orders aspect
  // inserts before fragment inserts so the socket is enabled in-game by the time the fragment lands.
  const accept = await Promise.all(
    liveSockets.map((_, index) => availablePlugHashes(index, livePlugs, entries[index], plugSets)),
  );

  return greedyAssign(accept, plugItemHashes);
}

export interface PlugAssignment {
  plugItemHash: number;
  // The socket the plug will go into, or undefined when it isn't unlocked / no free socket fits it.
  socketIndex?: number;
}

// The distinct-socket matching, pure and free of manifest/profile I/O so it can be reasoned about and
// tested directly. `accept[i]` is the plug hashes socket i will take. Each plug claims the
// lowest-indexed socket that accepts it and isn't already taken, so duplicates (two aspects, two of
// the same mod) spread across the sockets that share a plug set instead of colliding on the first.
export function greedyAssign(accept: number[][], plugItemHashes: number[]): PlugAssignment[] {
  const claimed = new Set<number>();

  return plugItemHashes.map((plugItemHash) => {
    const socketIndex = accept.findIndex(
      (hashes, index) => !claimed.has(index) && hashes.includes(plugItemHash),
    );

    if (socketIndex === -1) {
      return { plugItemHash, socketIndex: undefined };
    }

    claimed.add(socketIndex);

    return { plugItemHash, socketIndex };
  });
}

// Account-wide unlocks (shaders, universal ornaments) live in the profile/character plug-set
// components, keyed by plug-set hash, not on the item instance. These ride along with ItemSockets.
export function mergedPlugSets(
  profile: Pick<FullProfile, "profilePlugSets" | "characterPlugSets">,
): Map<number, ReusablePlug[]> {
  const sets = new Map<number, ReusablePlug[]>();
  const add = (plugs?: Record<string, ReusablePlug[]>) => {
    for (const [hash, list] of Object.entries(plugs ?? {})) {
      sets.set(Number(hash), list);
    }
  };

  add(profile.profilePlugSets.plugs);
  for (const character of Object.values(profile.characterPlugSets)) {
    add(character.plugs);
  }

  return sets;
}

// Resolve the plugs the player can actually insert. Random-roll perk sockets are per-instance, so
// the live component is authoritative; reusable cosmetic sockets pull their full unlocked set from
// the account-wide plug-set components — the live component only reports a partial instance subset.
export async function availablePlugHashes(
  socketIndex: number,
  livePlugs: Record<string, ReusablePlug[]>,
  entry: SocketEntry | undefined,
  plugSets: Map<number, ReusablePlug[]>,
): Promise<number[]> {
  const live = livePlugs[String(socketIndex)];

  if (entry?.randomizedPlugSetHash !== undefined && live?.length) {
    return live.filter((plug) => plug.canInsert !== false).map((plug) => plug.plugItemHash);
  }

  if (entry?.reusablePlugSetHash !== undefined) {
    const set = plugSets.get(entry.reusablePlugSetHash);

    if (set?.length) {
      return set.filter((plug) => plug.canInsert).map((plug) => plug.plugItemHash);
    }
  }

  if (live?.length) {
    return live.filter((plug) => plug.canInsert !== false).map((plug) => plug.plugItemHash);
  }

  if (entry?.reusablePlugItems?.length) {
    return entry.reusablePlugItems.map((plug) => plug.plugItemHash);
  }

  if (entry?.reusablePlugSetHash !== undefined) {
    return plugSetItemHashes(entry.reusablePlugSetHash);
  }

  return [];
}
