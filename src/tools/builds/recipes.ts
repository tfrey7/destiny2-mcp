import { readFile } from "node:fs/promises";
import { BUILDS_FILE } from "../../setup/config.js";

// The shape DIM's loadout_share API returns. We keep it intact as the canonical, hash-based
// recipe; socketOverrides on the subclass item encode its super/aspects/fragments/abilities.
export interface DimItem {
  hash: number;
  socketOverrides?: Record<string, number>;
}

export interface DimParameters {
  mods?: number[];
  modsByBucket?: Record<string, number[]>;
  inGameIdentifiers?: { nameHash?: number; colorHash?: number; iconHash?: number };
}

export interface DimLoadout {
  name: string;
  classType: number;
  createdAt?: number;
  equipped: DimItem[];
  unequipped: DimItem[];
  parameters?: DimParameters;
}

export interface BuildRecipe {
  shareId: string;
  dimLink: string;
  source: string;
  className: string;
  subclass: string;
  slug: string;
  loadout: DimLoadout;
}

export interface BuildsFile {
  source: string;
  scrapedAt: string;
  builds: BuildRecipe[];
}

export async function loadBuilds(): Promise<BuildsFile> {
  return JSON.parse(await readFile(BUILDS_FILE, "utf8")) as BuildsFile;
}
