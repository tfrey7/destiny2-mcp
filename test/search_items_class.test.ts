import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { searchItems } from "../src/bungie/manifest.js";
import { useManifestFixture } from "./manifest_fixture.js";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "manifest_seed.json");

// The fixture's four exotic armor pieces span all three classes: one Warlock, one Titan, two Hunter.
const exoticArmor = { category: "armor", tier: "Exotic" } as const;

beforeAll(() => {
  useManifestFixture(SEED);
});

describe("searchItems class filter", () => {
  test("ignores class when the filter is omitted", async () => {
    const result = await searchItems(exoticArmor);

    expect(result.items.map((item) => item.name)).toStrictEqual([
      "Celestial Nighthawk",
      "Helm of Saint-14",
      "Orpheus Rig",
      "Sunbracers",
    ]);
  });

  test("keeps only the requested class's armor", async () => {
    const result = await searchItems({ ...exoticArmor, class: "Warlock" });

    expect(result.items.map((item) => item.name)).toStrictEqual(["Sunbracers"]);
    expect(result.items.every((item) => item.classType === "Warlock")).toBe(true);
  });

  test("a different class narrows to its own armor", async () => {
    const result = await searchItems({ ...exoticArmor, class: "Hunter" });

    expect(result.items.map((item) => item.name)).toStrictEqual([
      "Celestial Nighthawk",
      "Orpheus Rig",
    ]);
  });

  test("keeps class-agnostic (Any) gear regardless of the requested class", async () => {
    // Weapons carry classType "Any", so a class filter must not exclude them.
    const result = await searchItems({ category: "weapon", tier: "Exotic", class: "Warlock" });

    expect(result.count).toBe(8);
    expect(result.items.every((item) => item.classType === "Any")).toBe(true);
  });
});
