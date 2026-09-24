import type { BotClient } from "./xstorybot.ts";

/*
  Bot との通信。初期化で用意した接続（src/lib/xstorybot.ts）を通して action を送る。
  LINE では XStoryBot の LIFF API へ送り、webchat では親の画面が Bot を実行する（src/lib/liff.ts が選ぶ）。
  モック（npm run dev:mock）では、作品のモック（projects/<名前>/mock.ts）が src/mock/ を通して応答する。
*/

let client: BotClient | null = null;

// 接続は同時に1つの操作しか受け付けない（重ねると busy で断る）ので、送る順に1つずつ送る
let queue: Promise<unknown> = Promise.resolve();

/** 初期化で用意した Bot との接続を使う */
export function setBotClient(value: BotClient | null): void {
  client = value;
}

function enqueue<T>(operation: (current: BotClient) => Promise<T>): Promise<T> {
  const run = queue.then(() => {
    if (!client) throw new Error("Botとの接続がありません");
    return operation(client);
  });
  queue = run.catch(() => undefined);
  return run;
}

/**
 * action を送り、シナリオが返した行の配列を受け取る（台詞の行とコマンドの配列の行。データを返す action は1行目に JSON）。
 * 送れなかった時、Bot が受け付けなかった時、応答を確かめられなかった時は、例外を投げる。
 */
export function requestLines(action: string): Promise<unknown[]> {
  return enqueue((current) => current.request(action));
}

/** 利用者の発言としてトークへ送る（webchat ではチャットへ送り、会話の応答まで待つ） */
export function sendText(text: string): Promise<void> {
  return enqueue((current) => current.sendText(text));
}

/** LIFF を閉じる（webchat では、ページを表示している画面を閉じる） */
export function closeWindow(): void {
  client?.close();
}

/** データを返す action の応答の1行目（JSON）を読む */
export function firstLineJson(lines: unknown[]): unknown {
  const [first] = lines;
  if (typeof first !== "string") throw new Error("応答の1行目がありません");
  return JSON.parse(first);
}
