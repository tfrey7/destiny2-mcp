import type { ObjectiveView, TriumphSuggestion } from "../../bungie/progression.js";

/** A Triumph's completion lifecycle as the card renders it — drives the tile's accent colour. */
export type TriumphState = "completed" | "in_progress" | "not_started";

/**
 * One Triumph's objective, ready to render: its in-game label, live progress, and a precomputed
 * percent so a renderer needn't redo the divide. `complete` is authoritative for the checkmark.
 */
export interface ObjectiveLine {
  label: string;
  progress: number;
  total: number;
  percent: number;
  complete: boolean;
}

/** A Triumph's reward item, ready to render: its name and (on the card path) its manifest icon. */
export interface RewardView {
  name: string;
  /** Relative Bungie CDN icon path; the grid inlines it as a data: URI (see images.ts). */
  icon?: string;
}

/**
 * One tile in the Triumph grid — the reduced, display-ready shape both renderers consume. Carries
 * the headline fields (name, score, percent) shown on the tile face plus the hover-panel detail
 * (description, objective lines, the advisor's `why` reasons, and chips for seal / location /
 * activity / effort).
 */
export interface TriumphTile {
  recordHash: number;
  name: string;
  score: number;
  percent: number;
  state: TriumphState;
  description?: string;
  /** The seal (title) this Triumph feeds, shown as the panel's gold category line — like the
   * in-game "Gilded Title Triumph" subtitle. Absent for Triumphs outside any seal. */
  seal?: string;
  /** Short labels shown as chips: the place/mode facts — destinations, activity kind, scope. */
  chips: string[];
  /** The advisor's ranking reasons ("63% complete", "feeds the Conqueror title", …). */
  why: string[];
  objectives: ObjectiveLine[];
  rewards: RewardView[];
  /** A locked Triumph the game obscures — name/description are placeholders, so dim the tile. */
  obscured?: boolean;
  /** Relative Bungie CDN icon path; the renderer inlines it as a data: URI (see images.ts). */
  icon?: string;
}

/** What the tool hands the model layer: the advisor's suggestions plus resolved icon paths. */
export interface TriumphCard {
  title: string;
  subtitle: string;
  /** The advisor's caveat when a location/activity filter narrowed the set; shown under the header. */
  caveat?: string;
  suggestions: TriumphSuggestion[];
  /** recordHash → relative CDN icon path, resolved by the tool (see recordIcon). */
  icons?: Record<number, string>;
  /** recordHash → its reward items with icons, resolved by the tool (see recordRewards). Falls back
   * to the suggestion's plain reward names when absent (e.g. the offline preview). */
  rewards?: Record<number, RewardView[]>;
}

/** The shared shape every Triumph-card renderer (text, html, images) reads. */
export interface TriumphCardModel {
  title: string;
  subtitle: string;
  caveat?: string;
  tiles: TriumphTile[];
}

/**
 * Reduce the advisor's suggestions to ordered, display-ready tiles — the shared input for the text
 * card and the interactive grid alike. Suggestion order is preserved (the advisor already ranked
 * them highest-leverage first); each tile flattens the per-objective progress into labelled lines
 * and folds the Triumph's location / activity / seal / effort into a single chip list.
 *
 * @example
 * {
 *   title: "TRIUMPHS TO CHASE",
 *   subtitle: "15 ranked · Moon",
 *   tiles: [
 *     { name: "The Hollowed Lair", score: 50, percent: 63, state: "in_progress",
 *       chips: ["The Moon", "strike"], why: ["63% complete", "50 Triumph points"],
 *       objectives: [{ label: "Enemies defeated", progress: 6, total: 23, percent: 26, complete: false }] },
 *   ],
 * }
 */
export function triumphCardModel(card: TriumphCard): TriumphCardModel {
  return {
    title: card.title,
    subtitle: card.subtitle,
    ...(card.caveat ? { caveat: card.caveat } : {}),
    tiles: card.suggestions.map((suggestion) =>
      tile(suggestion, card.icons?.[suggestion.recordHash], card.rewards?.[suggestion.recordHash]),
    ),
  };
}

function tile(
  suggestion: TriumphSuggestion,
  icon: string | undefined,
  rewards: RewardView[] | undefined,
): TriumphTile {
  return {
    recordHash: suggestion.recordHash,
    name: suggestion.name,
    score: suggestion.score,
    percent: suggestion.percent,
    state: suggestion.state,
    ...(suggestion.description ? { description: suggestion.description } : {}),
    ...(suggestion.seal ? { seal: suggestion.seal } : {}),
    chips: chips(suggestion),
    why: suggestion.why,
    objectives: suggestion.objectives.map(objectiveLine),
    // Prefer the tool's icon-resolved rewards; fall back to the suggestion's plain reward names.
    rewards: rewards ?? suggestion.rewards.map((name) => ({ name })),
    ...(suggestion.obscured ? { obscured: true } : {}),
    ...(icon ? { icon } : {}),
  };
}

// The chip row distils *where and how* a Triumph is earned — destination, activity kind, and
// solo/fireteam scope. Deliberately the place/mode facts only: the advisor's `why` already narrates
// effort, expiry, and the seal it feeds, so repeating those here would just double them up.
function chips(suggestion: TriumphSuggestion): string[] {
  const chips: string[] = [];

  for (const place of suggestion.location ?? []) {
    chips.push(place);
  }

  if (suggestion.activityType) {
    chips.push(suggestion.activityType);
  }

  if (suggestion.scope) {
    chips.push(suggestion.scope);
  }

  return chips;
}

function objectiveLine(objective: ObjectiveView): ObjectiveLine {
  const percent =
    objective.total > 0
      ? Math.min(100, Math.round((objective.progress / objective.total) * 100))
      : objective.complete
        ? 100
        : 0;

  return {
    label: objective.description || "Progress",
    progress: objective.progress,
    total: objective.total,
    percent,
    complete: objective.complete,
  };
}
