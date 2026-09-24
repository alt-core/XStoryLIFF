<script lang="ts">
  import { onMount } from "svelte";
  import { engineState } from "../../lib/engineState.svelte.ts";
  import eventEngine from "../../lib/eventEngine.ts";
  import { skinImage } from "../../lib/project.ts";

  /*
    台詞の吹き出し（画面の下に出す）。作品固有のページに置くと、そのページの台本で台詞を出せる。
    Room は、部屋の中に吹き出しを出す（RoomArea）。押すと次へ進む。
  */
  onMount(() => {
    eventEngine.messageHost = true;
    return () => {
      eventEngine.messageHost = false;
    };
  });
</script>

{#if engineState.current.messageVisible}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="message-bubble" onclick={eventEngine.handleMessageClick}>
    <img class="message-bubble__image" src={skinImage("bubble")} alt="" />
    <div class="message-bubble__flex">
      <p class="message-bubble__text">{engineState.current.currentMessage ?? ""}</p>
    </div>
  </div>
{/if}

<style>
  /* 大きさと文字は、Room の吹き出しに合わせる（幅90vw、高さは部屋の吹き出しと同じ比率） */
  .message-bubble {
    position: fixed;
    left: 5vw;
    bottom: calc(4vw + env(safe-area-inset-bottom));
    z-index: 1200;
    width: 90vw;
    height: 24.3vw;
    cursor: pointer;
  }

  .message-bubble__image {
    position: absolute;
    width: 100%;
    height: 100%;
    max-width: none;
  }

  .message-bubble__flex {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .message-bubble__text {
    max-width: 75%;
    font-family: var(--xl-story-font);
    font-size: 3.8vw;
    text-align: left;
    white-space: pre-wrap;
    color: var(--xl-bubble-text, #2b2546);
  }
</style>
