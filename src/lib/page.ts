import { onMount } from "svelte";
import { app } from "./app.svelte.ts";
import eventEngine from "./eventEngine.ts";
import imageLoader from "./imageLoader.ts";

type Unregister = () => void;

export interface PageOptions {
  /** ページ名（イベント台本は `<イベント名>:<ページ名>` で取得する） */
  pageName: string;
  /** ページ固有のデータを準備する */
  preparePageData?: () => Promise<void>;
  /** 画像を登録する */
  registerImages?: (loader: typeof imageLoader) => void;
  /** コマンドのハンドラーを登録し、登録を解除する関数を返す */
  registerHandlers?: (engine: typeof eventEngine) => Unregister | Unregister[] | void;
  /** 表示の前に画像の読み込みを待つか（既定 true） */
  waitForImages?: boolean;
}

/**
 * ページの初期化。コンポーネントの初期化中に呼ぶ。
 * データ準備 → 画像登録 → ハンドラー登録 → イベント台本の取得と表示前のコマンドの実行 → 画像の読み込み待ち の順に進める。
 * 表示できるようになった時に何かをするなら、eventEngine.on("ready", ...) を使う。
 */
export function initPage({
  pageName,
  preparePageData,
  registerImages = () => {},
  registerHandlers = () => {},
  waitForImages = true
}: PageOptions): void {
  onMount(() => {
    // 初期化されていない場合は処理しない（skipInitialization のページ）
    if (!app.isInitialized) return;

    let unregisterFunctions: unknown[] = [];
    // データの準備を待つ間にページが閉じられたら、ハンドラーを登録しない（Svelte で後から登録すると、解除されずに残るため）
    let active = true;

    const initializeComponent = async () => {
      try {
        // ページ固有のデータ準備（オプション）
        if (preparePageData) await preparePageData();
        if (!active) return;

        // 画像の登録
        registerImages(imageLoader);

        // ハンドラーの登録
        const registered = registerHandlers(eventEngine) ?? [];
        unregisterFunctions = Array.isArray(registered) ? registered : [registered];

        // eventEngineの初期化（ページ名を指定）。表示前に実行できるコマンドを実行し終えてから戻る
        await eventEngine.initialize(pageName);

        if (!waitForImages) {
          // 画像のロードを待たない場合は即時完了
          eventEngine.setImagesLoaded(true);
        } else {
          // 画像のロード完了を監視（表示前のコマンドが加えた画像も待つ）
          imageLoader.onAllLoaded(() => eventEngine.setImagesLoaded(true));
        }
      } catch (error) {
        // イベントの台本を取り寄せないまま、黙って表示しない（台本を止めて、開き直すよう知らせる）
        eventEngine.halt(["initialize", pageName], error);
        // 読み込み画面のままにはしない
        eventEngine.setInitialCommandsExecuted(true);
        eventEngine.setImagesLoaded(true);
      }
    };

    void initializeComponent();

    return () => {
      active = false;
      // 登録解除関数があれば実行
      for (const unregister of unregisterFunctions) {
        if (typeof unregister === "function") unregister();
      }
    };
  });
}
