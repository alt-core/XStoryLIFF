<script lang="ts">
  import type { Snippet } from "svelte";
  import { skinImage, withBase } from "../../lib/project.ts";

  interface Props {
    /** 背景画像（省略すると作品の設定の background） */
    bgImage?: string;
    children: Snippet;
  }

  let { bgImage, children }: Props = $props();

  /** CSS の関数（linear-gradient(...) など）とキーワード（none など）はそのまま、それ以外は画像のpathとして url() で包む */
  const KEYWORDS = new Set(["none", "-moz-initial", "inherit", "initial", "revert", "unset"]);
  const backgroundImage = $derived.by(() => {
    if (bgImage === undefined) return `url("${skinImage("background")}")`;
    if ((bgImage.includes("(") && bgImage.includes(")")) || KEYWORDS.has(bgImage)) return bgImage;
    return `url("${withBase(bgImage)}")`;
  });
</script>

<!-- ページの背景。画像を幅いっぱいに描き、縦に繰り返す -->
<div class="page-layout" style:background-image={backgroundImage}>
  {@render children()}
</div>

<style>
  .page-layout {
    min-height: 100vh;
    width: 100vw;
    background-size: 100% auto;
    background-position: center;
    background-repeat: repeat-y;
  }
</style>
