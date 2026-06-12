import { describe, expect, test } from "vitest";
import { cardModel, type LoadoutCard, type LoadoutCardItem } from "../src/format/loadout/model.js";

const KINETIC = 1498876634;
const ENERGY = 2465295065;
const POWER = 953998645;
const HELMET = 3448274439;
const CLASS_ITEM = 1585787867;
const SUBCLASS = 3284755031;

function cardItem(bucketHash: number, overrides: Partial<LoadoutCardItem> = {}): LoadoutCardItem {
  return { name: "Item", rarity: "Legendary", type: "Type", bucketHash, ...overrides };
}

function card(overrides: Partial<LoadoutCard> = {}): LoadoutCard {
  return { title: "Build", className: "Hunter", items: [], ...overrides };
}

describe("cardModel subtitle", () => {
  test("an explicit subtitle wins over the slot", () => {
    const model = cardModel(card({ className: "Hunter", slot: 2, subtitle: "Prismatic" }));

    expect(model.subtitle).toBe("Hunter · Prismatic");
  });

  test("falls back to the slot index when no subtitle is given", () => {
    const model = cardModel(card({ className: "Titan", slot: 0 }));

    expect(model.subtitle).toBe("Titan · slot 0");
  });

  test("is just the class name when neither subtitle nor slot is set", () => {
    const model = cardModel(card({ className: "Warlock" }));

    expect(model.subtitle).toBe("Warlock");
  });
});

describe("cardModel weapons", () => {
  test("orders weapons Kinetic, Energy, Power regardless of input order", () => {
    const model = cardModel(
      card({
        items: [
          cardItem(POWER, { name: "Rocket" }),
          cardItem(KINETIC, { name: "Hand Cannon" }),
          cardItem(ENERGY, { name: "SMG" }),
        ],
      }),
    );

    const weapons = model.sections.find((section) => section.label === "WEAPONS");

    expect(weapons?.rows.map((row) => row.name)).toEqual(["Hand Cannon", "SMG", "Rocket"]);
  });

  test("carries the weapon type as the middle column and passes element through", () => {
    const model = cardModel(
      card({ items: [cardItem(KINETIC, { type: "Sidearm", element: "Strand" })] }),
    );

    const row = model.sections.find((section) => section.label === "WEAPONS")?.rows[0];

    expect(row?.middle).toBe("Sidearm");
    expect(row?.element).toBe("Strand");
  });

  test("omits the weapons section when there are no weapons", () => {
    const model = cardModel(card({ items: [cardItem(HELMET)] }));

    expect(model.sections.some((section) => section.label === "WEAPONS")).toBe(false);
  });
});

describe("cardModel armor", () => {
  test("appends an empty class-item placeholder when none is equipped", () => {
    const model = cardModel(card({ items: [cardItem(HELMET, { name: "Helm" })] }));

    const placeholder = model.sections.find((section) => section.label === "ARMOR")?.rows.at(-1);

    expect(placeholder).toMatchObject({ middle: "Class item", empty: true });
  });

  test("adds no placeholder when a class item is present", () => {
    const model = cardModel(card({ items: [cardItem(CLASS_ITEM, { name: "Cloak" })] }));

    const armor = model.sections.find((section) => section.label === "ARMOR");

    expect(armor?.rows.some((row) => row.empty)).toBe(false);
  });

  test("uses the bucket label as the middle column", () => {
    const model = cardModel(card({ items: [cardItem(HELMET, { name: "Helm" })] }));

    const row = model.sections.find((section) => section.label === "ARMOR")?.rows[0];

    expect(row?.middle).toBe("Helmet");
  });
});

describe("cardModel subclass", () => {
  test("shows the element in the middle column and keeps only the first subclass", () => {
    const model = cardModel(
      card({
        items: [
          cardItem(SUBCLASS, { name: "Strand", element: "Strand" }),
          cardItem(SUBCLASS, { name: "Solar", element: "Solar" }),
        ],
      }),
    );

    const subclass = model.sections.find((section) => section.label === "SUBCLASS");

    expect(subclass?.rows).toHaveLength(1);
    expect(subclass?.rows[0].middle).toBe("Strand");
  });
});

describe("cardModel sections", () => {
  test("orders sections subclass, weapons, armor", () => {
    const model = cardModel(
      card({
        items: [cardItem(SUBCLASS, { element: "Void" }), cardItem(KINETIC), cardItem(HELMET)],
      }),
    );

    expect(model.sections.map((section) => section.label)).toEqual([
      "SUBCLASS",
      "WEAPONS",
      "ARMOR",
    ]);
  });

  test("always includes an armor section, even for an empty loadout", () => {
    const model = cardModel(card({ items: [] }));

    expect(model.sections.map((section) => section.label)).toEqual(["ARMOR"]);
  });
});
