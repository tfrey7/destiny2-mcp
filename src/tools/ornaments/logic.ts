import { readFile } from "node:fs/promises";
import type { ClassName } from "../../schemas.js";
import { ORNAMENTS_FILE } from "../../setup/config.js";

export type OrnamentSlot = "helmet" | "arms" | "chest" | "legs" | "class";

export interface Ornament {
  hash: string;
  name: string;
  slot: OrnamentSlot;
  look: string;
  tags: string[];
  themes: string[];
  set: string;
  hunterHash: string | null;
  titanHash: string | null;
}

export interface OrnamentMatch {
  name: string;
  slot: OrnamentSlot;
  look: string;
  themes: string[];
  tags: string[];
  plugItemHash: number;
  score: number;
}

interface OrnamentsFile {
  ornaments: Ornament[];
}

let cache: Promise<Ornament[]> | null = null;

export async function loadOrnaments(): Promise<Ornament[]> {
  cache ??= readOrnaments();

  return cache;
}

async function readOrnaments(): Promise<Ornament[]> {
  const raw = await readFile(ORNAMENTS_FILE, "utf8");

  return (JSON.parse(raw) as OrnamentsFile).ornaments;
}

export async function findOrnaments(
  query: string,
  options: { className: ClassName; slot?: OrnamentSlot; limit: number },
): Promise<OrnamentMatch[]> {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const ornaments = await loadOrnaments();
  const matches: OrnamentMatch[] = [];

  for (const ornament of ornaments) {
    if (options.slot && ornament.slot !== options.slot) {
      continue;
    }

    const plugHash = hashForClass(ornament, options.className);

    if (!plugHash) {
      continue;
    }

    const points = score(ornament, terms);

    if (points === 0) {
      continue;
    }

    matches.push({
      name: ornament.name,
      slot: ornament.slot,
      look: ornament.look,
      themes: ornament.themes,
      tags: ornament.tags,
      plugItemHash: Number(plugHash),
      score: points,
    });
  }

  matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return matches.slice(0, options.limit);
}

// Captions were generated on the Warlock model; a set's look carries to Hunter/Titan only where the set
// name matched at build time, so those classes return null for unmatched sets rather than a wrong piece.
function hashForClass(ornament: Ornament, className: ClassName): string | null {
  if (className === "Warlock") {
    return ornament.hash;
  }

  if (className === "Hunter") {
    return ornament.hunterHash;
  }

  return ornament.titanHash;
}

// Themes are the deliberate aesthetic labels, so they weigh heaviest; tags next; a bare mention in the
// free-text look or set name counts least — "robot" should surface robot-themed pieces over a passing
// "metallic" tag.
function score(ornament: Ornament, terms: string[]): number {
  let total = 0;

  for (const term of terms) {
    if (ornament.themes.includes(term)) {
      total += 10;
    } else if (ornament.themes.some((theme) => theme.includes(term))) {
      total += 6;
    } else if (ornament.tags.includes(term)) {
      total += 5;
    } else if (ornament.tags.some((tag) => tag.includes(term))) {
      total += 3;
    } else if (ornament.look.toLowerCase().includes(term) || ornament.set.includes(term)) {
      total += 1;
    }
  }

  return total;
}
