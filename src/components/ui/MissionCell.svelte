<script lang="ts">
  interface Props {
    imageUrl: string;
    alt: string;
  }

  let { imageUrl, alt }: Props = $props();
</script>

<!-- ミッションの1つ（画像） -->
<div class="mission-cell">
  <img src={imageUrl} {alt} />
</div>

<style>
  .mission-cell {
    position: relative;
  }
</style>
