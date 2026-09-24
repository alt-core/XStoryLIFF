/** 標準のページ（Room の "" を除く）。ビルドでは、ページごとの入口（words/index.html など）を書き出す */
export const BUILTIN_ROUTES = ["words", "links", "missions", "messages"];

/**
 * 作品固有のページのファイル（projects/<名前>/pages/ からのpath）から、ページのpathを決める。
 * ディレクトリで入れ子にでき、index.svelte はそのディレクトリのページになる。
 */
export function projectPageRoute(file: string): string {
  return file.replace(/\.svelte$/u, "").replace(/(?:^|\/)index$/u, "");
}
