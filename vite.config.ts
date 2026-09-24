/// <reference types="vitest/config" />
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, loadEnv, type Plugin } from "vite";
import type { ProjectConfig } from "./src/lib/config.ts";
import { BUILTIN_ROUTES, projectPageRoute } from "./src/lib/routes.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

/** 作品固有のページ（projects/<名前>/pages/ の .svelte。ディレクトリで入れ子にできる） */
function projectPages(dir: string, prefix = ""): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // 作品固有のページがなければ何もしない
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.isDirectory()) return projectPages(join(dir, entry.name), `${prefix}${entry.name}/`);
    return entry.name.endsWith(".svelte") ? [projectPageRoute(`${prefix}${entry.name}`)] : [];
  });
}

/** ビルドした index.html を、各ページの入口（words/index.html など）へ複製する。静的ホストで開けるように */
function pageEntries(projectDir: string, projectConfig: ProjectConfig): Plugin {
  let outDir = "dist";
  const routes = [
    ...BUILTIN_ROUTES,
    ...Object.keys(projectConfig.documents).map((id) => `documents/${id}`),
    // 入口の index.html はもともとあるので、ページのpathが空のもの（pages/index.svelte）は除く
    ...projectPages(join(projectDir, "pages")).filter((route) => route !== "")
  ];
  return {
    name: "xstoryliff-page-entries",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      for (const route of routes) {
        const target = join(outDir, route, "index.html");
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(join(outDir, "index.html"), target);
      }
    }
  };
}

export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, root, "");

  // 使う作品（projects/<名前>/）。.env などの XSTORYLIFF_PROJECT で選ぶ（書かなければ同梱のデモ）
  const project = env.XSTORYLIFF_PROJECT || "demo";
  const projectDir = join(root, "projects", project);
  if (!existsSync(join(projectDir, "config.ts"))) {
    throw new Error(`作品の設定 projects/${project}/config.ts がありません（XSTORYLIFF_PROJECT で選んだ作品を確かめてください）`);
  }
  // 作品の設定は TypeScript のまま Node.js で読み込む（Node.js 22.18 以降）
  let projectConfig: ProjectConfig;
  try {
    ({ default: projectConfig } = (await import(pathToFileURL(join(projectDir, "config.ts")).href)) as { default: ProjectConfig });
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_UNKNOWN_FILE_EXTENSION") {
      throw new Error(`作品の設定（TypeScript）を読み込めません。Node.js 22.18 以降を使ってください（今は ${process.version}）`);
    }
    throw error;
  }

  // 公開用のビルドでは、LINE（LIFF ID、Bot の API、Bot名）と webchat（画面のオリジン）の少なくとも一方の設定が要る
  if (command === "build" && mode !== "mock") {
    const line = ["VITE_LIFF_ID", "VITE_API_BASE_URL", "VITE_BOT"];
    const missing = line.filter((name) => !env[name]);
    if (missing.length > 0 && (missing.length < line.length || !env.VITE_WEBCHAT_ORIGIN)) {
      throw new Error(
        `${missing.join("・")} を設定してください（.env.production.local など）。webchat だけで使う場合は VITE_WEBCHAT_ORIGIN だけでかまいません。LINEなしで確かめる場合は npm run build:mock を使います。`
      );
    }
  }

  return {
    // 作品の画像（projects/<名前>/public/）を、配置先の直下に置く
    publicDir: join(projectDir, "public"),
    resolve: {
      alias: {
        // @project は使う作品のフォルダ、@ はエンジン（src/）
        "@project": projectDir,
        "@": join(root, "src")
      }
    },
    plugins: [svelte(), pageEntries(projectDir, projectConfig)],
    test: {
      environment: "happy-dom",
      include: ["tests/**/*.test.ts", "projects/**/*.test.ts"]
    }
  };
});
