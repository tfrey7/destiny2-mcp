import { allDefinitions, findDefinition, getDefinition } from "./manifest_db.js";
import { itemInfo } from "./manifest.js";
import { matchActivityType, matchWorld } from "./locations.js";
import { loadTriumphIndex, triumphTag, type TriumphTag } from "./triumph_index.js";
import {
  type FullProfile,
  type ObjectiveProgress,
  type PresentationNodeState,
  type RecordComponentState,
  type RecordsComponent,
  type TriumphsProfile,
} from "./profile.js";

// A Triumph's completion lifecycle, derived from the DestinyRecordState bitmask: whether its
// objectives are done, whether the reward was claimed, and whether the game is hiding it.
interface RecordStatus {
  completed: boolean;
  redeemed: boolean;
  obscured: boolean;
}

// One objective on a Triumph or quest step, with its manifest label resolved and live progress
// joined. `complete` is authoritative; progress/total drive the percentage.
export interface ObjectiveView {
  description?: string;
  progress: number;
  total: number;
  complete: boolean;
}

// The narrow projection of a Triumph the read tools surface — enough to filter, sort by how close
// it is, and explain what's left, without the raw record/objective payloads.
interface TriumphView {
  recordHash: number;
  name: string;
  description?: string;
  state: "completed" | "in_progress" | "not_started";
  percent: number;
  score: number;
  seal?: string;
  location?: string[];
  activityType?: string;
  scope?: "solo" | "fireteam";
  effort?: "quick" | "moderate" | "grind";
  expires?: string;
  summary?: string;
  redeemed?: boolean;
  obscured?: boolean;
  objectives: ObjectiveView[];
  rewards: string[];
}

interface RecordFilters {
  name?: string;
  state?: "completed" | "incomplete";
  seal?: string;
  location?: string;
  activity?: string;
  limit?: number;
  offset?: number;
}

interface RecordSearch {
  count: number;
  truncated: boolean;
  records: TriumphView[];
}

// One seal: a title a player earns by completing a set of Triumphs. The live counts say how close
// the seal is, which is exactly what "which title should I chase" needs.
interface SealView {
  sealHash: number;
  name: string;
  title?: string;
  complete: number;
  total: number;
  percent: number;
  earned: boolean;
}

interface TriumphSummary {
  score: { total: number; active: number; legacy: number; lifetime: number };
  seals: SealView[];
}

// DestinyRecordState bits. A record's objectives are done when OBJECTIVE_NOT_COMPLETED is *clear*
// (the flag marks the unfinished state); the others gate redemption and visibility.
const RECORD_REDEEMED = 1;
const OBJECTIVE_NOT_COMPLETED = 4;
const OBSCURED = 8;

export function recordStatus(state: number): RecordStatus {
  return {
    completed: (state & OBJECTIVE_NOT_COMPLETED) === 0,
    redeemed: (state & RECORD_REDEEMED) !== 0,
    obscured: (state & OBSCURED) !== 0,
  };
}

// Records live in two scopes — account-wide (profileRecords) and per-character (characterRecords) —
// so a lookup has to consult both. Character entries win on overlap since they carry the live copy
// for character-scoped Triumphs.
function collectRecords(
  profile: Pick<FullProfile, "profileRecords" | "characterRecords">,
): Map<number, RecordComponentState> {
  const merged = new Map<number, RecordComponentState>();
  const absorb = (records?: Record<string, RecordComponentState>) => {
    for (const [hash, state] of Object.entries(records ?? {})) {
      merged.set(Number(hash) >>> 0, state);
    }
  };

  absorb(profile.profileRecords.records);
  for (const character of Object.values(profile.characterRecords)) {
    absorb(character.records);
  }

  return merged;
}

// Presentation-node rollups are split the same way as records; merge both scopes so every seal has
// its live progress, since some seals are tracked per-character.
function collectNodes(
  profile: Pick<FullProfile, "profilePresentationNodes" | "characterPresentationNodes">,
): Map<number, PresentationNodeState> {
  const merged = new Map<number, PresentationNodeState>();
  const absorb = (nodes?: Record<string, PresentationNodeState>) => {
    for (const [hash, state] of Object.entries(nodes ?? {})) {
      merged.set(Number(hash) >>> 0, state);
    }
  };

  absorb(profile.profilePresentationNodes.nodes);
  for (const character of Object.values(profile.characterPresentationNodes)) {
    absorb(character.nodes);
  }

  return merged;
}

// Resolve a Triumph's manifest label, current progress, and rewards into the read-tool projection.
// Objective labels and reward names are extra manifest reads, so callers should describe only the
// records they're returning (post-filter, post-limit), not the whole catalog.
async function describeRecord(
  meta: RecordMeta,
  live: RecordComponentState | undefined,
  seal?: string,
): Promise<TriumphView> {
  const status = recordStatus(live?.state ?? OBJECTIVE_NOT_COMPLETED);
  const objectives = await resolveObjectives(
    live?.objectives ?? meta.objectiveHashes.map(emptyObjective),
  );
  const tag = await triumphTag(meta.hash);

  return {
    recordHash: meta.hash,
    // The game hides an obscured Triumph's name and description until it's unlocked; honor that.
    name: status.obscured ? meta.obscuredName || "Classified" : meta.name,
    description: (status.obscured ? meta.obscuredDescription : meta.description) || undefined,
    state: progressState(status.completed, objectives),
    percent: status.completed ? 100 : objectivePercent(objectives),
    score: meta.score,
    ...(seal ? { seal } : {}),
    ...(tag?.location ? { location: tag.location } : {}),
    ...(tag?.activityType ? { activityType: tag.activityType } : {}),
    ...(tag?.scope ? { scope: tag.scope } : {}),
    ...(tag?.effort ? { effort: tag.effort } : {}),
    ...(tag?.expires ? { expires: tag.expires } : {}),
    ...(tag?.summary ? { summary: tag.summary } : {}),
    ...(status.completed ? { redeemed: status.redeemed } : {}),
    ...(status.obscured ? { obscured: true } : {}),
    objectives,
    rewards: await Promise.all(meta.rewardItemHashes.map(rewardName)),
  };
}

// Scan and filter the Triumph catalog, joining live state and seal membership. Static record
// attributes come from a cached one-time scan of the manifest; per-call work is the filter plus
// describing just the returned slice.
export async function searchRecords(
  profile: TriumphsProfile,
  filters: RecordFilters,
): Promise<RecordSearch> {
  const catalog = await recordCatalog();
  const live = collectRecords(profile);
  const seals = await sealMembership(profile.profileRecords.recordSealsRootNodeHash);
  const tags = filters.location || filters.activity ? await loadTriumphIndex() : undefined;

  const name = filters.name?.toLowerCase();
  const seal = filters.seal?.toLowerCase();
  // Normalize the location/activity filters to the canonical vocabulary so "moon" matches "The Moon".
  const location = filters.location ? matchWorld(filters.location) : undefined;
  const activity = filters.activity ? matchActivityType(filters.activity) : undefined;

  const matches = catalog.filter((record) => {
    if (name && !record.lowerName.includes(name)) {
      return false;
    }

    if (filters.state) {
      const completed = recordStatus(
        live.get(record.hash)?.state ?? OBJECTIVE_NOT_COMPLETED,
      ).completed;

      if (completed !== (filters.state === "completed")) {
        return false;
      }
    }

    if (seal) {
      const sealName = seals.get(record.hash);

      if (!sealName || !sealName.toLowerCase().includes(seal)) {
        return false;
      }
    }

    if (
      (filters.location || filters.activity) &&
      !matchesPlace(tags?.get(record.hash), filters, location, activity)
    ) {
      return false;
    }

    return true;
  });

  const limit = filters.limit ?? 25;
  const offset = filters.offset ?? 0;
  const records = await Promise.all(
    matches
      .slice(offset, offset + limit)
      .map((record) => describeRecord(record, live.get(record.hash), seals.get(record.hash))),
  );

  return { count: matches.length, truncated: offset + records.length < matches.length, records };
}

// Whether a Triumph's tag satisfies the location/activity filters. A filter that normalized to a
// canonical value matches exactly; one that didn't (a partial like "dreaming") falls back to a
// case-insensitive substring against the tag, so a loose query still narrows.
function matchesPlace(
  tag: TriumphTag | undefined,
  filters: RecordFilters,
  location: string | undefined,
  activity: string | undefined,
): boolean {
  if (filters.location) {
    const places = tag?.location ?? [];
    const hit = location
      ? places.includes(location)
      : places.some((place) => place.toLowerCase().includes(filters.location!.toLowerCase()));

    if (!hit) {
      return false;
    }
  }

  if (filters.activity) {
    const type = tag?.activityType;
    const hit = activity
      ? type === activity
      : Boolean(type && type.toLowerCase().includes(filters.activity.toLowerCase()));

    if (!hit) {
      return false;
    }
  }

  return true;
}

// The seal overview: total Triumph score plus every seal with its live completion counts, so a
// caller can spot which title is closest. Progress comes from the seal node's live rollup.
export async function triumphSummary(profile: TriumphsProfile): Promise<TriumphSummary> {
  const records = profile.profileRecords;
  const nodes = collectNodes(profile);
  const live = collectRecords(profile);
  const sealHashes = await sealNodeHashes(records.recordSealsRootNodeHash);

  const seals = await Promise.all(
    sealHashes.map((sealHash) => describeSeal(sealHash, nodes.get(sealHash), live)),
  );

  return {
    score: {
      total: records.score ?? 0,
      active: records.activeScore ?? 0,
      legacy: records.legacyScore ?? 0,
      lifetime: records.lifetimeScore ?? 0,
    },
    // Closest-to-done first — that's the seal worth focusing on — but earned seals sink to the bottom.
    seals: seals.sort((a, b) => Number(a.earned) - Number(b.earned) || b.percent - a.percent),
  };
}

export interface SuggestFilters {
  location?: string;
  activity?: string;
  limit?: number;
}

export interface TriumphSuggestion extends TriumphView {
  why: string[];
}

export interface SuggestResult {
  count: number;
  truncated: boolean;
  location?: string;
  activity?: string;
  caveat?: string;
  suggestions: TriumphSuggestion[];
}

// Rank the player's incomplete Triumphs by what's worth chasing next: how close it is (live
// completion), whether it's expiring, whether it feeds a title the player hasn't earned, and its
// Triumph score. Optionally scoped to a location/activity so "what next on the Moon" composes the
// location filter with the ranking. Only the returned slice is described, like searchRecords.
export async function suggestTriumphs(
  profile: TriumphsProfile,
  filters: SuggestFilters,
): Promise<SuggestResult> {
  const catalog = await recordCatalog();
  const live = collectRecords(profile);
  const seals = await sealMembership(profile.profileRecords.recordSealsRootNodeHash);
  const tags = await loadTriumphIndex();
  const nodes = collectNodes(profile);
  const sealHashes = await sealNodeHashes(profile.profileRecords.recordSealsRootNodeHash);
  const sealViews = await Promise.all(
    sealHashes.map((sealHash) => describeSeal(sealHash, nodes.get(sealHash), live)),
  );
  const sealByName = new Map(sealViews.map((seal) => [seal.name, seal]));

  const location = filters.location ? matchWorld(filters.location) : undefined;
  const activity = filters.activity ? matchActivityType(filters.activity) : undefined;

  const ranked: RankedRecord[] = [];

  for (const record of catalog) {
    const state = live.get(record.hash);

    if (recordStatus(state?.state ?? OBJECTIVE_NOT_COMPLETED).completed) {
      continue;
    }

    const tag = tags.get(record.hash);

    if ((filters.location || filters.activity) && !matchesPlace(tag, filters, location, activity)) {
      continue;
    }

    const sealName = seals.get(record.hash);
    const seal = sealName ? sealByName.get(sealName) : undefined;
    const percent = livePercent(state);
    const sealBoost = seal && !seal.earned ? seal.percent * 0.3 : 0;

    // Closeness drives the ranking; an in-progress, expiring, or title-feeding Triumph is bumped up,
    // with a small nudge for raw Triumph score so high-value goals edge out trivial ones when tied.
    const priority =
      percent +
      (percent > 0 ? 15 : 0) +
      (tag?.expires ? 30 : 0) +
      sealBoost +
      Math.min(record.score, 150) * 0.05;

    ranked.push({ record, state, sealName, seal, tag, percent, priority });
  }

  ranked.sort((a, b) => b.priority - a.priority);

  const limit = filters.limit ?? 15;
  const suggestions = await Promise.all(
    ranked.slice(0, limit).map(async (entry) => ({
      ...(await describeRecord(entry.record, entry.state, entry.sealName)),
      why: reasons(entry),
    })),
  );

  return {
    count: ranked.length,
    truncated: ranked.length > limit,
    ...(location ? { location } : {}),
    ...(activity ? { activity } : {}),
    ...(filters.location || filters.activity
      ? {
          caveat:
            "Location/activity filtering only surfaces Triumphs the index could tie to a destination or mode. Seasonal, account-wide, and Moments of Triumph goals usually aren't location-scoped and are excluded — so a thin result for a place means few of its Triumphs are place-bound, not that there's nothing to do there.",
        }
      : {}),
    suggestions,
  };
}

interface RankedRecord {
  record: CatalogRecord;
  state: RecordComponentState | undefined;
  sealName: string | undefined;
  seal: SealView | undefined;
  tag: TriumphTag | undefined;
  percent: number;
  priority: number;
}

function reasons(entry: RankedRecord): string[] {
  const why: string[] = [];

  if (entry.percent > 0) {
    why.push(`${entry.percent}% complete`);
  }

  if (entry.tag?.expires) {
    why.push(entry.tag.expires);
  }

  if (entry.seal && !entry.seal.earned) {
    why.push(`feeds the ${entry.seal.name} title (${entry.seal.percent}% earned)`);
  }

  if (entry.tag?.effort) {
    why.push(`${entry.tag.effort} effort`);
  }

  if (entry.record.score > 0) {
    why.push(`${entry.record.score} Triumph points`);
  }

  return why;
}

// Live completion of a single Triumph from its profile objectives, without the manifest reads
// describeRecord does — used to rank the whole incomplete set before describing just the top slice.
function livePercent(state: RecordComponentState | undefined): number {
  if (!state) {
    return 0;
  }

  if (recordStatus(state.state ?? OBJECTIVE_NOT_COMPLETED).completed) {
    return 100;
  }

  let progress = 0;
  let total = 0;

  for (const objective of state.objectives ?? []) {
    progress += Math.min(objective.progress ?? 0, objective.completionValue ?? 0);
    total += objective.completionValue ?? 0;
  }

  return total > 0 ? Math.round((progress / total) * 100) : 0;
}

// A record definition, projected to the fields the tools need. `obscured*` fields back the hidden
// display the game shows for locked Triumphs.
interface RecordMeta {
  hash: number;
  name: string;
  description?: string;
  obscuredName?: string;
  obscuredDescription?: string;
  score: number;
  hasTitle: boolean;
  title?: string;
  objectiveHashes: number[];
  rewardItemHashes: number[];
}

async function recordMeta(hash: number): Promise<RecordMeta | undefined> {
  const record = await findDefinition<RawRecord>("DestinyRecordDefinition", hash);

  if (!record) {
    return undefined;
  }

  return projectRecord(hash, record);
}

// A Triumph objective's human-readable label ("Medals earned", "Enemies defeated"). The live
// progress numbers ride on the profile component; only the wording comes from the manifest.
async function objectiveDescription(hash: number): Promise<string | undefined> {
  const objective = await findDefinition<{ progressDescription?: string }>(
    "DestinyObjectiveDefinition",
    hash,
  );

  return objective?.progressDescription || undefined;
}

// Join live objective progress with each objective's manifest label. Shared by Triumphs and quest
// steps, which carry the same objective shape.
export function resolveObjectives(objectives: ObjectiveProgress[]): Promise<ObjectiveView[]> {
  return Promise.all(objectives.map((objective) => describeObjective(objective)));
}

// Overall completion across a set of objectives, weighted by each objective's size so a step that
// needs 1 of 500 on one objective and 1 of 1 on another isn't reported as half done.
export function objectivePercent(objectives: ObjectiveView[]): number {
  let progress = 0;
  let total = 0;

  for (const objective of objectives) {
    progress += Math.min(objective.progress, objective.total);
    total += objective.total;
  }

  return total > 0 ? Math.round((progress / total) * 100) : 0;
}

const RECORD_TABLE = "DestinyRecordDefinition";
const NODE_TABLE = "DestinyPresentationNodeDefinition";

interface RawRecord {
  displayProperties?: { name?: string; description?: string };
  completionInfo?: { ScoreValue?: number };
  stateInfo?: { obscuredName?: string; obscuredDescription?: string };
  titleInfo?: { hasTitle?: boolean; titlesByGender?: Record<string, string> };
  objectiveHashes?: number[];
  rewardItems?: { itemHash: number }[];
  redacted?: boolean;
}

interface RawNode {
  displayProperties?: { name?: string };
  completionRecordHash?: number;
  children?: {
    presentationNodes?: { presentationNodeHash: number }[];
    records?: { recordHash: number }[];
  };
}

function projectRecord(hash: number, record: RawRecord): RecordMeta {
  const titles = record.titleInfo?.titlesByGender;

  return {
    hash,
    name: record.displayProperties?.name ?? `Triumph ${hash >>> 0}`,
    description: record.displayProperties?.description || undefined,
    obscuredName: record.stateInfo?.obscuredName || undefined,
    obscuredDescription: record.stateInfo?.obscuredDescription || undefined,
    score: record.completionInfo?.ScoreValue ?? 0,
    hasTitle: record.titleInfo?.hasTitle ?? false,
    title: titles ? Object.values(titles)[0] : undefined,
    objectiveHashes: record.objectiveHashes ?? [],
    // Reward entries repeat the same item at different quantities for conditional visibility; the
    // tools only report which items a Triumph grants, so dedupe to distinct hashes.
    rewardItemHashes: [...new Set((record.rewardItems ?? []).map((reward) => reward.itemHash))],
  };
}

interface CatalogRecord extends RecordMeta {
  lowerName: string;
}

let catalogPromise: Promise<CatalogRecord[]> | null = null;

// Searching Triumphs by attribute means scanning the whole record table once; cache the catalog for
// the process lifetime, mirroring the item catalog. Skip redacted rows and rows with no name.
function recordCatalog(): Promise<CatalogRecord[]> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      try {
        const catalog: CatalogRecord[] = [];

        for await (const { hash, def } of allDefinitions<RawRecord>(RECORD_TABLE)) {
          if (def.redacted || !def.displayProperties?.name) {
            continue;
          }

          const meta = projectRecord(hash, def);

          catalog.push({ ...meta, lowerName: meta.name.toLowerCase() });
        }

        return catalog;
      } catch (error) {
        catalogPromise = null;
        throw error;
      }
    })();
  }

  return catalogPromise;
}

let sealMapPromise: Promise<Map<number, string>> | null = null;

// Which seal each Triumph belongs to. The seal tree is static manifest data, so build the
// record→seal-name index once. A seal node's title record counts as a member too, so it reports the
// seal it caps.
function sealMembership(sealsRootHash: number | undefined): Promise<Map<number, string>> {
  if (!sealMapPromise) {
    sealMapPromise = (async () => {
      try {
        const membership = new Map<number, string>();
        const root = sealsRootHash
          ? await getDefinition<RawNode>(NODE_TABLE, sealsRootHash)
          : undefined;

        for (const child of root?.children?.presentationNodes ?? []) {
          const seal = await getDefinition<RawNode>(NODE_TABLE, child.presentationNodeHash);
          const name = seal.displayProperties?.name;

          if (!name) {
            continue;
          }

          if (seal.completionRecordHash) {
            membership.set(seal.completionRecordHash >>> 0, name);
          }

          for (const recordHash of await recordsUnder(child.presentationNodeHash)) {
            membership.set(recordHash, name);
          }
        }

        return membership;
      } catch (error) {
        sealMapPromise = null;
        throw error;
      }
    })();
  }

  return sealMapPromise;
}

// Every record hash beneath a presentation node, following sub-nodes. Seals nest their Triumphs one
// or two levels deep, so the walk recurses.
async function recordsUnder(nodeHash: number): Promise<number[]> {
  const node = await getDefinition<RawNode>(NODE_TABLE, nodeHash);
  const hashes = (node.children?.records ?? []).map((record) => record.recordHash >>> 0);

  for (const child of node.children?.presentationNodes ?? []) {
    hashes.push(...(await recordsUnder(child.presentationNodeHash)));
  }

  return hashes;
}

async function sealNodeHashes(sealsRootHash: number | undefined): Promise<number[]> {
  const root = sealsRootHash ? await getDefinition<RawNode>(NODE_TABLE, sealsRootHash) : undefined;

  return (root?.children?.presentationNodes ?? []).map((child) => child.presentationNodeHash);
}

async function describeSeal(
  sealHash: number,
  node: PresentationNodeState | undefined,
  live: Map<number, RecordComponentState>,
): Promise<SealView> {
  const def = await getDefinition<RawNode & { completionRecordHash?: number }>(
    NODE_TABLE,
    sealHash,
  );
  const completion = def.completionRecordHash
    ? await recordMeta(def.completionRecordHash)
    : undefined;
  const titleRecord = def.completionRecordHash
    ? live.get(def.completionRecordHash >>> 0)
    : undefined;
  const total = node?.completionValue ?? 0;
  const complete = Math.min(node?.progressValue ?? 0, total);

  return {
    sealHash,
    name: def.displayProperties?.name ?? `Seal ${sealHash >>> 0}`,
    title: completion?.title,
    complete,
    total,
    percent: total > 0 ? Math.round((complete / total) * 100) : 0,
    earned: recordStatus(titleRecord?.state ?? OBJECTIVE_NOT_COMPLETED).completed,
  };
}

async function describeObjective(objective: ObjectiveProgress): Promise<ObjectiveView> {
  return {
    description: await objectiveDescription(objective.objectiveHash),
    progress: objective.progress ?? 0,
    total: objective.completionValue ?? 0,
    complete: objective.complete ?? false,
  };
}

async function rewardName(itemHash: number): Promise<string> {
  return (await itemInfo(itemHash))?.name ?? `Item ${itemHash >>> 0}`;
}

// A record with no live objectives (never started) still has its definition objectives; render them
// at zero so the shape is consistent.
function emptyObjective(objectiveHash: number): ObjectiveProgress {
  return { objectiveHash, progress: 0, complete: false };
}

function progressState(
  completed: boolean,
  objectives: ObjectiveView[],
): "completed" | "in_progress" | "not_started" {
  if (completed) {
    return "completed";
  }

  return objectives.some((objective) => objective.progress > 0) ? "in_progress" : "not_started";
}
