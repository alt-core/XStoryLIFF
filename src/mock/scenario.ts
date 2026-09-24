/**
 * 作品のモック（projects/<名前>/mock.ts の default）。npm run dev:mock で、LINEとBotの代わりに action へ応答する。
 * 無い作品では、モックで開くとエラーの画面になる（LINEとBotにつないで確かめる）。
 */
export interface MockScenario<State> {
  /** 最初の状態。URL に ?reset を付けた時も、ここから始める。JSON にできる値にする（このタブの sessionStorage に保存する） */
  initialState(): State;
  /**
   * action に、XStoryBot の ##liff.<action> と同じ形の行で応答する（台詞の行、コマンドの配列の JSON の行。
   * データを返す action は、1行目に JSON）。状態は書き換えてよい（書き換えた後の状態を保存する）
   */
  respond(action: string, state: State): string[];
}

/** 作品のモックを書く（型を付けるため） */
export function defineMockScenario<State>(scenario: MockScenario<State>): MockScenario<State> {
  return scenario;
}
