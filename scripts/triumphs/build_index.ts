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
  source: "override" | "presentation-tree" | "activity-catalog" | "name-text" | "model";
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

const SEASON_LABEL = /^(Season of|Episode:)/;

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
    source: manifest?.source ?? "model",
    confidence: manifest?.confidence ?? "low",
  };

  const hasContent =
    tag.location ||
    tag.activityType ||
    tag.season ||
    tag.expires ||
    tag.scope ||
    tag.effort ||
    tag.summary;

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
  const { allDefinitions } = await import("../../src/bungie/manifest_db.js");

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

  const index: Record<string, TriumphTag> = {};
  const stats = { location: 0, activity: 0, season: 0, expires: 0, model: 0, summary: 0 };

  for await (const { hash, def } of allDefinitions<RawRecord>("DestinyRecordDefinition")) {
    if (def.redacted || def.recordTypeName !== "Triumphs") {
      continue;
    }

    const manifestTag = tagRecord(hash, def, nodes, overrides, activityWorlds, namedActivities, {
      matchActivityType,
      matchWorld,
    });
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

    if (tag.source === "model") {
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
  let source: TriumphTag["source"] | undefined;
  let confidence: TriumphTag["confidence"] | undefined;

  const record_ = (next: TriumphTag["source"], level: TriumphTag["confidence"]) => {
    source ??= next;
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
    source: source ?? "presentation-tree",
    confidence: confidence ?? "medium",
  };
}

await main();
