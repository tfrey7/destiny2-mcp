import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { ownershipMarker } from "../src/tools/show_build.js";
import { useManifestFixture } from "./manifest_fixture.js";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "manifest_seed.json");

// Ace of Spades is a trackable exotic; Rampage is a common perk with no collectible.
const ACE = { hash: 347366834 };
const ACE_COLLECTIBLE = 1660030046;
const RAMPAGE = { hash: 3425386926 };

beforeAll(() => {
  useManifestFixture(SEED);
});

describe("ownershipMarker", () => {
  test("a held piece reads owned regardless of Collections", async () => {
    expect(await ownershipMarker(ACE, true, new Set())).toBe(true);
  });

  test("a piece owned only via Collections (not held) reads owned", async () => {
    expect(await ownershipMarker(ACE, false, new Set([ACE_COLLECTIBLE]))).toBe(true);
  });

  test("a trackable piece the account never acquired reads to-farm", async () => {
    expect(await ownershipMarker(ACE, false, new Set())).toBe(false);
  });

  test("a piece with no collectible stays unmarked — absence is not proof of non-ownership", async () => {
    expect(await ownershipMarker(RAMPAGE, false, new Set())).toBeUndefined();
  });

  test("no Collections data (logged out) leaves a not-held piece unmarked, not to-farm", async () => {
    expect(await ownershipMarker(ACE, false, undefined)).toBeUndefined();
  });

  test("an explicit owned flag overrides held and Collections", async () => {
    expect(await ownershipMarker({ ...ACE, owned: false }, true, new Set([ACE_COLLECTIBLE]))).toBe(
      false,
    );
    expect(await ownershipMarker({ ...RAMPAGE, owned: true }, false, undefined)).toBe(true);
  });
});
