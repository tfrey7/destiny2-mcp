import { z } from "zod";

// Shared Destiny vocabulary: the attribute enums the tools accept as input and the bungie layer
// decodes from the manifest. Defined once so an item's element/tier/class/category can't drift
// between what a tool validates and what the manifest emits.

// A weapon's damage element. Prismatic only ever applies to a subclass, but list/search surface it
// so an item filtered to a Prismatic subclass build reads consistently.
export const elementSchema = z.enum([
  "Kinetic",
  "Arc",
  "Solar",
  "Void",
  "Stasis",
  "Strand",
  "Prismatic",
]);
export type Element = z.infer<typeof elementSchema>;

// A subclass's damage affinity — element minus Kinetic (there is no Kinetic subclass), plus Prismatic.
export const subclassSchema = z.enum(["Prismatic", "Solar", "Arc", "Void", "Stasis", "Strand"]);
export type Subclass = z.infer<typeof subclassSchema>;

export const tierSchema = z.enum(["Exotic", "Legendary", "Rare", "Uncommon", "Common"]);
export type Tier = z.infer<typeof tierSchema>;

export const classNameSchema = z.enum(["Titan", "Hunter", "Warlock"]);
export type ClassName = z.infer<typeof classNameSchema>;

export const itemCategorySchema = z.enum([
  "weapon",
  "armor",
  "shader",
  "emblem",
  "ornament",
  "cosmetic",
]);
export type ItemCategory = z.infer<typeof itemCategorySchema>;
