import { describe, expect, test } from "vitest";

import { ammoTypeLabel, isGearBucket, slotFromBucketHash } from "../src/bungie/manifest.js";

describe("slotFromBucketHash", () => {
  test("maps each weapon bucket to its slot name", () => {
    expect(slotFromBucketHash(1498876634)).toBe("Kinetic");
    expect(slotFromBucketHash(2465295065)).toBe("Energy");
    expect(slotFromBucketHash(953998645)).toBe("Power");
  });

  test("returns undefined for armor and unknown buckets", () => {
    expect(slotFromBucketHash(3448274439)).toBeUndefined(); // helmet
    expect(slotFromBucketHash(0)).toBeUndefined();
    expect(slotFromBucketHash(undefined)).toBeUndefined();
  });
});

describe("ammoTypeLabel", () => {
  test("maps each ammunition type to its label", () => {
    expect(ammoTypeLabel(1)).toBe("Primary");
    expect(ammoTypeLabel(2)).toBe("Special");
    expect(ammoTypeLabel(3)).toBe("Heavy");
  });

  test("returns undefined for None and missing ammo type", () => {
    expect(ammoTypeLabel(0)).toBeUndefined();
    expect(ammoTypeLabel(undefined)).toBeUndefined();
  });
});

describe("isGearBucket", () => {
  test("returns true for weapon and armor equip buckets", () => {
    expect(isGearBucket(1498876634)).toBe(true); // kinetic weapon
    expect(isGearBucket(3448274439)).toBe(true); // helmet
    expect(isGearBucket(1585787867)).toBe(true); // class item
  });

  test("returns false for subclass, unknown, and missing buckets", () => {
    expect(isGearBucket(3284755031)).toBe(false); // subclass
    expect(isGearBucket(0)).toBe(false);
    expect(isGearBucket(undefined)).toBe(false);
  });
});
