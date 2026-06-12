import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { MANIFEST_DIR } from "../setup/config.js";
import { bungieFetch } from "./client.js";

// How long a loaded manifest is trusted before the next definition lookup triggers a background
// version check. Bungie bumps the manifest rarely, so a coarse interval keeps the check cheap.
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Force the manifest to download and open up front, so a missing or unreadable manifest fails
// loudly at startup instead of surfacing as a cryptic error on the first gear tool call.
export async function loadManifest(): Promise<void> {
  await state();
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

// manifest.ts caches indexes built from the open database (the name index, the catalog). When the
// database is swapped for a newer version those caches must be dropped too, so they register here.
export function onManifestSwap(hook: () => void): void {
  swapHooks.push(hook);
}

const swapHooks: (() => void)[] = [];

interface ManifestMeta {
  version: string;
  mobileWorldContentPaths: Record<string, string>;
}

interface ManifestState {
  version: string;
  connection: DatabaseSync;
}

async function fetchMeta(): Promise<{ version: string; versionDir: string; mobilePath: string }> {
  const data = await bungieFetch<ManifestMeta>("/Destiny2/Manifest/", { auth: false });

  return {
    version: data.version,
    versionDir: join(MANIFEST_DIR, data.version),
    mobilePath: data.mobileWorldContentPaths.en,
  };
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

let statePromise: Promise<ManifestState> | null = null;
let lastCheckedAt = 0;
let refreshInFlight: Promise<void> | null = null;

function state(): Promise<ManifestState> {
  if (!statePromise) {
    statePromise = (async () => {
      try {
        return await openManifest();
      } catch (error) {
        // Don't memoize a failed open — let the next caller retry rather than poisoning the cache.
        statePromise = null;
        throw error;
      }
    })();
  }

  return statePromise;
}

async function openManifest(): Promise<ManifestState> {
  // An explicit database path skips the version lookup, letting tests and offline runs read a
  // local manifest without the network round-trip to /Destiny2/Manifest/.
  const override = process.env.DESTINY2_MANIFEST_DB;

  if (override) {
    return { version: "override", connection: new DatabaseSync(override, { readOnly: true }) };
  }

  const { version, versionDir, mobilePath } = await fetchMeta();
  const dbPath = await ensureDatabaseFile(versionDir, mobilePath);

  lastCheckedAt = Date.now();
  return { version, connection: new DatabaseSync(dbPath, { readOnly: true }) };
}

async function db(): Promise<DatabaseSync> {
  maybeRefresh();

  const current = await state();

  return current.connection;
}

// Past the refresh interval, kick off a version check without blocking the caller: tool calls keep
// reading the current database while a newer one downloads, and the swap happens once it's ready.
function maybeRefresh(): void {
  if (
    process.env.DESTINY2_MANIFEST_DB ||
    refreshInFlight ||
    Date.now() - lastCheckedAt < REFRESH_INTERVAL_MS
  ) {
    return;
  }

  lastCheckedAt = Date.now();
  refreshInFlight = (async () => {
    try {
      await refresh();
    } catch (error) {
      console.error(
        "[destiny2-mcp] Manifest refresh check failed; keeping the current version.",
        error,
      );
    } finally {
      refreshInFlight = null;
    }
  })();
}

async function refresh(): Promise<void> {
  const current = await state();
  const { version, versionDir, mobilePath } = await fetchMeta();

  if (version === current.version) {
    return;
  }

  const dbPath = await ensureDatabaseFile(versionDir, mobilePath);
  const connection = new DatabaseSync(dbPath, { readOnly: true });

  statePromise = Promise.resolve({ version, connection });

  // Prepared statements are bound to the old connection, and the derived indexes were built from it;
  // drop both so the next lookup re-prepares and re-indexes against the new database.
  statements.clear();
  for (const hook of swapHooks) {
    hook();
  }

  // The previous connection is left open on purpose: an in-flight allDefinitions iterator may still
  // be reading from it, and closing mid-iteration would throw. One read-only handle per version bump
  // is negligible given how rarely the manifest changes.
  await pruneOldVersions(version);
}

// Old version directories are dead weight once a newer manifest is live; remove every sibling but the
// current one so the cache doesn't accumulate a full database per Bungie release.
async function pruneOldVersions(currentVersion: string): Promise<void> {
  const entries = await readdir(MANIFEST_DIR, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name !== currentVersion)
      .map((entry) => rm(join(MANIFEST_DIR, entry.name), { recursive: true, force: true })),
  );
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
