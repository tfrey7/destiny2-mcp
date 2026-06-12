import { allDefinitions, findDefinition, getDefinition } from "./manifest_db.js";
import { itemInfo } from "./manifest.js";
import {
  type ObjectiveProgress,
  type PresentationNodeState,
  type ProfileResponse,
  type RecordComponentState,
  type RecordsComponent,
} from "./profile.js";

// A Triumph's completion lifecycle, derived from the DestinyRecordState bitmask: whether its
// objectives are done, whether the reward was claimed, and whether the game is hiding it.
export interface RecordStatus {
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
export interface TriumphView {
  recordHash: number;
  name: string;
  description?: string;
  state: "completed" | "in_progress" | "not_started";
  percent: number;
  score: number;
  seal?: string;
  redeemed?: boolean;
  obscured?: boolean;
  objectives: ObjectiveView[];
  rewards: string[];
}

export interface RecordFilters {
  name?: string;
  state?: "completed" | "incomplete";
  seal?: string;
  limit?: number;
}

export interface RecordSearch {
  count: number;
  truncated: boolean;
  records: TriumphView[];
}

// One seal: a title a player earns by completing a set of Triumphs. The live counts say how close
// the seal is, which is exactly what "which title should I chase" needs.
export interface SealView {
  sealHash: number;
  name: string;
  title?: string;
  complete: number;
  total: number;
  percent: number;
  earned: boolean;
}

export interface TriumphSummary {
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
export function collectRecords(profile: ProfileResponse): Map<number, RecordComponentState> {
  const merged = new Map<number, RecordComponentState>();
  const absorb = (records?: Record<string, RecordComponentState>) => {
    for (const [hash, state] of Object.entries(records ?? {})) {
      merged.set(Number(hash) >>> 0, state);
    }
  };

  absorb(profile.profileRecords?.data?.records);
  for (const character of Object.values(profile.characterRecords?.data ?? {})) {
    absorb(character.records);
  }

  return merged;
}

// Presentation-node rollups are split the same way as records; merge both scopes so every seal has
// its live progress, since some seals are tracked per-character.
export function collectNodes(profile: ProfileResponse): Map<number, PresentationNodeState> {
  const merged = new Map<number, PresentationNodeState>();
  const absorb = (nodes?: Record<string, PresentationNodeState>) => {
    for (const [hash, state] of Object.entries(nodes ?? {})) {
      merged.set(Number(hash) >>> 0, state);
    }
  };

  absorb(profile.profilePresentationNodes?.data?.nodes);
  for (const character of Object.values(profile.characterPresentationNodes?.data ?? {})) {
    absorb(character.nodes);
  }

  return merged;
}

// Resolve a Triumph's manifest label, current progress, and rewards into the read-tool projection.
// Objective labels and reward names are extra manifest reads, so callers should describe only the
// records they're returning (post-filter, post-limit), not the whole catalog.
export async function describeRecord(
  meta: RecordMeta,
  live: RecordComponentState | undefined,
  seal?: string,
): Promise<TriumphView> {
  const status = recordStatus(live?.state ?? OBJECTIVE_NOT_COMPLETED);
  const objectives = await resolveObjectives(
    live?.objectives ?? meta.objectiveHashes.map(emptyObjective),
  );

  return {
    recordHash: meta.hash,
    // The game hides an obscured Triumph's name and description until it's unlocked; honor that.
    name: status.obscured ? meta.obscuredName || "Classified" : meta.name,
    description: (status.obscured ? meta.obscuredDescription : meta.description) || undefined,
    state: progressState(status.completed, objectives),
    percent: status.completed ? 100 : objectivePercent(objectives),
    score: meta.score,
    ...(seal ? { seal } : {}),
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
  profile: ProfileResponse,
  filters: RecordFilters,
): Promise<RecordSearch> {
  const catalog = await recordCatalog();
  const live = collectRecords(profile);
  const seals = await sealMembership(profile.profileRecords?.data?.recordSealsRootNodeHash);

  const name = filters.name?.toLowerCase();
  const seal = filters.seal?.toLowerCase();

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

    return true;
  });

  const limit = filters.limit ?? 25;
  const records = await Promise.all(
    matches
      .slice(0, limit)
      .map((record) => describeRecord(record, live.get(record.hash), seals.get(record.hash))),
  );

  return { count: matches.length, truncated: matches.length > limit, records };
}

// The seal overview: total Triumph score plus every seal with its live completion counts, so a
// caller can spot which title is closest. Progress comes from the seal node's live rollup.
export async function triumphSummary(profile: ProfileResponse): Promise<TriumphSummary> {
  const records = profile.profileRecords?.data;
  const nodes = collectNodes(profile);
  const live = collectRecords(profile);
  const sealHashes = await sealNodeHashes(records?.recordSealsRootNodeHash);

  const seals = await Promise.all(
    sealHashes.map((sealHash) => describeSeal(sealHash, nodes.get(sealHash), live)),
  );

  return {
    score: {
      total: records?.score ?? 0,
      active: records?.activeScore ?? 0,
      legacy: records?.legacyScore ?? 0,
      lifetime: records?.lifetimeScore ?? 0,
    },
    // Closest-to-done first — that's the seal worth focusing on — but earned seals sink to the bottom.
    seals: seals.sort((a, b) => Number(a.earned) - Number(b.earned) || b.percent - a.percent),
  };
}

// A record definition, projected to the fields the tools need. `obscured*` fields back the hidden
// display the game shows for locked Triumphs.
export interface RecordMeta {
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

export async function recordMeta(hash: number): Promise<RecordMeta | undefined> {
  const record = await findDefinition<RawRecord>("DestinyRecordDefinition", hash);

  if (!record) {
    return undefined;
  }

  return projectRecord(hash, record);
}

// A Triumph objective's human-readable label ("Medals earned", "Enemies defeated"). The live
// progress numbers ride on the profile component; only the wording comes from the manifest.
export async function objectiveDescription(hash: number): Promise<string | undefined> {
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
