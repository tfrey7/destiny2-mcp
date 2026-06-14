import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

// Emits the Triumphs the manifest pass couldn't fully place — the ones with no location, or with an
// activity type but no world — bundled with the manifest text a classifier needs (name, description,
// objective labels, and the presentation-node ancestry). The model enrichment pass reads this; it's
// an intermediate artifact under the gitignored .cache/, not committed.

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST_DIR = join(homedir(), ".destiny2-mcp", "manifest");
const INDEX_FILE = join(ROOT, "..", "..", "data", "triumphs.json");
const OUT_FILE = join(ROOT, "..", "..", ".cache", "triumphs", "residue.json");

interface ResidueRecord {
  hash: number;
  name: string;
  description?: string;
  objectives: string[];
  ancestors: string[];
  activityType?: string;
}

interface RawRecord {
  displayProperties?: { name?: string; description?: string };
  recordTypeName?: string;
  parentNodeHashes?: number[];
  objectiveHashes?: number[];
  redacted?: boolean;
}

function manifestDatabasePath(): string {
  for (const version of readdirSync(MANIFEST_DIR)) {
    const path = join(MANIFEST_DIR, version, "world.sqlite");

    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(`[destiny2-mcp] No world.sqlite under ${MANIFEST_DIR}`);
}

function ancestorNames(
  parentHashes: number[] | undefined,
  nodes: Map<number, { name?: string; parents?: number[] }>,
  seen = new Set<number>(),
): string[] {
  const names: string[] = [];

  for (const hash of parentHashes ?? []) {
    if (seen.has(hash)) {
      continue;
    }

    seen.add(hash);
    const node = nodes.get(hash >>> 0);

    if (!node) {
      continue;
    }

    if (node.name) {
      names.push(node.name);
    }

    names.push(...ancestorNames(node.parents, nodes, seen));
  }

  return names;
}

async function main(): Promise<void> {
  const db = new DatabaseSync(manifestDatabasePath(), { readOnly: true });
  const index = JSON.parse(readFileSync(INDEX_FILE, "utf8")).triumphs as Record<
    string,
    { location?: string[]; activityType?: string }
  >;

  const nodes = new Map<number, { name?: string; parents?: number[] }>();

  for (const row of db.prepare("SELECT id, json FROM DestinyPresentationNodeDefinition").all() as {
    id: number;
    json: string;
  }[]) {
    const def = JSON.parse(row.json);

    nodes.set(row.id >>> 0, {
      name: def.displayProperties?.name,
      parents: def.parentNodeHashes,
    });
  }

  const objectiveLabel = (hash: number): string | undefined => {
    const row = db
      .prepare("SELECT json FROM DestinyObjectiveDefinition WHERE id = ?")
      .get(hash | 0) as { json: string } | undefined;

    return row ? JSON.parse(row.json).progressDescription || undefined : undefined;
  };

  const residue: ResidueRecord[] = [];

  for (const row of db.prepare("SELECT id, json FROM DestinyRecordDefinition").all() as {
    id: number;
    json: string;
  }[]) {
    const def = JSON.parse(row.json) as RawRecord;

    if (def.redacted || def.recordTypeName !== "Triumphs" || !def.displayProperties?.name) {
      continue;
    }

    const hash = row.id >>> 0;
    const tag = index[String(hash)];
    const unplaced = !tag?.location;
    const hasObjectives = (def.objectiveHashes?.length ?? 0) > 0;

    // A do-able goal with no world is what the classifier can help with; a Triumph already located,
    // or one with no objectives at all (a pure meta-goal), isn't worth the call.
    if (!unplaced || !hasObjectives) {
      continue;
    }

    residue.push({
      hash,
      name: def.displayProperties.name,
      description: def.displayProperties.description || undefined,
      objectives: (def.objectiveHashes ?? [])
        .map(objectiveLabel)
        .filter((label): label is string => Boolean(label)),
      ancestors: [...new Set(ancestorNames(def.parentNodeHashes, nodes))],
      ...(tag?.activityType ? { activityType: tag.activityType } : {}),
    });
  }

  db.close();
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(residue, null, 2)}\n`);
  console.log(`[destiny2-mcp] Wrote ${residue.length} residue Triumphs to ${OUT_FILE}`);
}

await main();
