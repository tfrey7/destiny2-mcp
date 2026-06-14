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

describe("searchItems pagination", () => {
  test("offset skips into the result set while count stays the full total", async () => {
    const result = await searchItems({ ...exoticWeapons, limit: 3, offset: 3 });

    expect(result.count).toBe(8);
    expect(result.truncated).toBe(true);
    expect(result.items.map((item) => item.name)).toStrictEqual([
      "Graviton Lance",
      "Izanagi's Burden",
      "Riskrunner",
    ]);
  });

  test("the final page is not flagged truncated", async () => {
    const result = await searchItems({ ...exoticWeapons, limit: 3, offset: 6 });

    expect(result.truncated).toBe(false);
    expect(result.items.map((item) => item.name)).toStrictEqual(["Sunshot", "Wicked Implement"]);
  });

  test("an offset past the end returns nothing", async () => {
    const result = await searchItems({ ...exoticWeapons, offset: 99 });

    expect(result.count).toBe(8);
    expect(result.truncated).toBe(false);
    expect(result.items).toStrictEqual([]);
  });
});
