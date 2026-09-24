import type { Component } from "svelte";
import { config } from "./lib/project.ts";
import { projectPageRoute } from "./lib/routes.ts";

/**
 * ページ。path からページのコンポーネントを決める。
 * ページのモジュールが `skipInitialization = true` を書き出していれば、Botとの接続（LIFFの初期化など）をせずに表示する。
 */
type PageModule = { default: Component<any>; skipInitialization?: boolean };

export interface ResolvedPage {
  component: Component<any>;
  props: Record<string, unknown>;
  skipInitialization: boolean;
}

/** 標準のページ（キーは src/lib/routes.ts の BUILTIN_ROUTES と Room の ""） */
const BUILTIN: Record<string, () => Promise<PageModule>> = {
  "": () => import("./components/screens/MainScene.svelte"),
  words: () => import("./components/screens/WordList.svelte"),
  links: () => import("./components/screens/LinkList.svelte"),
  missions: () => import("./components/screens/MissionList.svelte"),
  messages: () => import("./components/screens/MessageList.svelte")
};

// 作品固有のページ（projects/<名前>/pages/<path>.svelte → /<path>/）
const PROJECT = Object.fromEntries(
  Object.entries(import.meta.glob<PageModule>("@project/pages/**/*.svelte")).map(([file, load]) => [
    projectPageRoute(file.slice(file.indexOf("/pages/") + "/pages/".length)),
    load
  ])
);

/** 配置先（base）を除いた path（先頭と末尾の / と index.html を除く） */
export function routeOf(pathname: string, base: string = import.meta.env.BASE_URL): string {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\/+/u, "");
  return decodeURIComponent(rest.replace(/(?:^|\/)index\.html$/u, "").replace(/^\/+|\/+$/gu, ""));
}

/** ページを決める。無いページは null（search は URL の ?… で、資料の見せ方の確かめに使う） */
export async function resolvePage(route: string, search: string = window.location.search): Promise<ResolvedPage | null> {
  // ページの表は自分の項目だけを引く（/constructor/ などの path で、Object の持ち物を引かない）
  const project = Object.hasOwn(PROJECT, route) ? PROJECT[route] : undefined;
  if (project) {
    const module = await project();
    return { component: module.default, props: {}, skipInitialization: module.skipInitialization === true };
  }
  const builtin = Object.hasOwn(BUILTIN, route) ? BUILTIN[route] : undefined;
  if (builtin) {
    const module = await builtin();
    return { component: module.default, props: {}, skipInitialization: module.skipInitialization === true };
  }
  // 資料のページ。設定に無い資料と、設定に無い見せ方（?route= の書き誤り）は、素の資料を見せずに、無いページとして扱う
  const match = /^documents\/([^/]+)$/u.exec(route);
  if (match && Object.hasOwn(config.documents, match[1])) {
    const routeName = new URLSearchParams(search).get("route");
    if (routeName && !Object.hasOwn(config.documents[match[1]].routes ?? {}, routeName)) return null;
    const module = await import("./components/screens/DocumentScreen.svelte");
    return { component: module.default, props: { id: match[1] }, skipInitialization: false };
  }
  return null;
}
