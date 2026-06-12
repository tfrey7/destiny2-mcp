import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Builds a throwaway SQLite database matching the real manifest schema (id INTEGER, json TEXT) from a
// committed seed of real item rows, then points the manifest reader at it via the DESTINY2_MANIFEST_DB
// seam. The reader can't tell the fixture from the full manifest — both are point queries by hash.
export function useManifestFixture(seedPath: string): void {
  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedRow[];
  const dbPath = join(mkdtempSync(join(tmpdir(), "destiny2-manifest-")), "world.sqlite");
  const connection = new DatabaseSync(dbPath);

  for (const table of new Set(seed.map((row) => row.table))) {
    connection.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, json TEXT)`);
  }

  for (const row of seed) {
    // The id column stores the hash as a signed 32-bit integer, exactly as the reader queries it.
    connection
      .prepare(`INSERT INTO ${row.table} (id, json) VALUES (?, ?)`)
      .run(row.hash | 0, JSON.stringify(row.json));
  }

  connection.close();
  process.env.DESTINY2_MANIFEST_DB = dbPath;
}

interface SeedRow {
  table: string;
  hash: number;
  json: unknown;
}
