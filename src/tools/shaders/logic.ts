import { readFile } from "node:fs/promises";
import { SHADERS_FILE } from "../../setup/config.js";

export interface Shader {
  hash: string;
  name: string;
  colors: string[];
  warmth: string;
  brightness: string;
  finish: string[];
  look: string;
  tags: string[];
}

export interface ShaderMatch {
  name: string;
  colors: string[];
  warmth: string;
  brightness: string;
  finish: string[];
  look: string;
  plugItemHash: number;
  score: number;
}

interface ShadersFile {
  shaders: Shader[];
}

let cache: Promise<Shader[]> | null = null;

export async function loadShaders(): Promise<Shader[]> {
  cache ??= readShaders();

  return cache;
}

export async function findShaders(query: string, limit: number): Promise<ShaderMatch[]> {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const shaders = await loadShaders();
  const matches: ShaderMatch[] = [];

  for (const shader of shaders) {
    const points = score(shader, terms);

    if (points === 0) {
      continue;
    }

    matches.push({
      name: shader.name,
      colors: shader.colors,
      warmth: shader.warmth,
      brightness: shader.brightness,
      finish: shader.finish,
      look: shader.look,
      plugItemHash: Number(shader.hash),
      score: points,
    });
  }

  matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return matches.slice(0, limit);
}

async function readShaders(): Promise<Shader[]> {
  const raw = await readFile(SHADERS_FILE, "utf8");

  return (JSON.parse(raw) as ShadersFile).shaders;
}

// Colors are the search intent for a shader, so they weigh heaviest, then the descriptor tags, then the
// material finish and the warmth/brightness axes, then a bare mention in the free-text look.
function score(shader: Shader, terms: string[]): number {
  let total = 0;

  for (const term of terms) {
    if (shader.colors.includes(term)) {
      total += 8;
    } else if (shader.colors.some((color) => color.includes(term))) {
      total += 5;
    } else if (shader.tags.includes(term)) {
      total += 6;
    } else if (shader.tags.some((tag) => tag.includes(term))) {
      total += 3;
    } else if (shader.finish.includes(term)) {
      total += 5;
    } else if (shader.warmth === term || shader.brightness === term) {
      total += 4;
    } else if (shader.look.toLowerCase().includes(term)) {
      total += 1;
    }
  }

  return total;
}
