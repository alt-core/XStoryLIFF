<script lang="ts">
  import { skinImage } from "../../lib/project.ts";
  import { app } from "../../lib/app.svelte.ts";

  // Bot が返した値をそのまま出す（無ければ何も出さない）
  const lv = $derived(app.userStatus?.lv ?? "");
  const nWords = $derived(app.userStatus?.n_words ?? "");
</script>

<!--
  ステータス表示。背景の画像に lv と n_words を重ねる。
  数値の枠（左端と幅）と書体は、背景の画像に合わせてスキンのCSS変数で変えられる（既定はデモの画像に合わせた値）。
  数値は枠の中央に寄せる。幅を auto にすると、左端から書く。
-->
<div class="user-status">
  <img class="user-status__panel" src={skinImage("status")} alt="ステータス" />
  <div class="user-status__lv">
    <p>{lv}</p>
  </div>
  <div class="user-status__words">
    <p>{nWords}</p>
  </div>
</div>

<style>
  .user-status {
    position: relative;
    width: 100vw;
    padding: 2.7vw 0 2.5vw;
  }

  .user-status__panel {
    width: 72vw;
    margin: 0 auto;
  }

  .user-status__lv,
  .user-status__words {
    position: absolute;
    top: var(--xl-status-top, 4.06vw);
    font-family: var(--xl-status-font, var(--xl-story-font));
    font-size: var(--xl-status-font-size, 5.5vw);
    font-weight: var(--xl-status-font-weight, 700);
    color: var(--xl-status-color, #fff4dc);
    text-align: center;
    white-space: nowrap;
  }

  .user-status__lv {
    left: var(--xl-status-lv-left, 29.2vw);
    width: var(--xl-status-lv-width, 15vw);
  }

  .user-status__words {
    left: var(--xl-status-words-left, 68.6vw);
    width: var(--xl-status-words-width, 15vw);
  }
</style>
