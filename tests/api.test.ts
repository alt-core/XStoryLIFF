import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Api = typeof import("../src/lib/api.ts");
let api: Api;

beforeEach(async () => {
  vi.resetModules();
  api = await import("../src/lib/api.ts");
});

describe("Botへの送信", () => {
  it("送る順に1つずつ送る（接続は同時に1つしか受け付けない）", async () => {
    let inFlight = 0;
    const order: string[] = [];
    api.setBotClient({
      request: vi.fn(async (action: string) => {
        inFlight += 1;
        if (inFlight > 1) throw new Error("busy");
        await new Promise((resolve) => setTimeout(resolve, action === "slow" ? 20 : 1));
        order.push(action);
        inFlight -= 1;
        return [action];
      }),
      sendText: vi.fn(async (text: string) => {
        order.push(`send:${text}`);
      }),
      close: vi.fn()
    });
    const results = await Promise.all([api.requestLines("slow"), api.sendText("こんにちは"), api.requestLines("fast")]);
    expect(results).toEqual([["slow"], undefined, ["fast"]]);
    expect(order).toEqual(["slow", "send:こんにちは", "fast"]);
  });

  it("失敗しても、次の送信は続けて送る", async () => {
    api.setBotClient({
      request: vi.fn(async (action: string) => {
        if (action === "broken") throw new Error("outcome-unknown");
        return [action];
      }),
      sendText: vi.fn(),
      close: vi.fn()
    });
    await expect(api.requestLines("broken")).rejects.toThrow("outcome-unknown");
    await expect(api.requestLines("next")).resolves.toEqual(["next"]);
  });

  it("接続の前は送らない", async () => {
    await expect(api.requestLines("get_status")).rejects.toThrow("Botとの接続がありません");
  });

  it("データを返す action は、1行目の JSON を読む", () => {
    expect(api.firstLineJson(['{"lv": 1}'])).toEqual({ lv: 1 });
    expect(() => api.firstLineJson([])).toThrow("1行目がありません");
  });
});

describe("起動方法", () => {
  it("xsb_client が無ければ LINE、webchat なら webchat。ほかの値は不正", async () => {
    const { launchMode } = await import("../src/lib/liff.ts");
    expect(launchMode("")).toBe("line");
    expect(launchMode("?xsb_client=line")).toBe("line");
    expect(launchMode("?id=1&xsb_client=webchat")).toBe("webchat");
    expect(() => launchMode("?xsb_client=other")).toThrow("起動方法");
  });

  /** LINE の SDK の代わり。モジュールはテストごとに読み直すので、SDK を読んだかをテストごとに確かめられる */
  function mockLiffSdk() {
    const sdk = { loaded: false, init: vi.fn(async () => {}), isInClient: () => true, isLoggedIn: () => false, login: vi.fn() };
    vi.doMock("@line/liff", () => {
      sdk.loaded = true;
      return { default: sdk };
    });
    window.history.replaceState(null, "", "/");
    return sdk;
  }
  afterEach(() => {
    vi.doUnmock("@line/liff");
    vi.unstubAllEnvs();
  });

  it("LINE では、LINE の SDK で初期化し、未ログインならログインへ進む", async () => {
    const sdk = mockLiffSdk();
    vi.stubEnv("VITE_LIFF_ID", "1234567890-abcdefgh");
    const { connectBot } = await import("../src/lib/liff.ts");
    expect(await connectBot()).toBeNull();
    expect(sdk.loaded).toBe(true);
    expect(sdk.init).toHaveBeenCalledWith({ liffId: "1234567890-abcdefgh" });
    expect(sdk.login).toHaveBeenCalledWith({ redirectUri: window.location.href });
  });

  it("LIFF ID の無いビルド（Webchat だけで使う）を LINE として開くと、LINE の SDK を読まずに止める", async () => {
    const sdk = mockLiffSdk();
    vi.stubEnv("VITE_LIFF_ID", "");
    const { connectBot } = await import("../src/lib/liff.ts");
    await expect(connectBot()).rejects.toThrow("Webchat の中から開いてください");
    expect(sdk.loaded).toBe(false);
  });

  it("webchat で開いている時は、アプリの中のページへのリンクに起動パラメータを引き継ぐ", async () => {
    const { pageHref } = await import("../src/lib/project.ts");
    window.history.replaceState(null, "", "/?xsb_client=webchat");
    expect(new URL(pageHref("/words/")).search).toBe("?xsb_client=webchat");
    expect(new URL(pageHref("/documents/memo/?route=broken")).searchParams.get("route")).toBe("broken");
    // 外部のURLには付けない
    expect(pageHref("https://example.com/")).toBe("https://example.com/");
    window.history.replaceState(null, "", "/");
    expect(new URL(pageHref("/words/")).search).toBe("");
  });
});
