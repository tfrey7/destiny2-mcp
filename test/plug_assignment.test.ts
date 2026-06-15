import { describe, expect, test } from "vitest";
import { greedyAssign } from "../src/bungie/sockets.js";

const indexes = (accept: number[][], plugs: number[]) =>
  greedyAssign(accept, plugs).map((a) => a.socketIndex);

describe("greedyAssign", () => {
  test("each ability plug lands in its own dedicated socket", () => {
    // super → socket 0, grenade → 1, melee → 2 (each socket accepts only its own ability).
    const accept = [[100], [200], [300]];

    expect(indexes(accept, [100, 200, 300])).toEqual([0, 1, 2]);
  });

  test("two aspects sharing one plug set fill two distinct sockets", () => {
    // Both aspect sockets (0, 1) accept either aspect; the second aspect must not collide on socket 0.
    const aspectSet = [10, 11, 12];
    const accept = [aspectSet, aspectSet];

    expect(indexes(accept, [11, 12])).toEqual([0, 1]);
  });

  test("several fragments sharing one plug set spread across the fragment sockets", () => {
    const fragSet = [20, 21, 22, 23];
    const accept = [fragSet, fragSet, fragSet];

    expect(indexes(accept, [20, 21, 22])).toEqual([0, 1, 2]);
  });

  test("two of the same mod fill two general-mod sockets", () => {
    const generalMods = [50, 51];
    const accept = [generalMods, generalMods];

    expect(indexes(accept, [50, 50])).toEqual([0, 1]);
  });

  test("a plug no socket accepts resolves to undefined without consuming a socket", () => {
    const accept = [
      [10, 11],
      [10, 11],
    ];

    // 999 fits nowhere; the two real aspects still claim both sockets.
    expect(indexes(accept, [999, 10, 11])).toEqual([undefined, 0, 1]);
  });

  test("more plugs than sockets leaves the overflow unassigned", () => {
    const aspectSet = [10, 11, 12];
    const accept = [aspectSet, aspectSet];

    expect(indexes(accept, [10, 11, 12])).toEqual([0, 1, undefined]);
  });

  test("input order is preserved in the returned assignments", () => {
    const accept = [[1], [2], [3]];

    expect(greedyAssign(accept, [3, 1, 2])).toEqual([
      { plugItemHash: 3, socketIndex: 2 },
      { plugItemHash: 1, socketIndex: 0 },
      { plugItemHash: 2, socketIndex: 1 },
    ]);
  });
});
