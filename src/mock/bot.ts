import type { MockScenario } from "./scenario.ts";

/*
  Botの代わり（npm run dev:mock）。作品のモック（projects/<名前>/mock.ts）に action への応答を任せる。
  作品の状態は、このタブの sessionStorage に保存する。
  URLに ?reset を付けると最初から、?event=<名前> を付けるとそのイベント中として開く（get_status の event を置き換える。?event= だけならイベントなし）。
*/
const scenarios = import.meta.glob<{ default: MockScenario<unknown> }>("@project/mock.ts");

let loaded: { scenario: MockScenario<unknown>; state: unknown; storageKey: string } | null = null;

async function load() {
  if (loaded) return loaded;
  const [entry] = Object.entries(scenarios);
  if (!entry) throw new Error("この作品にはモック（projects/<名前>/mock.ts）がありません。LINEとBotにつないで確かめてください");
  const [path, importScenario] = entry;
  const { default: scenario } = await importScenario();
  // 作品ごとに分けて保存する（作品を切り替えた時に、別の作品の状態を読まない）
  const storageKey = `xstoryliff-mock:${path}`;
  let state: unknown;
  if (!new URLSearchParams(window.location.search).has("reset")) {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) state = JSON.parse(saved);
    } catch {
      // 読めなければ最初から
    }
  }
  loaded = { scenario, state: state ?? scenario.initialState(), storageKey };
  return loaded;
}

function save() {
  if (!loaded) return;
  try {
    sessionStorage.setItem(loaded.storageKey, JSON.stringify(loaded.state));
  } catch {
    // 保存できないブラウザーでは、ページの中だけで進行を保つ
  }
}

/** ?event=<名前> の時は、get_status の event を置き換える */
function withForcedEvent(lines: string[]): string[] {
  const forced = new URLSearchParams(window.location.search).get("event");
  if (forced === null || typeof lines[0] !== "string") return lines;
  const status = JSON.parse(lines[0]);
  return [JSON.stringify({ ...status, event: forced ? { [forced]: 1 } : {} }), ...lines.slice(1)];
}

/** action への応答（シナリオが返した行の配列。XStoryBot の LIFF API の応答を読んだ後と同じ形） */
export async function mockRequest(action: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 160));
  const { scenario, state } = await load();
  const lines = scenario.respond(action, state);
  save();
  return action === "get_status" ? withForcedEvent(lines) : lines;
}
