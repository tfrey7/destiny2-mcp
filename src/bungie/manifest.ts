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
  itemTypeDisplayName?: string;
  defaultDamageType?: number;
  talentGrid?: { hudDamageType?: number };
  inventory?: { tierTypeName?: string; bucketTypeHash?: number };
}

export interface ItemMeta {
  name: string;
  rarity: string;
  type: string;
  element?: string;
  bucketHash: number;
}

const DAMAGE_TYPE: Record<number, string> = {
  1: "Kinetic",
  2: "Arc",
  3: "Solar",
  4: "Void",
  6: "Stasis",
  7: "Strand",
};

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

function metaFrom(definition: Definition): ItemMeta | undefined {
  const name = nameFrom(definition);
  if (!name) return undefined;

  // Weapons carry their element in defaultDamageType; subclasses leave it 0 and use talentGrid.hudDamageType.
  const element =
    DAMAGE_TYPE[definition.defaultDamageType ?? 0] ??
    DAMAGE_TYPE[definition.talentGrid?.hudDamageType ?? 0] ??
    (name.includes("Prismatic") ? "Prismatic" : undefined);

  return {
    name,
    rarity: definition.inventory?.tierTypeName ?? "Basic",
    type: definition.itemTypeDisplayName ?? "",
    element,
    bucketHash: definition.inventory?.bucketTypeHash ?? 0,
  };
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

async function streamItemMeta(remotePath: string): Promise<Record<string, ItemMeta>> {
  const response = await fetch(`https://www.bungie.net${remotePath}`);
  if (!response.ok || !response.body) {
    throw new Error(`[destiny2-mcp] Failed to download manifest table (${response.status})`);
  }

  const pipeline = chain([Readable.fromWeb(response.body as never), parser(), streamObject()]);
  const result: Record<string, ItemMeta> = {};
  for await (const { key, value } of pipeline as AsyncIterable<{ key: string; value: Definition }>) {
    const item = metaFrom(value);
    if (item) result[key] = item;
  }
  return result;
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

async function loadItemMeta(remotePath: string): Promise<Map<number, ItemMeta>> {
  const { versionDir } = await meta();
  const localPath = join(versionDir, "item-meta.json");
  try {
    const stored = JSON.parse(await readFile(localPath, "utf8")) as Record<string, ItemMeta>;
    return new Map(Object.entries(stored).map(([hash, value]) => [Number(hash), value]));
  } catch {
    const data = await streamItemMeta(remotePath);
    await mkdir(versionDir, { recursive: true });
    await writeFile(localPath, JSON.stringify(data));
    return new Map(Object.entries(data).map(([hash, value]) => [Number(hash), value]));
  }
}

let itemIndex: Promise<Map<number, ItemMeta>> | null = null;
let loadoutIndex: Promise<Map<number, string>> | null = null;

function itemMetaMap() {
  if (!itemIndex) {
    itemIndex = meta().then(({ paths }) => loadItemMeta(paths.DestinyInventoryItemDefinition));
  }
  return itemIndex;
}

export async function itemName(hash: number): Promise<string> {
  return (await itemMetaMap()).get(hash >>> 0)?.name ?? `Unknown item ${hash >>> 0}`;
}

export async function itemMeta(hash: number): Promise<ItemMeta | undefined> {
  return (await itemMetaMap()).get(hash >>> 0);
}

export async function loadoutName(hash: number): Promise<string> {
  if (!loadoutIndex) {
    loadoutIndex = meta().then(({ paths }) => loadIndex("loadout-names.json", paths.DestinyLoadoutNameDefinition));
  }
  const names = await loadoutIndex;
  return names.get(hash >>> 0) ?? "Unnamed loadout";
}
