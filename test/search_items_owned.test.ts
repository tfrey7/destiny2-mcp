import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { searchItems, type OwnershipLookup } from "../src/bungie/manifest.js";
import { useManifestFixture } from "./manifest_fixture.js";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "manifest_seed.json");

// Five of the fixture's eight exotic weapons are owned, leaving three the account is missing.
const HELD = new Set(["Ace of Spades", "Wicked Implement", "Gjallarhorn", "Sunshot", "Riskrunner"]);
const isOwned: OwnershipLookup = (entry) => HELD.has(entry.name);

const exoticWeapons = { category: "weapon", tier: "Exotic" } as const;

beforeAll(() => {
  useManifestFixture(SEED);
});

describe("searchItems owned filter", () => {
  test("ignores ownership when the filter is omitted", async () => {
    const result = await searchItems(exoticWeapons, isOwned);

    expect(result.count).toBe(8);
  });

  test("owned:false keeps only the gear the lookup does not own", async () => {
    const result = await searchItems({ ...exoticWeapons, owned: false }, isOwned);

    expect(result.items.map((item) => item.name)).toStrictEqual([
      "Final Warning",
      "Graviton Lance",
      "Izanagi's Burden",
    ]);
  });

  test("owned:true keeps only the gear the lookup owns", async () => {
    const result = await searchItems({ ...exoticWeapons, owned: true }, isOwned);

    expect(result.count).toBe(5);
    expect(result.items.every((item) => HELD.has(item.name))).toBe(true);
  });

  test("count and truncated reflect the owned-filtered set, not the pre-filter catalog", async () => {
    const result = await searchItems({ ...exoticWeapons, owned: false, limit: 2 }, isOwned);

    expect(result.count).toBe(3);
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(2);
  });
});
