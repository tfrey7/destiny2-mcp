import {
  gearTierFromPlugs,
  isArmorBucket,
  itemMeta,
  itemName,
  itemSetName,
  slotFromBucketHash,
} from "../bungie/manifest.js";
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

// The visible socketed plugs per item instance, lifted straight from the live ItemSockets component.
// This is cheap — no definition lookups, just reading the component — so it covers every instanced
// item. The expensive part (resolving plug definitions to decode a tier) is deferred to inventoryItems,
// which runs it only for armor.
export function socketPlugsByInstance(profile: ProfileResponse): Map<string, number[]> {
  const socketData = profile.itemComponents?.sockets?.data ?? {};
  const plugs = new Map<string, number[]>();

  for (const [instanceId, component] of Object.entries(socketData)) {
    plugs.set(
      instanceId,
      (component.sockets ?? [])
        .filter((socket) => socket.isVisible !== false && socket.plugHash !== undefined)
        .map((socket) => socket.plugHash as number),
    );
  }

  return plugs;
}

export interface InventoryItem {
  name: string;
  itemInstanceId?: string;
  quantity: number;
  slot?: string;
  element?: string;
  type?: string;
  tier?: string;
  gearTier?: number;
  setName?: string;
}

// Carries the manifest attributes (element/type/tier/set) that list_inventory filters and projects
// on, and that get_equipped reports. Those come from the item definition; gearTier is per-instance,
// so callers that fetched ItemSockets pass the plug map (see socketPlugsByInstance) to fill it. The
// tier decode walks plug definitions, so it runs only for armor — the only gear that carries a tier.
export async function inventoryItems(
  items: DestinyItem[],
  plugsByInstance?: Map<string, number[]>,
): Promise<InventoryItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const meta = await itemMeta(item.itemHash);
      const plugs =
        item.itemInstanceId && isArmorBucket(meta?.bucketHash)
          ? plugsByInstance?.get(item.itemInstanceId)
          : undefined;

      return {
        name: meta?.name ?? (await itemName(item.itemHash)),
        itemInstanceId: item.itemInstanceId,
        quantity: item.quantity,
        slot: slotFromBucketHash(meta?.bucketHash),
        element: meta?.element,
        type: meta?.type || undefined,
        // "Basic" is the manifest default for unranked junk; drop it so the field stays signal.
        tier: meta?.rarity && meta.rarity !== "Basic" ? meta.rarity : undefined,
        gearTier: plugs ? await gearTierFromPlugs(plugs) : undefined,
        setName: meta?.setHash ? await itemSetName(meta.setHash) : undefined,
      };
    }),
  );
}
