import { BUCKET, CLASS_ITEM_BUCKET, type Section } from "./data.js";

export interface LoadoutCardItem {
  name: string;
  rarity: string;
  type: string;
  element?: string;
  bucketHash: number;
}

export interface LoadoutCard {
  title: string;
  className: string;
  /** Saved-loadout slot index. Omit for community builds, which have no slot. */
  slot?: number;
  /** Overrides the detail shown after the class name. Defaults to `slot N` when slot is set. */
  subtitle?: string;
  items: LoadoutCardItem[];
}

export interface CardRow {
  name: string;
  rarity: string;
  /** Middle column: weapon type or armor slot label. */
  middle: string;
  /** Element name (e.g. "Strand"), when the item or subclass has one. */
  element?: string;
  /** The placeholder row for a loadout with no class item equipped. */
  empty?: boolean;
}

export interface CardSection {
  label: Section;
  rows: CardRow[];
}

export interface CardModel {
  title: string;
  subtitle: string;
  sections: CardSection[];
}

/**
 * Reduce a loadout to ordered sections and rows — the shared input for every card renderer.
 *
 * @example
 * {
 *   title: "Threadrunner",
 *   subtitle: "Hunter · slot 2",
 *   sections: [
 *     { label: "WEAPONS", rows: [
 *       { name: "Quicksilver Storm", rarity: "Exotic", middle: "Auto Rifle", element: "Strand" },
 *     ] },
 *     { label: "ARMOR", rows: [
 *       { name: "Mask of Bakris", rarity: "Exotic", middle: "Helmet" },
 *       { name: "—", rarity: "Basic", middle: "Class item", empty: true },
 *     ] },
 *     { label: "SUBCLASS", rows: [
 *       { name: "Strand Hunter", rarity: "Basic", middle: "Strand", element: "Strand" },
 *     ] },
 *   ],
 * }
 */
export function cardModel(card: LoadoutCard): CardModel {
  const detail = card.subtitle ?? (card.slot !== undefined ? `slot ${card.slot}` : undefined);
  const subtitle = detail ? `${card.className} · ${detail}` : card.className;
  const sections: CardSection[] = [];

  const weapons = inSection(card.items, "WEAPONS");

  if (weapons.length > 0) {
    sections.push({
      label: "WEAPONS",
      rows: weapons.map((item) => ({
        name: item.name,
        rarity: item.rarity,
        middle: item.type,
        element: item.element,
      })),
    });
  }

  const armor = inSection(card.items, "ARMOR");

  const armorRows: CardRow[] = armor.map((item) => ({
    name: item.name,
    rarity: item.rarity,
    middle: BUCKET[item.bucketHash].label,
  }));

  if (!armor.some((item) => item.bucketHash === CLASS_ITEM_BUCKET)) {
    armorRows.push({ name: "—", rarity: "Basic", middle: "Class item", empty: true });
  }

  sections.push({ label: "ARMOR", rows: armorRows });

  const subclass = inSection(card.items, "SUBCLASS")[0];

  if (subclass) {
    sections.push({
      label: "SUBCLASS",
      rows: [
        {
          name: subclass.name,
          rarity: subclass.rarity,
          middle: subclass.element ?? "",
          element: subclass.element,
        },
      ],
    });
  }

  return { title: card.title, subtitle, sections };
}

function inSection(items: LoadoutCardItem[], section: Section): LoadoutCardItem[] {
  return items
    .filter((item) => BUCKET[item.bucketHash]?.section === section)
    .sort((a, b) => (BUCKET[a.bucketHash]?.order ?? 99) - (BUCKET[b.bucketHash]?.order ?? 99));
}
