import { readFile } from "node:fs/promises";
import type { ClassName } from "../../schemas.js";
import { ORNAMENTS_FILE } from "../../setup/config.js";

export type OrnamentSlot = "helmet" | "arms" | "chest" | "legs" | "class";

export interface Ornament {
  hash: string;
  name: string;
  class: ClassName;
  slot: OrnamentSlot;
  look: string;
  tags: string[];
  themes: string[];
  set: string;
  crossClass: boolean;
}

export interface OrnamentMatch {
  name: string;
  slot: OrnamentSlot;
  look: string;
  themes: string[];
  tags: string[];
  crossClass: boolean;
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

export async function findOrnaments(
  query: string,
  options: { className: ClassName; slot?: OrnamentSlot; limit: number },
): Promise<OrnamentMatch[]> {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const ornaments = await loadOrnaments();
  const matches: OrnamentMatch[] = [];

  for (const ornament of ornaments) {
    if (ornament.class !== options.className) {
      continue;
    }

    if (options.slot && ornament.slot !== options.slot) {
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
      crossClass: ornament.crossClass,
      plugItemHash: Number(ornament.hash),
      score: points,
    });
  }

  matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return matches.slice(0, options.limit);
}

async function readOrnaments(): Promise<Ornament[]> {
  const raw = await readFile(ORNAMENTS_FILE, "utf8");

  return (JSON.parse(raw) as OrnamentsFile).ornaments;
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
