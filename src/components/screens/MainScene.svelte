<script lang="ts">
  import { initPage } from "../../lib/page.ts";
  import eventEngine from "../../lib/eventEngine.ts";
  import { requireString } from "../../lib/values.ts";
  import imageLoader from "../../lib/imageLoader.ts";
  import { menuEntries } from "../../lib/menu.ts";
  import { closeWindow, sendText } from "../../lib/api.ts";
  import { config, dataImage, pageHref, skinImage, withBase } from "../../lib/project.ts";
  import { pageTitle } from "../../lib/title.svelte.ts";
  import type { MenuButton } from "../../lib/config.ts";
  import type { RoomObject } from "../../lib/types.ts";
  import { app, isRoomObject, updateUserStatus } from "../../lib/app.svelte.ts";
  import PageLayout from "../layout/PageLayout.svelte";
  import ImageButton from "../ui/ImageButton.svelte";
  import RoomArea from "../ui/RoomArea.svelte";
  import UserStatus from "../ui/UserStatus.svelte";

  /* Room のページ。部屋、ステータス表示、メニューのボタン */

  const userStatus = $derived(app.userStatus);

  // メニューに出すボタン（Bot が menu で返したものと、台本で出したもの）
  const buttons = $derived(menuEntries(config.menu, userStatus));

  // 利用者の発言としてトークへ送り、閉じる
  async function sendChatMessage(text: string) {
    try {
      await sendText(text);
      closeWindow();
    } catch (error) {
      console.error("トークへ送れませんでした:", error);
    }
  }

  function press(button: MenuButton) {
    if (button.send) void sendChatMessage(button.send);
    else if (button.action) void eventEngine.sendUserAction(button.action);
  }

  // setコマンドのハンドラー
  function handleSetCommand(key: unknown, value: RoomObject | null) {
    // 物の形でない set（オブジェクトでない、effect が文字列でない）は、部屋を描けなくなるので台本を止める
    if (value !== null && !isRoomObject(value)) {
      throw new Error(`set の値が物の形ではありません: ${JSON.stringify([key, value])}`);
    }
    const name = requireString(key, "set の名前");
    updateUserStatus((status) => {
      if (value === null) {
        // 削除の場合：objectからプロパティを除外する
        const { [name]: _, ...rest } = status.roomObjects ?? {};
        return { ...status, roomObjects: rest };
      }
      return { ...status, roomObjects: { ...status.roomObjects, [name]: value } };
    });
    // 画像が指定されていれば、ローダーに登録
    if (value?.f) imageLoader.registerImage(dataImage("room", value.f));
  }

  initPage({
    pageName: "room",
    registerImages: (loader) => {
      const images = Object.values(app.userStatus?.roomObjects ?? {})
        .filter((object) => object.f)
        .map((object) => dataImage("room", object.f ?? ""));
      loader.registerImages(images);
    },
    // condition は、部屋（RoomArea）が受け付ける
    registerHandlers: (engine) => engine.registerCommandHandler("set", handleSetCommand, { canExecuteBeforeReady: true })
  });

  pageTitle.current = config.titles.room;
</script>

<PageLayout>
  <div class="scene">
    <img class="scene__title" src={skinImage("titleRoom")} alt={config.titles.room} />
    <UserStatus />

    <!-- ROOM画像 -->
    <div>
      {#if userStatus}<RoomArea objects={userStatus.roomObjects ?? {}} />{/if}
    </div>

    <!-- ボタンエリア -->
    <div class="scene__buttons">
      <!-- 出したボタンの2つ目以降は、前のボタンに 3vw 重ねる -->
      {#each buttons as { button, revealed }, index (button.id)}
        <div class="scene__button" class:scene__button--overlap={index > 0} class:scene__button--revealed={revealed}>
          {#if button.href}
            <a href={pageHref(button.href)}><ImageButton image={withBase(button.image)} alt={button.label} /></a>
          {:else}
            <ImageButton image={withBase(button.image)} alt={button.label} onclick={() => press(button)} />
          {/if}
        </div>
      {/each}
    </div>
  </div>
</PageLayout>

<style>
  .scene {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 100vh;
  }

  .scene__title {
    padding: 6vw 7vw 0;
  }

  .scene__buttons {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    padding: 2vw 6vw 0;
  }

  .scene__button--overlap {
    margin-top: -3vw;
  }

  /* 台本で出したボタンが現れる演出（1.5倍から縮みながら、0.5秒で現れる） */
  .scene__button--revealed {
    animation: button-reveal 0.5s ease-out both;
  }

  @keyframes button-reveal {
    from {
      opacity: 0;
      transform: scale(1.5);
    }
  }
</style>
