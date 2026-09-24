# 開発と動作確認

Node.js 22.18以降を使います（ビルドの設定が、作品の `config.ts` を TypeScript のまま読み込むため）。

```sh
npm install
```

## LINEなしで確かめる（モック）

```sh
npm run dev:mock
```

`http://127.0.0.1:5173/` を開きます。LINEとBotの代わりに、作品のモック（`projects/<名前>/mock.ts`）が応答します。

| ファイル | 内容 |
|---|---|
| `projects/<名前>/mock.ts` | 作品のモック。最初の状態と、actionへの応答（Botの `##liff.*` の応答と同じ形の行）を書く |
| `src/mock/bot.ts` | Botの代わり。作品のモックに応答を任せる。状態の保存と、下のパラメーター |
| `src/mock/liff.ts` | LINEとBotの代わりの接続（`src/lib/xstorybot.ts` の接続と同じ形。同時に1つの操作だけを受け付ける）。トークへの送信とLIFFを閉じる操作は、画面下のお知らせで表示する |

作品のモックは、次の形で書きます（デモの `projects/demo/mock.ts` が例です）。モックの無い作品は、モックで開くとエラーの画面になります。

```ts
import { defineMockScenario } from "@/mock/scenario.ts";

export default defineMockScenario({
  // 最初の状態（JSON にできる値）
  initialState: () => ({ status: { event: {}, lv: 1, menu: ["words"], roomObjects: {}, words: {} } }),
  // actionへの応答。状態は書き換えてよい
  respond(action, state) {
    if (action === "get_status") return [JSON.stringify(state.status)];
    return [];
  }
});
```

進行はブラウザーのタブごと（sessionStorage）に、作品ごとに分けて保存します。URLに次のパラメーターを付けられます。

| パラメーター | 動き |
|---|---|
| `?reset` | 最初からやり直す |
| `?event=<名前>` | そのイベントの最中として開く（`?event=` だけならイベントなし） |

モックのデータを変えれば、Botのシナリオを書く前に、画面の見え方や台本の動きを試せます。

## XStoryBotで確かめる

[サンプルシナリオ](../../projects/demo/xstorybot/README.md)を、XStoryBotのローカル環境で動かせます。LINEに接続しなくても、トーク側の応答とフラグを確かめられます。

LIFFの画面をLINEで開くには、HTTPSのURLが要ります。開発中の画面は、トンネル（ngrok、Cloudflare Tunnelなど）で公開し、LIFFアプリのエンドポイントURLに設定します。

```sh
npm run dev
```

`npm run dev` では、`.env.local` などの `VITE_LIFF_ID`・`VITE_API_BASE_URL`・`VITE_BOT` を使います。開発中は、台本を止めた時の原因も画面に表示します。

## XStoryBotのWebchatで確かめる

XStoryBotの手元のWebchat（`tools/local_scenario.py webchat`）の中で、開発中の画面を開けます。LINEもトンネルも要りません。

1. XStoryBotの `settings.yaml` で、Botに `liff` と `webchat` のinterfaceを置き、`liff_apps` に開発中の画面を登録します。手元では `http://127.0.0.1:<port>` のURLも使えます。

   ```yaml
   plugins:
     liff:
       allow_origin: 'http://127.0.0.1:5173'
       ignore_unhandled_action: true
   bots:
     bot:
       interfaces:
         - type: webchat
           params:
             liff_apps:
               room: {bot: bot, url: 'http://127.0.0.1:5173/', liff_id: YOUR_LIFF_ID, match: prefix}
         - type: liff
   ```

2. XStoryBotのリポジトリで、`python tools/local_scenario.py webchat --settings settings.yaml --bot bot` を実行します。
3. XStoryLIFFで、`VITE_WEBCHAT_ORIGIN=http://127.0.0.1:8765 npm run dev` を実行します。
4. `http://127.0.0.1:8765/chat/bot` を開き、シナリオのボタンなどから `https://liff.line.me/YOUR_LIFF_ID` のリンクを押すと、チャットの中に画面が開きます（[サンプルシナリオ](../../projects/demo/xstorybot/README.md)では「へや」）。

## テストと検査

```sh
npm test            # 単体テスト（Vitest）
npm run check       # 型検査（svelte-check と tsc）
npm run build:mock  # モックで動くビルド
```

エンジンの単体テストは `tests/` に、作品のテストは作品のフォルダ（`projects/<名前>/*.test.ts`）にあります。プッシュすると、GitHub Actions（`.github/workflows/ci.yml`）が型検査・単体テスト・モックのビルドを確かめます。

| ファイル | 内容 |
|---|---|
| `eventEngine.test.ts` | 台本の進み方、読み込み中の実行、不具合の時に止める動き |
| `api.test.ts` | Botへの送信（送る順に1つずつ）、起動方法（LINEとWebchat）、アプリの中のリンク |
| `xstorybot.test.ts` | XStoryBotの取り決め（LINEのLIFF APIへの送信と失敗の分け方、Webchatの画面とのやり取り、送り元の確かめ、起動パラメータの引き継ぎ） |
| `userStatus.test.ts` | 利用者の状態（`get_status`）の形の確かめ方 |
| `words.test.ts` | ことば帳の見出しと並べ方 |
| `roomConditions.test.ts` | condition の読み方、吸い付く位置、ドラッグの範囲 |
| `sanitize.test.ts` | 手紙の本文の無害化 |
| `pages.test.ts` | URLからページを決める |
| `menu.test.ts` | メニューに出すボタン（Bot が menu を返さなければ出さない） |
| `projects/demo/mock.test.ts` | デモの台本（モック）に、受け付けないコマンドや行き先の無いactionが無いこと。台詞を出せないページから呼ぶactionに台詞が無いこと |

## ソースの構成

| 場所 | 内容 |
|---|---|
| `src/lib/eventEngine.ts` | 台本を実行するエンジン |
| `src/lib/page.ts` | ページの初期化（`initPage`。ページ名、画像の読み込み、コマンドのハンドラー） |
| `src/lib/app.svelte.ts`・`src/lib/inbox.svelte.ts` | 利用者の状態（`get_status`）と手紙の一覧。Svelte の runes（`$state`）で持つ |
| `src/lib/api.ts`・`src/lib/liff.ts` | Botとの通信（送る順に1つずつ）、LINEとWebchatの見分けと接続 |
| `src/lib/xstorybot.ts` | XStoryBotの取り決めのページ側（LINEのLIFF APIへの送信、Webchatの画面とのやり取り、起動パラメータの引き継ぎ） |
| `src/lib/imageLoader.ts`・`src/lib/fontLoader.ts` | 画像と書体（台詞の文字の分）の読み込みを待つ |
| `src/lib/values.ts` | 台本の値の読み方（数の文字列、空でない文字列） |
| `src/lib/setup.ts` | 作品の準備（`setup.ts`）の形 |
| `src/components/screens/` | 各ページ |
| `src/components/ui/` | ページの部品（Room、ステータス表示、戻るボタン、台詞の吹き出しなど） |
| `src/mock/` | LINEとBotの代わり（作品のモックを呼ぶ） |
| `src/pages.ts` | URLからページを決める |
| `projects/<名前>/` | 作品ごとの設定、スキン、画像、作品固有のページ、モック |
| `vite.config.ts` | ビルド。使う作品を選び（`XSTORYLIFF_PROJECT`）、ページごとの入口（`words/index.html` など）も作る |

## XStoryBotの取り決めが変わった時

XStoryBotとの取り決め（LINEのLIFF APIと、Webchatのiframeとのやり取り）のページ側は、`src/lib/xstorybot.ts` にXStoryLIFFのコードとして持っています（XStoryBotは、ページ側の実装を持ちません）。XStoryBotの[LIFFページとWebchatの連携仕様](https://github.com/alt-core/XStoryBot/blob/master/docs/liff-webchat-api.md)が変わった時（とくにprotocolのversionが上がった時）は、ここを合わせ、`tests/xstorybot.test.ts` と手元のWebchatで確かめます。

## エンジンの更新を取り込む

作品を `projects/<名前>/` と `.env`、作品の説明（直下の `README.md` と `docs/` の直下）だけに書いていれば、エンジンの更新は、フォーク元の変更を取り込むだけで済みます。エンジンの説明（`docs/xstoryliff/`）も、フォーク元が更新します。直下の `README.md` は、フォーク元では短い案内だけにしてあるので、作品の説明に書き換えても、取り込みで食い違うことはほとんどありません。

```sh
git remote add upstream https://github.com/alt-core/XStoryLIFF.git   # 初めの一度だけ
git fetch upstream
git merge upstream/main
npm install
npm test && npm run check
```

エンジン（`src/`）やエンジンの説明書を直接書き換えると、取り込む時に食い違うことがあります。作品ごとの違いは、作品のフォルダ（設定、`skin.css`、`pages/`、`setup.ts`）に書いてください。標準のページを大きく変えたい時は、同じpathの作品固有のページを作ると、標準のページより優先します。
