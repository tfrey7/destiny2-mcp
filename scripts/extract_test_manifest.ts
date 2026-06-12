import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ITEM_TABLE = "DestinyInventoryItemDefinition";
const MANIFEST_DIR = join(homedir(), ".destiny2-mcp", "manifest");
const OUT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "manifest_seed.json",
);

// A hand-picked set of recognizable weapons and armor, chosen so the fixture reads at a glance while
// still covering the rules the tools must respect: a Strand and a Stasis weapon prove the kinetic slot
// holds non-Kinetic elements, the exotics cover the one-exotic limit, and the spread hits every element,
// ammo type, and equip slot. Real attributes are read from the manifest, not assumed — see the summary.
const CURATED_NAMES = [
  "Ace of Spades",
  "Sunshot",
  "Riskrunner",
  "Graviton Lance",
  "Final Warning",
  "Wicked Implement",
  "Gjallarhorn",
  "Izanagi's Burden",
  "Fatebringer",
  "Celestial Nighthawk",
  "Orpheus Rig",
  "Helm of Saint-14",
  "Sunbracers",
];

// Perks/traits live in a different itemType (19) than gear, so the fixture seeds a couple explicitly to
// cover the `perk` search category and inspect_item's plug-description path: an origin trait and a classic
// weapon trait. The base (non-enhanced) copy is chosen so the seeded description is deterministic.
const CURATED_PERKS = ["Veist Stinger", "Rampage"];

const DAMAGE_TYPE: Record<number, string> = {
  1: "Kinetic",
  2: "Arc",
  3: "Solar",
  4: "Void",
  6: "Stasis",
  7: "Strand",
};
const AMMO_TYPE: Record<number, string> = { 1: "Primary", 2: "Special", 3: "Heavy" };
const SLOT_BY_BUCKET: Record<number, string> = {
  1498876634: "Kinetic",
  2465295065: "Energy",
  953998645: "Power",
};

interface SeedRow {
  table: string;
  hash: number;
  json: unknown;
}

interface RawItem {
  displayProperties?: { name?: string };
  defaultDamageType?: number;
  equippingBlock?: { ammoType?: number };
  inventory?: { tierTypeName?: string; bucketTypeHash?: number };
}

function manifestDatabasePath(): string {
  if (!existsSync(MANIFEST_DIR)) {
    throw new Error(
      `[destiny2-mcp] No manifest directory at ${MANIFEST_DIR} — run the server once to download it`,
    );
  }

  for (const versionDir of readdirSync(MANIFEST_DIR)) {
    const candidate = join(MANIFEST_DIR, versionDir, "world.sqlite");

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`[destiny2-mcp] No world.sqlite found under ${MANIFEST_DIR}`);
}

// Resolve a name to its best item: prefer the Exotic version, then one with a Collections source, so a
// reissued or duplicate name lands on the recognizable copy.
function resolveByName(connection: DatabaseSync, name: string): SeedRow | undefined {
  const row = connection
    .prepare(
      `SELECT id, json FROM ${ITEM_TABLE}
       WHERE lower(json_extract(json, '$.displayProperties.name')) = lower(?)
         AND json_extract(json, '$.itemType') IN (2, 3)
       ORDER BY (json_extract(json, '$.inventory.tierTypeName') = 'Exotic') DESC,
                (json_extract(json, '$.collectibleHash') IS NOT NULL) DESC,
                id ASC
       LIMIT 1`,
    )
    .get(name) as { id: number; json: string } | undefined;

  if (!row) {
    return undefined;
  }

  return { table: ITEM_TABLE, hash: row.id >>> 0, json: JSON.parse(row.json) };
}

// Resolve a perk/trait name to its base copy: a plug item (itemType 19) whose type name carries "Trait"
// or "Intrinsic", preferring the lowest rarity so the enhanced (Uncommon) variant doesn't win.
function resolvePerkByName(connection: DatabaseSync, name: string): SeedRow | undefined {
  const row = connection
    .prepare(
      `SELECT id, json FROM ${ITEM_TABLE}
       WHERE lower(json_extract(json, '$.displayProperties.name')) = lower(?)
         AND json_extract(json, '$.itemType') = 19
         AND (json_extract(json, '$.itemTypeDisplayName') LIKE '%Trait%'
              OR json_extract(json, '$.itemTypeDisplayName') LIKE '%Intrinsic%')
       ORDER BY (json_extract(json, '$.inventory.tierTypeName') = 'Common') DESC, id ASC
       LIMIT 1`,
    )
    .get(name) as { id: number; json: string } | undefined;

  if (!row) {
    return undefined;
  }

  return { table: ITEM_TABLE, hash: row.id >>> 0, json: JSON.parse(row.json) };
}

function summarize(item: SeedRow): string {
  const raw = item.json as RawItem;
  const tier = raw.inventory?.tierTypeName ?? "?";
  const element = DAMAGE_TYPE[raw.defaultDamageType ?? 0] ?? "—";
  const slot = SLOT_BY_BUCKET[raw.inventory?.bucketTypeHash ?? 0] ?? "Armor";
  const ammo = AMMO_TYPE[raw.equippingBlock?.ammoType ?? 0] ?? "—";

  return `${tier.padEnd(9)} ${slot.padEnd(7)} ${element.padEnd(7)} ${ammo.padEnd(7)}`;
}

async function main(): Promise<void> {
  const connection = new DatabaseSync(manifestDatabasePath(), { readOnly: true });
  const seed: SeedRow[] = [];

  for (const name of CURATED_NAMES) {
    const item = resolveByName(connection, name);

    if (!item) {
      console.warn(`[destiny2-mcp] Not found in manifest: ${name}`);
      continue;
    }

    console.log(`[destiny2-mcp] ${summarize(item)} ${name} (${item.hash})`);
    seed.push(item);
  }

  for (const name of CURATED_PERKS) {
    const item = resolvePerkByName(connection, name);

    if (!item) {
      console.warn(`[destiny2-mcp] Perk not found in manifest: ${name}`);
      continue;
    }

    console.log(`[destiny2-mcp] perk    ${name} (${item.hash})`);
    seed.push(item);
  }

  connection.close();
  seed.sort((a, b) => a.hash - b.hash);

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(`[destiny2-mcp] Wrote ${seed.length} items to ${OUT_FILE}`);
}

await main();
