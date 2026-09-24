/*
  XStoryBot との接続。XStoryBot の LIFF 連携仕様（XStoryBot の docs/liff-webchat-api.md）のうち、ページ側を実装する。
  XStoryBot はページ側の実装を持たないので、仕様が変わった時（とくに protocol の version が上がった時）は、ここを合わせる。
  - LINE: LIFF のアクセストークンを付けて、XStoryBot の LIFF API（<apiBaseUrl>/liff/<bot>/message）へ POST する
  - Webchat: 親の画面（XStoryBot の Webchat）と postMessage でやり取りする（protocol xstorybot-liff、version 1）
  どちらも、同時に1つの操作しか受け付けない（重ねると busy）。待つ時間の上限を過ぎると outcome-unknown にする。
*/

/** 起動パラメータ。Webchat は、登録したページを iframe で開く時に xsb_client=webchat を付ける */
export const LAUNCH_PARAM = "xsb_client";

const PROTOCOL = "xstorybot-liff";
const VERSION = 1;
/**
 * 操作の応答を待つ時間の上限（ミリ秒）。Webchat の画面との接続にも使う
 * （同じ枠で前のページが始めた操作が終わるまで、画面は接続の返事を待たせるため）
 */
const DEFAULT_TIMEOUT = 60_000;

/** 失敗の種類（XStoryBot の取り決めの code） */
export type BotErrorCode = "invalid-input" | "unavailable" | "busy" | "state-refreshed" | "request-failed" | "outcome-unknown" | "closed";

const MESSAGES: Record<BotErrorCode, string> = {
  "invalid-input": "操作の指定が不正です。",
  unavailable: "この環境では利用できません。起動方法や設定を確認してください。",
  busy: "処理中です。完了してから操作してください。",
  "state-refreshed": "別のタブで状態が変わりました。表示を更新して操作を確認してください。",
  "request-failed": "処理に失敗しました。",
  "outcome-unknown": "処理結果を確認できません。操作を繰り返さず、一度閉じて開き直してください。",
  closed: "このページの接続は終了しています。"
};

export class BotClientError extends Error {
  readonly code: BotErrorCode;
  readonly requestId: string | null;

  constructor(code: string, options: { message?: string; requestId?: string | null; cause?: unknown } = {}) {
    const normalized = (Object.hasOwn(MESSAGES, code) ? code : "request-failed") as BotErrorCode;
    super(options.message ?? MESSAGES[normalized], options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "BotClientError";
    this.code = normalized;
    this.requestId = options.requestId ?? null;
  }
}

/** Bot との接続（画面が使う操作） */
export interface BotClient {
  /** action を送り、シナリオが返した行の配列を受け取る（台詞の行とコマンドの配列の行。データを返す action は1行目に JSON） */
  request(action: string): Promise<unknown[]>;
  /** 利用者の発言としてトークへ送る（Webchat ではチャットへ送り、会話の応答まで待つ） */
  sendText(text: string): Promise<void>;
  /** LIFF を閉じる（Webchat では、ページを表示している画面を閉じる） */
  close(): void;
}

/** LINE の LIFF SDK のうち、使う操作（liff.init を済ませたもの） */
export interface LiffSdk {
  getAccessToken(): string | null;
  sendMessages(messages: Array<{ type: "text"; text: string }>): Promise<void>;
  closeWindow(): void;
}

/** LIFF SDK などの失敗を、取り決めの code にする */
function toBotError(error: unknown): BotClientError {
  if (error instanceof BotClientError) return error;
  const { code, status } = (error ?? {}) as { code?: unknown; status?: unknown };
  const unavailable = ["UNAUTHORIZED", "FORBIDDEN", "INIT_FAILED", "401", "403", 401, 403].includes(code as never) || status === 401 || status === 403;
  return new BotClientError(unavailable ? "unavailable" : "request-failed", { cause: error });
}

function requireString(value: unknown): asserts value is string {
  if (typeof value !== "string") throw new BotClientError("invalid-input");
}

/**
 * 同時に1つの操作だけを受け付け、待つ時間の上限で打ち切る。
 * 打ち切っても、Bot での操作を取り消したことにはしない（結果が分からないので outcome-unknown）。
 */
function singleFlight(timeoutMs: number) {
  let pending: object | null = null;
  let closed = false;
  const run = <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    if (closed) return Promise.reject(new BotClientError("closed"));
    if (pending) return Promise.reject(new BotClientError("busy"));
    const current = {};
    pending = current;
    const controller = new AbortController();
    return new Promise<T>((resolve, reject) => {
      const settle = (done: () => void) => {
        if (pending !== current) return;
        pending = null;
        clearTimeout(timer);
        done();
      };
      const timer = setTimeout(() => {
        controller.abort();
        settle(() => reject(new BotClientError("outcome-unknown")));
      }, timeoutMs);
      operation(controller.signal).then(
        (value) => settle(() => resolve(value)),
        (error: unknown) => settle(() => reject(toBotError(error)))
      );
    });
  };
  return {
    run,
    close() {
      closed = true;
    }
  };
}

/** LINE: XStoryBot の LIFF API へ送る */
export function createLineClient(options: { liff: LiffSdk; apiBaseUrl: string; bot: string; timeoutMs?: number }): BotClient {
  const { liff, apiBaseUrl, bot, timeoutMs = DEFAULT_TIMEOUT } = options;
  let base: URL;
  try {
    base = new URL(apiBaseUrl);
  } catch (error) {
    throw new BotClientError("invalid-input", { message: `XStoryBot の API の基点が不正です: ${apiBaseUrl}`, cause: error });
  }
  if (!bot || !["https:", "http:"].includes(base.protocol) || base.search || base.hash) {
    throw new BotClientError("invalid-input", { message: "XStoryBot の API の基点（VITE_API_BASE_URL）と Bot名（VITE_BOT）を確かめてください" });
  }
  const endpoint = `${base.href.replace(/\/+$/u, "")}/liff/${encodeURIComponent(bot)}/message`;
  const { run, close } = singleFlight(timeoutMs);

  return {
    request(action) {
      return run(async (signal) => {
        requireString(action);
        const token = liff.getAccessToken();
        if (!token) throw new BotClientError("unavailable");
        let response: Response;
        let data: { result?: unknown; message?: unknown } | null;
        try {
          response = await fetch(endpoint, {
            method: "POST",
            credentials: "omit",
            signal,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action })
          });
        } catch (error) {
          throw new BotClientError("outcome-unknown", { cause: error });
        }
        if (!response.ok) throw new BotClientError(response.status === 401 || response.status === 403 ? "unavailable" : "request-failed");
        try {
          data = await response.json();
        } catch (error) {
          throw new BotClientError("outcome-unknown", { cause: error });
        }
        // Bot が失敗と答えた時と、成功の形でない時（処理済みかもしれない）を分ける
        if (data?.result === "Failure" || data?.result === "Error") throw new BotClientError("request-failed");
        let lines: unknown;
        try {
          if (data?.result !== "Success" || typeof data.message !== "string") throw new Error("成功の形ではありません");
          lines = JSON.parse(data.message);
        } catch (error) {
          throw new BotClientError("outcome-unknown", { cause: error });
        }
        if (!Array.isArray(lines)) throw new BotClientError("outcome-unknown");
        return lines;
      });
    },
    sendText(text) {
      return run(async () => {
        requireString(text);
        await liff.sendMessages([{ type: "text", text }]);
      });
    },
    close() {
      try {
        liff.closeWindow();
      } catch (error) {
        throw toBotError(error);
      }
      close();
    }
  };
}

/** Webchat の画面とやり取りする窓（テストでは、偽の窓を渡す） */
export interface WebchatHost {
  parent: { postMessage(message: unknown, targetOrigin: string): void };
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

type Envelope = { protocol?: unknown; version?: unknown; type?: unknown; id?: unknown; session?: unknown; ok?: unknown; value?: unknown; error?: { code?: unknown; message?: unknown; requestId?: unknown } };

let nextId = 0;
const identifier = () => `${Date.now()}-${++nextId}-${Math.random().toString(36).slice(2)}`;

/**
 * Webchat: 親の画面（XStoryBot の Webchat）と接続する。
 * 接続先の origin はページの運営者が決めた値だけを使う（URL や受け取ったメッセージからは取らない）。
 * 親から来たメッセージは、親の窓と origin、protocol と version、要求の id と接続の session を確かめてから使う。
 */
export async function connectWebchat(
  options: { parentOrigin: string; timeoutMs?: number },
  host: WebchatHost = window as unknown as WebchatHost
): Promise<BotClient> {
  const { parentOrigin, timeoutMs = DEFAULT_TIMEOUT } = options;
  let origin: string;
  try {
    const url = new URL(parentOrigin);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("http(s) ではありません");
    origin = url.origin;
  } catch (error) {
    throw new BotClientError("invalid-input", { message: `Webchat の画面の origin が不正です: ${parentOrigin}`, cause: error });
  }
  if (origin !== parentOrigin) throw new BotClientError("invalid-input", { message: `Webchat の画面の origin には path を含めないでください: ${parentOrigin}` });
  // iframe の中でなければ、Webchat から開かれていない
  if ((host.parent as unknown) === host) throw new BotClientError("unavailable");

  let session: string | null = null;
  let closed = false;
  let pending: {
    id: string;
    method: "connect" | "request" | "sendText";
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  const post = (type: string, values: Record<string, unknown>) => host.parent.postMessage({ protocol: PROTOCOL, version: VERSION, type, ...values }, parentOrigin);
  const settle = (error: unknown, value?: unknown) => {
    const current = pending;
    if (!current) return;
    pending = null;
    clearTimeout(current.timer);
    if (error) current.reject(error);
    else current.resolve(value);
  };
  const listen = (event: MessageEvent) => {
    const data = event.data as Envelope | null;
    if (closed || !pending || event.source !== host.parent || event.origin !== parentOrigin) return;
    if (data?.protocol !== PROTOCOL || data.version !== VERSION || data.id !== pending.id) return;
    if (pending.method === "connect") {
      if (data.type !== "connected" || typeof data.session !== "string" || !data.session) return;
      session = data.session;
      settle(null);
    } else if (data.type === "result" && data.session === session) {
      if (data.ok === false && typeof data.error?.code === "string") {
        settle(
          new BotClientError(data.error.code, {
            message: typeof data.error.message === "string" ? data.error.message : undefined,
            requestId: typeof data.error.requestId === "string" ? data.error.requestId : null
          })
        );
      } else if (data.ok === true && (pending.method === "request" ? Array.isArray(data.value) : data.value === null)) {
        settle(null, pending.method === "request" ? data.value : undefined);
      } else {
        settle(new BotClientError("outcome-unknown"));
      }
    }
  };
  const call = <T>(method: "connect" | "request" | "sendText", args?: Record<string, unknown>): Promise<T> => {
    if (closed) return Promise.reject(new BotClientError("closed"));
    if (pending) return Promise.reject(new BotClientError("busy"));
    return new Promise<T>((resolve, reject) => {
      const id = identifier();
      pending = {
        id,
        method,
        resolve: resolve as (value: unknown) => void,
        reject,
        timer: setTimeout(() => settle(new BotClientError(method === "connect" ? "unavailable" : "outcome-unknown")), timeoutMs)
      };
      try {
        post(method === "connect" ? "connect" : "invoke", { id, session, method, args });
      } catch (error) {
        settle(new BotClientError("unavailable", { cause: error }));
      }
    });
  };
  /** 接続を終える。close は画面を閉じる通知、disconnect は接続を放すだけ */
  const dispose = (type: "close" | "disconnect") => {
    if (closed) return;
    try {
      if (session) post(type, { session });
    } finally {
      closed = true;
      host.removeEventListener("message", listen);
      settle(new BotClientError("closed"));
    }
  };

  host.addEventListener("message", listen);
  try {
    await call<void>("connect");
  } catch (error) {
    dispose("disconnect");
    throw error;
  }
  return {
    async request(action) {
      requireString(action);
      return call<unknown[]>("request", { action });
    },
    async sendText(text) {
      requireString(text);
      await call<void>("sendText", { text });
    },
    close: () => dispose("close")
  };
}

/**
 * アプリの中の移動先に、起動パラメータを引き継ぐ。今のURLが xsb_client=webchat の時、同じ origin への移動先にだけ付ける
 * （付けないと、移った先が LINE として初期化しようとする）。query と fragment は保つ。
 */
export function withLaunchParams(href: string, currentHref: string = window.location.href): string {
  const current = new URL(currentHref);
  const target = new URL(href, current);
  if (target.origin === current.origin && current.searchParams.get(LAUNCH_PARAM) === "webchat") {
    target.searchParams.set(LAUNCH_PARAM, "webchat");
  }
  return target.href;
}
