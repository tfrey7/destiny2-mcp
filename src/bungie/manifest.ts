import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

type DefinitionTable = Record<string, Definition>;

const TABLES = ["DestinyInventoryItemDefinition", "DestinyLoadoutNameDefinition"] as const;
type TableName = (typeof TABLES)[number];

let cache: Record<TableName, DefinitionTable> | null = null;

async function loadTable(versionDir: string, table: TableName, remotePath: string): Promise<DefinitionTable> {
  const localPath = join(versionDir, `${table}.json`);
  try {
    return JSON.parse(await readFile(localPath, "utf8")) as DefinitionTable;
  } catch {
    const response = await fetch(`https://www.bungie.net${remotePath}`);
    if (!response.ok) throw new Error(`[destiny2-mcp] Failed to download ${table} (${response.status})`);
    const text = await response.text();
    await mkdir(versionDir, { recursive: true });
    await writeFile(localPath, text);
    return JSON.parse(text) as DefinitionTable;
  }
}

async function ensureLoaded(): Promise<Record<TableName, DefinitionTable>> {
  if (cache) return cache;

  const meta = await bungieFetch<ManifestMeta>("/Destiny2/Manifest/", { auth: false });
  const paths = meta.jsonWorldComponentContentPaths.en;
  const versionDir = join(MANIFEST_DIR, meta.version);

  const loaded = {} as Record<TableName, DefinitionTable>;
  for (const table of TABLES) {
    loaded[table] = await loadTable(versionDir, table, paths[table]);
  }

  cache = loaded;
  return cache;
}

function nameFrom(definition: Definition | undefined): string | undefined {
  return definition?.displayProperties?.name ?? definition?.name;
}

export async function itemName(hash: number): Promise<string> {
  const tables = await ensureLoaded();
  return nameFrom(tables.DestinyInventoryItemDefinition[String(hash >>> 0)]) ?? `Unknown item ${hash >>> 0}`;
}

export async function loadoutName(hash: number): Promise<string> {
  const tables = await ensureLoaded();
  return nameFrom(tables.DestinyLoadoutNameDefinition[String(hash >>> 0)]) ?? "Unnamed loadout";
}
