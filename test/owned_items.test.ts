import { describe, expect, test } from "vitest";
import type { DestinyItem, ProfileResponse } from "../src/bungie/profile.js";
import { ownedItemsByHash } from "../src/tools/builds/logic.js";

function gearItem(itemHash: number, itemInstanceId?: string): DestinyItem {
  return { itemHash, itemInstanceId, quantity: 1, bucketHash: 0 };
}

describe("ownedItemsByHash", () => {
  test("records a vault item with no owning character", () => {
    const profile: ProfileResponse = {
      profileInventory: { data: { items: [gearItem(100, "inst-vault")] } },
    };

    const entry = ownedItemsByHash(profile).get(100);

    expect(entry?.itemInstanceId).toBe("inst-vault");
    expect(entry?.location).toBe("vault");
    expect(entry?.characterId).toBeUndefined();
  });

  test("prefers the equipped copy over inventory and vault", () => {
    const profile: ProfileResponse = {
      characterEquipment: { data: { "char-1": { items: [gearItem(100, "inst-equipped")] } } },
      characterInventories: { data: { "char-1": { items: [gearItem(100, "inst-inventory")] } } },
      profileInventory: { data: { items: [gearItem(100, "inst-vault")] } },
    };

    const entry = ownedItemsByHash(profile).get(100);

    expect(entry?.itemInstanceId).toBe("inst-equipped");
    expect(entry?.location).toBe("equipped");
    expect(entry?.characterId).toBe("char-1");
  });

  test("prefers an inventory copy over the vault when not equipped", () => {
    const profile: ProfileResponse = {
      characterInventories: { data: { "char-1": { items: [gearItem(100, "inst-inventory")] } } },
      profileInventory: { data: { items: [gearItem(100, "inst-vault")] } },
    };

    const entry = ownedItemsByHash(profile).get(100);

    expect(entry?.location).toBe("inventory");
    expect(entry?.characterId).toBe("char-1");
  });

  test("skips an item that has no instance id", () => {
    const profile: ProfileResponse = {
      profileInventory: { data: { items: [gearItem(100)] } },
    };

    expect(ownedItemsByHash(profile).has(100)).toBe(false);
  });
});
