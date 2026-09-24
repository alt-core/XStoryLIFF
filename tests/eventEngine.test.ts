import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Command } from "../src/lib/types.ts";

type Engine = typeof import("../src/lib/eventEngine.ts").default;
type App = typeof import("../src/lib/app.svelte.ts").app;

let engine: Engine;
let app: App;
// Botとの接続（src/lib/xstorybot.ts の接続の代わり）。応答はテストごとに決める
let request: Mock<(action: string) => Promise<unknown[]>>;
let sendText: Mock<(text: string) => Promise<void>>;
let replies: Record<string, string[] | Error>;

const commands = (...list: unknown[][]) => JSON.stringify(list);

/** キューの実行が落ち着くまで待つ */
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** 台詞を送る（吹き出しを押す） */
const click = async () => {
  engine.handleMessageClick();
  await settle();
};

/** 新しいエンジン（シングルトン）とストアで始める */
async function setup({ ready = true } = {}) {
  vi.resetModules();
  ({ default: engine } = await import("../src/lib/eventEngine.ts"));
  ({ app } = await import("../src/lib/app.svelte.ts"));
  replies = {};
  request = vi.fn(async (action: string) => {
    const reply = replies[action];
    if (reply instanceof Error) throw reply;
    return reply ?? [];
  });
  sendText = vi.fn(async () => {});
  (await import("../src/lib/api.ts")).setBotClient({ request, sendText, close: vi.fn() });
  app.isInitialized = true;
  app.userStatus = { lv: 1, n_words: 0 };
  engine.messageHost = true;
  if (ready) {
    engine.setInitialCommandsExecuted(true);
    engine.setImagesLoaded(true);
    engine.setFontsLoaded(true);
  }
}

/** set の呼ばれた順を記録するハンドラー（各ページの set の代わり） */
function recordSet(options: { canExecuteBeforeReady?: boolean } = {}) {
  const calls: unknown[][] = [];
  engine.registerCommandHandler("set", (...args: unknown[]) => void calls.push(args), options);
  return calls;
}

/** 止まった時の通知を記録する */
function recordHalt() {
  const halts: Array<{ command: Command; error: unknown }> = [];
  engine.on("halt", (data) => halts.push(data));
  return halts;
}

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  await setup();
});

describe("応答の読み方（parseActions）", () => {
  it("[ で始まる行はコマンドの配列、それ以外は台詞", () => {
    expect(engine.parseActions(["こんばんは", commands(["set", "a", 1], ["wait", 1])])).toEqual([
      ["message", "こんばんは"],
      ["set", "a", 1],
      ["wait", 1]
    ]);
  });

  it("コマンドの配列の形でない行（配列でない要素、平らな配列）は読めない行として扱う", async () => {
    for (const line of ["[null]", '["set","a",1]', "[[1]]", "[[]]"]) {
      expect(() => engine.parseActions([line]), line).toThrow();
    }
    expect(() => engine.parseActions("台詞")).toThrow();
    expect(() => engine.parseActions([1])).toThrow();
    replies.broken = ["[null]"];
    expect(await engine.fetchAndExecuteAction("broken")).toBe(false);
    await settle();
    expect(engine.getState()).toMatchObject({ commandQueue: [], isExecuting: false });
  });

  it("読めない行が1つでもあれば、応答全体を実行しない", async () => {
    const calls = recordSet();
    replies.broken = [commands(["set", "a", 1]), "台詞", "[not json"];
    expect(await engine.fetchAndExecuteAction("broken")).toBe(false);
    await settle();
    expect(calls).toEqual([]);
    expect(engine.getState().commandQueue).toEqual([]);
  });
});

describe("台本の進み方", () => {
  it("台詞は押すまで待ち、押すと次へ進む", async () => {
    replies.talk = ["一", "二"];
    await engine.fetchAndExecuteAction("talk");
    await settle();
    expect(engine.getState()).toMatchObject({ messageVisible: true, currentMessage: "一", waitingForUserInteraction: true });
    await click();
    expect(engine.getState().currentMessage).toBe("二");
    await click();
    expect(engine.getState()).toMatchObject({ messageVisible: false, isExecuting: false, commandQueue: [] });
  });

  it("wait や set の後のコマンドを飛ばさない", async () => {
    const calls = recordSet();
    replies.scene = [commands(["set", "a", 1], ["wait", 0.01], ["set", "b", 2], ["set", "c", 3])];
    await engine.fetchAndExecuteAction("scene");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await settle();
    expect(calls).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });

  it("command の台本は、キューの末尾に加わる", async () => {
    replies.first = [commands(["command", "second"]), "最初の続き"];
    replies.second = ["二番目"];
    await engine.fetchAndExecuteAction("first");
    await settle();
    expect(request).toHaveBeenCalledWith("second");
    expect(engine.getState().currentMessage).toBe("最初の続き");
    await click();
    expect(engine.getState().currentMessage).toBe("二番目");
  });

  it("コマンドの前後に通知する", async () => {
    const before: unknown[] = [];
    const after: unknown[] = [];
    recordSet();
    engine.on("beforeCommandExecute", ({ action, args }) => before.push([action, ...args]));
    engine.on("commandExecuted", ({ action, success }) => after.push([action, success]));
    replies.scene = [commands(["set", "a", 1])];
    await engine.fetchAndExecuteAction("scene");
    await settle();
    expect(before).toEqual([["set", "a", 1]]);
    expect(after).toEqual([["set", true]]);
  });

  it("set_hud はステータス表示の値を変える", async () => {
    replies.status = [commands(["set_hud", "lv", 3], ["set_hud", "n_words", 12])];
    await engine.fetchAndExecuteAction("status");
    await settle();
    expect(app.userStatus).toMatchObject({ lv: 3, n_words: 12 });
  });

  it("set_hud で get_status の形でなくなる値を入れたら、台本を止める", async () => {
    const halts = recordHalt();
    for (const [key, value] of [["words", { a: { s: 1 } }], ["roomObjects", "部屋"], ["missions", {}]] as const) {
      replies.broken = [commands(["set_hud", key, value], ["set_hud", "lv", 9])];
      await engine.fetchAndExecuteAction("broken");
      await settle();
    }
    expect(halts).toHaveLength(3);
    expect(app.userStatus).toEqual({ lv: 1, n_words: 0 });
  });

  it("send_chat はトークへ送る", async () => {
    replies.chat = [commands(["send_chat", "こんにちは"])];
    await engine.fetchAndExecuteAction("chat");
    await settle();
    expect(sendText).toHaveBeenCalledWith("こんにちは");
  });
});

describe("利用者の操作から送る action", () => {
  it("台本の実行中（台詞の表示中を含む）は受け付けない", async () => {
    replies.talk = ["一"];
    replies.tap = ["タップの台本"];
    await engine.fetchAndExecuteAction("talk");
    await settle();
    expect(await engine.sendUserAction("tap")).toBe(false);
    expect(request).not.toHaveBeenCalledWith("tap");
    await click();
    expect(await engine.sendUserAction("tap")).toBe(true);
    await settle();
    expect(engine.getState().currentMessage).toBe("タップの台本");
  });

  it("応答を待つ間の二度押しは、1回だけ送る", async () => {
    replies.tap = [commands(["set_hud", "lv", 2])];
    const [first, second] = await Promise.all([engine.sendUserAction("tap"), engine.sendUserAction("tap")]);
    await settle();
    expect([first, second]).toEqual([true, false]);
    expect(request.mock.calls.filter(([action]) => action === "tap")).toHaveLength(1);
  });

  it("送れなかった時は false（知らせず、次の操作は受け付ける）", async () => {
    replies.tap = new Error("network");
    expect(await engine.sendUserAction("tap")).toBe(false);
    replies.tap = [commands(["set_hud", "lv", 3])];
    expect(await engine.sendUserAction("tap")).toBe(true);
    await settle();
    expect(app.userStatus?.lv).toBe(3);
  });
});

describe("読み込み中の実行", () => {
  beforeEach(async () => {
    await setup({ ready: false });
  });

  it("表示前に実行できるコマンドだけを進め、表示できるようになったら続きを実行する", async () => {
    const calls = recordSet({ canExecuteBeforeReady: true });
    replies.scene = [commands(["set", "a", 1], ["set_hud", "lv", 2]), "台詞", commands(["set", "b", 2])];
    await engine.fetchAndExecuteAction("scene");
    await settle();
    expect(calls).toEqual([["a", 1]]);
    expect(app.userStatus?.lv).toBe(2);
    expect(engine.getState()).toMatchObject({ messageVisible: false, isExecuting: false });

    engine.setInitialCommandsExecuted(true);
    engine.setImagesLoaded(true);
    engine.setFontsLoaded(true);
    await settle();
    expect(engine.getState()).toMatchObject({ isReady: true, currentMessage: "台詞" });
    await click();
    expect(calls).toEqual([["a", 1], ["b", 2]]);
  });

  it("イベント中なら、優先度の最も高いイベントの台本をページ名付きで取り寄せる", async () => {
    app.userStatus = { event: { low: 1, high: 5, middle: 3 } };
    replies["high:room"] = ["ようこそ"];
    const initial = await engine.initialize("room");
    expect(request).toHaveBeenCalledWith("high:room");
    expect(initial).toEqual([["message", "ようこそ"]]);
  });

  it("初期化を終えた時には、表示前に実行できるコマンドを実行し終えている（表示の前に、その画像の読み込みを待てるように）", async () => {
    const calls = recordSet({ canExecuteBeforeReady: true });
    app.userStatus = { event: { intro: 1 } };
    replies["intro:room"] = [commands(["set", "a", 1], ["set", "b", 2], ["set_hud", "lv", 3], ["set", "c", 3]), "台詞"];
    await engine.initialize("room");
    expect(calls).toEqual([["a", 1], ["b", 2], ["c", 3]]);
    expect(app.userStatus?.lv).toBe(3);
    expect(engine.getState()).toMatchObject({ isExecuting: false, messageVisible: false });
  });

  it("イベントの台本を取り寄せられなければ、読み飛ばさずに止めて知らせる", async () => {
    const halts = recordHalt();
    app.userStatus = { event: { intro: 1 } };
    replies["intro:room"] = new Error("network");
    expect(await engine.initialize("room")).toEqual([]);
    expect(halts.map(({ command }) => command)).toEqual([["initialize", "intro:room"]]);
  });

  it("event を読めなければ、でたらめな台本を取り寄せずに止める", async () => {
    for (const event of ["intro", ["intro"], { intro: "高い" }, { intro: null }]) {
      const halts = recordHalt();
      app.userStatus = { event: event as unknown as Record<string, number> };
      expect(await engine.initialize("room"), JSON.stringify(event)).toEqual([]);
      expect(halts.map(({ command }) => command)).toEqual([["initialize", "event"]]);
    }
    expect(request).not.toHaveBeenCalled();
  });

  it("event の優先度は数の文字列も読む", async () => {
    app.userStatus = { event: { low: "1", high: "5" } as unknown as Record<string, number> };
    replies["high:room"] = ["ようこそ"];
    expect(await engine.initialize("room")).toEqual([["message", "ようこそ"]]);
  });

  it("イベントがなければ、何も取り寄せずに初期化を終える", async () => {
    app.userStatus = { event: {} };
    expect(await engine.initialize("room")).toEqual([]);
    expect(request).not.toHaveBeenCalled();
    expect(engine.getState().initialCommandsExecuted).toBe(true);
  });
});

describe("不具合の時は台本を止める", () => {
  it("このページに無いコマンド", async () => {
    const calls = recordSet();
    const halts = recordHalt();
    replies.scene = [commands(["set", "a", 1], ["no_such_command"], ["set", "b", 2]), "続き"];
    await engine.fetchAndExecuteAction("scene");
    await settle();
    expect(calls).toEqual([["a", 1]]);
    expect(halts.map(({ command }) => command)).toEqual([["no_such_command"]]);
    expect(engine.getState()).toMatchObject({ commandQueue: [], isExecuting: false, messageVisible: false, waitingForUserInteraction: false });
  });

  it("ハンドラーの例外", async () => {
    const halts = recordHalt();
    engine.registerCommandHandler("set", () => {
      throw new Error("壊れた値");
    });
    replies.scene = [commands(["set", "a", 1]), "続き"];
    await engine.fetchAndExecuteAction("scene");
    await settle();
    expect(halts).toHaveLength(1);
    expect(engine.getState()).toMatchObject({ commandQueue: [], messageVisible: false });
  });

  it("台詞を出す場所の無いページの message", async () => {
    engine.messageHost = false;
    const halts = recordHalt();
    replies.scene = ["台詞", commands(["set_hud", "lv", 9])];
    await engine.fetchAndExecuteAction("scene");
    await settle();
    expect(halts.map(({ command }) => command)).toEqual([["message", "台詞"]]);
    expect(app.userStatus?.lv).toBe(1);
  });

  it("command の台本を取り寄せられない（続きの台本も実行しない）", async () => {
    const halts = recordHalt();
    replies.first = [commands(["command", "second"], ["set_hud", "lv", 9])];
    replies.second = new Error("network");
    await engine.fetchAndExecuteAction("first");
    await settle();
    expect(halts.map(({ command }) => command)).toEqual([["command", "second"]]);
    expect(app.userStatus?.lv).toBe(1);
    expect(engine.getState().commandQueue).toEqual([]);
  });

  it("引数の誤り（行き先の無い go、読めない wait、文字列でない send_chat、項目名の無い set_hud）", async () => {
    const cases: unknown[][] = [["go"], ["wait", "すこし"], ["wait", ""], ["wait", -1], ["send_chat", { text: "こんにちは" }], ["set_hud", "", 3]];
    for (const command of cases) {
      const halts = recordHalt();
      replies.scene = [commands(command, ["set_hud", "lv", 9])];
      await engine.fetchAndExecuteAction("scene");
      await settle();
      expect(halts.map(({ command }) => command), JSON.stringify(command)).toEqual([command]);
    }
    expect(sendText).not.toHaveBeenCalled();
    expect(app.userStatus?.lv).toBe(1);
  });

  it("wait は数の文字列も読む", async () => {
    const halts = recordHalt();
    replies.scene = [commands(["wait", "0.01"], ["set_hud", "lv", 2])];
    await engine.fetchAndExecuteAction("scene");
    await new Promise((resolve) => setTimeout(resolve, 30));
    await settle();
    expect(halts).toEqual([]);
    expect(app.userStatus?.lv).toBe(2);
  });

  it("止めた時は、表示中の台詞も片付ける", async () => {
    recordHalt();
    replies.talk = ["台詞"];
    await engine.fetchAndExecuteAction("talk");
    await settle();
    expect(engine.getState().messageVisible).toBe(true);
    engine.halt(["condition", "solved"], new Error("通信の失敗"));
    expect(engine.getState()).toMatchObject({ messageVisible: false, currentMessage: null, commandQueue: [] });
  });

  it("止める前に始まったコマンドが後から終わっても、止めた後の台本に触れない", async () => {
    const calls = recordSet();
    recordHalt();
    replies.old = [commands(["wait", 0.03], ["set", "old", 1])];
    replies.fresh = [commands(["set", "b", 2], ["wait", 0.15], ["set", "c", 3])];
    await engine.fetchAndExecuteAction("old");
    await settle();
    engine.halt(["condition", "solved"], new Error("通信の失敗"));
    await engine.fetchAndExecuteAction("fresh");
    // 止める前の wait が終わっても、新しい台本の wait を飛ばして先へ進めない
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(calls).toEqual([["b", 2]]);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await settle();
    expect(calls).toEqual([["b", 2], ["c", 3]]);
  });

  it("止める前に送った command の応答が後から届いても、実行しない", async () => {
    const halts = recordHalt();
    let release: () => void = () => {};
    request.mockImplementation(async (action: string) => {
      if (action === "second") await new Promise<void>((resolve) => (release = resolve));
      return action === "first" ? [commands(["command", "second"])] : [commands(["set_hud", "lv", 9], ["command", "third"])];
    });
    await engine.fetchAndExecuteAction("first");
    await settle();
    engine.halt(["on_message_read", "letter"], new Error("通信の失敗"));
    release();
    await settle();
    expect(app.userStatus?.lv).toBe(1);
    expect(request).not.toHaveBeenCalledWith("third");
    expect(halts).toHaveLength(1);
    expect(engine.getState()).toMatchObject({ commandQueue: [], isExecuting: false });
  });

  it("go の後ろの台本は実行しない。path と http(s) のURLだけを開く", async () => {
    const halts = recordHalt();
    replies.scene = [commands(["go", "#next"], ["set_hud", "lv", 9])];
    await engine.fetchAndExecuteAction("scene");
    await settle();
    expect(halts).toEqual([]);
    expect(app.userStatus?.lv).toBe(1);
    expect(engine.getState()).toMatchObject({ commandQueue: [], isExecuting: false });

    replies.unsafe = [commands(["go", "javascript:alert(1)"])];
    await engine.fetchAndExecuteAction("unsafe");
    await settle();
    expect(halts.map(({ command }) => command)).toEqual([["go", "javascript:alert(1)"]]);
  });

  it("go でほかのページへ移り始めたら、移り終わるまで action を送らない（同じページの中の # なら受け付ける）", async () => {
    replies.anchor = [commands(["go", "#next"])];
    replies.leave = [commands(["go", "/documents/memo/"])];
    replies.tap = [commands(["set_hud", "lv", 2])];
    await engine.fetchAndExecuteAction("anchor");
    await settle();
    expect(await engine.sendUserAction("tap")).toBe(true);
    await settle();
    await engine.fetchAndExecuteAction("leave");
    await settle();
    request.mockClear();
    expect(await engine.sendUserAction("tap")).toBe(false);
    expect(await engine.fetchAndExecuteAction("tap")).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("止まった後も、新しい台本は実行できる（開き直さなくても次の操作は受け付ける）", async () => {
    recordHalt();
    replies.broken = [commands(["no_such_command"])];
    replies.talk = ["こんばんは"];
    await engine.fetchAndExecuteAction("broken");
    await settle();
    await engine.fetchAndExecuteAction("talk");
    await settle();
    expect(engine.getState().currentMessage).toBe("こんばんは");
  });
});
