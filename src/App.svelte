<script lang="ts">
  import { onMount, type Component } from "svelte";
  import ErrorScreen from "./components/ErrorScreen.svelte";
  import LoadingScreen from "./components/LoadingScreen.svelte";
  import Notices from "./components/Notices.svelte";
  import { app, initialize } from "./lib/app.svelte.ts";
  import { engineState } from "./lib/engineState.svelte.ts";
  import eventEngine from "./lib/eventEngine.ts";
  import { loadStoryFont } from "./lib/fontLoader.ts";
  import { notify } from "./lib/notices.svelte.ts";
  import { config } from "./lib/project.ts";
  import { pageTitle } from "./lib/title.svelte.ts";
  import { resolvePage, routeOf } from "./pages.ts";

  /* アプリの枠。ページを決め、Botとの接続（LINE では LIFF の初期化）と画像・書体の読み込みを待ってから表示する */

  let Page = $state<Component<any> | null>(null);
  let pageProps = $state<Record<string, unknown>>({});
  let skipInitialization = $state(false);
  let resolved = $state(false);
  let missing = $state(false);

  const error = $derived(app.error);
  const isInitialized = $derived(app.isInitialized);
  const isInitializing = $derived(app.isInitializing);
  // ローディング状態の判定（初期化スキップページでは常にfalse）
  const isLoading = $derived(
    !resolved || (!skipInitialization && (isInitializing || !isInitialized || !engineState.current.isReady || !engineState.current.fontsLoaded))
  );

  onMount(() => {
    // 作品の書体を使えるようにし、読み込みを待つ
    document.documentElement.style.setProperty("--xl-story-font", `"${config.font.family}", sans-serif`);
    void loadStoryFont(config.font.family, config.font.cssUrl).then(() => eventEngine.setFontsLoaded(true));

    // 不具合で台本を止めた時は、開き直すよう知らせる
    const offHalt = eventEngine.on("halt", ({ error: cause }: { error: unknown }) => {
      notify("物語をうまく進められませんでした。時間をおいて、開き直してください。");
      if (import.meta.env.DEV) notify(`台本を止めました: ${cause instanceof Error ? cause.message : String(cause)}`, 8000);
    });

    void (async () => {
      let page;
      try {
        page = await resolvePage(routeOf(window.location.pathname));
      } catch (cause) {
        // ページのファイルを読み込めない（通信の失敗や、公開し直した後の古い画面など）
        console.error("ページを読み込めませんでした:", cause);
        app.error = "ページを読み込めませんでした。";
        resolved = true;
        return;
      }
      if (page) {
        Page = page.component;
        pageProps = page.props;
        skipInitialization = page.skipInitialization;
      } else {
        missing = true;
      }
      resolved = true;
      // 初期化をスキップするページでない場合のみ初期化
      if (!skipInitialization) await initialize();
      if (missing) {
        // 無いページでは、読み込み画面のままにせず「ページが見つかりません」を出す
        eventEngine.setInitialCommandsExecuted(true);
        eventEngine.setImagesLoaded(true);
      }
    })();

    return offHalt;
  });

  /* ページのタイトル。読み込み中は「Loading...」、ページを描いた時点で、読み込み画面の間もページのタイトルにする */
  const pageRendered = $derived(Page !== null && (skipInitialization || (!error && isInitialized)));
  $effect(() => {
    document.title = isLoading && !pageRendered ? "Loading..." : pageTitle.current;
  });
</script>

{#if skipInitialization && Page}
  <!-- 初期化をスキップするページは直接レンダリング -->
  <Page {...pageProps} />
{:else if error}
  <!-- エラー画面（最優先で表示） -->
  <ErrorScreen {error} />
{:else}
  <!-- メインコンテンツ -->
  <div class="app-content" class:app-content--loading={isLoading}>
    {#if isInitialized}
      {#if Page}
        <Page {...pageProps} />
      {:else if missing}
        <p class="app-missing">ページが見つかりません。</p>
      {/if}
    {/if}
  </div>
  <!-- ローディング画面 -->
  {#if isLoading}<LoadingScreen />{/if}
{/if}
<Notices />

<style>
  .app-content {
    position: relative;
    width: 100%;
    background: var(--background);
    opacity: 1;
    transition: opacity 0.05s ease-in-out;
    will-change: opacity;
  }

  .app-content--loading {
    position: absolute;
    opacity: 0.01;
  }

  .app-missing {
    padding: 20vw 7vw;
    text-align: center;
  }
</style>
