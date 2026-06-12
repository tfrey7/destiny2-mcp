import { collectibleSource, itemInfo } from "./manifest.js";
import { Component, getProfile } from "./profile.js";

export interface Acquisition {
  name: string;
  tier?: string;
  itemType?: string;
  source?: string;
  owned?: boolean;
}

// Bit 0 of DestinyCollectibleState; set means the account has never acquired the item.
const NOT_ACQUIRED = 1;

export async function ownedCollectibles(): Promise<Set<number>> {
  const profile = await getProfile([Component.Collectibles]);
  const collectibles = profile.profileCollectibles?.data?.collectibles ?? {};

  const owned = new Set<number>();

  for (const [hash, { state }] of Object.entries(collectibles)) {
    if ((state & NOT_ACQUIRED) === 0) {
      owned.add(Number(hash));
    }
  }
  return owned;
}

export async function acquisitionFor(itemHash: number, owned?: Set<number>): Promise<Acquisition> {
  const info = await itemInfo(itemHash);

  if (!info) {
    return { name: `Unknown item ${itemHash >>> 0}` };
  }

  const acquisition: Acquisition = { name: info.name, tier: info.tier, itemType: info.itemType };

  if (info.collectibleHash) {
    acquisition.source = await collectibleSource(info.collectibleHash);
    if (owned) {
      acquisition.owned = owned.has(info.collectibleHash);
    }
  }
  return acquisition;
}

// The embeddable building block: annotate a set of gear with where to find it and whether
// the account already owns it, fetching the account's Collections state once for the batch.
export async function acquisitionForMany(itemHashes: number[]): Promise<Acquisition[]> {
  const owned = await ownedCollectibles();

  return Promise.all(itemHashes.map((hash) => acquisitionFor(hash, owned)));
}
