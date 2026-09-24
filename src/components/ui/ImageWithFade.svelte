<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { dataImage } from "../../lib/project.ts";
  import type { NormalizedWord } from "../../lib/words.ts";

  interface Props {
    wordObj: NormalizedWord;
    fallbackText: string;
  }

  let { wordObj, fallbackText }: Props = $props();

  /*
    ことばの画像。fade があれば、新しい画像を上に出し、前の画像を fade 秒かけて消す。初めて表示する時は即時に出す。
  */
  let currentImage = $state<string | null>(null);
  let nextImage = $state<string | null>(null);
  let fading = $state(false);
  let previousImage: string | null = null;
  // クロスフェードを終えるタイマー（続けて差し替えた時に、前のタイマーで後の画像を上書きしない）
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(fadeTimer));

  $effect(() => {
    const src = wordObj.f ? dataImage("words", wordObj.f) : null;
    const fade = Number.parseFloat(String(wordObj.fade ?? ""));
    untrack(() => {
      // 画像が変わらない時（ほかの項目だけの変更）は、途中のクロスフェードをそのまま続ける
      if (src === previousImage) return;
      clearTimeout(fadeTimer);
      if (!src) {
        currentImage = null;
        nextImage = null;
        fading = false;
        previousImage = null;
        return;
      }
      if (fade > 0 && previousImage) {
        // 前の画像がある場合はクロスフェード
        nextImage = src;
        fading = true;
        fadeTimer = setTimeout(() => {
          currentImage = src;
          nextImage = null;
          fading = false;
        }, fade * 1000);
      } else {
        // 初回やフェードなしの場合は即時表示
        currentImage = src;
        nextImage = null;
        fading = false;
      }
      previousImage = src;
    });
  });
</script>

{#if !wordObj.f}
  <p>{wordObj.w || fallbackText}</p>
{:else if !currentImage && !nextImage}
  <!-- 画像がまだないときのプレースホルダー -->
  <div class="word-image word-image--placeholder"></div>
{:else}
  <div class="word-image">
    {#if currentImage}
      <img
        src={currentImage}
        alt={wordObj.w || fallbackText}
        style:opacity={fading ? 0 : 1}
        style:transition={fading ? `opacity ${wordObj.fade}s` : undefined}
      />
    {/if}
    {#if nextImage}
      <img class="word-image__next" src={nextImage} alt={wordObj.w || fallbackText} />
    {/if}
  </div>
{/if}

<style>
  /* 画面の左端から幅いっぱいの帯として描く（文字の位置は画像の中で合わせる） */
  .word-image {
    position: relative;
    width: 100vw;
    margin-left: -13.5vw;
  }

  .word-image--placeholder {
    height: 6.5vw;
  }

  .word-image__next {
    position: absolute;
    top: 0;
    left: 0;
  }
</style>
