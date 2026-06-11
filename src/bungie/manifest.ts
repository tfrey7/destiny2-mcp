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
  itemType?: number;
  itemTypeDisplayName?: string;
  collectibleHash?: number;
  defaultDamageType?: number;
  talentGrid?: { hudDamageType?: number };
  equippingBlock?: { ammoType?: number };
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

export interface SocketEntry {
  socketTypeHash?: number;
  singleInitialItemHash?: number;
  reusablePlugItems?: { plugItemHash: number }[];
  reusablePlugSetHash?: number;
}

export interface SocketCategoryEntry {
  socketCategoryHash: number;
  socketIndexes: number[];
}

export interface ItemDefinition {
  displayProperties?: { name?: string; description?: string };
  itemTypeDisplayName?: string;
  flavorText?: string;
  inventory?: { tierTypeName?: string; bucketTypeHash?: number };
  defaultDamageType?: number;
  equippingBlock?: { ammoType?: number };
  sockets?: { socketEntries?: SocketEntry[]; socketCategories?: SocketCategoryEntry[] };
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

// DestinyInventoryBucketDefinition hashes for the three weapon equip slots. An item only carries a
// meaningful slot if it lives in one of these buckets; armor and everything else map to undefined.
const WEAPON_SLOT_BY_BUCKET: Record<number, string> = {
  1498876634: "Kinetic",
  2465295065: "Energy",
  953998645: "Power",
};

// DestinyAmmunitionType enum: 0 = None (non-weapon), 1 = Primary, 2 = Special, 3 = Heavy.
const AMMO_TYPE: Record<number, string> = {
  1: "Primary",
  2: "Special",
  3: "Heavy",
};

// The equip slot a weapon competes for, or undefined for non-weapons.
export function slotFromBucketHash(bucketHash: number | undefined): string | undefined {
  return bucketHash === undefined ? undefined : WEAPON_SLOT_BY_BUCKET[bucketHash];
}

// The ammo a weapon draws from, or undefined when None / not a weapon.
export function ammoTypeLabel(ammoType: number | undefined): string | undefined {
  return ammoType === undefined ? undefined : AMMO_TYPE[ammoType];
}

const TIER_RANK: Record<string, number> = {
  Exotic: 4,
  Legendary: 3,
  Rare: 2,
  Uncommon: 1,
  Common: 0,
};

// Weapons carry their element in defaultDamageType; subclasses leave it 0 and use talentGrid.hudDamageType.
function elementOf(item: RawItem): string | undefined {
  return (
    DAMAGE_TYPE[item.defaultDamageType ?? 0] ??
    DAMAGE_TYPE[item.talentGrid?.hudDamageType ?? 0] ??
    (item.displayProperties?.name?.includes("Prismatic") ? "Prismatic" : undefined)
  );
}

let metaPromise: Promise<{ versionDir: string; mobilePath: string }> | null = null;

function meta() {
  if (!metaPromise) {
    metaPromise = (async () => {
      const data = await bungieFetch<ManifestMeta>("/Destiny2/Manifest/", { auth: false });
      return {
        versionDir: join(MANIFEST_DIR, data.version),
        mobilePath: data.mobileWorldContentPaths.en,
      };
    })();
  }
  return metaPromise;
}

// Bungie ships the manifest as a zipped SQLite database; download and unpack it once per
// version so every definition is queryable by hash without holding the table in memory.
async function ensureDatabaseFile(versionDir: string, mobilePath: string): Promise<string> {
  const dbPath = join(versionDir, "world.sqlite");
  if (existsSync(dbPath)) {
    return dbPath;
  }

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
  if (!name) {
    return undefined;
  }
  return {
    name,
    tier: item.inventory?.tierTypeName,
    itemType: item.itemTypeDisplayName || undefined,
    collectibleHash: item.collectibleHash,
  };
}

export async function itemMeta(hash: number): Promise<ItemMeta | undefined> {
  const item = definition<RawItem>(await db(), ITEM_TABLE, hash);
  const name = item?.displayProperties?.name;
  if (!name) {
    return undefined;
  }

  return {
    name,
    rarity: item.inventory?.tierTypeName ?? "Basic",
    type: item.itemTypeDisplayName ?? "",
    element: elementOf(item),
    bucketHash: item.inventory?.bucketTypeHash ?? 0,
  };
}

export async function socketCategoryName(hash: number): Promise<string> {
  const category = await getDefinition<NameDefinition>("DestinySocketCategoryDefinition", hash);
  return category.displayProperties?.name ?? `Socket category ${hash >>> 0}`;
}

// The candidate plugs for a non-randomized socket (shader, ornament, emblem variant) live in a
// plug set keyed off the item definition; the live profile component only fills in what's unlocked.
export async function plugSetItemHashes(plugSetHash: number): Promise<number[]> {
  const plugSet = await getDefinition<{ reusablePlugItems?: { plugItemHash: number }[] }>(
    "DestinyPlugSetDefinition",
    plugSetHash,
  );
  return (plugSet.reusablePlugItems ?? []).map((plug) => plug.plugItemHash);
}

export async function loadoutName(hash: number): Promise<string> {
  const loadout = definition<NameDefinition>(await db(), "DestinyLoadoutNameDefinition", hash);
  return loadout?.displayProperties?.name ?? loadout?.name ?? "Unnamed loadout";
}

export async function collectibleSource(collectibleHash: number): Promise<string | undefined> {
  return (
    definition<CollectibleDefinition>(await db(), "DestinyCollectibleDefinition", collectibleHash)
      ?.sourceString || undefined
  );
}

let nameIndexPromise: Promise<
  Map<string, { hash: number; tier?: string; collectibleHash?: number }[]>
> | null = null;

// Resolving a name to a hash means scanning the whole item table once; cache the index for
// the process lifetime. Names repeat across rarities and reissues, so keep every candidate.
function buildNameIndex(connection: Database.Database) {
  const index = new Map<string, { hash: number; tier?: string; collectibleHash?: number }[]>();
  const rows = connection.prepare(`SELECT id, json FROM ${ITEM_TABLE}`).iterate();
  for (const { id, json } of rows as IterableIterator<{ id: number; json: string }>) {
    const item = JSON.parse(json) as RawItem;
    const name = item.displayProperties?.name;
    if (!name) {
      continue;
    }

    const key = name.toLowerCase();
    const candidates = index.get(key) ?? [];
    candidates.push({
      hash: id >>> 0,
      tier: item.inventory?.tierTypeName,
      collectibleHash: item.collectibleHash,
    });
    index.set(key, candidates);
  }
  return index;
}

// Prefer the highest rarity, then a candidate that actually has a Collections source.
export async function findItemByName(name: string): Promise<number | undefined> {
  if (!nameIndexPromise) {
    nameIndexPromise = (async () => buildNameIndex(await db()))();
  }
  const candidates = (await nameIndexPromise).get(name.toLowerCase());
  if (!candidates?.length) {
    return undefined;
  }

  return [...candidates].sort((a, b) => {
    const tier = (TIER_RANK[b.tier ?? ""] ?? 0) - (TIER_RANK[a.tier ?? ""] ?? 0);
    if (tier !== 0) {
      return tier;
    }
    return Number(Boolean(b.collectibleHash)) - Number(Boolean(a.collectibleHash));
  })[0].hash;
}

export type ItemCategory = "weapon" | "armor" | "shader" | "emblem" | "ornament" | "cosmetic";

const isShader = (entry: CatalogEntry) => entry.type === "Shader";
const isEmblem = (entry: CatalogEntry) => entry.type === "Emblem";
// Universal/transmog ornaments carry no dedicated category hash (just the generic Mods category), so
// the item type display name ("Weapon Ornament", "Hunter Universal Ornament", …) is the reliable signal.
const isOrnament = (entry: CatalogEntry) => Boolean(entry.type?.includes("Ornament"));

const CATEGORY_MATCHES: Record<ItemCategory, (entry: CatalogEntry) => boolean> = {
  weapon: (entry) => entry.itemType === 3,
  armor: (entry) => entry.itemType === 2,
  shader: isShader,
  emblem: isEmblem,
  ornament: isOrnament,
  cosmetic: (entry) => isShader(entry) || isEmblem(entry) || isOrnament(entry),
};

export interface CatalogEntry {
  hash: number;
  name: string;
  tier?: string;
  type?: string;
  element?: string;
  slot?: string;
  ammoType?: string;
  itemType?: number;
  collectibleHash?: number;
}

export interface SearchFilters {
  name?: string;
  element?: string;
  type?: string;
  tier?: string;
  category?: ItemCategory;
  limit?: number;
}

let catalogPromise: Promise<CatalogEntry[]> | null = null;

// Searching by attribute means scanning the whole item table once; cache the catalog for the
// process lifetime, mirroring the name index. Skip rows without a display name (dummies, redacted).
function buildCatalog(connection: Database.Database): CatalogEntry[] {
  const catalog: CatalogEntry[] = [];
  const rows = connection.prepare(`SELECT id, json FROM ${ITEM_TABLE}`).iterate();
  for (const { id, json } of rows as IterableIterator<{ id: number; json: string }>) {
    const item = JSON.parse(json) as RawItem;
    const name = item.displayProperties?.name;
    if (!name) {
      continue;
    }

    catalog.push({
      hash: id >>> 0,
      name,
      tier: item.inventory?.tierTypeName,
      type: item.itemTypeDisplayName || undefined,
      element: elementOf(item),
      slot: slotFromBucketHash(item.inventory?.bucketTypeHash),
      ammoType: ammoTypeLabel(item.equippingBlock?.ammoType),
      itemType: item.itemType,
      collectibleHash: item.collectibleHash,
    });
  }
  return catalog;
}

export interface SearchResult {
  count: number;
  truncated: boolean;
  items: CatalogEntry[];
}

// Names repeat across reissues; keep the copy with a Collections source so its hash chains into how_to_acquire.
function dedupeByName(entries: CatalogEntry[]): CatalogEntry[] {
  const byName = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    const existing = byName.get(entry.name);
    if (!existing || (!existing.collectibleHash && entry.collectibleHash)) {
      byName.set(entry.name, entry);
    }
  }
  return [...byName.values()];
}

export async function searchItems(filters: SearchFilters): Promise<SearchResult> {
  if (!catalogPromise) {
    catalogPromise = (async () => buildCatalog(await db()))();
  }
  const catalog = await catalogPromise;

  const name = filters.name?.toLowerCase();
  const type = filters.type?.toLowerCase();
  const inCategory = filters.category ? CATEGORY_MATCHES[filters.category] : undefined;

  const matches = catalog.filter((entry) => {
    if (name && !entry.name.toLowerCase().includes(name)) {
      return false;
    }
    if (type && !entry.type?.toLowerCase().includes(type)) {
      return false;
    }
    if (filters.element && entry.element !== filters.element) {
      return false;
    }
    if (filters.tier && entry.tier !== filters.tier) {
      return false;
    }
    if (inCategory && !inCategory(entry)) {
      return false;
    }
    return true;
  });

  const sorted = dedupeByName(matches).sort((a, b) => {
    const tier = (TIER_RANK[b.tier ?? ""] ?? 0) - (TIER_RANK[a.tier ?? ""] ?? 0);
    if (tier !== 0) {
      return tier;
    }
    return a.name.localeCompare(b.name);
  });

  const limit = filters.limit ?? 50;
  return { count: sorted.length, truncated: sorted.length > limit, items: sorted.slice(0, limit) };
}
