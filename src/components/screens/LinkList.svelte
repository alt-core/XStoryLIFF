<script lang="ts">
  import { initPage } from "../../lib/page.ts";
  import type { LinkItem } from "../../lib/config.ts";
  import { config, pageHref, skinImage, withBase } from "../../lib/project.ts";
  import { pageTitle } from "../../lib/title.svelte.ts";
  import { app } from "../../lib/app.svelte.ts";
  import { toNumber } from "../../lib/values.ts";
  import PageLayout from "../layout/PageLayout.svelte";
  import BackButton from "../ui/BackButton.svelte";

  /* リンク集。進行中のイベントに応じてバナーを差し替える */

  const event = $derived(app.userStatus?.event ?? {});

  /** 進行中のイベントに応じてバナーを差し替える（バナーのあるイベントのうち、優先度の最も高いもの） */
  function imageOf(link: LinkItem, activeEvents: Record<string, number>) {
    const [chosen] = Object.entries(link.eventImageUrls ?? {})
      .filter(([eventName]) => Object.hasOwn(activeEvents, eventName))
      .sort(([a], [b]) => toNumber(activeEvents[b]) - toNumber(activeEvents[a]));
    return withBase(chosen ? chosen[1] : link.imageUrl);
  }

  /** 外部ブラウザーで開くリンクには、LINEアプリの指定 openExternalBrowser=1 を付ける（webchat では新しいタブで開く） */
  function hrefOf(link: LinkItem) {
    if (!link.isExternal) return pageHref(link.url);
    const url = new URL(link.url, window.location.href);
    url.searchParams.set("openExternalBrowser", "1");
    return url.toString();
  }

  initPage({
    pageName: "links",
    registerImages: (loader) => {
      // バナー画像を登録
      const activeEvents = app.userStatus?.event ?? {};
      for (const link of config.links) loader.registerImage(imageOf(link, activeEvents));
    }
  });

  pageTitle.current = config.titles.links;
</script>

<PageLayout>
  <div class="link-list">
    <img class="link-list__title" src={skinImage("titleLinks")} alt={config.titles.links} />
    <div class="link-list__items">
      {#each config.links as link (link.id)}
        <a href={hrefOf(link)} target={link.isExternal ? "_blank" : undefined} rel={link.isExternal ? "noopener noreferrer" : undefined}>
          <div class="link-list__banner">
            <img src={imageOf(link, event)} alt={link.title} />
          </div>
        </a>
      {/each}
    </div>
    <BackButton />
  </div>
</PageLayout>

<style>
  .link-list {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 100vh;
  }

  .link-list__title {
    padding: 6vw 7vw 0;
  }

  .link-list__items {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6vw;
    padding: 6vw 6vw 0;
    margin-bottom: 15vw;
  }

  .link-list__banner {
    display: flex;
    align-items: center;
    cursor: pointer;
  }
</style>
