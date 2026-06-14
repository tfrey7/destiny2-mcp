import { bungieFetch } from "./client.js";
import { activityMeta, type ActivityMeta } from "./manifest.js";
import { Component, getPrimaryMembership, getProfile } from "./profile.js";

// The narrow projection of one completed activity the read tools surface: the manifest-resolved name,
// type, and destination instead of raw hashes, the per-activity stats, and the instanceId for a PGCR
// drill-down. Deliberately omits the hashes and card art — those stay internal to the recap.
export interface ActivityEntry {
  instanceId: string;
  name: string;
  activityType?: string;
  destination?: string;
  mode: string;
  period: string;
  durationSeconds: number;
  kills: number;
  deaths: number;
  assists: number;
  kdr: number;
  completed: boolean;
  standing?: "Victory" | "Defeat";
  score?: number;
}

export interface HistoryOptions {
  mode?: string;
  count?: number;
  characterId?: string;
}

export interface RecapOptions {
  period?: string;
  start?: string;
  end?: string;
  mode?: string;
  characterId?: string;
}

// One coarse mode's tally in the recap: how many runs, how many were clears, and the time spent.
export interface RecapModeCount {
  mode: string;
  count: number;
  clears: number;
  durationSeconds: number;
}

export interface RecapNotable {
  longest?: { name: string; mode: string; durationSeconds: number };
  bestKdr?: { name: string; mode: string; kdr: number };
}

// The aggregated window the recap card renders: the headline totals, the per-mode breakdown, the
// notable runs, and a representative PGCR image for the card's backdrop.
export interface RecapSummary {
  periodLabel: string;
  mode?: string;
  totalActivities: number;
  totalDurationSeconds: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  kdr: number;
  clears: number;
  byMode: RecapModeCount[];
  notable: RecapNotable;
  pgcrImage?: string;
}

// The newest completed activities across the player's characters (or one, when scoped), merged and
// re-sorted newest-first. A mode name ("raid", "crucible", …) filters at the API; `count` caps the
// list (Bungie returns at most one page of 250 per character per call).
export async function activityHistory(options: HistoryOptions): Promise<ActivityEntry[]> {
  const membership = await getPrimaryMembership();
  const characters = await characterIds(options.characterId);
  const modeInt = options.mode === undefined ? undefined : modeFilterInt(options.mode);
  const count = options.count ?? 25;

  // Each character needs only its newest `count` to guarantee the global newest `count` after the merge.
  const batches = await Promise.all(
    characters.map((characterId) => pageActivities(membership, characterId, modeInt, 0, count)),
  );
  const raws = batches
    .flat()
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, count);

  return projectAll(raws);
}

// The aggregated recap over a time window: page each character's history back far enough to cover the
// window, filter to it, and roll the runs up into totals, a per-mode breakdown, and notable runs.
export async function activityRecap(options: RecapOptions): Promise<RecapSummary> {
  const membership = await getPrimaryMembership();
  const characters = await characterIds(options.characterId);
  const modeInt = options.mode === undefined ? undefined : modeFilterInt(options.mode);
  const window = parsePeriod(options);

  const batches = await Promise.all(
    characters.map((characterId) => collectSince(membership, characterId, modeInt, window.start)),
  );
  const raws = batches
    .flat()
    .filter((raw) => withinWindow(raw.period, window))
    .sort((a, b) => b.period.localeCompare(a.period));

  const metas = await resolveMetas(raws);
  const entries = raws.map((raw) => projectEntry(raw, metas.get(activityRef(raw.activityDetails))));

  return aggregate(entries, raws, metas, window, options.mode);
}

interface Membership {
  membershipType: number;
  destinyMembershipId: string;
}

interface RawActivity {
  period: string;
  activityDetails: {
    referenceId: number;
    directorActivityHash: number;
    instanceId: string;
    mode: number;
    modes: number[];
  };
  values: Record<string, { basic?: { value?: number } }>;
}

interface Window {
  label: string;
  start: Date;
  end: Date;
}

// One page is the API maximum; pacing the recap back at this size keeps the round-trips few. The
// page cap bounds a runaway "last month" on a very active account; hitting it is logged, not silent.
const PAGE_SIZE = 250;
const MAX_PAGES = 10;

async function characterIds(characterId?: string): Promise<string[]> {
  if (characterId) {
    return [characterId];
  }

  const profile = await getProfile([Component.Characters]);

  return Object.keys(profile.characters);
}

async function pageActivities(
  membership: Membership,
  characterId: string,
  modeInt: number | undefined,
  page: number,
  count: number = PAGE_SIZE,
): Promise<RawActivity[]> {
  const params = new URLSearchParams({ count: String(count), page: String(page) });

  if (modeInt !== undefined) {
    params.set("mode", String(modeInt));
  }

  const data = await bungieFetch<{ activities?: RawActivity[] }>(
    `/Destiny2/${membership.membershipType}/Account/${membership.destinyMembershipId}/Character/${characterId}/Stats/Activities/?${params}`,
  );

  return data.activities ?? [];
}

// Page a character's history newest-first until a page reaches past the window start (or the history
// runs out), so the window is fully covered without fetching the player's whole lifetime.
async function collectSince(
  membership: Membership,
  characterId: string,
  modeInt: number | undefined,
  since: Date,
): Promise<RawActivity[]> {
  const collected: RawActivity[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await pageActivities(membership, characterId, modeInt, page);

    if (batch.length === 0) {
      break;
    }

    collected.push(...batch);

    const oldest = batch[batch.length - 1];

    if (new Date(oldest.period).getTime() < since.getTime() || batch.length < PAGE_SIZE) {
      break;
    }

    if (page === MAX_PAGES - 1) {
      console.error(
        `[destiny2-mcp] activity_recap hit the ${MAX_PAGES}-page history cap for character ${characterId}; the window may be truncated.`,
      );
    }
  }

  return collected;
}

async function resolveMetas(raws: RawActivity[]): Promise<Map<number, ActivityMeta | undefined>> {
  const hashes = [...new Set(raws.map((raw) => activityRef(raw.activityDetails)))];
  const metas = new Map<number, ActivityMeta | undefined>();

  await Promise.all(
    hashes.map(async (hash) => {
      metas.set(hash, await activityMeta(hash));
    }),
  );

  return metas;
}

async function projectAll(raws: RawActivity[]): Promise<ActivityEntry[]> {
  const metas = await resolveMetas(raws);

  return raws.map((raw) => projectEntry(raw, metas.get(activityRef(raw.activityDetails))));
}

function projectEntry(raw: RawActivity, meta: ActivityMeta | undefined): ActivityEntry {
  const value = (key: string): number => raw.values[key]?.basic?.value ?? 0;
  const score = value("score");

  return {
    instanceId: raw.activityDetails.instanceId,
    name: meta?.name ?? "Unknown activity",
    ...(meta?.activityType ? { activityType: meta.activityType } : {}),
    ...(meta?.destination ? { destination: meta.destination } : {}),
    mode: coarseMode(raw.activityDetails.modes, raw.activityDetails.mode),
    period: raw.period,
    durationSeconds: value("activityDurationSeconds"),
    kills: value("kills"),
    deaths: value("deaths"),
    assists: value("assists"),
    kdr: round(value("killsDeathsRatio")),
    completed: value("completed") === 1,
    ...(raw.values.standing ? { standing: value("standing") === 0 ? "Victory" : "Defeat" } : {}),
    ...(score > 0 ? { score } : {}),
  };
}

function aggregate(
  entries: ActivityEntry[],
  raws: RawActivity[],
  metas: Map<number, ActivityMeta | undefined>,
  window: Window,
  mode: string | undefined,
): RecapSummary {
  const totalDurationSeconds = sum(entries, (entry) => entry.durationSeconds);
  const totalKills = sum(entries, (entry) => entry.kills);
  const totalDeaths = sum(entries, (entry) => entry.deaths);
  const totalAssists = sum(entries, (entry) => entry.assists);

  return {
    periodLabel: window.label,
    ...(mode ? { mode } : {}),
    totalActivities: entries.length,
    totalDurationSeconds,
    totalKills,
    totalDeaths,
    totalAssists,
    kdr: round(totalDeaths > 0 ? totalKills / totalDeaths : totalKills),
    clears: entries.filter((entry) => entry.completed).length,
    byMode: byMode(entries),
    notable: notable(entries),
    ...(representativeArt(entries, raws, metas) ?? {}),
  };
}

function byMode(entries: ActivityEntry[]): RecapModeCount[] {
  const counts = new Map<string, RecapModeCount>();

  for (const entry of entries) {
    const existing = counts.get(entry.mode) ?? {
      mode: entry.mode,
      count: 0,
      clears: 0,
      durationSeconds: 0,
    };

    existing.count += 1;
    existing.clears += entry.completed ? 1 : 0;
    existing.durationSeconds += entry.durationSeconds;
    counts.set(entry.mode, existing);
  }

  return [...counts.values()].sort((a, b) => b.count - a.count);
}

function notable(entries: ActivityEntry[]): RecapNotable {
  const result: RecapNotable = {};

  const longest = maxBy(entries, (entry) => entry.durationSeconds);

  if (longest && longest.durationSeconds > 0) {
    result.longest = {
      name: longest.name,
      mode: longest.mode,
      durationSeconds: longest.durationSeconds,
    };
  }

  const bestKdr = maxBy(
    entries.filter((entry) => entry.kills > 0),
    (entry) => entry.kdr,
  );

  if (bestKdr) {
    result.bestKdr = { name: bestKdr.name, mode: bestKdr.mode, kdr: bestKdr.kdr };
  }

  return result;
}

// The card's backdrop: the PGCR art of the longest run in the window — a marquee activity (a raid or
// dungeon) over a quick playlist match. Falls back to nothing when no run carries a PGCR image.
function representativeArt(
  entries: ActivityEntry[],
  raws: RawActivity[],
  metas: Map<number, ActivityMeta | undefined>,
): { pgcrImage: string } | undefined {
  let bestIndex = -1;
  let bestDuration = -1;

  entries.forEach((entry, index) => {
    if (entry.durationSeconds > bestDuration) {
      bestDuration = entry.durationSeconds;
      bestIndex = index;
    }
  });

  if (bestIndex === -1) {
    return undefined;
  }

  const pgcrImage = metas.get(activityRef(raws[bestIndex].activityDetails))?.pgcrImage;

  return pgcrImage ? { pgcrImage } : undefined;
}

// The activity hash to resolve against the manifest. directorActivityHash is the specific node, but
// some playlist activities leave it 0 and carry the activity on referenceId, so fall back to that.
function activityRef(details: RawActivity["activityDetails"]): number {
  return details.directorActivityHash || details.referenceId;
}

// Map a history entry's modes to a single coarse bucket for grouping. The `modes` array carries the
// parent categories (AllPvP, AllStrikes) alongside the specific playlist, so membership in a bucket's
// ints is the reliable signal; order is most-specific-first so a Nightfall isn't bucketed as a Strike.
function coarseMode(modes: number[], mode: number): string {
  const present = new Set(modes?.length ? modes : [mode]);

  for (const bucket of MODE_BUCKETS) {
    if (bucket.modes.some((value) => present.has(value))) {
      return bucket.label;
    }
  }

  return "Other";
}

interface ModeBucket {
  label: string;
  modes: number[];
}

// DestinyActivityModeType ints grouped into the coarse buckets the recap reports. Specific-first so
// the first match wins: Trials/Nightfall/Dungeon outrank the broad PvP/Strike/PvE categories they
// also belong to. See modeFilterInt for the inverse (a name → the API filter value).
const MODE_BUCKETS: ModeBucket[] = [
  { label: "Raid", modes: [4] },
  { label: "Dungeon", modes: [82] },
  { label: "Trials of Osiris", modes: [84] },
  { label: "Nightfall", modes: [16, 17, 46, 47] },
  { label: "Gambit", modes: [63, 75, 112] },
  { label: "Crucible", modes: [5] },
  { label: "Strike", modes: [3, 18] },
  { label: "Story", modes: [2] },
  { label: "Patrol", modes: [6] },
  { label: "PvE", modes: [7] },
];

// The DestinyActivityModeType the API filters on for a human mode name. Coarse on purpose — "strike"
// is AllStrikes (every playlist strike), "crucible" is AllPvP — so the filter matches how a player asks.
const MODE_FILTERS: Record<string, number> = {
  raid: 4,
  dungeon: 82,
  crucible: 5,
  pvp: 5,
  gambit: 63,
  strike: 18,
  strikes: 18,
  nightfall: 16,
  trials: 84,
  story: 2,
  patrol: 6,
};

function modeFilterInt(mode: string): number {
  const value = MODE_FILTERS[mode.toLowerCase().trim()];

  if (value === undefined) {
    throw new Error(
      `[destiny2-mcp] Unknown activity mode "${mode}". Try one of: ${Object.keys(MODE_FILTERS).join(", ")}.`,
    );
  }

  return value;
}

// Resolve the recap's time window from explicit dates or a phrase. Explicit start/end win; otherwise a
// phrase ("today", "yesterday", "last 7 days", "last week", "last month") sets it, defaulting to a week.
function parsePeriod(options: RecapOptions): Window {
  if (options.start || options.end) {
    const start = options.start ? startOfDay(new Date(options.start)) : new Date(0);
    const end = options.end ? endOfDay(new Date(options.end)) : new Date();

    return { label: `${formatDate(start)} – ${formatDate(end)}`, start, end };
  }

  const text = (options.period ?? "last 7 days").toLowerCase().trim();
  const now = new Date();

  if (text === "today") {
    return { label: "Today", start: startOfDay(now), end: now };
  }

  if (text === "yesterday") {
    const midnight = startOfDay(now);

    return { label: "Yesterday", start: addDays(midnight, -1), end: midnight };
  }

  const lastDays = text.match(/^last (\d+) days?$/);

  if (lastDays) {
    const days = Number(lastDays[1]);

    return { label: `Last ${days} days`, start: addDays(now, -days), end: now };
  }

  if (text === "last week" || text === "this week") {
    return { label: "Last 7 days", start: addDays(now, -7), end: now };
  }

  if (text === "last month") {
    return { label: "Last 30 days", start: addDays(now, -30), end: now };
  }

  return { label: "Last 7 days", start: addDays(now, -7), end: now };
}

function withinWindow(period: string, window: Window): boolean {
  const time = new Date(period).getTime();

  return time >= window.start.getTime() && time <= window.end.getTime();
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);

  copy.setHours(0, 0, 0, 0);

  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);

  copy.setHours(23, 59, 59, 999);

  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);

  copy.setDate(copy.getDate() + days);

  return copy;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sum<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

function maxBy<T>(items: T[], value: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestValue = -Infinity;

  for (const item of items) {
    const current = value(item);

    if (current > bestValue) {
      bestValue = current;
      best = item;
    }
  }

  return best;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
