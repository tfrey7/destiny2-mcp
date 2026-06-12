import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { itemMeta, slotFromBucketHash } from "../src/bungie/manifest.js";
import { useManifestFixture } from "./manifest_fixture.js";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "manifest_seed.json");

beforeAll(() => {
  useManifestFixture(SEED);
});

describe("itemMeta slot/element invariant", () => {
  // Final Warning — a Strand weapon that lives in the Kinetic slot. The headline rule: the slot name
  // is not the element. element must come from the damage type, never from the slot it occupies.
  test("a Strand weapon in the Kinetic slot deals Strand, not Kinetic", async () => {
    const meta = await itemMeta(3121540812);

    expect(meta?.element).toBe("Strand");
    expect(slotFromBucketHash(meta?.bucketHash)).toBe("Kinetic");
    expect(meta?.element).not.toBe(slotFromBucketHash(meta?.bucketHash));
  });

  // Wicked Implement — a Stasis weapon, also in the Kinetic slot.
  test("a Stasis weapon in the Kinetic slot deals Stasis", async () => {
    const meta = await itemMeta(940371471);

    expect(meta?.element).toBe("Stasis");
    expect(slotFromBucketHash(meta?.bucketHash)).toBe("Kinetic");
  });

  // Ace of Spades — the exotic limit can only be checked if rarity surfaces precisely.
  test("an exotic weapon reports Exotic rarity", async () => {
    const meta = await itemMeta(347366834);

    expect(meta?.rarity).toBe("Exotic");
  });
});
