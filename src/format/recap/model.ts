import type { RecapSummary } from "../../bungie/activities.js";

/** What the tool hands the model layer: the rolled-up window plus a card title. */
export interface RecapCard {
  title: string;
  summary: RecapSummary;
}

/** One headline figure on the card's stat banner — a big value over a small label. */
export interface RecapStatTile {
  value: string;
  label: string;
}

/** One mode's bar in the breakdown: its run count drives the fill width; clears/time annotate it. */
export interface RecapModeBar {
  mode: string;
  count: number;
  widthPercent: number;
  clears: number;
  duration: string;
}

/** One notable-run line: a label ("Longest", "Best KDR"), the activity, and the figure that earned it. */
export interface RecapNotableLine {
  label: string;
  name: string;
  detail: string;
}

/** The shared shape every recap-card renderer (text, html, images) reads. */
export interface RecapCardModel {
  title: string;
  subtitle: string;
  stats: RecapStatTile[];
  modes: RecapModeBar[];
  notable: RecapNotableLine[];
  pgcrImage?: string;
  empty: boolean;
}

/**
 * Reduce an aggregated window to the display-ready card model — the shared input for the text card
 * and the interactive dashboard alike. Durations become "12h 38m", the headline figures become the
 * four stat tiles, and each mode's run count becomes a bar width relative to the busiest mode.
 *
 * @example
 * {
 *   title: "Activity Recap",
 *   subtitle: "Last 7 days · all",
 *   stats: [{ value: "47", label: "activities" }, { value: "12h 38m", label: "played" }, …],
 *   modes: [{ mode: "Crucible", count: 22, widthPercent: 100, clears: 22, duration: "3h 04m" }, …],
 *   notable: [{ label: "Longest", name: "Vow of the Disciple", detail: "1h 02m" }, …],
 * }
 */
export function recapCardModel(card: RecapCard): RecapCardModel {
  const { summary } = card;
  const busiest = summary.byMode[0]?.count ?? 0;

  return {
    title: card.title,
    subtitle: `${summary.periodLabel} · ${summary.mode ?? "all"}`,
    stats: stats(summary),
    modes: summary.byMode.map((mode) => ({
      mode: mode.mode,
      count: mode.count,
      widthPercent: busiest > 0 ? Math.round((mode.count / busiest) * 100) : 0,
      clears: mode.clears,
      duration: formatDuration(mode.durationSeconds),
    })),
    notable: notable(summary),
    ...(summary.pgcrImage ? { pgcrImage: summary.pgcrImage } : {}),
    empty: summary.totalActivities === 0,
  };
}

function stats(summary: RecapSummary): RecapStatTile[] {
  return [
    { value: String(summary.totalActivities), label: "activities" },
    { value: formatDuration(summary.totalDurationSeconds), label: "played" },
    { value: summary.kdr.toFixed(2), label: "KDR" },
    { value: String(summary.clears), label: "clears" },
  ];
}

function notable(summary: RecapSummary): RecapNotableLine[] {
  const lines: RecapNotableLine[] = [];

  if (summary.notable.longest) {
    lines.push({
      label: "Longest",
      name: summary.notable.longest.name,
      detail: formatDuration(summary.notable.longest.durationSeconds),
    });
  }

  if (summary.notable.bestKdr) {
    lines.push({
      label: "Best KDR",
      name: summary.notable.bestKdr.name,
      detail: summary.notable.bestKdr.kdr.toFixed(2),
    });
  }

  return lines;
}

// Whole-minute precision is plenty for a recap: "12h 38m", "47m", or "0m" for a sub-minute run.
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m`;
}
