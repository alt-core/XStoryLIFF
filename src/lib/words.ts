import type { WordObject, WordValue } from "./types.ts";

/* ことば帳の語の整え方と見出し */

// カタカナをひらがなに変換する（Unicodeのオフセットは0x60）
export function toHiragana(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 0x30a1 && code <= 0x30f6) return String.fromCharCode(code - 0x60);
  return char;
}

// 小書きの仮名は、大きい仮名の行に入れる（文字コードの大小だけで比べると、ぁ・ゃ・ゎ などが別の行に入るため）
const SMALL_KANA: Record<string, string> = {
  "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お", "っ": "つ", "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "ゎ": "わ", "ゕ": "か", "ゖ": "け"
};

// あいうえお は あ に、かきくけこ は か に...
const aDanList = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"];

export function convertToADan(char: string): string {
  if (char === "■") return "■";
  const kana = SMALL_KANA[char] ?? char;
  let result = "英数字";
  for (const aDan of aDanList) {
    if (kana < aDan) continue;
    result = aDan;
  }
  if (kana <= "ん") return result;
  return "その他";
}

// 単語の最初の文字を正規化して返す（全角/半角、ひらがな/カタカナ、濁点などの違いを吸収）
export function getNormalizedInitial(word: string): string {
  // NFKD正規化で全角英数字や記号を半角に統一（濁点を除去するためにNFKCではなくNFKDを使用）
  const normalized = word.normalize("NFKD");
  // 最初の文字を取得し、カタカナはひらがなに変換
  return toHiragana(normalized.charAt(0)).toUpperCase();
}

export type NormalizedWord = WordObject & { w: string; s: string };

const optional = (value: unknown, type: "string" | "number") => value === undefined || value === null || typeof value === type;

/** ことばの値の形（オブジェクトなら、w・s・f・onclick は文字列、fade は数か数の文字列）。読めない値で一覧を描けなくならないよう、先に確かめる */
export function isWordValue(value: unknown): value is WordValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const { w, s, f, fade, onclick } = value as Record<string, unknown>;
  return optional(w, "string") && optional(s, "string") && optional(f, "string") && optional(onclick, "string") && (optional(fade, "number") || typeof fade === "string");
}

// ワードオブジェクトを正規化する
export function normalizeWordObj(key: string, value: WordValue | undefined, existingEntry: WordValue = {}): NormalizedWord {
  // 新しいワードオブジェクトを作成（null やオブジェクト以外なら空）
  const wordObj: WordObject = value && typeof value === "object" ? { ...value } : {};
  const existing: WordObject = existingEntry && typeof existingEntry === "object" ? existingEntry : {};

  // w（display）が無い場合は、既存の w または key をデフォルト値として設定
  if (!wordObj.w) wordObj.w = existing.w || key;

  // s（sortKey）が無い場合は、既存の s または key をデフォルト値として設定
  if (!wordObj.s) wordObj.s = existing.s || key;

  // f が null の場合は、f プロパティを削除（文字列表示にフォールバック）
  if (wordObj.f === null) delete wordObj.f;

  return wordObj as NormalizedWord;
}

export interface WordItem {
  key: string;
  display: string;
  sortKey: string;
  wordObj: NormalizedWord;
  /** 見出し（あ・か・…、英数字、その他、■） */
  firstChar: string;
}

/** 読み順に並べ、見出しを付ける。「■」で始まる語は末尾 */
export function sortWords(words: Record<string, WordValue>): WordItem[] {
  const parsed = Object.keys(words).map((key) => {
    const wordObj = normalizeWordObj(key, words[key]);
    return { key, display: wordObj.w, sortKey: wordObj.s, wordObj, firstChar: "" };
  });

  const sorted = [...parsed].sort((a, b) => {
    const aUnknown = a.sortKey.startsWith("■");
    const bUnknown = b.sortKey.startsWith("■");
    if (aUnknown && !bUnknown) return 1;
    if (!aUnknown && bUnknown) return -1;
    return a.sortKey.localeCompare(b.sortKey, "ja-JP", { sensitivity: "base", ignorePunctuation: true });
  });

  for (const item of sorted) item.firstChar = convertToADan(getNormalizedInitial(item.sortKey));
  return sorted;
}
