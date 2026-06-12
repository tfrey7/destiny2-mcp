import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { MANIFEST_DIR } from "../setup/config.js";
import { bungieFetch } from "./client.js";

// Force the manifest to download and open up front, so a missing or unreadable manifest fails
// loudly at startup instead of surfacing as a cryptic error on the first gear tool call.
export async function loadManifest(): Promise<void> {
  await db();
}

// Every definition is local, so resolving one by hash is a point query rather than a network call.
export async function getDefinition<T>(table: string, hash: number): Promise<T> {
  return definition<T>(await db(), table, hash) ?? ({} as T);
}

// Like getDefinition, but preserves the absent-row signal for callers that fall back on a missing item.
export async function findDefinition<T>(table: string, hash: number): Promise<T | undefined> {
  return definition<T>(await db(), table, hash);
}

// Scan an entire definition table once, yielding the unsigned hash and parsed json for each row.
// Callers that index or filter the whole table use this rather than reaching for the connection.
export async function* allDefinitions<T>(
  table: string,
): AsyncIterableIterator<{ hash: number; def: T }> {
  const connection = await db();
  const rows = connection.prepare(`SELECT id, json FROM ${table}`).iterate();

  for (const { id, json } of rows as IterableIterator<{ id: number; json: string }>) {
    yield { hash: id >>> 0, def: JSON.parse(json) as T };
  }
}

interface ManifestMeta {
  version: string;
  mobileWorldContentPaths: Record<string, string>;
}

let metaPromise: Promise<{ versionDir: string; mobilePath: string }> | null = null;

function meta() {
  if (!metaPromise) {
    metaPromise = (async () => {
      try {
        const data = await bungieFetch<ManifestMeta>("/Destiny2/Manifest/", { auth: false });

        return {
          versionDir: join(MANIFEST_DIR, data.version),
          mobilePath: data.mobileWorldContentPaths.en,
        };
      } catch (error) {
        // Don't memoize a failed fetch — let the next caller retry rather than poisoning the cache.
        metaPromise = null;
        throw error;
      }
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

let dbPromise: Promise<DatabaseSync> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        // An explicit database path skips the version lookup, letting tests and offline runs read a
        // local manifest without the network round-trip to /Destiny2/Manifest/.
        const override = process.env.DESTINY2_MANIFEST_DB;

        if (override) {
          return new DatabaseSync(override, { readOnly: true });
        }

        const { versionDir, mobilePath } = await meta();
        const dbPath = await ensureDatabaseFile(versionDir, mobilePath);

        return new DatabaseSync(dbPath, { readOnly: true });
      } catch (error) {
        dbPromise = null;
        throw error;
      }
    })();
  }

  return dbPromise;
}

// The SQLite id column stores each hash as a signed 32-bit integer.
function toId(hash: number): number {
  return hash | 0;
}

const statements = new Map<string, StatementSync>();

function definition<T>(connection: DatabaseSync, table: string, hash: number): T | undefined {
  let statement = statements.get(table);

  if (!statement) {
    statement = connection.prepare(`SELECT json FROM ${table} WHERE id = ?`);
    statements.set(table, statement);
  }

  const row = statement.get(toId(hash)) as { json: string } | undefined;

  return row ? (JSON.parse(row.json) as T) : undefined;
}
