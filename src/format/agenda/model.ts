import type { ArmorCard } from "../armor/model.js";
import type { TitleDetailModel } from "../title/model.js";
import type { TriumphTile } from "../triumphs/model.js";
import type { WeaponCard } from "../weapon/model.js";

/**
 * The agenda card models a single play-session plan: an ordered list of phases (Warm-up, Focus,
 * Stretch…), each holding the activities to do in that stretch. Unlike the loadout/build cards it is
 * NOT gear — it's the model's synthesis of the player's live pursuits (active quests, ROI-ranked
 * Triumphs, seal/artifact progress) into "what to focus on tonight". The renderer is content-agnostic:
 * it draws whatever phases and items the tool hands it, so the model owns the curation and this layer
 * only reduces the spec to a display-ready shape (percents, time totals, chip lists).
 */

/**
 * A card from another tool embedded in an agenda item: the resolved sub-model the agenda iframe expands
 * inline (a click-to-open accordion). The tool resolves an item/record hash into the matching card spec
 * — reusing weaponCardSpec / armorCardSpec / the single-record Triumph builder — so an embed can't drift
 * from the real card. The agenda renders a COMPACT view of it from the shared client render modules.
 */
export type AgendaEmbed =
  | { kind: "weapon"; card: WeaponCard }
  | { kind: "armor"; card: ArmorCard }
  | { kind: "triumph"; tile: TriumphTile }
  | { kind: "title"; detail: TitleDetailModel };

/** One activity on the agenda, as the tool resolves it (icon is a CDN path, set from an item hash). */
export interface AgendaItem {
  name: string;
  /** One-line why/context — the reward, the seal it feeds, the reason it's worth doing now. */
  detail?: string;
  /** Rough time estimate in minutes; folds into the phase and session totals. */
  minutes?: number;
  /** Live progress numerator/denominator — drives the progress bar and the default label. */
  current?: number;
  total?: number;
  /** Overrides the derived "current/total" label (e.g. "step 3/5", "quest", "weekly"). */
  progressLabel?: string;
  /** Flags a time-limited item (expiring Triumph, seasonal challenge) with an ⏰ badge. */
  expiring?: boolean;
  /** Place/mode facts shown as chips. */
  activityType?: string;
  location?: string;
  /** Relative Bungie CDN icon path, resolved by the tool from an optional item hash (see images.ts). */
  icon?: string;
  /** A weapon/armor/triumph card the item expands inline (see AgendaEmbed). */
  embed?: AgendaEmbed;
}

/** One stretch of the session — a labelled group of items with an optional time budget. */
export interface AgendaPhase {
  label: string;
  minutes?: number;
  items: AgendaItem[];
}

/** What the tool hands the model layer: the resolved session plan. */
export interface AgendaCard {
  title: string;
  /** The session's theme — "Chase the Dredgen title", "Catch up on seasonal", etc. */
  objective?: string;
  /** A title (seal) card the objective reveals on hover — the session's goal in full. */
  objectiveEmbed?: AgendaEmbed;
  phases: AgendaPhase[];
}

/** One item reduced for rendering: progress flattened to a percent + label, facts folded into chips. */
export interface AgendaItemLine {
  name: string;
  detail?: string;
  minutes?: number;
  /** 0–100 when the item carries progress; absent for a binary "do this" item. */
  percent?: number;
  progressLabel?: string;
  expiring?: boolean;
  chips: string[];
  icon?: string;
  embed?: AgendaEmbed;
}

export interface AgendaPhaseModel {
  label: string;
  /** The phase's time budget — its own `minutes`, or the sum of its items' estimates. */
  minutes?: number;
  items: AgendaItemLine[];
}

/** The shared shape every agenda renderer (text, html, images) reads. */
export interface AgendaCardModel {
  title: string;
  subtitle: string;
  objective?: string;
  /** The title (seal) card the objective reveals on hover. */
  objectiveEmbed?: AgendaEmbed;
  /** Whole-session time estimate in minutes, when any phase or item carried one. */
  totalMinutes?: number;
  phases: AgendaPhaseModel[];
}

/**
 * Reduce a session plan to ordered, display-ready phases — the shared input for the text card and the
 * interactive timeline alike. Phase and item order is preserved (the model already sequenced them).
 * Each item's progress collapses to a clamped percent and a label; each phase's time budget is its own
 * estimate or the sum of its items'; the subtitle headlines the session length and phase count.
 *
 * @example
 * {
 *   title: "TONIGHT'S AGENDA",
 *   subtitle: "~90 min · 3 phases",
 *   objective: "Chase the Dredgen title",
 *   totalMinutes: 90,
 *   phases: [
 *     { label: "Warm-up", minutes: 15, items: [
 *       { name: "Gambit bounties", percent: 25, progressLabel: "1/4", chips: ["Gambit"] } ] },
 *   ],
 * }
 */
export function agendaCardModel(card: AgendaCard): AgendaCardModel {
  const phases = card.phases.map(phaseModel);
  const totalMinutes = phases.reduce((sum, phase) => sum + (phase.minutes ?? 0), 0);

  return {
    title: card.title,
    subtitle: subtitle(phases, totalMinutes),
    ...(card.objective ? { objective: card.objective } : {}),
    ...(card.objectiveEmbed ? { objectiveEmbed: card.objectiveEmbed } : {}),
    ...(totalMinutes > 0 ? { totalMinutes } : {}),
    phases,
  };
}

function phaseModel(phase: AgendaPhase): AgendaPhaseModel {
  const items = phase.items.map(itemLine);
  // The phase's own budget wins; otherwise sum what the items estimate (0 → leave it absent).
  const summed = items.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
  const minutes = phase.minutes ?? (summed > 0 ? summed : undefined);

  return {
    label: phase.label,
    ...(minutes !== undefined ? { minutes } : {}),
    items,
  };
}

function itemLine(item: AgendaItem): AgendaItemLine {
  return {
    name: item.name,
    ...(item.detail ? { detail: item.detail } : {}),
    ...(item.minutes !== undefined ? { minutes: item.minutes } : {}),
    ...progress(item),
    ...(item.expiring ? { expiring: true } : {}),
    chips: chips(item),
    ...(item.icon ? { icon: item.icon } : {}),
    ...(item.embed ? { embed: item.embed } : {}),
  };
}

// Collapse an item's raw progress into a clamped percent and a label. A bare `total` with no `current`
// still reads as 0%; an item with neither stays unprogressed (no bar). An explicit progressLabel always
// wins over the derived "current/total" so the model can say "step 3/5" or "quest" instead.
function progress(item: AgendaItem): { percent?: number; progressLabel?: string } {
  const hasProgress = item.current !== undefined || item.total !== undefined;

  if (!hasProgress && !item.progressLabel) {
    return {};
  }

  const current = item.current ?? 0;
  const total = item.total ?? 0;
  const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
  const label =
    item.progressLabel ?? (item.total !== undefined ? `${current}/${total}` : `${current}`);

  return { percent, progressLabel: label };
}

// The chip row distils where/how the activity is done — the place and the mode. The detail line already
// narrates the why, so chips stay purely the place/mode facts (mirrors the Triumph card's chip rule).
function chips(item: AgendaItem): string[] {
  const chips: string[] = [];

  if (item.activityType) {
    chips.push(item.activityType);
  }

  if (item.location) {
    chips.push(item.location);
  }

  return chips;
}

function subtitle(phases: AgendaPhaseModel[], totalMinutes: number): string {
  const count = `${phases.length} phase${phases.length === 1 ? "" : "s"}`;

  return totalMinutes > 0 ? `~${totalMinutes} min · ${count}` : count;
}
