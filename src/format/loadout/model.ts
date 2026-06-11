import { BUCKET, CLASS_ITEM_BUCKET, ELEMENT, RARITY_COLOR, type Section } from "./data.js";

export type Rgb = [number, number, number];

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

export interface CardRowElement {
  name: string;
  icon: string;
  color: Rgb;
}

export interface CardRow {
  name: string;
  color: Rgb;
  /** Middle column: weapon type or armor slot label. */
  middle: string;
  element?: CardRowElement;
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

function rarityColor(rarity: string): Rgb {
  return RARITY_COLOR[rarity] ?? RARITY_COLOR.Basic;
}

function elementOf(name: string | undefined): CardRowElement | undefined {
  const entry = name ? ELEMENT[name] : undefined;
  if (!entry || !name) {
    return undefined;
  }
  return { name, icon: entry.icon, color: entry.color };
}

function inSection(items: LoadoutCardItem[], section: Section): LoadoutCardItem[] {
  return items
    .filter((item) => BUCKET[item.bucketHash]?.section === section)
    .sort((a, b) => (BUCKET[a.bucketHash]?.order ?? 99) - (BUCKET[b.bucketHash]?.order ?? 99));
}

/** Reduce a loadout to ordered sections and rows — the shared input for every card renderer. */
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
        color: rarityColor(item.rarity),
        middle: item.type,
        element: elementOf(item.element),
      })),
    });
  }

  const armor = inSection(card.items, "ARMOR");
  const armorRows: CardRow[] = armor.map((item) => ({
    name: item.name,
    color: rarityColor(item.rarity),
    middle: BUCKET[item.bucketHash].label,
  }));
  if (!armor.some((item) => item.bucketHash === CLASS_ITEM_BUCKET)) {
    armorRows.push({ name: "—", color: rarityColor("Basic"), middle: "Class item", empty: true });
  }
  sections.push({ label: "ARMOR", rows: armorRows });

  const subclass = inSection(card.items, "SUBCLASS")[0];
  if (subclass) {
    const color = subclass.element
      ? (ELEMENT[subclass.element]?.color ?? rarityColor("Basic"))
      : rarityColor("Basic");
    sections.push({
      label: "SUBCLASS",
      rows: [
        {
          name: subclass.name,
          color,
          middle: subclass.element ?? "",
          element: elementOf(subclass.element),
        },
      ],
    });
  }

  return { title: card.title, subtitle, sections };
}
