import { mount } from "svelte";
import App from "./App.svelte";
import eventEngine from "./lib/eventEngine.ts";
import type { ProjectSetup } from "./lib/setup.ts";
import "./styles/globals.css";
import "@project/skin.css";

// 作品の準備（projects/<名前>/setup.ts があれば、全ページで使うコマンドなどを登録する）
for (const module of Object.values(import.meta.glob<{ default: ProjectSetup }>("@project/setup.ts", { eager: true }))) {
  module.default(eventEngine);
}

mount(App, { target: document.getElementById("app")! });
