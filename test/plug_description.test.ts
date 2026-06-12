import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { plugDescription } from "../src/bungie/manifest.js";
import { useManifestFixture } from "./manifest_fixture.js";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "manifest_seed.json");

// Voidwalker's Chaos Accelerant: its own description is blank and the rules text lives on this sandbox
// perk — the exact shape that left aspects and fragments showing up empty before the fallback.
const SANDBOX_PERK_HASH = 3438846199;

beforeAll(() => {
  useManifestFixture(SEED);
});

describe("plugDescription", () => {
  test("falls back to the linked sandbox perk when the item's own description is empty", async () => {
    const description = await plugDescription({
      displayProperties: { description: "" },
      perks: [{ perkHash: SANDBOX_PERK_HASH }],
    });

    expect(description).toContain("Overcharge your grenade");
  });

  test("keeps the item's own description when present, ignoring the perk link", async () => {
    const description = await plugDescription({
      displayProperties: { description: "Own text." },
      perks: [{ perkHash: SANDBOX_PERK_HASH }],
    });

    expect(description).toBe("Own text.");
  });

  test("returns an empty string when there is no description and no perks", async () => {
    expect(await plugDescription({ displayProperties: { description: "" } })).toBe("");
  });
});
