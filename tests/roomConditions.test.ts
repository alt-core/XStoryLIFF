import { describe, expect, it } from "vitest";
import { clampToRoom, compareById, parsePositionConditions, snapPoint } from "../src/components/ui/roomConditions.ts";
import type { RoomObject } from "../src/lib/types.ts";

const objects: Record<string, RoomObject> = {
  star: { f: "star.svg", x: 0.8, y: 0.85, w: 0.075, h: 0.08, id: 6 }
};

describe("condition の条件を読む", () => {
  it("position の条件を読む", () => {
    expect(parsePositionConditions([["position", ["star", 0.17, 0.6, 0.255, 0.71]]], objects)).toEqual([["star", 0.17, 0.6, 0.255, 0.71]]);
  });

  it("範囲は、物の座標と同じく数の文字列も使える", () => {
    expect(parsePositionConditions([["position", ["star", 0.1, "0.2", 0.3, " 0.4 "]]], objects)).toEqual([["star", 0.1, 0.2, 0.3, 0.4]]);
  });

  it("条件が無い・読めない・対象が無い時は、満たしたことにせず例外にする", () => {
    expect(() => parsePositionConditions([], objects)).toThrow("条件がありません");
    expect(() => parsePositionConditions(undefined, objects)).toThrow("条件がありません");
    expect(() => parsePositionConditions([["position", ["star", 0.1, "上", 0.3, 0.4]]], objects)).toThrow("解釈できません");
    expect(() => parsePositionConditions([["position", ["star", 0.1, "", 0.3, 0.4]]], objects)).toThrow("解釈できません");
    expect(() => parsePositionConditions([["position", ["star", 0.1, 0.2, 0.3]]], objects)).toThrow("解釈できません");
    expect(() => parsePositionConditions([["near", ["star", 0.1, 0.2, 0.3, 0.4]]], objects)).toThrow("解釈できません");
    expect(() => parsePositionConditions([["position", ["ghost", 0, 0, 1, 1]]], objects)).toThrow("対象オブジェクトがありません");
  });
});

describe("吸い付く位置", () => {
  const condition = ["star", 0.2, 0.6, 0.3, 0.7] as const;

  it("左上が範囲に入れば（境界を含む）、範囲の中心へ", () => {
    for (const point of [{ x: 0.22, y: 0.61 }, { x: 0.2, y: 0.7 }, { x: 0.3, y: 0.6 }]) {
      const snapped = snapPoint(point, [...condition]);
      expect(snapped?.x).toBeCloseTo(0.25);
      expect(snapped?.y).toBeCloseTo(0.65);
    }
  });

  it("範囲の外なら吸い付かない", () => {
    expect(snapPoint({ x: 0.19, y: 0.65 }, [...condition])).toBeNull();
  });
});

describe("ドラッグの範囲", () => {
  it("物の中心を部屋の中に収める（半分までは外へ出せる）", () => {
    expect(clampToRoom({ x: -0.2, y: 0.99 }, { w: 0.1, h: 0.2 })).toEqual({ x: -0.05, y: 0.9 });
    expect(clampToRoom({ x: 0.3, y: 0.4 }, { w: 0.1, h: 0.2 })).toEqual({ x: 0.3, y: 0.4 });
  });

  it("部屋の端の近くの condition にも届く", () => {
    const point = clampToRoom({ x: 1.2, y: 0.5 }, { w: 0.1, h: 0.1 });
    expect(snapPoint(point, ["star", 0.9, 0.4, 0.96, 0.6])).not.toBeNull();
  });
});

describe("重なり順", () => {
  it("id で比べ、id が無ければ元の順を保つ", () => {
    expect(compareById({ x: 0, y: 0, w: 1, h: 1, id: 2 }, { x: 0, y: 0, w: 1, h: 1, id: 11 })).toBeLessThan(0);
    expect(compareById({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1, id: 11 })).toBe(0);
  });
});
