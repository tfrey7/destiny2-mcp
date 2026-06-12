import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// Merges the vision captions produced for Warlock universal ornaments (one JSON file per workflow batch
// under .cache/ornaments/captions/) with the live manifest, resolving each set's Hunter and Titan
// counterparts by name stem + slot so a caption can be applied to any class. Writes the committed index
// the find_ornaments tool reads at runtime.

const ROOT = dirname(fileURLToPath(import.meta.url));
const CAPTIONS_DIR = join(ROOT, "..", "..", ".cache", "ornaments", "captions");
const OUT_FILE = join(ROOT, "..", "..", "data", "ornaments.json");
const MANIFEST_DIR = join(homedir(), ".destiny2-mcp", "manifest");
const ITEM_TABLE = "DestinyInventoryItemDefinition";

type Slot = "helmet" | "arms" | "chest" | "legs" | "class";

interface Caption {
  hash: string;
  name: string;
  slot: Slot;
  look: string;
  tags: string[];
  themes: string[];
}

interface OrnamentEntry extends Caption {
  set: string;
  hunterHash: string | null;
  titanHash: string | null;
}

// A set's slot is named with a recognizable noun; the same noun set works for all three classes (the
// class item differs — Bond / Cloak / Mark — which is itself the signal for the class slot).
const SLOT_NOUNS: [Slot, RegExp][] = [
  ["class", /\b(Bond|Cloak|Mark|Wings)\b/i],
  [
    "helmet",
    /\b(Helm|Helmet|Hood|Mask|Cowl|Crown|Cover|Casque|Visage|Hat|Gaze|Crest|Coronet|Diadem|Headpiece|Horns?)\b/i,
  ],
  [
    "arms",
    /\b(Gauntlets|Grips|Gloves|Wraps|Bracers|Hold|Grasps|Claws|Gauntlet|Mitts|Vambraces|Sleeves|Arms)\b/i,
  ],
  [
    "chest",
    /\b(Robes|Vest|Plate|Chest|Mantle|Vestments|Shell|Harness|Cuirass|Garb|Tabard|Overcoat|Jacket|Coat|Mail|Robe|Tunic|Raiment)\b/i,
  ],
  [
    "legs",
    /\b(Legs|Boots|Greaves|Strides|Steps|Treads|Pants|Leggings|Walkers|Hooves|Sandals|Soles|Hightops|Shoes|Legguards|Riders|Skirt)\b/i,
  ],
];

const slotOf = (name: string): Slot | null => {
  for (const [slot, pattern] of SLOT_NOUNS) {
    if (pattern.test(name)) {
      return slot;
    }
  }

  return null;
};

// Strip the slot noun and possessives so "Aedile's Bond" and "Aedile's Cloak" collapse to the same set
// key. What remains is the set's distinguishing name, shared across classes.
const ALL_NOUNS = new RegExp(SLOT_NOUNS.map(([, p]) => p.source).join("|"), "gi");

const setKey = (name: string): string =>
  name
    .replace(ALL_NOUNS, " ")
    .replace(/\b(Warlock|Hunter|Titan)\b/gi, " ") // some sets embed the class in the name
    .replace(/'s\b/gi, " ")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

interface RawItem {
  displayProperties?: { name?: string };
  itemTypeDisplayName?: string;
}

function manifestDatabasePath(): string {
  if (!existsSync(MANIFEST_DIR)) {
    throw new Error(
      `[destiny2-mcp] No manifest at ${MANIFEST_DIR} — run the server once to download it`,
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

function loadCaptions(): Caption[] {
  const captions: Caption[] = [];

  for (const file of readdirSync(CAPTIONS_DIR)) {
    if (!/^batch-\d+\.json$/.test(file)) {
      continue;
    }

    const batch = JSON.parse(readFileSync(join(CAPTIONS_DIR, file), "utf8")) as Caption[];

    captions.push(...batch);
  }

  return captions;
}

// Index every Hunter / Titan universal ornament by "set key + slot" so a Warlock caption resolves to its
// counterpart on the other two classes.
function crossClassIndex(
  connection: DatabaseSync,
): Map<string, { Hunter?: string; Titan?: string }> {
  const index = new Map<string, { Hunter?: string; Titan?: string }>();
  const rows = connection.prepare(`SELECT id, json FROM ${ITEM_TABLE}`).all() as {
    id: number;
    json: string;
  }[];

  for (const row of rows) {
    const item = JSON.parse(row.json) as RawItem;
    const type = item.itemTypeDisplayName ?? "";
    const klass =
      type === "Hunter Universal Ornament"
        ? "Hunter"
        : type === "Titan Universal Ornament"
          ? "Titan"
          : null;

    if (!klass) {
      continue;
    }

    const name = item.displayProperties?.name ?? "";
    const slot = slotOf(name);

    if (!slot) {
      continue;
    }

    const key = `${setKey(name)}|${slot}`;
    const entry = index.get(key) ?? {};

    entry[klass] = String(row.id >>> 0);
    index.set(key, entry);
  }

  return index;
}

async function main(): Promise<void> {
  const captions = loadCaptions();
  const connection = new DatabaseSync(manifestDatabasePath(), { readOnly: true });
  const crossClass = crossClassIndex(connection);

  connection.close();

  let hunterMatched = 0;
  let titanMatched = 0;

  const ornaments: OrnamentEntry[] = captions.map((caption) => {
    const set = setKey(caption.name);
    const counterpart = crossClass.get(`${set}|${caption.slot}`) ?? {};

    if (counterpart.Hunter) {
      hunterMatched++;
    }

    if (counterpart.Titan) {
      titanMatched++;
    }

    return {
      ...caption,
      set,
      hunterHash: counterpart.Hunter ?? null,
      titanHash: counterpart.Titan ?? null,
    };
  });

  ornaments.sort((a, b) => a.name.localeCompare(b.name));

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify({ ornaments }, null, 2)}\n`);

  console.log(`[destiny2-mcp] Wrote ${ornaments.length} Warlock ornaments to ${OUT_FILE}`);
  console.log(
    `[destiny2-mcp] Cross-class: Hunter ${hunterMatched}/${ornaments.length}, Titan ${titanMatched}/${ornaments.length}`,
  );
}

await main();
