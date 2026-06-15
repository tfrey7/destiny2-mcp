export type Section = "WEAPONS" | "ARMOR" | "SUBCLASS";

/** Card section labels: the bucket-backed sections plus the artifact, which has no bucket. */
export type CardSectionLabel = Section | "ARTIFACT";

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
