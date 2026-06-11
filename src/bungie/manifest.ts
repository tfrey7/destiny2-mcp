import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import { MANIFEST_DIR } from "../config.js";
import { bungieFetch } from "./client.js";

const ITEM_TABLE = "DestinyInventoryItemDefinition";

interface ManifestMeta {
  version: string;
  mobileWorldContentPaths: Record<string, string>;
}

interface RawItem {
  displayProperties?: { name?: string };
  itemTypeDisplayName?: string;
  collectibleHash?: number;
  defaultDamageType?: number;
  talentGrid?: { hudDamageType?: number };
  inventory?: { tierTypeName?: string; bucketTypeHash?: number };
}

interface CollectibleDefinition {
  sourceString?: string;
}

interface NameDefinition {
  displayProperties?: { name?: string };
  name?: string;
}

interface StatDefinition {
  displayProperties?: { name?: string };
}

export interface ItemInfo {
  name: string;
  tier?: string;
  itemType?: string;
  collectibleHash?: number;
}

export interface ItemMeta {
  name: string;
  rarity: string;
  type: string;
  element?: string;
  bucketHash: number;
}

export interface ItemDefinition {
  displayProperties?: { name?: string; description?: string };
  itemTypeDisplayName?: string;
  flavorText?: string;
  inventory?: { tierTypeName?: string };
  defaultDamageType?: number;
  sockets?: { socketEntries?: { singleInitialItemHash?: number }[] };
  stats?: { stats?: Record<string, { value?: number }> };
}

const DAMAGE_TYPE: Record<number, string> = {
  1: "Kinetic",
  2: "Arc",
  3: "Solar",
  4: "Void",
  6: "Stasis",
  7: "Strand",
};

const TIER_RANK: Record<string, number> = { Exotic: 4, Legendary: 3, Rare: 2, Uncommon: 1, Common: 0 };

let metaPromise: Promise<{ versionDir: string; mobilePath: string }> | null = null;

function meta() {
  if (!metaPromise) {
    metaPromise = (async () => {
      const data = await bungieFetch<ManifestMeta>("/Destiny2/Manifest/", { auth: false });
      return { versionDir: join(MANIFEST_DIR, data.version), mobilePath: data.mobileWorldContentPaths.en };
    })();
  }
  return metaPromise;
}

// Bungie ships the manifest as a zipped SQLite database; download and unpack it once per
// version so every definition is queryable by hash without holding the table in memory.
async function ensureDatabaseFile(versionDir: string, mobilePath: string): Promise<string> {
  const dbPath = join(versionDir, "world.sqlite");
  if (existsSync(dbPath)) return dbPath;

  const response = await fetch(`https://www.bungie.net${mobilePath}`);
  if (!response.ok) {
    throw new Error(`[destiny2-mcp] Failed to download manifest database (${response.status})`);
  }

  const archive = new AdmZip(Buffer.from(await response.arrayBuffer()));
  const [entry] = archive.getEntries();
  await mkdir(versionDir, { recursive: true });
  await writeFile(dbPath, entry.getData());
  return dbPath;
}

let dbPromise: Promise<Database.Database> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { versionDir, mobilePath } = await meta();
      const dbPath = await ensureDatabaseFile(versionDir, mobilePath);
      return new Database(dbPath, { readonly: true, fileMustExist: true });
    })();
  }
  return dbPromise;
}

// The SQLite id column stores each hash as a signed 32-bit integer.
function toId(hash: number): number {
  return hash | 0;
}

const statements = new Map<string, Database.Statement>();

function definition<T>(connection: Database.Database, table: string, hash: number): T | undefined {
  let statement = statements.get(table);
  if (!statement) {
    statement = connection.prepare(`SELECT json FROM ${table} WHERE id = ?`);
    statements.set(table, statement);
  }
  const row = statement.get(toId(hash)) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as T) : undefined;
}

// Every definition is local, so resolving one by hash is a point query rather than a network call.
export async function getDefinition<T>(entityType: string, hash: number): Promise<T> {
  return definition<T>(await db(), entityType, hash) ?? ({} as T);
}

export function itemDefinition(hash: number): Promise<ItemDefinition> {
  return getDefinition<ItemDefinition>(ITEM_TABLE, hash);
}

export async function statName(hash: number): Promise<string> {
  const stat = await getDefinition<StatDefinition>("DestinyStatDefinition", hash);
  return stat.displayProperties?.name ?? `Stat ${hash >>> 0}`;
}

export async function itemName(hash: number): Promise<string> {
  const item = definition<RawItem>(await db(), ITEM_TABLE, hash);
  return item?.displayProperties?.name ?? `Unknown item ${hash >>> 0}`;
}

export async function itemInfo(hash: number): Promise<ItemInfo | undefined> {
  const item = definition<RawItem>(await db(), ITEM_TABLE, hash);
  const name = item?.displayProperties?.name;
  if (!name) return undefined;
  return { name, tier: item.inventory?.tierTypeName, itemType: item.itemTypeDisplayName || undefined, collectibleHash: item.collectibleHash };
}

export async function itemMeta(hash: number): Promise<ItemMeta | undefined> {
  const item = definition<RawItem>(await db(), ITEM_TABLE, hash);
  const name = item?.displayProperties?.name;
  if (!name) return undefined;

  // Weapons carry their element in defaultDamageType; subclasses leave it 0 and use talentGrid.hudDamageType.
  const element =
    DAMAGE_TYPE[item.defaultDamageType ?? 0] ??
    DAMAGE_TYPE[item.talentGrid?.hudDamageType ?? 0] ??
    (name.includes("Prismatic") ? "Prismatic" : undefined);

  return {
    name,
    rarity: item.inventory?.tierTypeName ?? "Basic",
    type: item.itemTypeDisplayName ?? "",
    element,
    bucketHash: item.inventory?.bucketTypeHash ?? 0,
  };
}

export async function loadoutName(hash: number): Promise<string> {
  const loadout = definition<NameDefinition>(await db(), "DestinyLoadoutNameDefinition", hash);
  return loadout?.displayProperties?.name ?? loadout?.name ?? "Unnamed loadout";
}

export async function collectibleSource(collectibleHash: number): Promise<string | undefined> {
  return definition<CollectibleDefinition>(await db(), "DestinyCollectibleDefinition", collectibleHash)?.sourceString || undefined;
}

let nameIndexPromise: Promise<Map<string, { hash: number; tier?: string; collectibleHash?: number }[]>> | null = null;

// Resolving a name to a hash means scanning the whole item table once; cache the index for
// the process lifetime. Names repeat across rarities and reissues, so keep every candidate.
function buildNameIndex(connection: Database.Database) {
  const index = new Map<string, { hash: number; tier?: string; collectibleHash?: number }[]>();
  const rows = connection.prepare(`SELECT id, json FROM ${ITEM_TABLE}`).iterate();
  for (const { id, json } of rows as IterableIterator<{ id: number; json: string }>) {
    const item = JSON.parse(json) as RawItem;
    const name = item.displayProperties?.name;
    if (!name) continue;

    const key = name.toLowerCase();
    const candidates = index.get(key) ?? [];
    candidates.push({ hash: id >>> 0, tier: item.inventory?.tierTypeName, collectibleHash: item.collectibleHash });
    index.set(key, candidates);
  }
  return index;
}

// Prefer the highest rarity, then a candidate that actually has a Collections source.
export async function findItemByName(name: string): Promise<number | undefined> {
  if (!nameIndexPromise) nameIndexPromise = db().then(buildNameIndex);
  const candidates = (await nameIndexPromise).get(name.toLowerCase());
  if (!candidates?.length) return undefined;

  return [...candidates].sort((a, b) => {
    const tier = (TIER_RANK[b.tier ?? ""] ?? 0) - (TIER_RANK[a.tier ?? ""] ?? 0);
    if (tier !== 0) return tier;
    return Number(Boolean(b.collectibleHash)) - Number(Boolean(a.collectibleHash));
  })[0].hash;
}
