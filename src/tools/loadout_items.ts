import { itemMeta } from "../bungie/manifest.js";
import { displayPlugs, type LoadoutSection } from "../bungie/plugs.js";
import type { ProfileResponse } from "../bungie/profile.js";
import { BUCKET } from "../format/loadout/data.js";
import type { LoadoutCardItem } from "../format/loadout/model.js";

/**
 * Project an equipped item instance into a loadout-card item: its manifest attributes (name, rarity,
 * element, icon, …) plus its hash and the socketed plugs the card shows — weapon perks, armor mods,
 * or subclass aspects + fragments, picked by the item's bucket section. Items the manifest doesn't
 * know (no name) drop out; items outside a card section carry no plugs.
 */
export async function enrichItem(
  hash: number,
  instanceId: string | undefined,
  profile: ProfileResponse,
): Promise<LoadoutCardItem | undefined> {
  const meta = await itemMeta(hash);

  if (!meta) {
    return undefined;
  }

  const section = BUCKET[meta.bucketHash]?.section as LoadoutSection | undefined;
  const plugs = section ? await displayPlugs(hash, instanceId, profile, section) : undefined;

  return { ...meta, hash, plugs };
}
