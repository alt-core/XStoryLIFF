<script lang="ts">
  interface Props {
    image: string;
    alt?: string;
    onclick?: () => void;
  }

  let { image, alt, onclick }: Props = $props();
</script>

<!-- 画像のボタン（押すと少し縮む） -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<img class="image-button" src={image} {alt} {onclick} />

<style>
  .image-button {
    display: block;
    width: 100%;
    object-fit: cover;
    cursor: pointer;
    transition: all 0.2s;
  }

  .image-button:hover {
    transform: scale(1.02);
  }

  .image-button:active {
    transform: scale(0.98);
  }
</style>
