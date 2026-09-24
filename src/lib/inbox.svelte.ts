import { firstLineJson, requestLines } from "./api.ts";
import type { InboxMessage } from "./types.ts";

/** 手紙の一覧の状態 */
class InboxState {
  messages = $state.raw<InboxMessage[] | null>(null);
  isLoading = $state(false);
  error = $state<string | null>(null);
}

export const inbox = new InboxState();

/** sort の降順（sort がなければ 0） */
const sortMessages = (messages: InboxMessage[]) => [...messages].sort((a, b) => (b.sort || 0) - (a.sort || 0));

/** 手紙の形（id と本文の名前がある） */
const isMessage = (value: unknown): value is InboxMessage =>
  typeof value === "object" && value !== null && typeof (value as InboxMessage).id === "string" && typeof (value as InboxMessage).content === "string";

/** 手紙を既読にする（並び順は保つ） */
export function markMessageAsRead(messageId: string): void {
  if (!inbox.messages) return;
  inbox.messages = sortMessages(inbox.messages.map((message) => (message.id === messageId ? { ...message, read: true } : message)));
}

/** 手紙の一覧を取得する */
export async function fetchMessages(): Promise<void> {
  try {
    inbox.isLoading = true;
    inbox.error = null;
    const messages = firstLineJson(await requestLines("get_messages"));
    if (!Array.isArray(messages) || !messages.every(isMessage)) throw new Error("手紙の一覧（get_messages）の形が違います");
    inbox.messages = sortMessages(messages);
    inbox.isLoading = false;
  } catch (error) {
    // 利用者には短く知らせ、原因は開発者向けに残す
    console.error("手紙の一覧を読み込めませんでした:", error);
    inbox.error = "一覧を読み込めませんでした。";
    inbox.isLoading = false;
  }
}
