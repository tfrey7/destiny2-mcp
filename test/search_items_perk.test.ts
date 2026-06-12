import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { searchItems } from "../src/bungie/manifest.js";
import { useManifestFixture } from "./manifest_fixture.js";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "manifest_seed.json");

beforeAll(() => {
  useManifestFixture(SEED);
});

describe("searchItems perk category", () => {
  test("returns perks and traits, not gear", async () => {
    const result = await searchItems({ category: "perk" });

    expect(result.items.map((item) => item.name)).toStrictEqual(["Rampage", "Veist Stinger"]);
  });

  test("resolves a trait by name to a hash that feeds inspect_item", async () => {
    const result = await searchItems({ category: "perk", name: "Veist Stinger" });

    expect(result.items).toHaveLength(1);
    const [trait] = result.items;
    expect(trait.type).toBe("Origin Trait");
    expect(trait.hash).toBe(3988215619);
  });

  test("gear categories exclude perks", async () => {
    const weapons = await searchItems({ category: "weapon" });

    expect(weapons.items.some((item) => item.name === "Veist Stinger")).toBe(false);
  });
});
