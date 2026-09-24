<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { updateUserStatus } from "../../lib/app.svelte.ts";
  import { engineState } from "../../lib/engineState.svelte.ts";
  import eventEngine from "../../lib/eventEngine.ts";
  import { dataImage, room, skinImage } from "../../lib/project.ts";
  import type { RoomObject } from "../../lib/types.ts";
  import { requireString, toNumber } from "../../lib/values.ts";
  import { clampToRoom, compareById, parsePositionConditions, snapPoint, type Point, type PositionCondition } from "./roomConditions.ts";

  /*
    Room の部屋と額縁、台詞の吹き出し。condition（物を運ぶ謎）のコマンドも受け付ける。
    額縁（frameWidth×frameHeight）を実寸で描き、画面の幅の90%に縮めて表示する。部屋は額縁の内側（太さ border）。
  */
  interface Props {
    objects: Record<string, RoomObject>;
  }

  let { objects }: Props = $props();

  const { frameWidth, frameHeight, border: borderSize } = room;
  const roomWidth = frameWidth - 2 * borderSize;
  const roomHeight = frameHeight - 2 * borderSize;
  const widthScale = 0.9;

  /** 演出の層。container は位置と大きさ、image は画像の明るさ。ほかの名前は、作品の skin.css の .fx-<名前> で描く（外側の層） */
  const CONTAINER_EFFECTS = new Set(["scale", "shake"]);
  const IMAGE_EFFECTS = new Set(["flash", "glow"]);
  /** 作品の演出の名前に使える文字（クラス名にするため） */
  const CUSTOM_EFFECT_NAME = /^[A-Za-z0-9_-]+$/u;

  /** 待っている condition。満たしてBotが受け付けたら resolve し、エンジンが次のコマンドへ進む */
  interface PendingCondition {
    action: string;
    positions: PositionCondition[];
    resolve: () => void;
    reject: (error: Error) => void;
  }

  let containerElement = $state<HTMLDivElement>();
  let roomElement = $state<HTMLDivElement>();
  let scale = $state(1);
  let dragging = $state<string | null>(null);
  let dragOffset = { x: 0, y: 0 };
  // ドラッグを始めた指（2本目の指では動かさない）
  let dragPointerId: number | null = null;
  let conditions: PendingCondition | null = null;
  let objectPositions = $state<Record<string, Point>>({});
  let effectObjects = $state<Record<string, string[]>>({});
  let roomFlash = $state(false);
  let roomFlashStrong = $state(false);
  // すでにハマっているオブジェクト、実行済みのエフェクト
  let snappedObjects: Record<string, boolean> = {};
  const executedEffects: Record<string, boolean> = {};
  // 前に描いた物（set で置き換えられた物を見分けるため）
  let previousObjects: Record<string, RoomObject> = {};

  const sortedObjects = $derived(Object.entries(objects).sort(([, a], [, b]) => compareById(a, b)));

  // set で置き換えた物は、ドラッグした位置と吸い付いた状態を捨てる（set は物を丸ごと置き換える）
  $effect(() => {
    const current = objects;
    untrack(() => {
      const replaced = Object.keys(objectPositions).filter((key) => current[key] !== previousObjects[key]);
      if (replaced.length > 0) {
        objectPositions = Object.fromEntries(Object.entries(objectPositions).filter(([key]) => !replaced.includes(key)));
        for (const key of replaced) delete snappedObjects[key];
      }
      previousObjects = current;
    });
  });

  // オブジェクトが追加・更新された時に、まだ実行していない演出を再生する。
  // 表示の前（読み込み画面の下）では始めず、表示してから再生する（表示前に実行した set の演出も見せる）
  $effect(() => {
    const current = objects;
    if (!engineState.current.isReady) return;
    untrack(() => {
      const newEffectObjects: Record<string, string[]> = {};
      let hasRoomFlash = false;
      let hasRoomFlashStrong = false;

      for (const [key, object] of Object.entries(current)) {
        if (!object.effect) continue;
        const effectKey = `${key}-${object.effect}`;
        if (executedEffects[effectKey]) continue;
        executedEffects[effectKey] = true;

        const effects = object.effect.split(",").map((effect) => effect.trim());
        if (effects.includes("room_flash")) {
          hasRoomFlash = true;
          const objectEffects = effects.filter((effect) => effect !== "room_flash");
          if (objectEffects.length > 0) newEffectObjects[key] = objectEffects;
        } else if (effects.includes("room_flash_strong")) {
          hasRoomFlashStrong = true;
          const objectEffects = effects.filter((effect) => effect !== "room_flash_strong");
          if (objectEffects.length > 0) newEffectObjects[key] = objectEffects;
        } else {
          newEffectObjects[key] = effects;
        }
        // 演出の組は、次に同じ物へ演出が付くまで残す（組が変わると、描き直して再生する）
      }

      if (hasRoomFlash) flashRoom();
      if (hasRoomFlashStrong) {
        roomFlashStrong = true;
        setTimeout(() => (roomFlashStrong = false), 500);
      }
      if (Object.keys(newEffectObjects).length > 0) effectObjects = { ...effectObjects, ...newEffectObjects };
    });
  });

  function flashRoom() {
    roomFlash = true;
    setTimeout(() => (roomFlash = false), 200);
  }

  /** 部屋に対する割合を CSS の % にする。数として計算し（"0.5" のような数の文字列も使える）、数にならない値は指定しない */
  function percent(value: unknown): string | undefined {
    const number = toNumber(value) * 100;
    return Number.isFinite(number) ? `${number}%` : undefined;
  }

  /** 同じ層の演出は、後に書いたものが効く */
  function effectOf(names: string[], layer: Set<string>) {
    let chosen = "";
    for (const name of names) if (layer.has(name)) chosen = name;
    return chosen;
  }

  /** 作品の演出（標準の名前でないもの）のクラス */
  function customEffectClasses(names: string[]) {
    return names
      .filter((name) => !CONTAINER_EFFECTS.has(name) && !IMAGE_EFFECTS.has(name) && CUSTOM_EFFECT_NAME.test(name))
      .map((name) => `fx-${name}`)
      .join(" ");
  }

  // condition判定
  function checkConditions(): void {
    if (!conditions) return;
    const { action, positions, resolve, reject } = conditions;
    let allConditionsMet = true;

    for (const condition of positions) {
      const [objectKey] = condition;
      // ドラッグされた場合はその位置、されていなければ初期位置
      const dragged = objectPositions[objectKey];
      const object = objects[objectKey];
      const point = dragged ?? (object ? { x: toNumber(object.x), y: toNumber(object.y) } : null);
      if (!point) {
        allConditionsMet = false;
        break;
      }

      const snapped = snapPoint(point, condition);
      if (snapped) {
        // 範囲内にある場合、オブジェクトを中央に移動させる
        objectPositions = { ...objectPositions, [objectKey]: snapped };
        // このオブジェクトがまだハマっていない場合のみ、部屋全体を光らせる
        if (!snappedObjects[objectKey]) {
          flashRoom();
          snappedObjects[objectKey] = true;
        }
      } else {
        // 範囲外の場合、ハマっていない状態に戻す（吸い付く演出を全てのピースで判定するため break しない）
        delete snappedObjects[objectKey];
        allConditionsMet = false;
      }
    }

    if (!allConditionsMet) return;
    conditions = null;
    /*
      解けたことを Bot へ伝え、受け付けられてから、condition の後ろのコマンドへ進む（action の応答の台本は、その後に続く）。
      伝えられなければ、続きの台本（command で状態を進めるものもある）を実行しないよう、台本を止める。
    */
    void eventEngine.fetchAndExecuteAction(action).then((ok) => {
      if (ok) resolve();
      else reject(new Error(`condition の action を Bot へ伝えられませんでした: ${action}`));
    });
  }

  // conditionコマンドのハンドラー。満たしてBotが受け付けるまで、エンジンは次のコマンドへ進まない
  function handleConditionCommand(value: unknown, rawConditions: unknown): Promise<void> {
    const action = requireString(value, "condition の action");
    // 条件が読めない時や、対象が無い時は例外で止める（満たしたことにしない）
    const positions = parsePositionConditions(rawConditions, objects);

    // 条件判定対象のオブジェクトを動かせるようにする（動かせる物は置き換えない。ドラッグした位置を捨てないため）
    const updatedObjects: Record<string, RoomObject> = {};
    for (const [objectKey] of positions) {
      if (!objects[objectKey].movable) updatedObjects[objectKey] = { ...objects[objectKey], movable: true };
    }
    if (Object.keys(updatedObjects).length > 0) {
      updateUserStatus((status) => ({ ...status, roomObjects: { ...status.roomObjects, ...updatedObjects } }));
    }

    // ハマっているオブジェクトのリストをリセット
    snappedObjects = {};

    return new Promise<void>((resolve, reject) => {
      conditions = { action, positions, resolve, reject };
      // 始めた時点で範囲に入っていれば、すぐ成立する
      setTimeout(() => checkConditions(), 0);
    });
  }

  // オブジェクトクリックハンドラー。台本の実行中（台詞の表示中を含む）は受け付けない（台詞の表示中は、台詞を送るだけ）
  function handleObjectClick(object: RoomObject) {
    if (object.onclick) void eventEngine.sendUserAction(object.onclick);
  }

  // ドラッグ（マウス・タッチ）
  function handlePointerDown(event: PointerEvent, key: string) {
    if (!objects[key]?.movable || dragging !== null) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dragging = key;
    dragPointerId = event.pointerId;
    // ドラッグ開始時にハマっている状態を解除
    delete snappedObjects[key];
    dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!dragging || !roomElement || event.pointerId !== dragPointerId) return;
    event.preventDefault();
    // 部屋（額縁の内側）の実際の位置から計算する
    const roomRect = roomElement.getBoundingClientRect();
    const object = objects[dragging];
    const point = {
      x: (event.clientX - roomRect.left - dragOffset.x) / roomRect.width,
      y: (event.clientY - roomRect.top - dragOffset.y) / roomRect.height
    };
    objectPositions = { ...objectPositions, [dragging]: object ? clampToRoom(point, object) : point };
  }

  function handlePointerUp(event: PointerEvent) {
    if (!dragging || event.pointerId !== dragPointerId) return;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
    // ドラッグ終了時にcondition判定を行う
    checkConditions();
    dragging = null;
    dragPointerId = null;
  }

  onMount(() => {
    // 親要素の横幅に合わせたスケール
    const updateScale = () => {
      if (containerElement) scale = (containerElement.clientWidth * widthScale) / frameWidth;
    };
    updateScale();
    window.addEventListener("resize", updateScale);

    // ドラッグ中のスクロール防止
    const preventScroll = (event: Event) => {
      if (dragging) event.preventDefault();
    };
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("wheel", preventScroll, { passive: false });

    // condition コマンドを受け付け、台詞を表示する場所があることをエンジンに知らせる
    const offCondition = eventEngine.registerCommandHandler("condition", handleConditionCommand);
    eventEngine.messageHost = true;

    // 台本を止めた時は、待っていた condition も捨てる（止めた台本の一部なので、後から満たしても action を送らない）。
    // 待っていたエンジンの処理は、止めた後の台本に触れずに終わる
    const offHalt = eventEngine.on("halt", () => {
      const pending = conditions;
      conditions = null;
      pending?.resolve();
    });

    return () => {
      window.removeEventListener("resize", updateScale);
      window.removeEventListener("touchmove", preventScroll);
      window.removeEventListener("wheel", preventScroll);
      offCondition();
      eventEngine.messageHost = false;
      offHalt();
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="room-area" bind:this={containerElement} onclick={eventEngine.handleMessageClick}>
  <div class="room-area__scaled" style:transform="scale({scale})" style:width="{frameWidth}px" style:height="{frameHeight * scale}px">
    <!-- 額縁 -->
    <img class="room-area__frame" src={skinImage("roomFrame")} alt="" style:width="{frameWidth}px" style:height="{frameHeight}px" />

    <!-- 部屋の中身（オブジェクト） -->
    <div
      class="room-area__room"
      class:room-area__room--flash={roomFlash}
      class:room-area__room--flash-strong={roomFlashStrong}
      bind:this={roomElement}
      style:top="{borderSize}px"
      style:left="{borderSize}px"
      style:width="{roomWidth}px"
      style:height="{roomHeight}px"
    >
      {#each sortedObjects as [key, object] (key)}
        {@const position = objectPositions[key] ?? { x: object.x, y: object.y }}
        {@const effects = effectObjects[key] ?? []}
        <!-- 位置と大きさは数として計算する（"0.5" のような数の文字列も使える。値が無ければ指定しない） -->
        <div
          class="room-object"
          class:room-object--movable={object.movable}
          style:left={percent(position.x)}
          style:top={percent(position.y)}
          style:width={percent(object.w)}
          style:height={percent(object.h)}
          style:cursor={object.movable || object.onclick ? "pointer" : "default"}
          style:opacity={dragging === key ? 0.8 : 1}
          style:z-index={dragging === key ? 100 : object.id}
          onpointerdown={object.movable ? (event) => handlePointerDown(event, key) : undefined}
          onclick={!object.movable && object.onclick ? () => handleObjectClick(object) : undefined}
        >
          {#key effects.join("-")}
            <div class="room-object__custom {customEffectClasses(effects)}">
              <div class="room-object__container fx-{effectOf(effects, CONTAINER_EFFECTS) || 'none'}">
                <div class="room-object__image fx-{effectOf(effects, IMAGE_EFFECTS) || 'none'}">
                  <!-- 画像の指定がなければ描かない（onclick があれば、見えないタップの領域になる） -->
                  {#if object.f}<img src={dataImage("room", object.f)} alt="" draggable="false" />{/if}
                </div>
              </div>
            </div>
          {/key}
        </div>
      {/each}

      <!-- 吹き出し -->
      {#if engineState.current.messageVisible}
        <div class="room-bubble">
          <img class="room-bubble__image" src={skinImage("bubble")} alt="" />
          <div class="room-bubble__flex">
            <p class="room-bubble__text">{engineState.current.currentMessage ?? ""}</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .room-area {
    width: 100vw;
    padding: 0 5vw;
    overflow: hidden;
  }

  .room-area__scaled {
    position: relative;
    transform-origin: top left;
  }

  /*
    額縁は id が 10 未満の物より手前に描く（id が 10 以上の物は、額縁の後に並ぶので額縁より手前）。
    操作は下の物へ通す（額縁の下の物も押せるように）。
  */
  .room-area__frame {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10;
    max-width: none;
    pointer-events: none;
  }

  .room-area__room {
    position: absolute;
  }

  /* 部屋全体のフラッシュ */
  .room-area__room::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 50;
    background: white;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }

  /* 通常と強が重なった時は、不透明度は通常（0.8）、切り替えの時間は強（0.3秒） */
  .room-area__room--flash-strong::after {
    opacity: 1;
    transition: opacity 0.3s;
  }

  .room-area__room--flash::after {
    opacity: 0.8;
  }

  .room-object {
    position: absolute;
  }

  .room-object--movable {
    touch-action: none;
  }

  .room-object__custom,
  .room-object__container {
    position: relative;
    width: 100%;
    height: 100%;
    transform-origin: center center;
  }

  .room-object__image {
    width: 100%;
    height: 100%;
  }

  .room-object__image img {
    width: 100%;
    height: 100%;
    max-width: none;
  }

  /* flash と glow は、明るくなってから緩やかに戻る */
  .fx-flash {
    animation: fx-flash 0.8s ease-out;
  }

  .fx-glow {
    animation: fx-glow 0.8s ease-out;
  }

  .fx-scale {
    animation: fx-scale 0.5s linear;
  }

  .fx-shake {
    animation: fx-shake 0.5s ease-in-out;
  }

  .room-bubble {
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 200;
    width: 100%;
    height: 30%;
    cursor: pointer;
  }

  .room-bubble__image {
    position: absolute;
    width: 100%;
    height: 100%;
    max-width: none;
  }

  .room-bubble__flex {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    margin-left: -4vw;
  }

  .room-bubble__text {
    max-width: 75%;
    margin: 0 auto;
    font-family: var(--xl-story-font);
    font-size: 44px;
    text-align: left;
    white-space: pre-wrap;
    color: var(--xl-bubble-text, #2b2546);
  }

  @keyframes fx-flash {
    from {
      filter: brightness(3) contrast(0.7);
    }
    to {
      filter: brightness(1) contrast(1);
    }
  }

  @keyframes fx-glow {
    from {
      filter: brightness(3);
    }
    to {
      filter: brightness(1);
    }
  }

  /* 弾みながら元の大きさに戻る（elastic.out(1, 0.3) の曲線をキーフレームにしたもの） */
  @keyframes fx-scale {
    0% {
      transform: scale(1.5);
    }
    5% {
      transform: scale(1.177);
    }
    10% {
      transform: scale(0.875);
    }
    15% {
      transform: scale(0.823);
    }
    20% {
      transform: scale(0.938);
    }
    25% {
      transform: scale(1.044);
    }
    30% {
      transform: scale(1.063);
    }
    35% {
      transform: scale(1.022);
    }
    40% {
      transform: scale(0.984);
    }
    45% {
      transform: scale(0.978);
    }
    50% {
      transform: scale(0.992);
    }
    55% {
      transform: scale(1.006);
    }
    60% {
      transform: scale(1.008);
    }
    70% {
      transform: scale(0.998);
    }
    80% {
      transform: scale(0.999);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes fx-shake {
    0%,
    100% {
      transform: translateX(0);
    }
    20%,
    60% {
      transform: translateX(-5px);
    }
    40%,
    80% {
      transform: translateX(5px);
    }
  }
</style>
