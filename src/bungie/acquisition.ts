import { collectibleSource, itemInfo } from "./manifest.js";
import { Component, getProfile, type DestinyItem, type ProfileResponse } from "./profile.js";

export interface Acquisition {
  name: string;
  tier?: string;
  itemType?: string;
  source?: string;
  owned?: boolean;
}

export interface OwnedGear {
  // Names of gear the player currently holds. Name is the join key on purpose: crafted/variant
  // exotics carry a different item hash (and collectibleHash) than the catalog entry, so matching
  // by hash misses them while the name still lines up.
  heldNames: Set<string>;
  // Collectibles flagged acquired, so gear that was earned and later dismantled still counts.
  acquiredCollectibles: Set<number>;
}

export async function ownedGear(): Promise<OwnedGear> {
  const profile = await getProfile([
    Component.ProfileInventories,
    Component.CharacterInventories,
    Component.CharacterEquipment,
    Component.Collectibles,
  ]);

  const heldHashes = new Set<number>();
  const collect = (bucket?: { items: DestinyItem[] }): void => {
    for (const item of bucket?.items ?? []) {
      heldHashes.add(item.itemHash);
    }
  };

  collect(profile.profileInventory?.data);
  for (const character of Object.values(profile.characterInventories?.data ?? {})) {
    collect(character);
  }

  for (const character of Object.values(profile.characterEquipment?.data ?? {})) {
    collect(character);
  }

  const heldNames = new Set<string>();

  for (const hash of heldHashes) {
    const info = await itemInfo(hash);

    if (info?.name) {
      heldNames.add(info.name);
    }
  }

  return { heldNames, acquiredCollectibles: collectedCollectibles(profile) };
}

// Acquisition state is split across the account-wide bucket and each character's bucket; a
// collectible counts as acquired when NOT_ACQUIRED is clear in any of them.
export function collectedCollectibles(profile: ProfileResponse): Set<number> {
  const buckets = [
    profile.profileCollectibles?.data?.collectibles ?? {},
    ...Object.values(profile.characterCollectibles?.data ?? {}).map(
      (character) => character.collectibles ?? {},
    ),
  ];

  const acquired = new Set<number>();

  for (const collectibles of buckets) {
    for (const [hash, { state }] of Object.entries(collectibles)) {
      if ((state & NOT_ACQUIRED) === 0) {
        acquired.add(Number(hash));
      }
    }
  }

  return acquired;
}

// Held gear is the primary signal — matched by name so crafted/variant copies count — with
// Collections as the fallback so gear earned and later dismantled still reads as owned.
export function isOwned(
  info: { name: string; collectibleHash?: number },
  owned: OwnedGear,
): boolean {
  if (owned.heldNames.has(info.name)) {
    return true;
  }

  return info.collectibleHash !== undefined && owned.acquiredCollectibles.has(info.collectibleHash);
}

export async function acquisitionFor(itemHash: number, owned?: OwnedGear): Promise<Acquisition> {
  const info = await itemInfo(itemHash);

  if (!info) {
    return { name: `Unknown item ${itemHash >>> 0}` };
  }

  const acquisition: Acquisition = { name: info.name, tier: info.tier, itemType: info.itemType };

  if (info.collectibleHash) {
    acquisition.source = await collectibleSource(info.collectibleHash);
  }

  if (owned) {
    acquisition.owned = isOwned(info, owned);
  }

  return acquisition;
}

// The embeddable building block: annotate a set of gear with where to find it and whether the
// account already owns it, fetching the account's held gear and Collections once for the batch.
export async function acquisitionForMany(itemHashes: number[]): Promise<Acquisition[]> {
  const owned = await ownedGear();

  return Promise.all(itemHashes.map((hash) => acquisitionFor(hash, owned)));
}

// Bit 0 of DestinyCollectibleState; set means the account has never acquired the item. Collections
// is an unreliable sole signal — some exotics keep this bit set even while the weapon sits in the
// inventory — so it backs up the held-gear check rather than standing alone.
const NOT_ACQUIRED = 1;
