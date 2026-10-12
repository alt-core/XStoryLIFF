import { afterEach, describe, expect, it, vi } from "vitest";
import { BotClientError, connectWebchat, createLineClient, withLaunchParams, type WebchatHost } from "../src/lib/xstorybot.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LINE: XStoryBot の LIFF API へ送る", () => {
  const liff = () => ({ getIDToken: vi.fn(() => "id-token"), sendMessages: vi.fn(async () => {}), closeWindow: vi.fn() });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("IDトークンを付けて <基点>/liff/<Bot名>/message へ送り、行の配列を返す", async () => {
    const fetchStub = vi.fn(async () => reply({ code: 200, result: "Success", message: JSON.stringify(["台詞", "[]"]) }));
    vi.stubGlobal("fetch", fetchStub);
    const client = createLineClient({ liff: liff(), apiBaseUrl: "https://bot.example.com/", bot: "story" });
    expect(await client.request("get_status")).toEqual(["台詞", "[]"]);
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://bot.example.com/liff/story/message");
    expect(init.headers).toMatchObject({ Authorization: "Bearer id-token" });
    expect(init.body).toBe(JSON.stringify({ action: "get_status" }));
  });

  it("要求ごとにSDKのIDトークンを取得し、SDKが同じ値を返す場合も送る", async () => {
    const sdk = liff();
    sdk.getIDToken.mockReturnValueOnce("first-id-token").mockReturnValue("next-id-token");
    const fetchStub = vi.fn(async () => reply({ result: "Success", message: "[]" }));
    vi.stubGlobal("fetch", fetchStub);
    const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story" });
    for (const action of ["first", "next", "cached"]) await client.request(action);
    expect(sdk.getIDToken).toHaveBeenCalledTimes(3);
    expect(fetchStub.mock.calls.map((call) => (call as unknown as [string, RequestInit])[1].headers)).toEqual([
      { "Content-Type": "application/json", Authorization: "Bearer first-id-token" },
      { "Content-Type": "application/json", Authorization: "Bearer next-id-token" },
      { "Content-Type": "application/json", Authorization: "Bearer next-id-token" }
    ]);
  });

  it("IDトークンが無い時とSDKの取得失敗時は、APIを呼ばず認証情報を含まない案内を返す", async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
    const secret = "artificial-token-and-claims";
    for (const getIDToken of [() => null, () => { throw new Error(secret); }]) {
      const sdk = { ...liff(), getIDToken, getAccessToken: vi.fn(() => "unused-access-token") };
      const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story" });
      const error = await client.request("get_status").catch((value: unknown) => value);
      expect(error).toBeInstanceOf(BotClientError);
      expect(error).toMatchObject({ code: "unavailable", message: "LINEの認証情報を取得できません。画面を開き直してください。" });
      expect((error as Error).cause).toBeUndefined();
      expect(String(error)).not.toContain(secret);
      expect((error as Error).stack).not.toContain(secret);
      expect(sdk.getAccessToken).not.toHaveBeenCalled();
      expect(sdk.closeWindow).toHaveBeenCalledTimes(1);
      await expect(client.request("again")).rejects.toMatchObject({ code: "closed" });
    }
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("LINE通信や応答の例外・認証エラー本文を画面とログ用の例外に含めない", async () => {
    const secret = "artificial-id-token-and-private-claims";
    const responses = [
      () => Promise.reject(new Error(secret)),
      async () => ({ ok: true, json: async () => { throw new Error(secret); } }),
      async () => reply({ result: "Success", message: secret }),
      async () => reply({ result: "Failure", message: secret }, 401)
    ];
    for (const response of responses) {
      vi.stubGlobal("fetch", vi.fn(response));
      const client = createLineClient({ liff: liff(), apiBaseUrl: "https://bot.example.com", bot: "story" });
      const error = await client.request("get_status").catch((value: unknown) => value);
      expect(error).toBeInstanceOf(BotClientError);
      expect((error as Error).cause).toBeUndefined();
      expect(String(error)).not.toContain(secret);
      expect((error as Error).stack).not.toContain(secret);
      expect(JSON.stringify(error)).not.toContain(secret);
    }
  });

  it("APIの401では接続を閉じ、閉じる操作が失敗しても元の認証失敗を返す", async () => {
    const secret = "artificial-close-error-token";
    for (const failsToClose of [false, true]) {
      const sdk = liff();
      if (failsToClose) sdk.closeWindow.mockImplementation(() => { throw new Error(secret); });
      const fetchStub = vi.fn(async () => reply({ message: secret }, 401));
      vi.stubGlobal("fetch", fetchStub);
      const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story" });
      const error = await client.request("get_status").catch((value: unknown) => value);
      expect(error).toMatchObject({ code: "unavailable", message: "LINEの認証情報を取得できません。画面を開き直してください。" });
      expect((error as Error).cause).toBeUndefined();
      expect(String(error)).not.toContain(secret);
      expect(sdk.closeWindow).toHaveBeenCalledTimes(1);
      await expect(client.request("again")).rejects.toMatchObject({ code: "closed" });
      await expect(client.sendText("again")).rejects.toMatchObject({ code: "closed" });
      expect(fetchStub).toHaveBeenCalledTimes(1);
      expect(sdk.sendMessages).not.toHaveBeenCalled();
    }
  });

  it("sendTextではSDKが明示した認証失敗だけで接続を閉じる", async () => {
    const secret = "artificial-sdk-token-and-claims";
    const cases: Array<[Record<string, unknown>, boolean]> = [
      [{ code: "UNAUTHORIZED" }, true], [{ code: "401" }, true], [{ code: 401 }, true], [{ status: 401 }, true],
      [{ code: "FORBIDDEN" }, false], [{ code: "403" }, false], [{ status: 403 }, false], [{ code: "INIT_FAILED" }, false], [{}, false]
    ];
    for (const [error, authenticationFailed] of cases) {
      const sdk = liff();
      sdk.sendMessages.mockRejectedValue(Object.assign(new Error(secret), error));
      const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story" });
      const failure = await client.sendText("hello").catch((value: unknown) => value);
      expect(sdk.closeWindow).toHaveBeenCalledTimes(authenticationFailed ? 1 : 0);
      if (authenticationFailed) {
        expect(failure).toMatchObject({ code: "unavailable", message: "LINEの認証情報を取得できません。画面を開き直してください。" });
        expect((failure as Error).cause).toBeUndefined();
        expect(String(failure)).not.toContain(secret);
        await expect(client.request("again")).rejects.toMatchObject({ code: "closed" });
      }
      expect(sdk.sendMessages).toHaveBeenCalledTimes(1);
    }
  });

  it("時間切れの後に届いた古い401で、新しい操作を閉じない", async () => {
    vi.useFakeTimers();
    const sdk = liff();
    const replies: Array<(response: Response) => void> = [];
    const fetchStub = vi.fn(() => new Promise<Response>((resolve) => replies.push(resolve)));
    vi.stubGlobal("fetch", fetchStub);
    const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story", timeoutMs: 1000 });
    const first = expect(client.request("slow")).rejects.toMatchObject({ code: "outcome-unknown" });
    await vi.advanceTimersByTimeAsync(1000);
    await first;
    const next = client.request("next");
    replies[0](reply({}, 401));
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.closeWindow).not.toHaveBeenCalled();
    replies[1](reply({ result: "Success", message: '["next"]' }));
    expect(await next).toEqual(["next"]);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("sendTextの時間切れの後に届いた認証失敗でも、新しい操作を閉じない", async () => {
    vi.useFakeTimers();
    const sdk = liff();
    let rejectSend!: (error: unknown) => void;
    sdk.sendMessages.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectSend = reject; }));
    vi.stubGlobal("fetch", vi.fn(async () => reply({ result: "Success", message: '["next"]' })));
    const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story", timeoutMs: 1000 });
    const first = expect(client.sendText("slow")).rejects.toMatchObject({ code: "outcome-unknown" });
    await vi.advanceTimersByTimeAsync(1000);
    await first;
    rejectSend({ code: "UNAUTHORIZED" });
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.closeWindow).not.toHaveBeenCalled();
    expect(await client.request("next")).toEqual(["next"]);
    expect(sdk.sendMessages).toHaveBeenCalledTimes(1);
  });

  it("入力の誤りではAPIやSDKを呼ばず、接続も閉じない", async () => {
    const sdk = liff();
    const fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
    const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story" });
    await expect(client.request(1 as unknown as string)).rejects.toMatchObject({ code: "invalid-input" });
    await expect(client.sendText(null as unknown as string)).rejects.toMatchObject({ code: "invalid-input" });
    expect(fetchStub).not.toHaveBeenCalled();
    expect(sdk.sendMessages).not.toHaveBeenCalled();
    expect(sdk.closeWindow).not.toHaveBeenCalled();
  });

  it("失敗の種類を分ける（Botの失敗、認証、結果が分からない）", async () => {
    const cases: Array<[Response | Error, string]> = [
      [reply({ result: "Failure" }), "request-failed"],
      [reply({}, 401), "unavailable"],
      [reply({}, 403), "unavailable"],
      [reply({}, 500), "request-failed"],
      [new Response("<html>"), "outcome-unknown"],
      [reply({ result: "Success", message: "{}" }), "outcome-unknown"],
      [new TypeError("network"), "outcome-unknown"]
    ];
    for (const [result, code] of cases) {
      vi.stubGlobal("fetch", vi.fn(async () => (result instanceof Error ? Promise.reject(result) : result)));
      const sdk = liff();
      const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story" });
      await expect(client.request("get_status"), code).rejects.toMatchObject({ code });
      expect(sdk.closeWindow).toHaveBeenCalledTimes(result instanceof Response && result.status === 401 ? 1 : 0);
    }
  });

  it("応答が返らなければ、待つ時間の上限で結果が分からないものとして打ち切る", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))));
    const sdk = liff();
    const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story", timeoutMs: 1000 });
    const pending = client.request("get_status");
    const settled = expect(pending).rejects.toMatchObject({ code: "outcome-unknown" });
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
    expect(sdk.closeWindow).not.toHaveBeenCalled();
  });

  it("同時に2つは送らない（busy）。トークへの送信と閉じる操作は LIFF SDK で行う", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const sdk = liff();
    const client = createLineClient({ liff: sdk, apiBaseUrl: "https://bot.example.com", bot: "story" });
    // 応答の返らない要求（待つ時間の上限で失敗するので、受け取っておく）
    client.request("slow").catch(() => {});
    await expect(client.request("next")).rejects.toMatchObject({ code: "busy" });
    expect(sdk.closeWindow).not.toHaveBeenCalled();
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
