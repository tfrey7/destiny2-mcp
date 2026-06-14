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
