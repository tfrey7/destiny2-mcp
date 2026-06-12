import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import {
  equipableItemSet,
  gearTierFromPlugs,
  itemMeta,
  itemSetName,
} from "../src/bungie/manifest.js";
import { inventoryItems } from "../src/tools/inventory.js";
import { useManifestFixture } from "./manifest_fixture.js";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "tiering_seed.json");

beforeAll(() => {
  useManifestFixture(SEED);
});

describe("gearTierFromPlugs", () => {
  // The masterwork "Upgrade Armor" plug carries the gear tier as the bonus it grants to the six
  // archetype stats. These three plugs are real tier-1, tier-2, and tier-5 masterworks.
  test("decodes the tier from the masterwork plug's archetype-stat bonus", async () => {
    expect(await gearTierFromPlugs([788990506])).toBe(1);
    expect(await gearTierFromPlugs([902052880])).toBe(2);
    expect(await gearTierFromPlugs([788990510])).toBe(5);
  });

  test("finds the masterwork plug among unrelated sockets", async () => {
    // A general mod socket plug first, then the tier-2 masterwork — order must not matter.
    expect(await gearTierFromPlugs([1980618587, 902052880])).toBe(2);
  });

  test("returns undefined when no plug carries a tier", async () => {
    expect(await gearTierFromPlugs([1980618587])).toBeUndefined();
    expect(await gearTierFromPlugs([])).toBeUndefined();
  });
});

describe("armor set bonuses", () => {
  test("an armor piece exposes the set it belongs to", async () => {
    const meta = await itemMeta(2419726011); // Thriving Survivor Grips

    expect(meta?.setHash).toBe(2151917545);
    expect(await itemSetName(2151917545)).toBe("Thriving Survivor");
  });

  test("a set resolves its name and its per-count bonus perks with live text", async () => {
    const set = await equipableItemSet(2151917545);

    expect(set?.name).toBe("Thriving Survivor");
    const counts = set?.perks.map((perk) => perk.requiredCount).sort((a, b) => a - b);
    expect(counts).toEqual([2, 4]);

    const twoPiece = set?.perks.find((perk) => perk.requiredCount === 2);
    expect(twoPiece?.name).toBe("Opening Act");
    expect(twoPiece?.description.length).toBeGreaterThan(0);
  });

  test("an unknown set hash resolves to undefined", async () => {
    expect(await equipableItemSet(123)).toBeUndefined();
  });
});

describe("inventoryItems gear-tier gating", () => {
  test("decodes gearTier and set for an armor instance with a masterwork plug", async () => {
    const plugs = new Map([["armor-1", [902052880]]]); // tier-2 masterwork
    const [item] = await inventoryItems(
      [{ itemHash: 2419726011, itemInstanceId: "armor-1", quantity: 1, bucketHash: 0 }],
      plugs,
    );

    expect(item.gearTier).toBe(2);
    expect(item.setName).toBe("Thriving Survivor");
  });

  // The optimization: only armor walks its plugs for a tier. A non-armor item must skip the decode
  // even when its instance carries a plug that would otherwise resolve to a tier.
  test("skips the tier decode for a non-armor item", async () => {
    const plugs = new Map([["other-1", [902052880]]]);
    const [item] = await inventoryItems(
      [{ itemHash: 902052880, itemInstanceId: "other-1", quantity: 1, bucketHash: 0 }],
      plugs,
    );

    expect(item.gearTier).toBeUndefined();
  });
});
