import { describe, expect, test } from "vitest";
import { collectedCollectibles, isOwned } from "../src/bungie/acquisition.js";
import type { DestinyItem, ItemBucket } from "../src/bungie/profile.js";
import { ownedItemsByHash } from "../src/tools/builds/logic.js";

function gearItem(itemHash: number, itemInstanceId?: string): DestinyItem {
  return { itemHash, itemInstanceId, quantity: 1, bucketHash: 0 };
}

// The unwrapped gear slice ownedItemsByHash now consumes (no `{ data }` envelope); unspecified
// buckets default to empty so each test states only what it cares about.
function gearProfile(parts: {
  characterEquipment?: Record<string, ItemBucket>;
  characterInventories?: Record<string, ItemBucket>;
  profileInventory?: ItemBucket;
}) {
  return {
    characterEquipment: parts.characterEquipment ?? {},
    characterInventories: parts.characterInventories ?? {},
    profileInventory: parts.profileInventory ?? { items: [] },
  };
}

describe("ownedItemsByHash", () => {
  test("records a vault item with no owning character", () => {
    const profile = gearProfile({ profileInventory: { items: [gearItem(100, "inst-vault")] } });

    const entry = ownedItemsByHash(profile).get(100);

    expect(entry?.itemInstanceId).toBe("inst-vault");
    expect(entry?.location).toBe("vault");
    expect(entry?.characterId).toBeUndefined();
  });

  test("prefers the equipped copy over inventory and vault", () => {
    const profile = gearProfile({
      characterEquipment: { "char-1": { items: [gearItem(100, "inst-equipped")] } },
      characterInventories: { "char-1": { items: [gearItem(100, "inst-inventory")] } },
      profileInventory: { items: [gearItem(100, "inst-vault")] },
    });

    const entry = ownedItemsByHash(profile).get(100);

    expect(entry?.itemInstanceId).toBe("inst-equipped");
    expect(entry?.location).toBe("equipped");
    expect(entry?.characterId).toBe("char-1");
  });

  test("prefers an inventory copy over the vault when not equipped", () => {
    const profile = gearProfile({
      characterInventories: { "char-1": { items: [gearItem(100, "inst-inventory")] } },
      profileInventory: { items: [gearItem(100, "inst-vault")] },
    });

    const entry = ownedItemsByHash(profile).get(100);

    expect(entry?.location).toBe("inventory");
    expect(entry?.characterId).toBe("char-1");
  });

  test("skips an item that has no instance id", () => {
    const profile = gearProfile({ profileInventory: { items: [gearItem(100)] } });

    expect(ownedItemsByHash(profile).has(100)).toBe(false);
  });
});

describe("collectedCollectibles", () => {
  test("counts a collectible acquired on a character even when absent from the profile bucket", () => {
    const profile = {
      profileCollectibles: { collectibles: {} },
      characterCollectibles: { "char-1": { collectibles: { "10": { state: 16 } } } },
    };

    expect(collectedCollectibles(profile).has(10)).toBe(true);
  });

  test("excludes a collectible whose NOT_ACQUIRED bit is set in every bucket", () => {
    const profile = {
      profileCollectibles: { collectibles: {} },
      characterCollectibles: { "char-1": { collectibles: { "10": { state: 85 } } } },
    };

    expect(collectedCollectibles(profile).has(10)).toBe(false);
  });
});

describe("isOwned", () => {
  test("owns a held weapon even when Collections never flagged it acquired", () => {
    const owned = {
      heldNames: new Set(["Graviton Spike"]),
      acquiredCollectibles: new Set<number>(),
    };

    expect(isOwned({ name: "Graviton Spike", collectibleHash: 1648898126 }, owned)).toBe(true);
  });

  test("owns a crafted variant held under a different collectibleHash than the catalog entry", () => {
    const owned = {
      heldNames: new Set(["Dead Messenger"]),
      acquiredCollectibles: new Set<number>(),
    };

    expect(isOwned({ name: "Dead Messenger", collectibleHash: 4028619088 }, owned)).toBe(true);
  });

  test("falls back to Collections for gear earned and later dismantled", () => {
    const owned = { heldNames: new Set<string>(), acquiredCollectibles: new Set([777]) };

    expect(isOwned({ name: "Bastion", collectibleHash: 777 }, owned)).toBe(true);
  });

  test("is not owned when neither held nor acquired", () => {
    const owned = { heldNames: new Set<string>(), acquiredCollectibles: new Set<number>() };

    expect(isOwned({ name: "Hawkmoon", collectibleHash: 653763964 }, owned)).toBe(false);
  });
});
