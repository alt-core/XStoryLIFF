import eventEngine, { type EngineState } from "./eventEngine.ts";

/** イベントエンジンの状態を、画面から読むための写し。エンジンの stateChange で更新する */
class EngineStateView {
  current = $state.raw<EngineState>(eventEngine.getState());
}

export const engineState = new EngineStateView();

eventEngine.on("stateChange", (state: EngineState) => {
  engineState.current = { ...state };
});
