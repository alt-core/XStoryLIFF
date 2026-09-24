import { notify } from "../lib/notices.svelte.ts";
import { BotClientError, type BotClient } from "../lib/xstorybot.ts";
import { mockRequest } from "./bot.ts";

/**
 * LINE と Bot の代わり（src/lib/xstorybot.ts の接続と同じ形）。
 * 本物と同じく、同時に1つの操作しか受け付けない（重ねると busy）。トークへの送信と閉じる操作は、画面下のお知らせで代わりに表示する。
 */
export function createMockClient(): BotClient {
  let pending = false;
  const run = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (pending) throw new BotClientError("busy");
    pending = true;
    try {
      return await operation();
    } finally {
      pending = false;
    }
  };
  return {
    request: (action) => run(() => mockRequest(action)),
    sendText: (text) =>
      run(async () => {
        notify(`トークルームへ送信：「${text}」`);
      }),
    close() {
      notify("（ここでLIFFが閉じます）");
    }
  };
}
