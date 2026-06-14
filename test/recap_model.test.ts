import { describe, expect, test } from "vitest";
import type { RecapSummary } from "../src/bungie/activities.js";
import { formatDuration, recapCardModel, type RecapCard } from "../src/format/recap/model.js";

function summary(overrides: Partial<RecapSummary> = {}): RecapSummary {
  return {
    periodLabel: "Last 7 days",
    totalActivities: 47,
    totalDurationSeconds: 45480,
    totalKills: 1600,
    totalDeaths: 500,
    totalAssists: 300,
    kdr: 3.2,
    clears: 18,
    byMode: [
      { mode: "Crucible", count: 22, clears: 22, durationSeconds: 11040 },
      { mode: "Strike", count: 11, clears: 11, durationSeconds: 7260 },
      { mode: "Raid", count: 7, clears: 3, durationSeconds: 18000 },
    ],
    notable: {
      longest: { name: "Vow of the Disciple", mode: "Raid", durationSeconds: 3720 },
      bestKdr: { name: "Rumble", mode: "Crucible", kdr: 6.4 },
    },
    ...overrides,
  };
}

function card(overrides: Partial<RecapSummary> = {}): RecapCard {
  return { title: "Activity Recap", summary: summary(overrides) };
}

describe("recapCardModel subtitle", () => {
  test("reads 'all' when no mode filter is set", () => {
    expect(recapCardModel(card()).subtitle).toBe("Last 7 days · all");
  });

  test("names the mode filter when present", () => {
    expect(recapCardModel(card({ mode: "raid" })).subtitle).toBe("Last 7 days · raid");
  });
});

describe("recapCardModel stats", () => {
  test("the four headline tiles read activities, time, KDR, clears", () => {
    const model = recapCardModel(card());

    expect(model.stats).toEqual([
      { value: "47", label: "activities" },
      { value: "12h 38m", label: "played" },
      { value: "3.20", label: "KDR" },
      { value: "18", label: "clears" },
    ]);
  });
});

describe("recapCardModel modes", () => {
  test("scales each bar width to the busiest mode and keeps input order", () => {
    const model = recapCardModel(card());

    expect(model.modes.map((mode) => [mode.mode, mode.widthPercent])).toEqual([
      ["Crucible", 100],
      ["Strike", 50],
      ["Raid", 32],
    ]);
  });
});

describe("recapCardModel notable", () => {
  test("formats the longest run's duration and the best KDR", () => {
    const model = recapCardModel(card());

    expect(model.notable).toEqual([
      { label: "Longest", name: "Vow of the Disciple", detail: "1h 02m" },
      { label: "Best KDR", name: "Rumble", detail: "6.40" },
    ]);
  });
});

describe("recapCardModel empty window", () => {
  test("flags empty when no activities and emits no mode bars", () => {
    const model = recapCardModel(
      card({ totalActivities: 0, byMode: [], notable: {}, clears: 0, kdr: 0 }),
    );

    expect(model.empty).toBe(true);
    expect(model.modes).toEqual([]);
  });
});

describe("formatDuration", () => {
  test("shows hours and zero-padded minutes past an hour", () => {
    expect(formatDuration(3720)).toBe("1h 02m");
  });

  test("shows only minutes under an hour", () => {
    expect(formatDuration(480)).toBe("8m");
  });

  test("rounds a sub-minute run to 0m", () => {
    expect(formatDuration(20)).toBe("0m");
  });
});
