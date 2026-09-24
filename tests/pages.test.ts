import { describe, expect, it, vi } from "vitest";
import { BUILTIN_ROUTES } from "../src/lib/routes.ts";
import { resolvePage, routeOf } from "../src/pages.ts";

// 作品の設定（デモの値）に頼らず、資料が1つだけある作品として確かめる
vi.mock("@project/config.ts", () => ({
  default: {
    title: "作品",
    font: { family: "sans-serif" },
    titles: { room: "部屋", words: "ことば", links: "リンク", missions: "ミッション", messages: "手紙" },
    menu: [],
    links: [],
    documents: { note: { title: "資料", image: "note.png", routes: { broken: "heavyNoise" } } }
  }
}));

describe("URL からページを決める", () => {
  it("配置先（base）と index.html を除く", () => {
    expect(routeOf("/", "/")).toBe("");
    expect(routeOf("/index.html", "/")).toBe("");
    expect(routeOf("/words/", "/")).toBe("words");
    expect(routeOf("/words/index.html", "/")).toBe("words");
    expect(routeOf("/documents/note/", "/")).toBe("documents/note");
    expect(routeOf("/liff/missions/", "/liff/")).toBe("missions");
    expect(routeOf("/documents/%E3%83%A1%E3%83%A2/", "/")).toBe("documents/メモ");
  });

  it("標準のページがある（ビルドで入口を書き出すページと同じ）", async () => {
    for (const route of ["", ...BUILTIN_ROUTES]) {
      const page = await resolvePage(route);
      expect(page?.component, route).toBeTypeOf("function");
      expect(page?.skipInitialization).toBe(false);
    }
  });

  it("資料のページは documents/<id>（?route= は設定にある見せ方だけ）", async () => {
    expect((await resolvePage("documents/note", ""))?.props).toEqual({ id: "note" });
    expect((await resolvePage("documents/note", "?route=broken"))?.props).toEqual({ id: "note" });
    // 書き誤った見せ方で、素の資料を見せない
    expect(await resolvePage("documents/note", "?route=brokn")).toBeNull();
  });

  it("無いページ", async () => {
    expect(await resolvePage("nothing")).toBeNull();
    expect(await resolvePage("documents/a/b")).toBeNull();
    // 設定に無い資料
    expect(await resolvePage("documents/nothing")).toBeNull();
    // Object の持ち物の名前（ページの表の項目ではない）
    for (const route of ["constructor", "toString", "__proto__", "hasOwnProperty"]) expect(await resolvePage(route), route).toBeNull();
  });
});
