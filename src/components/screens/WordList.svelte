<script lang="ts">
  import { initPage } from "../../lib/page.ts";
  import eventEngine from "../../lib/eventEngine.ts";
  import { requireString } from "../../lib/values.ts";
  import imageLoader from "../../lib/imageLoader.ts";
  import { closeWindow, sendText } from "../../lib/api.ts";
  import { config, dataImage, skinImage } from "../../lib/project.ts";
  import { pageTitle } from "../../lib/title.svelte.ts";
  import type { WordValue } from "../../lib/types.ts";
  import { isWordValue, normalizeWordObj, sortWords, type WordItem } from "../../lib/words.ts";
  import { app, updateUserStatus } from "../../lib/app.svelte.ts";
  import PageLayout from "../layout/PageLayout.svelte";
  import BackButton from "../ui/BackButton.svelte";
  import ImageWithFade from "../ui/ImageWithFade.svelte";
  import UserStatus from "../ui/UserStatus.svelte";

  /* ことば帳。Bot の words を読み順に並べ、見出しを付ける */

  let clickDisabled = $state(false);
  const sortedItems = $derived(sortWords(app.userStatus?.words ?? {}));

  // setコマンドのハンドラー
  function handleSetCommand(key: unknown, value?: WordValue) {
    const name = requireString(key, "set のキー");
    // 読めない値（w・s が文字列でない、など）は、一覧を描けなくなるので台本を止める
    if (value !== undefined && !isWordValue(value)) throw new Error(`set のことばの値を読めません: ${JSON.stringify([key, value])}`);
    updateUserStatus((status) => {
      // 既存のエントリがあれば引き継いで正規化する
      const existingEntry = status.words?.[name] ?? {};
      const newWordObj = normalizeWordObj(name, value, existingEntry);
      return { ...status, words: { ...status.words, [name]: newWordObj } };
    });
    // 画像が指定されていれば、ローダーに登録
    if (value && typeof value === "object" && value.f) imageLoader.registerImage(dataImage("words", value.f));
  }

  // disable_click_wordsコマンドのハンドラー
  function handleDisableClickWordsCommand() {
    clickDisabled = true;
  }

  initPage({
    pageName: "words",
    registerImages: (loader) => {
      loader.registerImage(skinImage("unknownSymbol"));
      const images = Object.values(app.userStatus?.words ?? {})
        .filter((word): word is { f: string } => typeof word === "object" && word !== null && Boolean(word.f))
        .map((word) => dataImage("words", word.f));
      loader.registerImages(images);
    },
    registerHandlers: (engine) => [
      engine.registerCommandHandler("set", handleSetCommand, { canExecuteBeforeReady: true }),
      engine.registerCommandHandler("disable_click_words", handleDisableClickWordsCommand, { canExecuteBeforeReady: true })
    ]
  });

  // クリックハンドラー
  async function handleWordClick(item: WordItem) {
    if (item.wordObj.onclick) {
      // onclickが指定されている場合は常に実行（台本の実行中は受け付けない）
      await eventEngine.sendUserAction(item.wordObj.onclick);
    } else if (!clickDisabled) {
      // クリックが有効な場合のみ、ことばをトークへ送って閉じる
      try {
        await sendText(item.wordObj.w || item.key);
        closeWindow();
      } catch (error) {
        console.error("トークへ送れませんでした:", error);
      }
    }
  }

  pageTitle.current = config.titles.words;
</script>

<PageLayout>
  <div class="word-list">
    <!-- タイトル画像 -->
    <img class="word-list__title" src={skinImage("titleWords")} alt={config.titles.words} />
    <UserStatus />
    <div class="word-list__items">
      {#each sortedItems as item, index (`${item.sortKey}-${index}`)}
        {#if index === 0 || sortedItems[index - 1].firstChar !== item.firstChar}
          <div class="word-list__header">
            {#if item.firstChar === "■"}
              <img class="word-list__unknown" src={skinImage("unknownSymbol")} alt="?" />
            {:else}
              <p class="word-list__header-text">{item.firstChar}</p>
            {/if}
          </div>
        {/if}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
          class="word-list__row"
          class:word-list__row--separated={index !== sortedItems.length - 1 && item.firstChar === sortedItems[index + 1].firstChar}
          style:cursor={clickDisabled ? "default" : "pointer"}
          onclick={() => handleWordClick(item)}
        >
          <div class="word-list__stack">
            <img class="word-list__star" src={skinImage("star")} alt="" />
            <div class="word-list__word">
              <ImageWithFade wordObj={item.wordObj} fallbackText={item.key} />
            </div>
          </div>
        </div>
      {/each}
    </div>
    <BackButton />
  </div>
</PageLayout>

<style>
  .word-list {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 100vh;
  }

  .word-list__title {
    padding: 5vw 7vw 0;
  }

  .word-list__items {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 3vw 5vw 0;
    margin-bottom: 15vw;
  }

  .word-list__header {
    margin-top: 0.5vw;
    padding: 0.5vw 2.5vw;
    background: var(--xl-words-header-color, #3b3f86);
  }

  .word-list__unknown {
    height: 5vw;
    width: auto;
  }

  .word-list__header-text {
    color: white;
    font-size: 5vw;
    font-weight: bold;
  }

  .word-list__row {
    height: 9.5vw;
    padding: 1.6vw 2.5vw 1.4vw;
  }

  .word-list__row--separated {
    border-bottom: 0.5vw solid rgba(255, 255, 255, 0.4);
  }

  .word-list__stack {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 2vw;
  }

  .word-list__star {
    width: 3.3vw;
    height: 6.5vw;
    padding: 1.6vw 0;
    margin-left: 0.7vw;
  }

  .word-list__word {
    overflow: hidden;
    color: white;
    font-size: 4.7vw;
    font-weight: bold;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
