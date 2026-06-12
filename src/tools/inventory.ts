import { itemMeta, itemName, slotFromBucketHash } from "../bungie/manifest.js";
import { type DestinyItem, type ProfileResponse } from "../bungie/profile.js";

export function instanceMap(profile: ProfileResponse): Map<string, number> {
  const map = new Map<string, number>();
  const add = (items?: DestinyItem[]) => {
    for (const item of items ?? []) {
      if (item.itemInstanceId) {
        map.set(item.itemInstanceId, item.itemHash);
      }
    }
  };

  for (const bucket of Object.values(profile.characterEquipment?.data ?? {})) {
    add(bucket.items);
  }

  for (const bucket of Object.values(profile.characterInventories?.data ?? {})) {
    add(bucket.items);
  }

  add(profile.profileInventory?.data?.items);
  return map;
}

export interface InventoryItem {
  name: string;
  itemInstanceId?: string;
  quantity: number;
  slot?: string;
  element?: string;
  type?: string;
  tier?: string;
}

// Carries the manifest attributes (element/type/tier) that list_inventory filters and projects on,
// and that get_equipped reports. All come from the item definition, so no per-instance components needed.
export async function inventoryItems(items: DestinyItem[]): Promise<InventoryItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const meta = await itemMeta(item.itemHash);

      return {
        name: meta?.name ?? (await itemName(item.itemHash)),
        itemInstanceId: item.itemInstanceId,
        quantity: item.quantity,
        slot: slotFromBucketHash(meta?.bucketHash),
        element: meta?.element,
        type: meta?.type || undefined,
        // "Basic" is the manifest default for unranked junk; drop it so the field stays signal.
        tier: meta?.rarity && meta.rarity !== "Basic" ? meta.rarity : undefined,
      };
    }),
  );
}
