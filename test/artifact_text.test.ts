import { describe, expect, test } from "vitest";
import { renderArtifactCardText, type ArtifactView } from "../src/format/artifact.js";

const artifact: ArtifactView = {
  name: "Seasonal Artifact",
  pointsUsed: 12,
  resetCount: 0,
  tiers: [
    {
      tier: 1,
      unlocked: true,
      perks: [
        { name: "Anti-Barrier Pulse Rifle", active: true },
        { name: "Overload Rounds", active: false },
      ],
    },
    { tier: 2, unlocked: false, perks: [{ name: "Authorized Mods: Heavy", active: false }] },
  ],
};

describe("renderArtifactCardText", () => {
  test("marks active and inactive perks, locked tiers, and the points subtitle", () => {
    const rendered = renderArtifactCardText(artifact);

    expect(rendered).toContain("●");
    expect(rendered).toContain("○");
    expect(rendered).toContain("· locked");
    expect(rendered).toContain("12 pts");
  });

  test("renders the full card", () => {
    expect(renderArtifactCardText(artifact)).toMatchInlineSnapshot(`
      "╭────────────────────────────────────────────────╮
      │ SEASONAL ARTIFACT                       12 pts │
      ├────────────────────────────────────────────────┤
      │ TIER 1                                         │
      │   ● Anti-Barrier Pulse Rifle                   │
      │   ○ Overload Rounds                            │
      │                                                │
      │ TIER 2 · locked                                │
      │   ○ Authorized Mods: Heavy                     │
      ╰────────────────────────────────────────────────╯"
    `);
  });
});
