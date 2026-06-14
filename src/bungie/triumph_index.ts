import { readFile } from "node:fs/promises";
import { TRIUMPHS_FILE } from "../setup/config.js";

// The offline location/activity tag for one Triumph, joined onto live record state by the read tools.
// Built by scripts/triumphs/build_index.ts from the manifest's presentation tree (authoritative) plus
// a model enrichment layer for the residue; `source`/`confidence` record which layer placed it.
export interface TriumphTag {
  location?: string[];
  activityType?: string;
  season?: string;
  expires?: string;
  scope?: "solo" | "fireteam";
  effort?: "quick" | "moderate" | "grind";
  summary?: string;
  source: "override" | "presentation-tree" | "activity-catalog" | "name-text" | "model";
  confidence: "high" | "medium" | "low";
}

export async function triumphTag(hash: number): Promise<TriumphTag | undefined> {
  return (await loadTriumphIndex()).get(hash);
}

export async function loadTriumphIndex(): Promise<Map<number, TriumphTag>> {
  cache ??= readIndex();

  return cache;
}

interface TriumphsFile {
  manifestVersion: string;
  triumphs: Record<string, TriumphTag>;
}

let cache: Promise<Map<number, TriumphTag>> | null = null;

async function readIndex(): Promise<Map<number, TriumphTag>> {
  try {
    const raw = await readFile(TRIUMPHS_FILE, "utf8");
    const file = JSON.parse(raw) as TriumphsFile;

    return new Map(Object.entries(file.triumphs).map(([hash, tag]) => [Number(hash) >>> 0, tag]));
  } catch (error) {
    cache = null;
    throw error;
  }
}
