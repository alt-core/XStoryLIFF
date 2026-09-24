import { config } from "./project.ts";

/**
 * ページのタイトル。各ページが設定する。
 * 読み込み中は App が「Loading...」を出し、ページを描いたらこのタイトルにする。
 */
class PageTitle {
  current = $state(config.title);
}

export const pageTitle = new PageTitle();
