import type { RoomObject } from "../../lib/types.ts";
import { toNumber } from "../../lib/values.ts";

/** condition の位置の条件 [オブジェクト名, x1, y1, x2, y2] */
export type PositionCondition = [key: string, x1: number, y1: number, x2: number, y2: number];

export interface Point {
  x: number;
  y: number;
}

/**
 * condition の条件 `[["position", [key, x1, y1, x2, y2]], ...]` を読む。
 * 条件が空、読めない条件がある、対象のオブジェクトが無い時は、例外を投げて台本を止める（満たしたことにはしない）。
 */
export function parsePositionConditions(conditions: unknown, objects: Record<string, RoomObject>): PositionCondition[] {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new Error(`condition の条件がありません: ${JSON.stringify(conditions)}`);
  }
  return conditions.map((condition): PositionCondition => {
    if (Array.isArray(condition) && condition[0] === "position" && Array.isArray(condition[1])) {
      const [key, ...values] = condition[1] as unknown[];
      const [x1, y1, x2, y2] = values.slice(0, 4).map(toNumber);
      if (typeof key === "string" && [x1, y1, x2, y2].every((value) => Number.isFinite(value))) {
        if (!objects[key]) throw new Error(`condition の対象オブジェクトがありません: ${key}`);
        return [key, x1, y1, x2, y2];
      }
    }
    throw new Error(`condition の条件を解釈できません: ${JSON.stringify(condition)}`);
  });
}

/** オブジェクトの左上が範囲に入っていれば（境界を含む）、範囲の中心へ吸い付く位置を返す */
export function snapPoint(point: Point, [, x1, y1, x2, y2]: PositionCondition): Point | null {
  if (point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2) return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  return null;
}

/**
 * ドラッグしたオブジェクトの中心を、部屋の中に収める（画面の外へ出して、取り戻せなくならないように）。
 * 物の半分までは部屋の外へ出せるので、部屋の端の近くの condition にも届く。
 */
export function clampToRoom(point: Point, object: Pick<RoomObject, "w" | "h">): Point {
  const w = toNumber(object.w) || 0;
  const h = toNumber(object.h) || 0;
  const clamp = (value: number, size: number) => Math.min(Math.max(value, -size / 2), 1 - size / 2);
  return { x: clamp(point.x, w), y: clamp(point.y, h) };
}

/** 重なり順（id で比べ、id が無ければ同じ順位として元の順を保つ） */
export function compareById(a: RoomObject, b: RoomObject): number {
  const difference = (a.id as number) - (b.id as number);
  return Number.isNaN(difference) ? 0 : difference;
}
