/*
  作品ごとの設定の形。作品固有の値（画像の置き場所、文言、メニュー、リンク、資料など）を、作品のフォルダの config.ts（projects/<名前>/config.ts）から与える。
  画面を作る画像の既定の置き場所は、作品の public/skin/。
*/

/** 画面を作る画像の置き場所（作品の public/ からのpath） */
export interface SkinImages {
  /** ページの背景（幅いっぱいに描き、縦に繰り返す） */
  background: string;
  /** ページの見出しの画像 */
  titleRoom: string;
  titleWords: string;
  titleLinks: string;
  titleMissions: string;
  titleMessages: string;
  /** ステータス表示の背景（lv と n_words を重ねる） */
  status: string;
  /** Roomの額縁 */
  roomFrame: string;
  /** 台詞の吹き出し */
  bubble: string;
  /** Roomへ戻るボタン */
  back: string;
  /** ことば帳の行の印 */
  star: string;
  /** ことば帳の「■」の見出し */
  unknownSymbol: string;
  /** ミッション一覧の見出し（タブの絵を含む） */
  missionsHeaderCurrent: string;
  missionsHeaderCleared: string;
  /** メッセージの枠（border-image）、小見出し、区切り線、行の矢印、一覧へ戻るボタン */
  messagesFrame: string;
  messagesSubtitle: string;
  messagesLine: string;
  messagesNext: string;
  messagesBack: string;
}

export const DEFAULT_IMAGES: SkinImages = {
  background: "/skin/bg.svg",
  titleRoom: "/skin/title_room.png",
  titleWords: "/skin/title_words.png",
  titleLinks: "/skin/title_links.png",
  titleMissions: "/skin/title_missions.png",
  titleMessages: "/skin/title_messages.png",
  status: "/skin/bg_status.png",
  roomFrame: "/skin/room_frame.svg",
  bubble: "/skin/fukidashi.svg",
  back: "/skin/button_back.png",
  star: "/skin/icon_star.svg",
  unknownSymbol: "/skin/unknown_symbol.svg",
  missionsHeaderCurrent: "/skin/header_missions_current.png",
  missionsHeaderCleared: "/skin/header_missions_cleared.png",
  messagesFrame: "/skin/messages_frame.svg",
  messagesSubtitle: "/skin/messages_subtitle.png",
  messagesLine: "/skin/messages_line.svg",
  messagesNext: "/skin/messages_next.svg",
  messagesBack: "/skin/messages_back.png"
};

/** Roomの下のメニューのボタン */
export interface MenuButton {
  /** get_status の menu に並べるID。roomObjects の同じ名前に visible: true を set すると、演出付きで出てくる */
  id: string;
  /** ボタンの画像 */
  image: string;
  /** ボタンの名前（画像の代替テキスト。読み上げなどに使う） */
  label?: string;
  /** 押した時の動き。移動先のpath、トークへ送る文字列（送ってLIFFを閉じる）、Botのaction のどれか */
  href?: string;
  send?: string;
  action?: string;
}

/** リンク集の項目 */
export interface LinkItem {
  id: string | number;
  title: string;
  url: string;
  /** バナー画像 */
  imageUrl: string;
  /** 進行中のイベントに応じて差し替えるバナー（イベント名 → 画像） */
  eventImageUrls?: Record<string, string>;
  /** true: 外で開く（LINE では外部ブラウザー。openExternalBrowser=1 を付ける。XStoryBot の Webchat では新しいタブ）。false: アプリの中で移る */
  isExternal: boolean;
}

/** 資料のグリッチの強さ */
export type NoiseLevel = "none" | "noise" | "heavyNoise";

/** 資料（/documents/<id>/ で開く） */
export interface DocumentItem {
  /** タブのタイトルと画像の代替テキスト */
  title: string;
  /** 画像のファイル名（<dataDir>/documents/ から読む） */
  image: string;
  /** グリッチの強さの既定。省略時は none（素の画像） */
  noise?: NoiseLevel;
  /** URLの ?route= の値ごとの強さ */
  routes?: Record<string, NoiseLevel>;
  /** 画像の周りの背景色（既定は #000） */
  background?: string;
  /** Roomへ戻るボタンを出すか（既定は出さない。資料だけを見せる） */
  back?: boolean;
}

export interface ProjectConfig {
  /** 作品名 */
  title: string;
  /** 台詞の書体。読み込みを待ってから画面を出す */
  font: {
    family: string;
    /** 書体のCSSのURL（Google Fonts など） */
    cssUrl?: string;
  };
  /** 画面を作る画像の置き場所。書かなかったものは、既定の置き場所（DEFAULT_IMAGES。作品の public/skin/ の決まった名前）を使う */
  images?: Partial<SkinImages>;
  /** Botのデータが指す画像のディレクトリ（既定は /data。room/・words/・missions/・documents/ を置く） */
  dataDir?: string;
  /** Roomの額縁の画像の大きさと枠の太さ（既定はデモの額縁の 1034×934、太さ 17）。部屋はその内側 */
  room?: {
    frameWidth: number;
    frameHeight: number;
    border: number;
  };
  /** ページのタイトル（ブラウザーのタイトルと、見出しの画像の代替テキスト） */
  titles: {
    room: string;
    words: string;
    links: string;
    missions: string;
    messages: string;
  };
  /** Roomの下のメニュー */
  menu: MenuButton[];
  /** リンク集 */
  links: LinkItem[];
  /** 資料。キーがページ名（/documents/<キー>/） */
  documents: Record<string, DocumentItem>;
}

export function defineProjectConfig(config: ProjectConfig): ProjectConfig {
  return config;
}
