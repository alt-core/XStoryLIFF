/*
  台本やBotのデータの値の読み方。読めない値は、素通りさせずに不具合として扱えるようにする。
*/

/** 数、または "0.5" のような数の文字列を数にする。読めなければ NaN */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

/** 空でない文字列か確かめる。書き誤りを素通りさせず、台本を止めるため */
export function requireString(value: unknown, what: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${what}がありません: ${JSON.stringify(value)}`);
  return value;
}
