<script lang="ts">
  import { initPage } from "../../lib/page.ts";
  import { config, dataImage, skinImage } from "../../lib/project.ts";
  import { pageTitle } from "../../lib/title.svelte.ts";
  import { app } from "../../lib/app.svelte.ts";
  import PageLayout from "../layout/PageLayout.svelte";
  import BackButton from "../ui/BackButton.svelte";
  import MissionCell from "../ui/MissionCell.svelte";
  import UserStatus from "../ui/UserStatus.svelte";

  /*
    ミッションの一覧。見出しの画像にタブの絵を描き、その上の透明な領域を押してタブを切り替える。
    URLの ?tab=cleared で、達成済みのタブから開く。
  */
  type Tab = "current" | "cleared";

  let tab = $state<Tab>(new URLSearchParams(window.location.search).get("tab") === "cleared" ? "cleared" : "current");
  const missions = $derived(app.userStatus?.missions ?? []);
  // tab に応じたフィルター（そのタブの画像が無いミッションは出さない）
  const filteredMissions = $derived(
    missions.filter((mission) => (tab === "current" ? !mission.cleared && mission.img1 : mission.cleared && mission.img2))
  );

  initPage({
    pageName: "missions",
    registerImages: (loader) => {
      const all = app.userStatus?.missions ?? [];
      const currentImages = all.filter((mission) => !mission.cleared && mission.img1).map((mission) => dataImage("missions", `current/${mission.img1}`));
      const clearedImages = all.filter((mission) => mission.cleared && mission.img2).map((mission) => dataImage("missions", `cleared/${mission.img2}`));
      loader.registerImages([...currentImages, ...clearedImages]);
    }
  });

  pageTitle.current = config.titles.missions;
</script>

<PageLayout>
  <div class="mission-list">
    <!-- タイトル画像 -->
    <img class="mission-list__title" src={skinImage("titleMissions")} alt={config.titles.missions} />
    <UserStatus />
    <!-- ヘッダー画像上に透明なクリックエリアを配置してタブ切り替え -->
    <div class="mission-list__header">
      <img
        src={skinImage(tab === "current" ? "missionsHeaderCurrent" : "missionsHeaderCleared")}
        alt="{tab === 'current' ? '進行中' : '達成済み'}の{config.titles.missions}"
      />
      <button
        class="mission-list__tab-switch"
        class:mission-list__tab-switch--current={tab === "current"}
        type="button"
        aria-label="{tab === 'current' ? '達成済み' : '進行中'}の{config.titles.missions}を見る"
        onclick={() => (tab = tab === "current" ? "cleared" : "current")}
      ></button>
    </div>
    <div class="mission-list__items">
      {#each filteredMissions as mission}
        <MissionCell imageUrl={dataImage("missions", tab === "current" ? `current/${mission.img1}` : `cleared/${mission.img2}`)} alt={config.titles.missions} />
      {/each}
    </div>
  </div>
  <BackButton />
</PageLayout>

<style>
  .mission-list {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 100vh;
  }

  .mission-list__title {
    padding: 6vw 7vw 0;
  }

  .mission-list__header {
    position: relative;
    width: 100%;
    padding: 0 6vw;
  }

  .mission-list__header img {
    width: 100%;
  }

  /* 押せる領域は、表示していない側のタブ（進行中の時は右40%、達成の時は左60%） */
  .mission-list__tab-switch {
    position: absolute;
    top: 0;
    left: 0%;
    width: 60%;
    height: 15vw;
    cursor: pointer;
  }

  .mission-list__tab-switch--current {
    left: 60%;
    width: 40%;
  }

  .mission-list__items {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3vw;
    padding: 3vw 6vw 0;
    margin-bottom: 15vw;
  }
</style>
