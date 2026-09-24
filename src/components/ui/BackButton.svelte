<script lang="ts">
  import { pageHref, skinImage } from "../../lib/project.ts";
</script>

<!-- Room へ戻るボタン（右下に固定） -->
<a href={pageHref("/")}>
  <img class="back-button" src={skinImage("back")} alt="戻る" />
</a>

<style>
  .back-button {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    width: 15vw;
    height: 15vw;
    transition: all 0.2s;
  }

  .back-button:hover {
    transform: scale(1.02);
  }

  .back-button:active {
    transform: scale(0.98);
  }
</style>
