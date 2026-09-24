<script lang="ts">
  import { untrack } from "svelte";
  import { initPage } from "../../lib/page.ts";
  import type { NoiseLevel } from "../../lib/config.ts";
  import { config, dataImage } from "../../lib/project.ts";
  import { pageTitle } from "../../lib/title.svelte.ts";
  import BackButton from "../ui/BackButton.svelte";
  import GlitchCanvas from "../ui/GlitchCanvas.svelte";

  /*
    資料のページ（/documents/<id>/）。画面の幅いっぱいに資料の画像だけを表示する。
    グリッチの強さは、URLの ?route= の値から資料ごとの対応表（routes）で決める。対応表に無ければ資料の既定の強さ（noise）。
  */
  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  const route = new URLSearchParams(window.location.search).get("route") ?? "";
  const entry = $derived(Object.hasOwn(config.documents, id) ? config.documents[id] : undefined);
  const noiseLevel: NoiseLevel = $derived((entry && route && entry.routes?.[route]) || entry?.noise || "none");
  const imagePath = $derived(entry ? dataImage("documents", entry.image) : "");

  // ページ名は資料のid
  initPage({
    pageName: untrack(() => id),
    registerImages: (loader) => {
      if (imagePath) loader.registerImage(imagePath);
    }
  });

  $effect(() => {
    if (entry) pageTitle.current = entry.title;
  });
</script>

{#if entry}
  <div
    class="document"
    class:document--heavy={noiseLevel === "heavyNoise"}
    style:background={entry.background ?? "#000"}
  >
    {#if noiseLevel === "none"}
      <img src={imagePath} alt={entry.title} />
    {:else}
      <GlitchCanvas src={imagePath} alt={entry.title} {noiseLevel} />
    {/if}
    {#if entry.back}<BackButton />{/if}
  </div>
{/if}

<style>
  .document {
    position: relative;
    width: 100vw;
    min-height: 100vh;
  }

  .document img {
    display: block;
    width: 100%;
  }

  /* 強いグリッチの資料は、1画面分だけを見せる */
  .document--heavy {
    height: 100vh;
    overflow: hidden;
  }
</style>
