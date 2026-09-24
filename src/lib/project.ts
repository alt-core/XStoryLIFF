import projectConfig from "@project/config.ts";
import { DEFAULT_IMAGES, type SkinImages } from "./config.ts";
import { withLaunchParams } from "./xstorybot.ts";

export const config = projectConfig;

/** 配置先のpath（サブパスに置いた場合は /works/story/ など） */
const BASE = import.meta.env.BASE_URL;

/** `/` で始まるpathを配置先に合わせる。URLや相対pathはそのまま */
export function withBase(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return `${BASE}${path.slice(1)}`;
}

/**
 * アプリの中のページへのリンク。`/` で始まるpathは配置先に合わせ、webchat で開いている時は起動パラメータ（xsb_client）を引き継ぐ
 * （引き継がないと、移った先が LINE として初期化しようとする）。
 */
export function pageHref(path: string): string {
  return withLaunchParams(withBase(path));
}

/** 画面を作る画像のURL。作品の設定になければ、既定の置き場所（作品の public/skin/ の決まった名前） */
export function skinImage(name: keyof SkinImages): string {
  return withBase(config.images?.[name] ?? DEFAULT_IMAGES[name]);
}

/** Botのデータが指す画像のURL（<dataDir>/<種類>/<ファイル名>） */
export function dataImage(kind: string, file: string): string {
  const dir = (config.dataDir ?? "/data").replace(/\/+$/u, "");
  return withBase(`${dir}/${kind}/${file}`);
}

/** Roomの額縁の大きさ（既定はデモの額縁の 1034×934、太さ 17） */
export const room = config.room ?? { frameWidth: 1034, frameHeight: 934, border: 17 };
