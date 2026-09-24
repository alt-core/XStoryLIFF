import { describe, expect, it } from "vitest";
import type { Command } from "@/lib/types.ts";
import config from "./config.ts";
import scenario, { ACTIONS, MESSAGES, ROOM, WORDS } from "./mock.ts";

/* デモの台本（モック）に、書き誤りや行き先の無い action が無いことを確かめる */

/** エンジンとページが受け付けるコマンド */
const KNOWN_COMMANDS = new Set(["message", "wait", "go", "send_chat", "command", "preload", "set_hud", "set", "condition", "disable_click_words"]);

/** 状態を変える action（モックが個別に応答する） */
const STATEFUL_ACTIONS = ["intro_2", "about_key", "touch_jar", "jar_done", "open_letter", "read_news"];

/** 最初の状態で action に応答させる */
const ask = (action: string) => scenario.respond(action, scenario.initialState());

function commandsOf(lines: string[]): Command[] {
  return lines.filter((line) => line.startsWith("[")).flatMap((line) => JSON.parse(line) as Command[]);
}

describe("デモの台本", () => {
  const scripted = [...Object.keys(ACTIONS), ...STATEFUL_ACTIONS];

  it.each(scripted)("%s のコマンドは、エンジンとページが受け付けるもの", (action) => {
    const lines = ask(action);
    expect(lines.length, action).toBeGreaterThan(0);
    for (const [name] of commandsOf(lines)) expect(KNOWN_COMMANDS.has(name), `${action}: ${name}`).toBe(true);
  });

  it("台本から呼ぶ action には、すべて台本がある", () => {
    const referenced = new Set<string>([
      ...Object.values(ROOM).flatMap((object) => (object.onclick ? [object.onclick] : [])),
      ...Object.values(WORDS).flatMap((word) => (word && typeof word === "object" && word.onclick ? [word.onclick] : [])),
      ...config.menu.flatMap((button) => (button.action ? [button.action] : [])),
      ...MESSAGES.flatMap((message) => (message.onopen ? [message.onopen] : []))
    ]);
    for (const action of scripted) {
      for (const [name, target] of commandsOf(ask(action))) {
        if (name === "command" || name === "condition") referenced.add(String(target));
      }
    }
    for (const action of referenced) expect(scripted, action).toContain(action);
  });

  it("台詞を出せないページから呼ぶ action（ことばの onclick、手紙の onopen）には、台詞が無い", () => {
    const fromPagesWithoutBubble = [
      ...Object.values(WORDS).flatMap((word) => (word && typeof word === "object" && word.onclick ? [word.onclick] : [])),
      ...MESSAGES.flatMap((message) => (message.onopen ? [message.onopen] : []))
    ];
    expect(fromPagesWithoutBubble.length).toBeGreaterThan(0);
    for (const action of fromPagesWithoutBubble) {
      for (const line of ask(action)) expect(line.startsWith("["), `${action}: ${line}`).toBe(true);
    }
  });

  it("go の行き先の資料は、設定にある", () => {
    for (const action of scripted) {
      for (const [name, url] of commandsOf(ask(action))) {
        if (name !== "go") continue;
        const target = new URL(String(url), "https://example.com/");
        const [, id] = /^\/documents\/([^/]+)\/$/u.exec(target.pathname) ?? [];
        expect(config.documents[id], String(url)).toBeDefined();
        const route = target.searchParams.get("route");
        if (route) expect(config.documents[id].routes?.[route], String(url)).toBeDefined();
      }
    }
  });

  it("データを返す action は、1行目が JSON", () => {
    const status = JSON.parse(ask("get_status")[0]);
    expect(status).toMatchObject({ lv: 1, event: { intro: 10 } });
    expect(Object.keys(status.roomObjects)).toContain("ruu");
    expect(JSON.parse(ask("get_messages")[0])).toHaveLength(MESSAGES.length);
    expect(ask("message_content:welcome")[0]).toContain("<p>");
  });

  it("状態を変える action は、状態に残す（開き直した時の get_status に出る）", () => {
    const state = scenario.initialState();
    scenario.respond("intro_2", state);
    scenario.respond("about_key", state);
    const status = JSON.parse(scenario.respond("get_status", state)[0]);
    expect(status.event).toEqual({});
    expect(status.menu).toContain("messages");
    expect(status.words["かぎ"]).toEqual({ w: "かぎ", f: "kagi.png" });
  });
});
