import { readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Merges the vision captions for all three classes' universal ornaments (one JSON file per workflow batch
// under .cache/ornaments/captions/ for Warlock and captions-ht/ for Hunter+Titan) into the committed
// index the find_ornaments tool reads. Each ornament is captioned natively for its own class; a set is
// flagged crossClass when its name stem appears for more than one class, and class-exclusive otherwise.

const ROOT = dirname(fileURLToPath(import.meta.url));
const CACHE = join(ROOT, "..", "..", ".cache", "ornaments");
const WARLOCK_CAPTIONS = join(CACHE, "captions");
const HT_CAPTIONS = join(CACHE, "captions-ht");
const HT_LIST = join(CACHE, "hunter-titan.json");
const OUT_FILE = join(ROOT, "..", "..", "data", "ornaments.json");

type Slot = "helmet" | "arms" | "chest" | "legs" | "class";
type ClassName = "Warlock" | "Hunter" | "Titan";

interface Caption {
  hash: string;
  name: string;
  slot: Slot;
  look: string;
  tags: string[];
  themes: string[];
}

interface OrnamentEntry extends Caption {
  class: ClassName;
  set: string;
  crossClass: boolean;
}

const SLOT_NOUNS: RegExp[] = [
  /\b(Bond|Cloak|Mark|Wings)\b/i,
  /\b(Helm|Helmet|Hood|Mask|Cowl|Crown|Cover|Casque|Visage|Hat|Gaze|Crest|Coronet|Diadem|Headpiece|Horns?)\b/i,
  /\b(Gauntlets|Grips|Gloves|Wraps|Bracers|Hold|Grasps|Claws|Gauntlet|Mitts|Vambraces|Sleeves|Arms)\b/i,
  /\b(Robes|Vest|Plate|Chest|Mantle|Vestments|Shell|Harness|Cuirass|Garb|Tabard|Overcoat|Jacket|Coat|Mail|Robe|Tunic|Raiment)\b/i,
  /\b(Legs|Boots|Greaves|Strides|Steps|Treads|Pants|Leggings|Walkers|Hooves|Sandals|Soles|Hightops|Shoes|Legguards|Riders|Skirt)\b/i,
];

// Strip the slot noun, the embedded class word, and possessives so a set's pieces collapse to one key
// shared across classes ("Deadlands Cover" / "Deadlands Mask" / "Deadlands Helm" -> "deadlands").
const ALL_NOUNS = new RegExp(SLOT_NOUNS.map((pattern) => pattern.source).join("|"), "gi");

const setKey = (name: string): string =>
  name
    .replace(ALL_NOUNS, " ")
    .replace(/\b(Warlock|Hunter|Titan)\b/gi, " ")
    .replace(/'s\b/gi, " ")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

function loadCaptions(dir: string): Caption[] {
  const captions: Caption[] = [];

  for (const file of readdirSync(dir)) {
    if (!/^batch-\d+\.json$/.test(file)) {
      continue;
    }

    captions.push(...(JSON.parse(readFileSync(join(dir, file), "utf8")) as Caption[]));
  }

  return captions;
}

async function main(): Promise<void> {
  const htClass = new Map(
    (JSON.parse(readFileSync(HT_LIST, "utf8")) as { hash: string; class: ClassName }[]).map(
      (item) => [item.hash, item.class],
    ),
  );

  const tagged: Omit<OrnamentEntry, "crossClass">[] = [];

  for (const caption of loadCaptions(WARLOCK_CAPTIONS)) {
    tagged.push({ ...caption, class: "Warlock", set: setKey(caption.name) });
  }

  for (const caption of loadCaptions(HT_CAPTIONS)) {
    const className = htClass.get(caption.hash);

    if (className) {
      tagged.push({ ...caption, class: className, set: setKey(caption.name) });
    }
  }

  const stemClasses = new Map<string, Set<ClassName>>();

  for (const ornament of tagged) {
    const classes = stemClasses.get(ornament.set) ?? new Set<ClassName>();

    classes.add(ornament.class);
    stemClasses.set(ornament.set, classes);
  }

  const ornaments: OrnamentEntry[] = tagged.map((ornament) => ({
    ...ornament,
    crossClass: (stemClasses.get(ornament.set)?.size ?? 1) > 1,
  }));

  ornaments.sort((a, b) => a.name.localeCompare(b.name) || a.class.localeCompare(b.class));

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify({ ornaments }, null, 2)}\n`);

  const byClass: Record<string, number> = {};

  for (const ornament of ornaments) {
    byClass[ornament.class] = (byClass[ornament.class] ?? 0) + 1;
  }

  const exclusive = ornaments.filter((ornament) => !ornament.crossClass).length;

  console.log(`[destiny2-mcp] Wrote ${ornaments.length} ornaments to ${OUT_FILE}`, byClass);
  console.log(`[destiny2-mcp] Class-exclusive entries: ${exclusive}`);
}

await main();
