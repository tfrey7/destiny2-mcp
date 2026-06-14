import type { DestinyItem, GearProfile } from "../../bungie/profile.js";

type OwnedProfile = Pick<
  GearProfile,
  "characterEquipment" | "characterInventories" | "profileInventory"
>;

type ItemLocation = "equipped" | "inventory" | "vault";

export interface OwnedItem {
  itemInstanceId: string;
  location: ItemLocation;
  characterId?: string;
}

// Maps each owned item hash to one of its instances, recording where that copy lives so an imported
// build can tell the player what needs transferring before it can be equipped. Vault items and items
// on another character must be pulled to the target character first; equip only works on gear the
// character already holds. Equipped > inventory > vault ordering picks the copy nearest to ready.
export function ownedItemsByHash(profile: OwnedProfile): Map<number, OwnedItem> {
  const map = new Map<number, OwnedItem>();

  const record = (item: DestinyItem, location: ItemLocation, characterId?: string) => {
    if (item.itemInstanceId && !map.has(item.itemHash)) {
      map.set(item.itemHash, { itemInstanceId: item.itemInstanceId, location, characterId });
    }
  };

  for (const [characterId, bucket] of Object.entries(profile.characterEquipment)) {
    for (const item of bucket.items) {
      record(item, "equipped", characterId);
    }
  }

  for (const [characterId, bucket] of Object.entries(profile.characterInventories)) {
    for (const item of bucket.items) {
      record(item, "inventory", characterId);
    }
  }

  for (const item of profile.profileInventory.items) {
    record(item, "vault");
  }

  return map;
}
