// ビルドの設定（vite.config.ts）からも読み込むので、エンジンは相対pathで読み込む
import { defineProjectConfig } from "../../src/lib/config.ts";

/*
  デモ作品「月灯りの部屋」の設定。
  画面を作る画像は、既定の置き場所（public/skin/）に置いている。ほかの置き場所にする時は images に書く（src/lib/config.ts の SkinImages）。
  Botのデータが指す画像は public/data/ に置いている。
*/
export default defineProjectConfig({
  title: "月灯りの部屋",
  font: {
    family: "Zen Maru Gothic",
    cssUrl: "https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap"
  },
  titles: {
    room: "月灯りの部屋",
    words: "ことば帳",
    links: "リンク",
    missions: "ミッション",
    messages: "手紙"
  },
  menu: [
    { id: "missions", label: "ミッション", image: "/skin/buttons/button_missions.png", href: "/missions/" },
    { id: "words", label: "ことば帳", image: "/skin/buttons/button_words.png", href: "/words/" },
    { id: "messages", label: "手紙", image: "/skin/buttons/button_messages.png", href: "/messages/" },
    { id: "links", label: "リンク", image: "/skin/buttons/button_links.png", href: "/links/" },
    { id: "talk", label: "話しかける", image: "/skin/buttons/button_talk.png", send: "こんばんは" },
    { id: "moon_door", label: "月の扉", image: "/skin/buttons/button_moon_door.png", action: "open_moon_door" }
  ],
  links: [
    {
      id: "clipping",
      title: "月見新聞 第三二八号",
      url: "/documents/clipping/",
      imageUrl: "/skin/banners/banner_clipping.png",
      isExternal: false
    },
    {
      id: "xstorybot",
      title: "XStoryBot",
      url: "https://github.com/alt-core/XStoryBot",
      imageUrl: "/skin/banners/banner_xstorybot.png",
      eventImageUrls: { moonlit: "/skin/banners/banner_xstorybot_moonlit.png" },
      isExternal: true
    },
    {
      id: "liff",
      title: "LINE Developers｜LIFF",
      url: "https://developers.line.biz/ja/docs/liff/",
      imageUrl: "/skin/banners/banner_liff.png",
      isExternal: true
    }
  ],
  documents: {
    clipping: { title: "月見新聞 第三二八号", image: "clipping.png", background: "#07070f", back: true },
    memo: { title: "ルゥのメモ", image: "memo.png", noise: "noise", routes: { clear: "none", broken: "heavyNoise" }, background: "#1a1633", back: true }
  }
});
