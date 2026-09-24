/*
  Botとやり取りするデータの形。
*/

/** 台本の1コマンド。先頭がコマンド名 */
export type Command = [string, ...unknown[]];

/** Roomのオブジェクト（get_status の roomObjects の値）。座標と大きさは部屋に対する割合 */
export interface RoomObject {
  /** 画像のファイル名（<dataDir>/room/ から読む） */
  f?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 重なり順。大きいほど手前。額縁は 10 */
  id?: number;
  /** タップした時に実行する action */
  onclick?: string;
  /** 演出（カンマ区切り）: flash, glow, scale, shake, room_flash, room_flash_strong */
  effect?: string;
  /** ドラッグで動かせるか（condition の対象になると true になる） */
  movable?: boolean;
  /** メニューのボタンを出す（メニューのIDと同じ名前のオブジェクトに付ける） */
  visible?: boolean;
}

/** ことば帳の語の値。オブジェクトでなければ、キーをそのまま表示する */
export interface WordObject {
  /** 表示文字列（省略時はキー） */
  w?: string;
  /** 並べ替えの読み（省略時はキー）。「■」で始まると末尾 */
  s?: string;
  /** 文字の代わりに表示する画像（<dataDir>/words/）。null なら文字に戻す */
  f?: string | null;
  /** 画像を切り替える時のクロスフェードの秒数 */
  fade?: number | string;
  /** タップした時に、トークへ送る代わりに実行する action */
  onclick?: string;
}

export type WordValue = WordObject | string | number | boolean | null;

/** ミッション（get_status の missions の要素） */
export interface Mission {
  id: number | string;
  /** 進行中の画像（<dataDir>/missions/current/） */
  img1?: string;
  /** 達成後の画像（<dataDir>/missions/cleared/） */
  img2?: string;
  cleared?: boolean;
}

/** get_status の応答 */
export interface UserStatus {
  /** 進行中のイベントと優先度 */
  event?: Record<string, number>;
  /** ステータス表示の値 */
  lv?: number | string;
  n_words?: number | string;
  roomObjects?: Record<string, RoomObject>;
  words?: Record<string, WordValue>;
  missions?: Mission[];
  /** Roomの下に出すメニューのID（設定の menu の id）。無ければ、ボタンを出さない */
  menu?: string[];
  [key: string]: unknown;
}

/** 手紙（get_messages の要素） */
export interface InboxMessage {
  id: string;
  from?: string;
  title: string;
  read?: boolean;
  /** 大きいほど上 */
  sort?: number;
  /** 本文の名前（message_content:<content>） */
  content: string;
  /** 開いた時に実行する action */
  onopen?: string;
}
