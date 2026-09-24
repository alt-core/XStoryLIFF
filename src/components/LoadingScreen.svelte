<script lang="ts">
  import { onMount } from "svelte";

  /* 読み込み中の表示。10秒たっても表示されなければ「再読み込み」を出す */
  let showReload = $state(false);

  onMount(() => {
    const timer = setTimeout(() => (showReload = true), 10_000);
    return () => clearTimeout(timer);
  });
</script>

<div class="loading" role="status">
  <div class="loading__spinner" aria-hidden="true"></div>
  <p class="loading__label">読み込み中…</p>
  <!-- 出るまでは押せない -->
  <button
    class="loading__reload"
    class:loading__reload--visible={showReload}
    type="button"
    tabindex={showReload ? 0 : -1}
    onclick={() => window.location.reload()}
  >
    再読み込み
  </button>
</div>

<style>
  .loading {
    position: fixed;
    inset: 0;
    z-index: 1300;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background: var(--background);
    color: var(--foreground);
    animation: loading-in 0.3s ease-in-out both;
  }

  .loading__spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.85);
    border-radius: 50%;
    animation: loading-spin 0.9s linear infinite;
  }

  .loading__label {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .loading__reload {
    font-size: 0.875rem;
    text-decoration: underline;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .loading__reload--visible {
    visibility: visible;
    opacity: 1;
  }

  @keyframes loading-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes loading-in {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading__spinner {
      animation-duration: 2.5s;
    }
  }
</style>
