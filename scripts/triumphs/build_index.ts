import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Builds data/triumphs.json — the location/activity tag index the triumph tools join against. The
// signal is the manifest itself: a record's parentNodeHashes walk up the presentation-node tree
// whose labels are clean location ("The Moon") and activity ("Raids") buckets, cross-checked against
// the activity catalog for raid/dungeon worlds. A small committed override file fills the residue.
// No third-party dataset and no model pass — the manifest carries the signal, so it's regenerable.

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST_DIR = join(homedir(), ".destiny2-mcp", "manifest");
const OVERRIDES_FILE = join(ROOT, "..", "..", "data", "triumph-overrides.json");
const MODEL_FILE = join(ROOT, "..", "..", "data", "triumph-model.json");
const OUT_FILE = join(ROOT, "..", "..", "data", "triumphs.json");

interface TriumphTag {
  location?: string[];
  activityType?: string;
  season?: string;
  expires?: string;
  scope?: "solo" | "fireteam";
  effort?: "quick" | "moderate" | "grind";
  summary?: string;
  source?: string;
  provenance:
    | "override"
    | "presentation-tree"
    | "activity-catalog"
    | "name-text"
    | "model"
    | "weapon-pattern";
  confidence: "high" | "medium" | "low";
}

interface Override {
  location?: string[];
  activityType?: string;
  note?: string;
}

// The model enrichment layer (data/triumph-model.json — a one-time vocabulary-constrained pass over
// the residue, see data.ts) fills gaps the manifest left and adds the qualitative fields the manifest
// never carries. It never overrides a manifest-derived placement.
interface ModelTag {
  location?: string[];
  activityType?: string;
  scope?: "solo" | "fireteam";
  effort?: "quick" | "moderate" | "grind";
  summary?: string;
}

interface RawRecord {
  displayProperties?: { name?: string; description?: string };
  recordTypeName?: string;
  parentNodeHashes?: number[];
  expirationInfo?: { hasExpiration?: boolean; description?: string };
  redacted?: boolean;
}

interface RawNode {
  displayProperties?: { name?: string };
  parentNodeHashes?: number[];
}

interface RawItem {
  displayProperties?: { name?: string };
  itemType?: number;
  collectibleHash?: number;
}

interface RawCollectible {
  sourceString?: string;
}

const SEASON_LABEL = /^(Season of|Episode:)/;

// DestinyItemType.Weapon — the rolled, collectible-bearing weapon, not its crafting recipe or pattern.
const WEAPON_ITEM_TYPE = 3;

function manifestDatabasePath(): { path: string; version: string } {
  if (!existsSync(MANIFEST_DIR)) {
    throw new Error(
      `[destiny2-mcp] No manifest at ${MANIFEST_DIR} — run the server once to download it`,
    );
  }

  for (const version of readdirSync(MANIFEST_DIR)) {
    const path = join(MANIFEST_DIR, version, "world.sqlite");

    if (existsSync(path)) {
      return { path, version };
    }
  }

  throw new Error(`[destiny2-mcp] No world.sqlite found under ${MANIFEST_DIR}`);
}

function loadOverrides(): Map<number, Override> {
  if (!existsSync(OVERRIDES_FILE)) {
    return new Map();
  }

  const raw = JSON.parse(readFileSync(OVERRIDES_FILE, "utf8")) as Record<string, Override>;

  return new Map(
    Object.entries(raw)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, value]) => [Number(key) >>> 0, value]),
  );
}

function loadModel(): Map<number, ModelTag> {
  if (!existsSync(MODEL_FILE)) {
    return new Map();
  }

  const raw = JSON.parse(readFileSync(MODEL_FILE, "utf8")) as Record<string, ModelTag>;

  return new Map(Object.entries(raw).map(([key, value]) => [Number(key) >>> 0, value]));
}

// Compose the manifest-derived tag with the model layer: manifest placement wins, the model only
// fills a missing world or activity type, and the qualitative fields always come from the model.
function compose(
  manifest: TriumphTag | undefined,
  model: ModelTag | undefined,
): TriumphTag | undefined {
  const location = manifest?.location ?? (model?.location?.length ? model.location : undefined);
  const activityType = manifest?.activityType ?? model?.activityType;

  const tag: TriumphTag = {
    ...(location ? { location } : {}),
    ...(activityType ? { activityType } : {}),
    ...(manifest?.season ? { season: manifest.season } : {}),
    ...(manifest?.expires ? { expires: manifest.expires } : {}),
    ...(model?.scope ? { scope: model.scope } : {}),
    ...(model?.effort ? { effort: model.effort } : {}),
    ...(model?.summary ? { summary: model.summary } : {}),
    ...(manifest?.source ? { source: manifest.source } : {}),
    provenance: manifest?.provenance ?? "model",
    confidence: manifest?.confidence ?? "low",
  };

  const hasContent =
    tag.location ||
    tag.activityType ||
    tag.season ||
    tag.expires ||
    tag.scope ||
    tag.effort ||
    tag.summary ||
    tag.source;

  return hasContent ? tag : undefined;
}

// Every presentation-node name above a record, following parentNodeHashes up to the roots. Records
// sit one or more levels under their location/activity bucket, so the walk has to recurse.
function ancestorNames(
  parentHashes: number[] | undefined,
  nodes: Map<number, RawNode>,
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

    if (node.displayProperties?.name) {
      names.push(node.displayProperties.name);
    }

    names.push(...ancestorNames(node.parentNodeHashes, nodes, seen));
  }

  return names;
}

async function main(): Promise<void> {
  const { path, version } = manifestDatabasePath();

  // Point the shared manifest reader at the cached database so locations.ts resolves worlds offline,
  // with no version lookup or network call. Set before importing the module that reads it.
  process.env.DESTINY2_MANIFEST_DB = path;

  const { activityWorldByName, matchActivityType, matchWorld, validateWorlds } =
    await import("../../src/bungie/locations.js");
  const { allDefinitions, findDefinition } = await import("../../src/bungie/manifest_db.js");

  const missing = await validateWorlds();

  if (missing.length > 0) {
    console.warn(`[destiny2-mcp] Worlds with no manifest match: ${missing.join(", ")}`);
  }

  const overrides = loadOverrides();
  const model = loadModel();
  const activityWorlds = await activityWorldByName();

  // Activity names long enough to be unambiguous when found inside a Triumph's text. Activities carry
  // a mode suffix ("Spire of the Watcher: Master"), so the pre-colon base name is indexed too — that's
  // the form a Triumph's own name uses. Longest first so the most specific match wins.
  const named = new Map<string, string>();

  for (const [name, world] of activityWorlds) {
    for (const variant of [name, name.split(":")[0].trim()]) {
      if (variant.length >= 10 && !named.has(variant)) {
        named.set(variant, world);
      }
    }
  }

  const namedActivities = [...named].sort((a, b) => b[0].length - a[0].length);

  const nodes = new Map<number, RawNode>();

  for await (const { hash, def } of allDefinitions<RawNode>("DestinyPresentationNodeDefinition")) {
    nodes.set(hash, def);
  }

  // Weapon-pattern records (recordTypeName "Weapon Pattern") sit in the tree by weapon archetype, so
  // the presentation walk carries no raid/season signal. Their source instead comes from the weapon
  // they unlock — keyed by name, since the pattern record shares the weapon's display name. The
  // cleaned collectible sourceString ("Source: \"Root of Nightmares\" Raid" → "Root of Nightmares
  // Raid") is the bridge; first weapon of a given name wins.
  const weaponSource = new Map<string, string>();

  for await (const { def } of allDefinitions<RawItem>("DestinyInventoryItemDefinition")) {
    const name = def.displayProperties?.name;

    if (
      !name ||
      def.itemType !== WEAPON_ITEM_TYPE ||
      !def.collectibleHash ||
      weaponSource.has(name)
    ) {
      continue;
    }

    const collectible = await findDefinition<RawCollectible>(
      "DestinyCollectibleDefinition",
      def.collectibleHash,
    );
    const source = collectible?.sourceString ? cleanSource(collectible.sourceString) : undefined;

    if (source) {
      weaponSource.set(name, source);
    }
  }

  const index: Record<string, TriumphTag> = {};
  const stats = {
    location: 0,
    activity: 0,
    season: 0,
    expires: 0,
    model: 0,
    summary: 0,
    source: 0,
  };

  for await (const { hash, def } of allDefinitions<RawRecord>("DestinyRecordDefinition")) {
    if (def.redacted) {
      continue;
    }

    let manifestTag: TriumphTag | undefined;

    if (def.recordTypeName === "Triumphs") {
      manifestTag = tagRecord(hash, def, nodes, overrides, activityWorlds, namedActivities, {
        matchActivityType,
        matchWorld,
      });
    } else if (def.recordTypeName === "Weapon Pattern") {
      manifestTag = tagPattern(def, weaponSource, namedActivities, { matchActivityType });
    } else {
      continue;
    }

    const tag = compose(manifestTag, model.get(hash));

    if (!tag) {
      continue;
    }

    index[String(hash)] = tag;

    if (tag.location) {
      stats.location += 1;
    }

    if (tag.activityType) {
      stats.activity += 1;
    }

    if (tag.season) {
      stats.season += 1;
    }

    if (tag.expires) {
      stats.expires += 1;
    }

    if (tag.summary) {
      stats.summary += 1;
    }

    if (tag.source) {
      stats.source += 1;
    }

    if (tag.provenance === "model") {
      stats.model += 1;
    }
  }

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(
    OUT_FILE,
    `${JSON.stringify({ manifestVersion: version, triumphs: index }, null, 2)}\n`,
  );

  console.log(`[destiny2-mcp] Wrote ${Object.keys(index).length} tagged Triumphs to ${OUT_FILE}`);
  console.log(`[destiny2-mcp] Manifest ${version}`, stats);
}

function tagRecord(
  hash: number,
  record: RawRecord,
  nodes: Map<number, RawNode>,
  overrides: Map<number, Override>,
  activityWorlds: Map<string, string>,
  namedActivities: [string, string][],
  match: {
    matchWorld: (term: string) => string | undefined;
    matchActivityType: (term: string) => string | undefined;
  },
): TriumphTag | undefined {
  const ancestors = ancestorNames(record.parentNodeHashes, nodes);
  const name = record.displayProperties?.name ?? "";
  const description = record.displayProperties?.description ?? "";
  const override = overrides.get(hash);

  const locations = new Set<string>();
  let provenance: TriumphTag["provenance"] | undefined;
  let confidence: TriumphTag["confidence"] | undefined;

  const record_ = (next: TriumphTag["provenance"], level: TriumphTag["confidence"]) => {
    provenance ??= next;
    confidence ??= level;
  };

  if (override?.location) {
    for (const world of override.location) {
      locations.add(world);
    }

    record_("override", "high");
  }

  // Presentation-tree ancestors and the activity catalog are authoritative; a bare name mention is a
  // weaker hint, so it only contributes when nothing stronger placed the Triumph.
  for (const ancestor of ancestors) {
    const world = match.matchWorld(ancestor) ?? activityWorlds.get(ancestor.toLowerCase().trim());

    if (world) {
      locations.add(world);
      record_(match.matchWorld(ancestor) ? "presentation-tree" : "activity-catalog", "high");
    }
  }

  // A specific activity named in the Triumph's own text (e.g. "Spire of the Watcher", "Crota's End")
  // resolves to its world through the manifest's activity catalog — authoritative, and it places the
  // raid/dungeon Triumphs the presentation tree files away from their destination.
  if (locations.size === 0) {
    const haystack = `${name} ${description}`.toLowerCase();
    const hit = namedActivities.find(([activity]) => haystack.includes(activity));

    if (hit) {
      locations.add(hit[1]);
      record_("activity-catalog", "high");
    }
  }

  if (locations.size === 0) {
    const fromName = match.matchWorld(name);

    if (fromName) {
      locations.add(fromName);
      record_("name-text", "low");
    }
  }

  let activityType = override?.activityType;

  if (activityType) {
    record_("override", "high");
  } else {
    activityType = ancestors.map(match.matchActivityType).find(Boolean);

    if (activityType) {
      record_("presentation-tree", "high");
    }
  }

  const season = ancestors.find((ancestor) => SEASON_LABEL.test(ancestor));
  const expires = record.expirationInfo?.hasExpiration
    ? record.expirationInfo.description || undefined
    : undefined;

  if (locations.size === 0 && !activityType && !season && !expires) {
    return undefined;
  }

  return {
    ...(locations.size > 0 ? { location: [...locations].sort() } : {}),
    ...(activityType ? { activityType } : {}),
    ...(season ? { season } : {}),
    ...(expires ? { expires } : {}),
    provenance: provenance ?? "presentation-tree",
    confidence: confidence ?? "medium",
  };
}

// Tag a weapon-pattern record from the source of the weapon it unlocks. Location reuses the activity
// catalog (a raid/dungeon name in the source string resolves to its world — long names only, so most
// raids place but short-named dungeons don't), activityType reads the "Raid"/"Dungeon" kind out of
// the same string, and the cleaned source rides along as the human label and substring filter key.
function tagPattern(
  record: RawRecord,
  weaponSource: Map<string, string>,
  namedActivities: [string, string][],
  match: { matchActivityType: (term: string) => string | undefined },
): TriumphTag | undefined {
  const source = weaponSource.get(record.displayProperties?.name ?? "");

  if (!source) {
    return undefined;
  }

  const haystack = source.toLowerCase();
  const activityHit = namedActivities.find(([activity]) => haystack.includes(activity));
  const activityType = match.matchActivityType(source);

  return {
    ...(activityHit ? { location: [activityHit[1]] } : {}),
    ...(activityType ? { activityType } : {}),
    source,
    provenance: "weapon-pattern",
    confidence: "high",
  };
}

// Strip the manifest's boilerplate from a collectible source string so it reads as a bare origin:
// "Source: \"Root of Nightmares\" Raid" → "Root of Nightmares Raid"; "Source: Last Wish raid." →
// "Last Wish raid". Quotes and the trailing period go; the activity name and kind stay intact.
function cleanSource(raw: string): string {
  return raw
    .replace(/^source:\s*/i, "")
    .replace(/["“”]/g, "")
    .replace(/\.\s*$/, "")
    .trim();
}

await main();
