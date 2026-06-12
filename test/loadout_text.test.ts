import { describe, expect, test } from "vitest";
import { renderLoadoutCardText } from "../src/format/loadout/index.js";
import type { LoadoutCard } from "../src/format/loadout/index.js";

const KINETIC_WEAPON = 1498876634;
const HELMET = 3448274439;
const SUBCLASS = 3284755031;

const card: LoadoutCard = {
  title: "MY BUILD",
  className: "Hunter",
  subtitle: "Strand",
  items: [
    {
      name: "Final Warning",
      rarity: "Exotic",
      type: "Sidearm",
      element: "Strand",
      bucketHash: KINETIC_WEAPON,
    },
    { name: "Cyrtarachne's Facade", rarity: "Exotic", type: "Helmet", bucketHash: HELMET },
    {
      name: "Strand",
      rarity: "Legendary",
      type: "Subclass",
      element: "Strand",
      bucketHash: SUBCLASS,
    },
  ],
};

describe("renderLoadoutCardText", () => {
  test("marks exotics, names elements, and shows an empty class-item placeholder", () => {
    const rendered = renderLoadoutCardText(card);

    expect(rendered).toContain("★");
    expect(rendered).toContain("● Strand");
    expect(rendered).toContain("(empty)");
  });

  test("renders the full box card", () => {
    expect(renderLoadoutCardText(card)).toMatchInlineSnapshot(`
      "╭────────────────────────────────────────────────╮
      │ MY BUILD                       Hunter · Strand │
      ├────────────────────────────────────────────────┤
      │ WEAPONS                                        │
      │   Final Warning ★   Sidearm      ● Strand      │
      │                                                │
      │ ARMOR                                          │
      │   Cyrtarachne's F… ★Helmet                     │
      │   —                 Class item   (empty)       │
      │                                                │
      │ SUBCLASS                                       │
      │   Strand            Strand       ● Strand      │
      ╰────────────────────────────────────────────────╯"
    `);
  });
});
