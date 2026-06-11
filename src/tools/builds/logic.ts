import type { DestinyItem, ProfileResponse } from "../../bungie/profile.js";

function allItems(profile: ProfileResponse): DestinyItem[] {
  const items: DestinyItem[] = [];
  for (const bucket of Object.values(profile.characterEquipment?.data ?? {})) items.push(...bucket.items);
  for (const bucket of Object.values(profile.characterInventories?.data ?? {})) items.push(...bucket.items);
  items.push(...(profile.profileInventory?.data?.items ?? []));
  return items;
}

// Maps each owned item hash to one of its instance ids, so an imported build can report
// which gear the player already has (and the instance id to hand to equip_items).
export function ownedInstanceByHash(profile: ProfileResponse): Map<number, string> {
  const map = new Map<number, string>();
  for (const item of allItems(profile)) {
    if (item.itemInstanceId && !map.has(item.itemHash)) map.set(item.itemHash, item.itemInstanceId);
  }
  return map;
}
