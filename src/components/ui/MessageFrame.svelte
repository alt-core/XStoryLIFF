<script lang="ts">
  import type { Snippet } from "svelte";
  import { skinImage } from "../../lib/project.ts";

  interface Props {
    height: string;
    children: Snippet;
  }

  let { height, children }: Props = $props();
</script>

<!-- 手紙の枠。枠の画像を border-image で伸ばす -->
<div class="message-frame" style:height style:border-image-source={`url("${skinImage("messagesFrame")}")`}>
  <div class="message-frame__inner">
    {@render children()}
  </div>
</div>

<style>
  .message-frame {
    width: 88vw;
    margin: 2vw 6vw 0;
    min-height: 50vw;
    border: 6vw solid transparent;
    border-image-slice: 80 fill;
    border-image-repeat: stretch repeat;
  }

  .message-frame__inner {
    width: 84vw;
    margin: -4vw -4vw 0;
    height: 100%;
  }
</style>
