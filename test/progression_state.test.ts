import { describe, expect, test } from "vitest";
import { objectivePercent, recordStatus } from "../src/bungie/progression.js";

describe("recordStatus", () => {
  test("a zero state is a completed, unredeemed Triumph", () => {
    expect(recordStatus(0)).toStrictEqual({ completed: true, redeemed: false, obscured: false });
  });

  test("the redeemed bit marks a claimed Triumph that is still complete", () => {
    expect(recordStatus(1)).toStrictEqual({ completed: true, redeemed: true, obscured: false });
  });

  test("the ObjectiveNotCompleted bit is what makes a Triumph incomplete", () => {
    expect(recordStatus(4).completed).toBe(false);
  });

  test("an obscured, unfinished Triumph reads every flag from the bitmask", () => {
    // 28 = ObjectiveNotCompleted (4) | Obscured (8) | Invisible (16).
    expect(recordStatus(28)).toStrictEqual({ completed: false, redeemed: false, obscured: true });
  });
});

describe("objectivePercent", () => {
  test("weights by objective size so a tiny step doesn't read as half done", () => {
    const objectives = [
      { progress: 1, total: 500, complete: false },
      { progress: 1, total: 1, complete: true },
    ];

    expect(objectivePercent(objectives)).toBe(0);
  });

  test("averages partial progress across a multi-objective Triumph", () => {
    const objectives = [
      { progress: 50, total: 50, complete: true },
      { progress: 25, total: 25, complete: true },
      { progress: 0, total: 1, complete: false },
    ];

    expect(objectivePercent(objectives)).toBe(99);
  });

  test("clamps overcompleted objectives so progress can't exceed 100%", () => {
    expect(objectivePercent([{ progress: 600, total: 500, complete: true }])).toBe(100);
  });

  test("an objective with no countable total contributes nothing", () => {
    expect(objectivePercent([{ progress: 0, total: 0, complete: false }])).toBe(0);
  });
});
