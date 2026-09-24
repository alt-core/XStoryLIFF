import { connectWebchat, createLineClient, LAUNCH_PARAM, type BotClient } from "./xstorybot.ts";

/**
 * 起動方法。XStoryBot の起動パラメータ xsb_client で決める（無ければ LINE）。
 * webchat は、登録したページを iframe で開く時に xsb_client=webchat を付ける。iframe の中かどうかでは推測しない。
 */
export function launchMode(search: string = window.location.search): "line" | "webchat" {
  const value = new URLSearchParams(search).get(LAUNCH_PARAM);
  if (value === null || value === "line") return "line";
  if (value === "webchat") return "webchat";
  throw new Error(`起動方法（xsb_client）が不正です: ${value}`);
}

/**
 * Bot との接続を用意する。
 * - LINE: LIFF を初期化する。LINEアプリの外で開かれて転送先があれば転送し、未ログインならログインへ進む（どちらも null を返す）
 * - webchat: 親の画面（XStoryBot の Webchat）と接続する。LINE の SDK は読み込まない
 * - モック（npm run dev:mock）: LINE と Bot の代わり
 */
export async function connectBot(): Promise<BotClient | null> {
  if (import.meta.env.MODE === "mock") {
    const { createMockClient } = await import("../mock/liff.ts");
    return createMockClient();
  }
  if (launchMode() === "webchat") {
    const parentOrigin = import.meta.env.VITE_WEBCHAT_ORIGIN;
    if (!parentOrigin) throw new Error("webchat の画面のオリジン（VITE_WEBCHAT_ORIGIN）が設定されていません");
    return connectWebchat({ parentOrigin });
  }

  const { default: liff } = await import("@line/liff");
  await liff.init({ liffId: import.meta.env.VITE_LIFF_ID ?? "" });

  // LINEアプリ内で開かれていない場合の処理
  if (!liff.isInClient() && import.meta.env.VITE_FORWARD_URL) {
    window.location.href = import.meta.env.VITE_FORWARD_URL;
    return null;
  }

  if (!liff.isLoggedIn()) {
    // ログインした後は、開いていたページへ戻る（指定しないと、エンドポイントURLへ戻る）
    liff.login({ redirectUri: window.location.href });
    return null;
  }

  return createLineClient({
    liff,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
    bot: import.meta.env.VITE_BOT ?? ""
  });
}
