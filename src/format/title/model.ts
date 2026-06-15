import type { ObjectiveView, TitleDetail, TriumphView } from "../../bungie/progression.js";
import type { ObjectiveLine, TriumphState } from "../triumphs/model.js";
import type { TitleStatus } from "../titles/model.js";

export type { TitleStatus } from "../titles/model.js";

/**
 * One Triumph row in the single-title detail card — a member Triumph laid out inline (the gallery's
 * hover detail, but always-on). Carries its state marker, name, score, live percent, the per-
 * objective progress, and its icon.
 */
export interface TitleTriumphRow {
  recordHash: number;
  name: string;
  description?: string;
  state: TriumphState;
  percent: number;
  score: number;
  objectives: ObjectiveLine[];
  /** A locked Triumph the game obscures — name/description are placeholders, so dim the row. */
  obscured?: boolean;
  /** Relative Bungie CDN icon path; the card inlines it as a data: URI (see images.ts). */
  icon?: string;
}

/** What the tool hands the model layer: the resolved title plus its member-Triumph icon paths. */
export interface TitleDetailCard {
  detail: TitleDetail;
  /** recordHash → relative CDN icon path, resolved by the tool (see recordIcon). */
  icons?: Record<number, string>;
}

/** The shared shape every single-title renderer (text, html, images) reads. */
export interface TitleDetailModel {
  /** The earned title word ("Dredgen"). */
  title: string;
  /** The seal's source ("Gambit"). */
  name: string;
  requirement?: string;
  status: TitleStatus;
  earned: boolean;
  complete: number;
  total: number;
  percent: number;
  gildable: boolean;
  gilded: number;
  /** Relative Bungie CDN path to the seal emblem. */
  icon?: string;
  triumphs: TitleTriumphRow[];
}

/**
 * Reduce a resolved title to the detail card's display shape: the seal header plus every member
 * Triumph as an inline row (incomplete-closest first, completed last — the order titleDetail set).
 *
 * @example
 * {
 *   title: "Dredgen", name: "Gambit", status: "in_progress",
 *   complete: 5, total: 9, percent: 56,
 *   triumphs: [{ name: "Reckoner", state: "not_started", percent: 0, score: 0, objectives: [] }],
 * }
 */
export function titleDetailModel(card: TitleDetailCard): TitleDetailModel {
  const { title, triumphs } = card.detail;

  return {
    title: title.title,
    name: title.name,
    ...(title.requirement ? { requirement: title.requirement } : {}),
    status: status(title.earned, title.complete),
    earned: title.earned,
    complete: title.complete,
    total: title.total,
    percent: title.percent,
    gildable: title.gildable,
    gilded: title.gilded,
    ...(title.icon ? { icon: title.icon } : {}),
    triumphs: triumphs.map((triumph) => row(triumph, card.icons?.[triumph.recordHash])),
  };
}

function row(triumph: TriumphView, icon: string | undefined): TitleTriumphRow {
  return {
    recordHash: triumph.recordHash,
    name: triumph.name,
    ...(triumph.description ? { description: triumph.description } : {}),
    state: triumph.state,
    percent: triumph.percent,
    score: triumph.score,
    objectives: triumph.objectives.map(objectiveLine),
    ...(triumph.obscured ? { obscured: true } : {}),
    ...(icon ? { icon } : {}),
  };
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

// A member Triumph reads earned/in-progress/not-started the same way a title does, so the rows take
// the same status colours as the seal's gallery tile.
function status(earned: boolean, complete: number): TitleStatus {
  if (earned) {
    return "earned";
  }

  return complete > 0 ? "in_progress" : "not_started";
}
