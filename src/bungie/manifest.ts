import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import chain from "stream-chain";
import { parser } from "stream-json";
import { streamObject } from "stream-json/streamers/stream-object.js";
import { MANIFEST_DIR } from "../config.js";
import { bungieFetch } from "./client.js";

interface ManifestMeta {
  version: string;
  jsonWorldComponentContentPaths: Record<string, Record<string, string>>;
}

interface Definition {
  displayProperties?: { name?: string };
  name?: string;
}

let metaPromise: Promise<{ versionDir: string; paths: Record<string, string> }> | null = null;

function meta() {
  if (!metaPromise) {
    metaPromise = (async () => {
      const data = await bungieFetch<ManifestMeta>("/Destiny2/Manifest/", { auth: false });
      return { versionDir: join(MANIFEST_DIR, data.version), paths: data.jsonWorldComponentContentPaths.en };
    })();
  }
  return metaPromise;
}

function nameFrom(definition: Definition | undefined): string | undefined {
  return definition?.displayProperties?.name ?? definition?.name;
}

// Stream the table instead of buffering it — DestinyInventoryItemDefinition is ~190MB
// and JSON.parsing it whole exhausts the heap.
async function streamNames(remotePath: string): Promise<Record<string, string>> {
  const response = await fetch(`https://www.bungie.net${remotePath}`);
  if (!response.ok || !response.body) {
    throw new Error(`[destiny2-mcp] Failed to download manifest table (${response.status})`);
  }

  const pipeline = chain([Readable.fromWeb(response.body as never), parser(), streamObject()]);
  const names: Record<string, string> = {};
  for await (const { key, value } of pipeline as AsyncIterable<{ key: string; value: Definition }>) {
    const name = nameFrom(value);
    if (name) names[key] = name;
  }
  return names;
}

async function loadIndex(file: string, remotePath: string): Promise<Map<number, string>> {
  const { versionDir } = await meta();
  const localPath = join(versionDir, file);
  try {
    const stored = JSON.parse(await readFile(localPath, "utf8")) as Record<string, string>;
    return new Map(Object.entries(stored).map(([hash, name]) => [Number(hash), name]));
  } catch {
    const names = await streamNames(remotePath);
    await mkdir(versionDir, { recursive: true });
    await writeFile(localPath, JSON.stringify(names));
    return new Map(Object.entries(names).map(([hash, name]) => [Number(hash), name]));
  }
}

let itemIndex: Promise<Map<number, string>> | null = null;
let loadoutIndex: Promise<Map<number, string>> | null = null;

export async function itemName(hash: number): Promise<string> {
  if (!itemIndex) {
    itemIndex = meta().then(({ paths }) => loadIndex("item-names.json", paths.DestinyInventoryItemDefinition));
  }
  const names = await itemIndex;
  return names.get(hash >>> 0) ?? `Unknown item ${hash >>> 0}`;
}

export async function loadoutName(hash: number): Promise<string> {
  if (!loadoutIndex) {
    loadoutIndex = meta().then(({ paths }) => loadIndex("loadout-names.json", paths.DestinyLoadoutNameDefinition));
  }
  const names = await loadoutIndex;
  return names.get(hash >>> 0) ?? "Unnamed loadout";
}
