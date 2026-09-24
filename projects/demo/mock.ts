import type { InboxMessage, Mission, RoomObject, UserStatus, WordValue } from "@/lib/types.ts";
import { defineMockScenario } from "@/mock/scenario.ts";

/*
  デモ作品のモック（npm run dev:mock で、LINEとBotの代わりに応答する）。値の形は、XStoryBot の ##liff.<action> が返す応答と同じ。
  - 台詞はそのまま1行
  - コマンドは JSON のコマンドの配列の1行（例: [["set","ruu",{...}],["wait",1]]）
  - データを返す action（get_status など）は、1行目に JSON
  同じ動きの XStoryBot のシナリオは xstorybot/ にある。
*/

export const ROOM: Record<string, RoomObject> = {
  base: { f: "room-base.svg", x: 0, y: 0, w: 1, h: 1, id: 0 },
  window: { f: "window.svg", x: 0.08, y: 0.07, w: 0.34, h: 0.46, id: 1, onclick: "look_window" },
  shelf: { f: "shelf.svg", x: 0.66, y: 0.08, w: 0.28, h: 0.46, id: 1 },
  rug: { f: "rug.svg", x: 0.14, y: 0.74, w: 0.66, h: 0.2, id: 1 },
  desk: { f: "desk.svg", x: 0.6, y: 0.47, w: 0.37, h: 0.4, id: 2, onclick: "touch_lamp" },
  letter: { f: "letter.svg", x: 0.75, y: 0.548, w: 0.1, h: 0.0556, id: 3, onclick: "open_letter" },
  plant: { f: "plant.svg", x: 0.01, y: 0.49, w: 0.15, h: 0.4, id: 3 },
  jar: { f: "jar.svg", x: 0.19, y: 0.58, w: 0.12, h: 0.19, id: 4, onclick: "touch_jar" },
  ruu: { f: "ruu.svg", x: 0.36, y: 0.33, w: 0.27, h: 0.48, id: 5, onclick: "talk_ruu" }
};

export const WORDS: Record<string, WordValue> = {
  "こんばんは": 1,
  "つき": { w: "月", s: "つき" },
  "ほし": { w: "星", s: "ほし" },
  "よる": { w: "夜", s: "よる" },
  "かぎ": { w: "かぎ", onclick: "about_key" },
  "ほしのうた": { w: "ほしのうた", f: "hoshi-no-uta.png" },
  "ランプ": 1,
  "LINE": 1,
  "■1": { w: "■■■■", s: "■1" },
  "■2": { w: "■■", s: "■2" }
};

export const MISSIONS: Mission[] = [
  { id: 1, img1: "hello.png", img2: "hello.png", cleared: true },
  { id: 2, img1: "jar.png", img2: "jar.png" },
  { id: 3, img1: "letter.png", img2: "letter.png" },
  { id: 4, img1: "words.png", img2: "words.png", cleared: true }
];

export const MESSAGES: InboxMessage[] = [
  { id: "welcome", from: "ルゥ", title: "はじめまして", read: false, sort: 30, content: "welcome" },
  { id: "news", from: "月見新聞", title: "号外：月から「ことば」がこぼれた？", read: false, sort: 20, content: "news", onopen: "read_news" },
  { id: "about", from: "XStoryLIFF", title: "このデモについて", read: true, sort: 10, content: "about" }
];

export const MESSAGE_BODIES: Record<string, string> = {
  welcome: [
    "<p>はじめまして。ルゥです。</p>",
    "<p>この部屋には、むかしはたくさんの「ことば」がありました。気がついたら、ほとんどが月の光にとけて、どこかへ行ってしまったの。</p>",
    "<p>LINEで話しかけてくれたら、ことばを少しずつ思い出せる気がします。よかったら、手伝ってください。</p>"
  ].join(""),
  news: [
    '<p style="color:#ffd99a;font-weight:bold">月見新聞・号外</p>',
    "<p>昨夜、町の上空で月の光が糸のようにほどけ、屋根の上に小さな文字が降り積もるのが目撃された。専門家は「ことばの流れ星」と呼んでいる。</p>",
    '<p><a href="../documents/clipping/" style="color:#9fd3ff;text-decoration:underline">記事の切り抜きを見る</a></p>'
  ].join(""),
  about: [
    "<p>これは <strong>XStoryLIFF</strong> のデモです。LINEとBotにつながず、ブラウザーの中だけで動いています。</p>",
    "<p>部屋のルゥやビン、机の手紙にさわると、Botから届く台本（イベント）の動きを試せます。</p>",
    "<p>チャットへの送信やLIFFを閉じる操作は、画面下のお知らせで代わりに表示します。</p>"
  ].join("")
};

const commands = (...list: unknown[][]) => JSON.stringify(list);
const ruu = (f: string, effect?: string): RoomObject => ({ ...ROOM.ruu, f, ...(effect ? { effect } : {}) });

/** 状態を変えない台本 */
export const ACTIONS: Record<string, string[]> = {
  "intro:room": [
    commands(["set", "ruu", ruu("ruu-smile.svg", "scale")]),
    "……あ、来てくれたんだ。",
    "わたしはルゥ。この部屋で、なくした「ことば」を探しているの。",
    commands(["command", "intro_2"])
  ],
  talk_ruu: [commands(["set", "ruu", ruu("ruu-smile.svg")]), "なあに？", "今夜は月がきれいだね。", commands(["set", "ruu", ruu("ruu.svg")])],
  look_window: ["窓の外に、大きな月が浮かんでいる。", "ときどき、光のすじが町へ落ちていくのが見える。"],
  touch_lamp: [commands(["set", "desk", { ...ROOM.desk, effect: "glow" }]), "ランプに手をかざすと、ほんのり温かい。"],
  open_moon_door: [
    commands(["set", "ruu", ruu("ruu-surprised.svg", "shake")]),
    "扉のすきまから、月の光がさしこんできた……！",
    commands(["set", "ruu", ruu("ruu.svg")]),
    "光のなかに、読めない文字が浮かんでいる。",
    commands(["go", "/documents/memo/?route=broken"])
  ]
};

/** デモの状態（このタブの間、保存する） */
interface DemoState {
  status: UserStatus;
  /** 既読にした手紙 */
  read: string[];
  /** 謎を解いた、号外を開いた、など */
  flags: Record<string, boolean>;
}

/** 見つけたことばの数（「■」で始まる語は数えない） */
function countWords(words: Record<string, WordValue> | undefined) {
  return Object.entries(words ?? {}).filter(([key, value]) => {
    const sortKey = value && typeof value === "object" && value.s ? value.s : key;
    return !sortKey.startsWith("■");
  }).length;
}

function clearMission(status: UserStatus, id: number) {
  const mission = status.missions?.find((item) => item.id === id);
  if (mission) mission.cleared = true;
}

export default defineMockScenario<DemoState>({
  initialState: () => ({
    status: {
      event: { intro: 10 },
      lv: 1,
      n_words: 0,
      menu: ["missions", "words", "links", "talk"],
      roomObjects: structuredClone(ROOM),
      words: structuredClone(WORDS),
      missions: structuredClone(MISSIONS)
    },
    read: [],
    flags: {}
  }),

  respond(action, current) {
    const status = current.status;

    if (action === "get_status") {
      return [JSON.stringify({ ...status, n_words: countWords(status.words) })];
    }
    if (action === "get_messages") {
      return [JSON.stringify(MESSAGES.map((message) => ({ ...message, read: message.read || current.read.includes(message.id) })))];
    }

    const [name, argument = ""] = action.includes(":") ? [action.slice(0, action.indexOf(":")), action.slice(action.indexOf(":") + 1)] : [action];
    switch (name) {
      case "message_content":
        return MESSAGE_BODIES[argument] ? [MESSAGE_BODIES[argument]] : [];
      case "on_message_read":
        if (!current.read.includes(argument)) current.read.push(argument);
        return [];
      case "intro_2":
        // 登場イベントを終え、手紙のボタンを演出付きで出す（次からは menu に入る）
        status.event = {};
        status.menu = [...new Set([...(status.menu ?? []), "messages"])];
        return [
          "LINEで話しかけてくれたら、見つけたことばが「ことば帳」に集まるよ。",
          commands(["set", "messages", { visible: true }]),
          "それと、わたしに届いた「手紙」も、よかったら読んでね。"
        ];
      case "touch_jar":
        if (current.flags.jar) return ["ビンの中で、星が静かに光ってる。"];
        return [
          commands(["set", "ruu", ruu("ruu-surprised.svg", "shake")]),
          "あっ、ビンの星がこぼれてる！",
          commands(["set", "star", { f: "star.svg", x: 0.8, y: 0.85, w: 0.075, h: 0.08, id: 6, effect: "scale" }], ["set", "ruu", ruu("ruu.svg")]),
          "床の星を、ビンまで運んでくれる？",
          commands(["condition", "jar_done", [["position", ["star", 0.17, 0.6, 0.255, 0.71]]]])
        ];
      case "jar_done": {
        current.flags.jar = true;
        const jar: RoomObject = { ...ROOM.jar, f: "jar-glow.svg" };
        if (status.roomObjects) status.roomObjects.jar = jar;
        clearMission(status, 2);
        status.words = { ...status.words, "つきあかり": { w: "月明かり", s: "つきあかり" } };
        // 月の扉のボタンを出す（次からは menu に入る）
        status.menu = [...new Set([...(status.menu ?? []), "moon_door"])];
        return [
          commands(["set", "star", null], ["set", "jar", { ...jar, effect: "glow,room_flash" }], ["set", "ruu", ruu("ruu-smile.svg")]),
          "ありがとう！　星がもどったよ。",
          "お礼に、ひとつことばを思い出したの。……「月明かり」。",
          commands(["set_hud", "n_words", countWords(status.words)], ["set", "moon_door", { visible: true }], ["set", "ruu", ruu("ruu.svg")])
        ];
      }
      case "about_key": {
        // ことば帳の「かぎ」の onclick。ことば帳には台詞を出す場所がないので、ことばを絵に変えて知らせる。
        // onclick を外すので、次からは押すとトークへ「かぎ」を送る
        const key = { w: "かぎ", f: "kagi.png" };
        status.words = { ...status.words, "かぎ": key };
        return [commands(["set", "かぎ", key])];
      }
      case "open_letter":
        clearMission(status, 3);
        return ["机の上の手紙には、何か書いてあるみたい。", commands(["go", "/documents/memo/"])];
      case "read_news":
        // 手紙を開いた時の onopen。手紙のページには台詞を出す場所がないので、ステータスの変化で知らせる
        if (!current.flags.news) {
          current.flags.news = true;
          status.lv = 2;
          return [commands(["set_hud", "lv", 2])];
        }
        return [];
      default:
        return ACTIONS[action] ?? [];
    }
  }
});
