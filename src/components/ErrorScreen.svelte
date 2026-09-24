<script lang="ts">
  interface Props {
    error: string;
  }

  let { error }: Props = $props();
</script>

<!-- エラーの画面。初期化（ページの読み込み、Botとの接続と get_status）に失敗した時に出し、ページを読み込み直してやり直す -->
<div class="error-screen">
  <div class="error-screen__stack">
    <svg class="error-screen__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        fill-rule="evenodd"
        d="M12 1a11 11 0 1 0 0 22a11 11 0 1 0 0-22zM10.75 6.75a1.25 1.25 0 0 1 2.5 0v6.5a1.25 1.25 0 0 1-2.5 0zM12 16a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z"
      />
    </svg>
    <div class="error-screen__texts">
      <p class="error-screen__title">エラーが発生しました</p>
      <p class="error-screen__message">{error}</p>
    </div>
    <button class="error-screen__retry" type="button" onclick={() => window.location.reload()}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v5h-5" />
      </svg>
      再読み込み
    </button>
  </div>
</div>

<style>
  .error-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100vh;
  }

  .error-screen__stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem;
    text-align: center;
  }

  .error-screen__icon {
    width: 3rem;
    height: 3rem;
    color: #e53e3e;
  }

  .error-screen__texts {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* 見出しは本文の色（globals.css の --foreground） */
  .error-screen__title {
    font-size: 1.125rem;
    font-weight: bold;
  }

  /* 暗い背景でも読める灰色 */
  .error-screen__message {
    color: #718096;
  }

  /* 再読み込みのボタン */
  .error-screen__retry {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 200px;
    min-width: 2.5rem;
    height: 2.5rem;
    padding: 0 1rem;
    border-radius: 0.375rem;
    background: #3182ce;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.2;
    transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
    transition-duration: 200ms;
  }

  .error-screen__retry:hover {
    background: #2b6cb0;
  }

  .error-screen__retry:active {
    background: #2c5282;
  }

  .error-screen__retry:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.6);
  }

  .error-screen__retry svg {
    width: 1em;
    height: 1em;
  }
</style>
