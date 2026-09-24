import { firstLineJson, requestLines, setBotClient } from "./api.ts";
import { connectBot } from "./liff.ts";
import type { RoomObject, UserStatus } from "./types.ts";
import { isWordValue } from "./words.ts";

/** アプリ全体の状態（Bot との接続と、get_status で受け取った利用者の状態） */
class AppState {
  error = $state<string | null>(null);
  /** 利用者の状態。書き換える時は、新しいオブジェクトに置き換える（updateUserStatus） */
  userStatus = $state.raw<UserStatus | null>(null);
  /** 初期化が済んだか */
  isInitialized = $state(false);
  /** 初期化の途中か */
  isInitializing = $state(false);
}

export const app = new AppState();

/** 利用者の状態を、新しいオブジェクトに置き換える（状態が無ければ何もしない） */
export function updateUserStatus(update: (status: UserStatus) => UserStatus): void {
  if (app.userStatus) app.userStatus = update(app.userStatus);
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Roomの物の形（オブジェクトで、演出の effect は文字列）。位置や大きさは、描く時に数として読む */
export const isRoomObject = (value: unknown): value is RoomObject =>
  isPlainObject(value) && (value.effect === undefined || value.effect === null || typeof value.effect === "string");

/**
 * get_status の応答の形を確かめる。ページが前提にする形でなければ例外を投げる（エラーの画面を出し、読めない状態で進めない）。
 * 項目が無い（または null の）時は、無いものとして扱う。
 */
export function parseUserStatus(value: unknown): UserStatus {
  if (!isPlainObject(value)) throw new Error("利用者の状態（get_status）がオブジェクトではありません");
  const checks: Array<[string, (item: unknown) => boolean]> = [
    ["event", isPlainObject],
    ["roomObjects", (item) => isPlainObject(item) && Object.values(item).every(isRoomObject)],
    ["words", (item) => isPlainObject(item) && Object.values(item).every(isWordValue)],
    ["missions", (item) => Array.isArray(item) && item.every(isPlainObject)]
  ];
  for (const [key, isValid] of checks) {
    const item = value[key];
    if (item !== undefined && item !== null && !isValid(item)) throw new Error(`利用者の状態（get_status）の ${key} を読めません`);
  }
  return value as UserStatus;
}

/** 初期化する。Bot との接続を用意し（LINE では LIFF の初期化）、利用者の状態（get_status）を取得する */
export async function initialize(): Promise<void> {
  // 既に初期化中または初期化済みなら処理しない
  if (app.isInitializing || app.isInitialized) return;
  app.isInitializing = true;
  app.error = null;

  try {
    const client = await connectBot();

    // 別のページへ移る時（LINEの外で開かれた時の転送、ログイン）は、ここで終える
    if (client === null) {
      app.isInitializing = false;
      return;
    }
    setBotClient(client);

    const status = parseUserStatus(firstLineJson(await requestLines("get_status")));

    app.userStatus = status;
    app.isInitialized = true;
    app.isInitializing = false;
  } catch (error) {
    console.error("初期化できませんでした:", error);
    app.error = error instanceof Error ? error.message : String(error);
    app.isInitializing = false;
  }
}
