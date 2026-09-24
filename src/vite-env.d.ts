/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** LINE: LIFF ID */
  readonly VITE_LIFF_ID?: string;
  /** LINE: XStoryBot の API の基点（https://<host>。LIFF API は <基点>/liff/<Bot名>/message） */
  readonly VITE_API_BASE_URL?: string;
  /** LINE: XStoryBot の Bot名 */
  readonly VITE_BOT?: string;
  /** LINE: LINEアプリ以外で開かれた時の転送先 */
  readonly VITE_FORWARD_URL?: string;
  /** webchat: ページを iframe で開く XStoryBot の Webchat の画面のオリジン（https://<host>） */
  readonly VITE_WEBCHAT_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** 使う作品（XSTORYLIFF_PROJECT で選んだ projects/<名前>/）の設定。vite.config.ts の @project で読み込む */
declare module "@project/config.ts" {
  const config: import("./lib/config.ts").ProjectConfig;
  export default config;
}
