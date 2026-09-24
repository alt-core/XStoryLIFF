<script lang="ts">
  import { onMount } from "svelte";
  import { initPage } from "../../lib/page.ts";
  import { requestLines } from "../../lib/api.ts";
  import eventEngine from "../../lib/eventEngine.ts";
  import { config, skinImage } from "../../lib/project.ts";
  import { pageTitle } from "../../lib/title.svelte.ts";
  import { sanitizeToFragment } from "../../lib/sanitize.ts";
  import { withLaunchParams } from "../../lib/xstorybot.ts";
  import type { InboxMessage } from "../../lib/types.ts";
  import { fetchMessages, inbox, markMessageAsRead } from "../../lib/inbox.svelte.ts";
  import PageLayout from "../layout/PageLayout.svelte";
  import BackButton from "../ui/BackButton.svelte";
  import MessageFrame from "../ui/MessageFrame.svelte";
  import UserStatus from "../ui/UserStatus.svelte";

  /* 手紙のページ（一覧と本文） */

  let selectedMessage = $state<InboxMessage | null>(null);
  let messageContent = $state("");
  let contentElement = $state<HTMLDivElement>();
  let hasProcessedQuery = false;
  let contentRequest = 0;

  const messages = $derived(inbox.messages);
  const isLoading = $derived(inbox.isLoading);
  const error = $derived(inbox.error);

  onMount(() => {
    void fetchMessages();
  });

  // ?id= の手紙を、一覧を読み込んだ後に一度だけ開く
  $effect(() => {
    if (hasProcessedQuery || !messages || messages.length === 0) return;
    const messageId = new URLSearchParams(window.location.search).get("id");
    if (!messageId) return;
    const targetMessage = messages.find((message) => message.id === messageId);
    if (targetMessage) {
      hasProcessedQuery = true;
      void handleMessageClick(targetMessage);
    }
  });

  initPage({
    pageName: "messages",
    // メッセージページでは画像のロードを待たない
    waitForImages: false,
    registerImages: (loader) => {
      loader.registerImage(skinImage("messagesSubtitle"));
      loader.registerImage(skinImage("messagesLine"));
      loader.registerImage(skinImage("messagesNext"));
      loader.registerImage(skinImage("messagesBack"));
    }
  });

  /** 本文の名前に使える文字（英数字と _ - .）。ほかの文字があれば、削って別の本文を取り寄せないよう、取り寄せない */
  const CONTENT_NAME = /^[A-Za-z0-9_.-]+$/u;

  async function handleMessageClick(message: InboxMessage) {
    selectedMessage = message;

    // 本文の取得は、この処理が最初の送信（既読、または既読の手紙なら onopen）を始めた後に始める
    queueMicrotask(() => void loadMessageContent(message));

    // 未読（read が無い時も未読として表示する）なら、既読にするリクエストを送信
    if (!message.read) {
      try {
        await requestLines(`on_message_read:${message.id}`);
        // ローカルのメッセージリストも更新
        markMessageAsRead(message.id);
      } catch (err) {
        // 既読を伝えられなければ、onopen の台本も実行しない（状態を進めない。開き直せば、既読の送信からやり直す）
        console.error("手紙の既読を伝えられませんでした:", err);
        eventEngine.halt(["on_message_read", message.id], err);
        return;
      }
    }

    // onopenアクションの処理（既読を伝え終えてから）
    if (message.onopen) await eventEngine.fetchAndExecuteAction(message.onopen);
  }

  async function loadMessageContent(message: InboxMessage) {
    // 後から開いた手紙の本文を、先に開いた手紙の遅い応答で上書きしない
    const request = ++contentRequest;
    messageContent = "";
    try {
      if (!CONTENT_NAME.test(message.content)) throw new Error(`本文の名前に使えない文字があります: ${message.content}`);
      const [body] = await requestLines(`message_content:${message.content}`);
      if (typeof body !== "string") throw new Error(`本文がありません: ${message.content}`);
      if (request === contentRequest) messageContent = body;
    } catch (err) {
      console.error("手紙の本文を読み込めませんでした:", err);
      if (request === contentRequest) messageContent = "<p>本文を読み込めませんでした。</p>";
    }
  }

  // 本文を表示する。スクリプトを動かせるものを取り除き、HTMLの文字列に戻さずにそのまま移す。
  // アプリの中のページへのリンクは、webchat の起動パラメータを引き継ぐ
  $effect(() => {
    const fragment = sanitizeToFragment(messageContent);
    for (const link of fragment.querySelectorAll("a[href]")) {
      try {
        link.setAttribute("href", withLaunchParams(link.getAttribute("href") ?? ""));
      } catch {
        // URLとして読めないリンク（書き誤り）は、書かれたままにする。本文の表示は止めない
      }
    }
    contentElement?.replaceChildren(fragment);
  });

  function handleBackClick() {
    selectedMessage = null;
  }

  pageTitle.current = config.titles.messages;
</script>

<PageLayout>
  <div class="message-list">
    <img class="message-list__title" src={skinImage("titleMessages")} alt={config.titles.messages} />
    <UserStatus />
    {#if !selectedMessage}
      <div class="message-list__box">
        <MessageFrame height="calc(100vh - 45vw)">
          {#if isLoading}
            <p class="message-list__note">読み込み中…</p>
          {:else if error}
            <p class="message-list__note">{error}</p>
          {:else}
            <img class="message-list__subtitle" src={skinImage("messagesSubtitle")} alt="{config.titles.messages}の一覧" />
            <img class="message-list__line" src={skinImage("messagesLine")} alt="" />
            <div class="message-list__scroll message-list__scroll--list">
              {#each messages ?? [] as article}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div class="message-list__row" onclick={() => handleMessageClick(article)}>
                  <div>
                    <p class="message-list__from" class:message-list__unread={!article.read}>{article.from ?? ""}</p>
                    <p class="message-list__subject" class:message-list__unread={!article.read}>{article.title}</p>
                  </div>
                  <img class="message-list__next" src={skinImage("messagesNext")} alt="" />
                </div>
              {/each}
            </div>
          {/if}
        </MessageFrame>
      </div>
    {:else}
      <div class="message-list__box">
        <MessageFrame height="calc(100vh - 60vw)">
          <div class="message-list__scroll message-list__scroll--detail">
            <div class="message-list__heading">
              <p class="message-list__from" class:message-list__unread={!selectedMessage.read}>{selectedMessage.from ?? ""}</p>
              <p class="message-list__detail-title" class:message-list__unread={!selectedMessage.read}>{selectedMessage.title}</p>
            </div>
            <img class="message-list__line" src={skinImage("messagesLine")} alt="" />
            <!-- 取得した本文HTMLを表示する（スクリプトを動かせるものだけは取り除く） -->
            <div class="message-list__content" bind:this={contentElement}></div>
          </div>
        </MessageFrame>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <img class="message-list__back" src={skinImage("messagesBack")} alt="戻る" onclick={handleBackClick} />
      </div>
    {/if}
  </div>
  <BackButton />
</PageLayout>

<style>
  .message-list {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 100vh;
  }

  .message-list__title {
    padding: 0 7vw;
    margin-top: 6vw;
  }

  .message-list__box {
    position: relative;
  }

  .message-list__note {
    margin-top: 20vw;
    color: white;
    text-align: center;
  }

  .message-list__subtitle {
    width: 34vw;
    margin: 1.5vw auto;
  }

  .message-list__line {
    width: 80vw;
    margin: 0 auto;
    padding: 0.5vw 0;
  }

  .message-list__scroll {
    width: 100%;
    overflow-y: auto;
  }

  .message-list__scroll::-webkit-scrollbar {
    width: 0.5vw;
  }

  .message-list__scroll::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
  }

  .message-list__scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.7);
    border-radius: 0.25vw;
  }

  .message-list__scroll--list {
    height: calc(100% - 1.7vw);
    overflow-x: hidden;
  }

  .message-list__scroll--detail {
    height: calc(100% + 8vw);
  }

  .message-list__row {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 80vw;
    min-height: 17.2vw;
    margin: 0 2vw;
    padding: 2vw;
    border-bottom: 0.3vw solid rgba(255, 255, 255, 0.4);
    cursor: pointer;
  }

  .message-list__from {
    margin-bottom: -0.25vw;
    color: white;
    font-size: 3.7vw;
    font-weight: normal;
  }

  .message-list__subject {
    overflow: hidden;
    color: white;
    font-size: 4.8vw;
    font-weight: normal;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .message-list__detail-title {
    color: white;
    font-size: 4.8vw;
    font-weight: normal;
  }

  .message-list__unread {
    font-weight: 800;
  }

  .message-list__next {
    position: absolute;
    top: 50%;
    right: 1vw;
    width: 2vw;
    height: auto;
    transform: translateY(-50%);
  }

  .message-list__heading {
    margin: 1vw 4vw;
  }

  .message-list__content {
    margin-top: 2vw;
    padding: 0 4vw;
    color: white;
    font-size: 3.7vw;
    line-height: 7vw;
  }

  .message-list__back {
    width: 55vw;
    margin: 2vw auto 0;
    cursor: pointer;
  }
</style>
