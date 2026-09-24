<script lang="ts">
  import { notices } from "../lib/notices.svelte.ts";
</script>

<div class="notices" aria-live="polite">
  {#each notices.list as notice (notice.id)}
    <p class="notice">{notice.text}</p>
  {/each}
</div>

<style>
  .notices {
    position: fixed;
    left: 50%;
    bottom: calc(1rem + env(safe-area-inset-bottom));
    z-index: 1400;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: min(calc(100% - 2rem), 26rem);
    transform: translateX(-50%);
    pointer-events: none;
  }

  .notice {
    padding: 0.625rem 1rem;
    border-radius: 0.75rem;
    background: rgba(26, 32, 44, 0.94);
    color: #edf2f7;
    font-size: 0.875rem;
    line-height: 1.6;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
</style>
