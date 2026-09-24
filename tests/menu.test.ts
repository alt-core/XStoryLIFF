import { describe, expect, it } from "vitest";
import type { MenuButton } from "../src/lib/config.ts";
import { menuEntries } from "../src/lib/menu.ts";

const buttons: MenuButton[] = [
  { id: "missions", image: "/skin/buttons/button_missions.png", href: "/missions/" },
  { id: "words", image: "/skin/buttons/button_words.png", href: "/words/" },
  { id: "door", image: "/skin/buttons/button_door.png", action: "open_door" }
];

const ids = (entries: ReturnType<typeof menuEntries>) => entries.map(({ button, revealed }) => `${button.id}${revealed ? "*" : ""}`);

describe("メニューに出すボタン", () => {
  it("Bot が menu で返したIDのボタンを、設定の順に出す", () => {
    expect(ids(menuEntries(buttons, { menu: ["words", "missions"] }))).toEqual(["missions", "words"]);
  });

  it("menu が無い・配列でない時は、何も出さない", () => {
    expect(menuEntries(buttons, {})).toEqual([]);
    expect(menuEntries(buttons, null)).toEqual([]);
    expect(menuEntries(buttons, { menu: "missions,words" as unknown as string[] })).toEqual([]);
  });

  it("台本で visible を set したボタンは、menu に無くても演出付きで出す", () => {
    const status = { menu: ["missions"], roomObjects: { door: { visible: true, x: 0, y: 0, w: 0, h: 0 } } };
    expect(ids(menuEntries(buttons, status))).toEqual(["missions", "door*"]);
  });
});
