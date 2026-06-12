import { readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Merges the vision captions produced for shader swatch icons (one JSON file per workflow batch under
// .cache/shaders/captions/) with the authoritative shader names, writing the committed index the
// find_shaders tool reads at runtime. Shaders are account-wide, so there is no per-class resolution.

const ROOT = dirname(fileURLToPath(import.meta.url));
const CAPTIONS_DIR = join(ROOT, "..", "..", ".cache", "shaders", "captions");
const SHADERS_LIST = join(ROOT, "..", "..", ".cache", "shaders", "shaders.json");
const OUT_FILE = join(ROOT, "..", "..", "data", "shaders.json");

interface Caption {
  hash: string;
  colors: string[];
  warmth: string;
  brightness: string;
  finish: string[];
  look: string;
  tags: string[];
}

interface ShaderEntry extends Omit<Caption, "hash"> {
  hash: string;
  name: string;
}

function loadCaptions(): Caption[] {
  const captions: Caption[] = [];

  for (const file of readdirSync(CAPTIONS_DIR)) {
    if (!/^batch-\d+\.json$/.test(file)) {
      continue;
    }

    captions.push(...(JSON.parse(readFileSync(join(CAPTIONS_DIR, file), "utf8")) as Caption[]));
  }

  return captions;
}

async function main(): Promise<void> {
  const names = new Map(
    (JSON.parse(readFileSync(SHADERS_LIST, "utf8")) as { hash: string; name: string }[]).map(
      (shader) => [shader.hash, shader.name],
    ),
  );

  const shaders: ShaderEntry[] = [];

  for (const caption of loadCaptions()) {
    const name = names.get(caption.hash);

    if (!name) {
      continue; // unnamed manifest entries aren't actionable to recommend
    }

    const { hash, colors, warmth, brightness, finish, look, tags } = caption;

    shaders.push({ hash, name, colors, warmth, brightness, finish, look, tags });
  }

  shaders.sort((a, b) => a.name.localeCompare(b.name));

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify({ shaders }, null, 2)}\n`);

  console.log(`[destiny2-mcp] Wrote ${shaders.length} named shaders to ${OUT_FILE}`);
}

await main();
