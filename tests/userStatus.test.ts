import { describe, expect, it } from "vitest";
import { parseUserStatus } from "../src/lib/app.svelte.ts";

describe("利用者の状態（get_status）の形", () => {
  it("ページが前提にする形なら、そのまま受け取る（無い項目や null の項目は、無いものとして扱う）", () => {
    const status = { event: {}, lv: 1, roomObjects: { a: { x: 0, y: 0, w: 1, h: 1 } }, words: {}, missions: [{ id: 1 }], menu: ["words"], extra: "自由" };
    expect(parseUserStatus(status)).toBe(status);
    expect(parseUserStatus({ words: null })).toEqual({ words: null });
  });

  it("形が違えば例外にする（エラーの画面を出し、読めない状態で進めない）", () => {
    expect(() => parseUserStatus([])).toThrow("オブジェクトではありません");
    expect(() => parseUserStatus({ missions: {} })).toThrow("missions");
    expect(() => parseUserStatus({ missions: [1] })).toThrow("missions");
    expect(() => parseUserStatus({ roomObjects: { a: "a.svg" } })).toThrow("roomObjects");
    expect(() => parseUserStatus({ words: ["つき"] })).toThrow("words");
    expect(() => parseUserStatus({ event: "intro" })).toThrow("event");
  });

  it("物とことばの値も確かめる（物の effect、ことばの w・s・f・onclick は文字列）", () => {
    expect(parseUserStatus({ roomObjects: { a: { x: 0, y: 0, w: 1, h: 1, effect: "glow,scale" } }, words: { a: 1, b: null, c: { w: "月", s: "つき", f: null, fade: "0.5" } } })).toBeTruthy();
    expect(() => parseUserStatus({ roomObjects: { a: { x: 0, y: 0, w: 1, h: 1, effect: ["glow"] } } })).toThrow("roomObjects");
    expect(() => parseUserStatus({ words: { a: { w: "月", s: 1 } } })).toThrow("words");
    expect(() => parseUserStatus({ words: { a: { w: ["月"] } } })).toThrow("words");
    expect(() => parseUserStatus({ words: { a: { onclick: 5 } } })).toThrow("words");
    expect(() => parseUserStatus({ words: { a: [1] } })).toThrow("words");
  });
});
