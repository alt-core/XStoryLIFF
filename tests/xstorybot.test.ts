import { afterEach, describe, expect, it, vi } from "vitest";
import { BotClientError, connectWebchat, createLineClient, withLaunchParams, type WebchatHost } from "../src/lib/xstorybot.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LINE: XStoryBot の LIFF API へ送る", () => {
  const liff = () => ({ getAccessToken: vi.fn(() => "token"), sendMessages: vi.fn(async () => {}), closeWindow: vi.fn() });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("アクセストークンを付けて <基点>/liff/<Bot名>/message へ送り、行の配列を返す", async () => {
    const fetchStub = vi.fn(async () => reply({ code: 200, result: "Success", message: JSON.stringify(["台詞", "[]"]) }));
    vi.stubGlobal("fetch", fetchStub);
    const client = createLineClient({ liff: liff(), apiBaseUrl: "https://bot.example.com/", bot: "story" });
    expect(await client.request("get_status")).toEqual(["台詞", "[]"]);
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://bot.example.com/liff/story/message");
    expect(init.headers).toMatchObject({ Authorization: "Bearer token" });
    expect(init.body).toBe(JSON.stringify({ action: "get_status" }));
  });

  it("失敗の種類を分ける（Botの失敗、認証、結果が分からない）", async () => {
    const cases: Array<[Response | Error, string]> = [
      [reply({ result: "Failure" }), "request-failed"],
      [reply({}, 401), "unavailable"],
      [reply({}, 500), "request-failed"],
      [new Response("<html>"), "outcome-unknown"],
      [reply({ result: "Success", message: "{}" }), "outcome-unknown"],
      [new TypeError("network"), "outcome-unknown"]
    ];
    for (const [result, code] of cases) {
      vi.stubGlobal("fetch", vi.fn(async () => (result instanceof Error ? Promise.reject(result) : result)));
      const client = createLineClient({ liff: liff(), apiBaseUrl: "https://bot.example.com", bot: "story" });
      await expect(client.request("get_status"), code).rejects.toMatchObject({ code });
    }
  });

  it("応答が返らなければ、待つ時間の上限で結果が分からないものとして打ち切る", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))));
    const client = createLineClient({ liff: liff(), apiBaseUrl: "https://bot.example.com", bot: "story", timeoutMs: 1000 });
    const pending = client.request("get_status");
    const settled = expect(pending).rejects.toMatchObject({ code: "outcome-unknown" });
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("同時に2つは送らない（busy）。トークへの送信と閉じる操作は LIFF SDK で行う", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const sdk = liff();
    const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story" });
    // 応答の返らない要求（待つ時間の上限で失敗するので、受け取っておく）
    client.request("slow").catch(() => {});
    await expect(client.request("next")).rejects.toMatchObject({ code: "busy" });
    const other = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story" });
    await other.sendText("こんにちは");
    expect(sdk.sendMessages).toHaveBeenCalledWith([{ type: "text", text: "こんにちは" }]);
    other.close();
    expect(sdk.closeWindow).toHaveBeenCalled();
  });
});

describe("Webchat: 親の画面と postMessage でやり取りする", () => {
  const ORIGIN = "https://chat.example.com";

  /** 偽の窓。親へ送ったメッセージを記録し、親からの返事を届ける */
  function fakeHost() {
    const listeners = new Set<(event: MessageEvent) => void>();
    const posted: Array<{ message: Record<string, unknown>; origin: string }> = [];
    const parent = { postMessage: (message: unknown, origin: string) => void posted.push({ message: message as Record<string, unknown>, origin }) };
    const host: WebchatHost = {
      parent,
      addEventListener: (_type, listener) => void listeners.add(listener),
      removeEventListener: (_type, listener) => void listeners.delete(listener)
    };
    const deliver = (data: Record<string, unknown>, options: { origin?: string; source?: unknown } = {}) => {
      const event = { data: { protocol: "xstorybot-liff", version: 1, ...data }, origin: options.origin ?? ORIGIN, source: options.source ?? parent } as unknown as MessageEvent;
      for (const listener of [...listeners]) listener(event);
    };
    const last = () => posted[posted.length - 1].message;
    return { host, posted, deliver, last, listeners };
  }

  async function connected(timeoutMs?: number) {
    const fake = fakeHost();
    const connecting = connectWebchat({ parentOrigin: ORIGIN, timeoutMs }, fake.host);
    expect(fake.last()).toMatchObject({ protocol: "xstorybot-liff", version: 1, type: "connect" });
    fake.deliver({ type: "connected", id: fake.last().id, session: "s1" });
    return { ...fake, client: await connecting };
  }

  it("接続し、action を送って、親が返した行の配列を受け取る", async () => {
    const { client, last, deliver, posted } = await connected();
    const pending = client.request("get_status");
    expect(last()).toMatchObject({ type: "invoke", session: "s1", method: "request", args: { action: "get_status" } });
    expect(posted.every(({ origin }) => origin === ORIGIN)).toBe(true);
    deliver({ type: "result", id: last().id, session: "s1", ok: true, value: ['{"lv":1}'] });
    expect(await pending).toEqual(['{"lv":1}']);
  });

  it("親の失敗は、その code と文言のまま受け取る", async () => {
    const { client, last, deliver } = await connected();
    const pending = client.request("tap");
    deliver({ type: "result", id: last().id, session: "s1", ok: false, error: { code: "state-refreshed", message: "別のタブで変わりました", requestId: "r1" } });
    await expect(pending).rejects.toMatchObject({ code: "state-refreshed", message: "別のタブで変わりました", requestId: "r1" });
  });

  it("親の窓と origin、要求の id、接続の session が違う返事は使わない", async () => {
    vi.useFakeTimers();
    const { client, last, deliver } = await connected(1000);
    const pending = client.request("tap");
    const id = last().id;
    const settled = expect(pending).rejects.toMatchObject({ code: "outcome-unknown" });
    deliver({ type: "result", id, session: "s1", ok: true, value: ["偽の origin"] }, { origin: "https://evil.example.com" });
    deliver({ type: "result", id, session: "s1", ok: true, value: ["偽の窓"] }, { source: {} });
    deliver({ type: "result", id: "other", session: "s1", ok: true, value: ["別の要求"] });
    deliver({ type: "result", id, session: "old", ok: true, value: ["古い接続"] });
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("同時に2つは送らない。トークへの送信は null で成功を返し、閉じる時は親へ知らせる", async () => {
    const { client, last, deliver, listeners } = await connected();
    const sending = client.sendText("こんにちは");
    await expect(client.request("tap")).rejects.toMatchObject({ code: "busy" });
    expect(last()).toMatchObject({ type: "invoke", method: "sendText", args: { text: "こんにちは" } });
    deliver({ type: "result", id: last().id, session: "s1", ok: true, value: null });
    await expect(sending).resolves.toBeUndefined();
    client.close();
    expect(last()).toMatchObject({ type: "close", session: "s1" });
    expect(listeners.size).toBe(0);
    await expect(client.request("tap")).rejects.toMatchObject({ code: "closed" });
  });

  it("iframe の中でない、親が答えない、origin に path がある時は接続しない", async () => {
    // 親が自分自身の窓（iframe の外で開いた）
    const top: Record<string, unknown> = { addEventListener: vi.fn(), removeEventListener: vi.fn(), postMessage: vi.fn() };
    top.parent = top;
    await expect(connectWebchat({ parentOrigin: ORIGIN }, top as unknown as WebchatHost)).rejects.toMatchObject({ code: "unavailable" });
    await expect(connectWebchat({ parentOrigin: `${ORIGIN}/chat` }, fakeHost().host)).rejects.toBeInstanceOf(BotClientError);
    vi.useFakeTimers();
    const silent = connectWebchat({ parentOrigin: ORIGIN, timeoutMs: 1000 }, fakeHost().host);
    const settled = expect(silent).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("親が前のページの操作の完了まで接続の返事を待たせても、操作と同じ時間まで待つ", async () => {
    vi.useFakeTimers();
    const fake = fakeHost();
    const connecting = connectWebchat({ parentOrigin: ORIGIN }, fake.host);
    await vi.advanceTimersByTimeAsync(30_000);
    fake.deliver({ type: "connected", id: fake.last().id, session: "s1" });
    const client = await connecting;
    void client.request("get_status");
    expect(fake.last()).toMatchObject({ type: "invoke", session: "s1", method: "request" });
  });
});

describe("起動パラメータの引き継ぎ", () => {
  it("webchat で開いている時だけ、同じ origin の移動先に xsb_client=webchat を付ける", () => {
    const current = "https://liff.example.com/?xsb_client=webchat";
    expect(withLaunchParams("/words/?id=1#top", current)).toBe("https://liff.example.com/words/?id=1&xsb_client=webchat#top");
    expect(withLaunchParams("../documents/memo/", "https://liff.example.com/messages/?xsb_client=webchat")).toBe("https://liff.example.com/documents/memo/?xsb_client=webchat");
    expect(withLaunchParams("https://example.com/", current)).toBe("https://example.com/");
    expect(withLaunchParams("/words/", "https://liff.example.com/")).toBe("https://liff.example.com/words/");
  });
});
