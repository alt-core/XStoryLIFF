import { describe, expect, it } from "vitest";
import { convertToADan, getNormalizedInitial, isWordValue, normalizeWordObj, sortWords, toHiragana } from "../src/lib/words.ts";

describe("見出しの文字", () => {
  it("カタカナはひらがなにする", () => {
    expect(toHiragana("カ")).toBe("か");
    expect(toHiragana("ヴ")).toBe("ゔ");
    expect(toHiragana("a")).toBe("a");
  });

  it("濁点を外し、全角の英数字は半角の大文字にする", () => {
    expect(getNormalizedInitial("ガイド")).toBe("か");
    expect(getNormalizedInitial("ｌｉｎｅ")).toBe("L");
    expect(getNormalizedInitial("パン")).toBe("は");
  });

  it("あ段の見出しにまとめる", () => {
    expect(convertToADan("い")).toBe("あ");
    expect(convertToADan("こ")).toBe("か");
    expect(convertToADan("ん")).toBe("わ");
    expect(convertToADan("L")).toBe("英数字");
    expect(convertToADan("漢")).toBe("その他");
    expect(convertToADan("■")).toBe("■");
  });

  it("小書きの仮名は、大きい仮名の行に入れる", () => {
    expect(convertToADan("ぁ")).toBe("あ");
    expect(convertToADan("っ")).toBe("た");
    expect(convertToADan("ゃ")).toBe("や");
    expect(convertToADan("ゎ")).toBe("わ");
  });
});

describe("語の値", () => {
  it("オブジェクトでなければ、キーを表示と読みに使う", () => {
    expect(normalizeWordObj("ランプ", 1)).toEqual({ w: "ランプ", s: "ランプ" });
  });

  it("値の形（オブジェクトなら w・s・f・onclick は文字列、fade は数か数の文字列）", () => {
    for (const value of [1, "月", true, null, { w: "月", s: "つき", f: "moon.png", fade: 0.5, onclick: "look" }, { f: null, fade: "0.5" }]) {
      expect(isWordValue(value), JSON.stringify(value)).toBe(true);
    }
    for (const value of [[1], { s: 1 }, { w: ["月"] }, { f: 1 }, { onclick: {} }, { fade: [] }]) {
      expect(isWordValue(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("表示と読みを指定できる。f が null なら文字で表示する", () => {
    expect(normalizeWordObj("つき", { w: "月", s: "つき", f: null })).toEqual({ w: "月", s: "つき" });
  });
});

describe("並べ方", () => {
  it("読み順に並べ、「■」で始まる語は末尾に置く", () => {
    const items = sortWords({
      "■1": { w: "■■", s: "■1" },
      "ランプ": 1,
      "つき": { w: "月", s: "つき" },
      "LINE": 1,
      "かぎ": 1
    });
    expect(items.map((item) => [item.display, item.firstChar])).toEqual([
      ["LINE", "英数字"],
      ["かぎ", "か"],
      ["月", "た"],
      ["ランプ", "ら"],
      ["■■", "■"]
    ]);
  });
});
