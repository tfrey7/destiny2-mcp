import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { searchItems } from "../src/bungie/manifest.js";
import { useManifestFixture } from "./manifest_fixture.js";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "manifest_seed.json");

const exoticWeapons = { category: "weapon", tier: "Exotic" } as const;

beforeAll(() => {
  useManifestFixture(SEED);
});

describe("searchItems sort", () => {
  test("defaults to rarity-then-name order", async () => {
    const result = await searchItems(exoticWeapons);

    // All same rarity here, so the tiebreak is alphabetical.
    expect(result.items.map((item) => item.name)).toStrictEqual([
      "Ace of Spades",
      "Final Warning",
      "Gjallarhorn",
      "Graviton Lance",
      "Izanagi's Burden",
      "Riskrunner",
      "Sunshot",
      "Wicked Implement",
    ]);
  });

  test("sort:newest orders by manifest index, latest first", async () => {
    const result = await searchItems({ ...exoticWeapons, sort: "newest" });

    expect(result.items.map((item) => item.name)).toStrictEqual([
      "Wicked Implement",
      "Izanagi's Burden",
      "Ace of Spades",
      "Riskrunner",
      "Graviton Lance",
      "Sunshot",
      "Final Warning",
      "Gjallarhorn",
    ]);
  });

  test("sort:newest with limit:1 resolves 'the latest' of a type", async () => {
    const result = await searchItems({
      type: "Hand Cannon",
      tier: "Exotic",
      sort: "newest",
      limit: 1,
    });

    expect(result.items.map((item) => item.name)).toStrictEqual(["Ace of Spades"]);
    expect(result.truncated).toBe(true);
  });
});
