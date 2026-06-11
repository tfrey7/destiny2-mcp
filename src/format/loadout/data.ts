export type Section = "WEAPONS" | "ARMOR" | "SUBCLASS";

type Rgb = [number, number, number];

export const RARITY_COLOR: Record<string, Rgb> = {
  Exotic: [232, 197, 71],
  Legendary: [193, 143, 240],
  Rare: [107, 163, 224],
  Common: [77, 179, 106],
  Basic: [201, 201, 201],
};

export const ELEMENT: Record<string, { icon: string; color: Rgb }> = {
  Strand: { icon: "🐍", color: [64, 201, 86] },
  Void: { icon: "🔮", color: [179, 143, 240] },
  Arc: { icon: "⚡", color: [125, 210, 255] },
  Solar: { icon: "🔥", color: [255, 150, 60] },
  Stasis: { icon: "🧊", color: [120, 180, 235] },
  Prismatic: { icon: "💖", color: [255, 99, 216] },
  Kinetic: { icon: "›", color: [210, 210, 210] },
};

export const CLASS_ITEM_BUCKET = 1585787867;

export const BUCKET: Record<number, { section: Section; label: string; order: number }> = {
  1498876634: { section: "WEAPONS", label: "Kinetic", order: 0 },
  2465295065: { section: "WEAPONS", label: "Energy", order: 1 },
  953998645: { section: "WEAPONS", label: "Power", order: 2 },
  3448274439: { section: "ARMOR", label: "Helmet", order: 3 },
  3551918588: { section: "ARMOR", label: "Gauntlets", order: 4 },
  14239492: { section: "ARMOR", label: "Chest", order: 5 },
  20886954: { section: "ARMOR", label: "Legs", order: 6 },
  [CLASS_ITEM_BUCKET]: { section: "ARMOR", label: "Class item", order: 7 },
  3284755031: { section: "SUBCLASS", label: "Subclass", order: 8 },
};
