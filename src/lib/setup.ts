import type eventEngine from "./eventEngine.ts";

/**
 * 作品の準備（projects/<名前>/setup.ts の default）。ページを開く前に一度だけ呼ぶ。
 * 全ページで使うコマンドの登録（engine.registerCommandHandler）や、エンジンのイベントの受け取り（engine.on）に使う。
 */
export type ProjectSetup = (engine: typeof eventEngine) => void;

/** 作品の準備を書く（型を付けるため） */
export function defineProjectSetup(setup: ProjectSetup): ProjectSetup {
  return setup;
}
