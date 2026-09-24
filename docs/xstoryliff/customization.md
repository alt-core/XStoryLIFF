# 作品に合わせた設定と拡張

作品は、`projects/<名前>/` のフォルダにまとめます。使う作品は、リポジトリの直下の `.env` の `XSTORYLIFF_PROJECT` で選びます（書かなければ同梱のデモ `projects/demo/`）。新しい作品は、デモのフォルダを複製して始めると、必要なファイルがそろいます。

| 作品のフォルダの中 | 内容 |
|---|---|
| `config.ts` | 作品の設定（この文書の1節） |
| `skin.css` | スキンのCSS変数（3節） |
| `public/skin/` | 画面を作る画像（2節） |
| `public/data/` | Botのデータが指す画像（4節） |
| `pages/` | 作品固有のページ（6節。任意） |
| `setup.ts` | 全ページで使うコマンドなど（7節。任意） |
| `mock.ts` | LINEなしで確かめるためのモック（[開発と動作確認](development.md)。任意） |

作品の `public/` の中身は、配置先の直下に置かれます（`public/skin/bg.svg` は `/skin/bg.svg`）。

## 1. 作品の設定（`config.ts`）

`config.ts` は、ビルドの設定（`vite.config.ts`）からも Node.js で読み込みます。エンジンの型は相対path（`../../src/lib/config.ts`）で読み込み、画像の `import` などは書かず、値だけを書いてください。

| 項目 | 内容 |
|---|---|
| `title` | 作品名 |
| `font.family`・`font.cssUrl` | 台詞の書体と、その書体のCSSのURL（Google Fontsなど）。CSSと、かな・英数字の書体を読み込んでから画面を出す。台本の台詞の文字も、出す前に読み込む（文字の範囲ごとにファイルが分かれた書体でも、台詞を別の書体で見せない。待つのは3秒まで） |
| `images` | 画面を作る画像の置き場所（2節）。書かなかったものは、既定の置き場所（作品の `public/skin/` の決まった名前）を使う |
| `dataDir` | Botのデータが指す画像のディレクトリ（既定は `/data`） |
| `room` | Roomの額縁の画像の大きさ（`frameWidth`・`frameHeight`、px）と枠の太さ（`border`）。部屋はその内側で、座標の0〜1はこの内側に対する割合。既定はデモの額縁の 1034×934、太さ 17 |
| `titles` | ページごとのタイトル。ブラウザーのタイトルと、見出しの画像の代替テキストに使う |
| `menu` | Roomの下のボタン（下の表） |
| `links` | リンク集（下の表） |
| `documents` | 資料（5節） |

`menu` の要素:

| 項目 | 内容 |
|---|---|
| `id` | `get_status` の `menu` に並べるID。台本で同じ名前に `visible` を `set` すると、演出付きで現れる |
| `image` | ボタンの画像 |
| `label` | ボタンの名前（画像の代替テキスト。読み上げなどに使う） |
| `href`・`send`・`action` | 押した時の動き。どれか1つを書く。`href` はそのページへ移る。`send` はトークへ送ってLIFFを閉じる。`action` はBotへ送って台本を動かす |

`links` の要素:

| 項目 | 内容 |
|---|---|
| `id`・`title` | ID と名前 |
| `url` | 開くURL。`/` で始まるpathは、配置先からのpath |
| `imageUrl` | バナーの画像 |
| `eventImageUrls` | イベントの間だけ差し替えるバナー（イベント名 → 画像）。進行中のイベントが複数あれば、優先度の最も高いもの |
| `isExternal` | `true` なら外で開く（LINEでは外部ブラウザー。`openExternalBrowser=1` を付ける。XStoryBotのWebchatでは新しいタブ）。`false` ならアプリの中で移る |

## 2. 画面を作る画像（`images`）

画面の多くは画像で描きます。見出しやボタンの文字も、作品の書体で描いた画像です。幅は画面の幅（vw）に対する表示の大きさで、画像はこの比率で縮めて表示します。高さは画像の縦横比で決まります。

既定の置き場所は、作品の `public/skin/` の下の決まった名前です（下の表）。デモのフォルダを複製した時は、デモの画像が入っています。作品の画像にする時は、同じ名前のファイルを置き換えるか、`images` に置き場所を書きます。

| キー | 既定の置き場所 | 表示 |
|---|---|---|
| `background` | `/skin/bg.svg` | ページの背景。幅いっぱいに描き、縦に繰り返す |
| `titleRoom`〜`titleMessages` | `/skin/title_room.png` など | ページの見出し。幅86vw |
| `status` | `/skin/bg_status.png` | ステータス表示の背景。幅72vw。Lvとことばの数を上に重ねる（3節） |
| `roomFrame` | `/skin/room_frame.svg` | Roomの額縁。`room` の大きさの画像を、幅90vwに縮める。重なり順は10で、`id` が10未満の物より手前に描く。タップは下の物へ通す |
| `bubble` | `/skin/fukidashi.svg` | 台詞の吹き出し。部屋の下から30%の高さに、部屋の幅いっぱいに引き伸ばす |
| `back` | `/skin/button_back.png` | Roomへ戻るボタン。15vw四方、右下に固定 |
| `star` | `/skin/icon_star.svg` | ことば帳の行の印 |
| `unknownSymbol` | `/skin/unknown_symbol.svg` | ことば帳の「■」の見出し。高さ5vw |
| `missionsHeaderCurrent`・`missionsHeaderCleared` | `/skin/header_missions_current.png` など | ミッションの見出し。幅88vw。上から15vwをタブの絵にする。進行中の時は右40%、達成済みの時は左60%を押すとタブが替わる |
| `messagesFrame` | `/skin/messages_frame.svg` | 手紙の枠。CSSの `border-image` で伸ばす（切り取り80px、枠の太さ6vw） |
| `messagesSubtitle` | `/skin/messages_subtitle.png` | 手紙の一覧の小見出し。幅34vw |
| `messagesLine` | `/skin/messages_line.svg` | 区切り線。幅80vw |
| `messagesNext` | `/skin/messages_next.svg` | 一覧の行の矢印。幅2vw |
| `messagesBack` | `/skin/messages_back.png` | 一覧へ戻るボタン。幅55vw |

メニューのボタン（`menu` の `image`）は幅88vwで縦に並べ、次のボタンを3vwずつ重ねます。上下に透明な余白を持たせてください（デモは幅880pxの画像の上下に20px）。

デモのスキンは、文字の入った画像がPNG、文字の無い部品がSVGです。

## 3. スキンのCSS変数（`skin.css`）

| 変数 | 既定 | 内容 |
|---|---|---|
| `--background` | `#0d1030` | ページの背景色（背景の画像の下と、読み込み中） |
| `--xl-status-color` | `#fff4dc` | ステータス表示の数値の色 |
| `--xl-status-font` | 作品の書体（`var(--xl-story-font)`） | ステータス表示の数値の書体 |
| `--xl-status-font-weight` | `700` | ステータス表示の数値の太さ |
| `--xl-status-font-size` | `5.5vw` | ステータス表示の数値の大きさ |
| `--xl-status-top` | `4.06vw` | ステータス表示の数値の上端 |
| `--xl-status-lv-left`・`--xl-status-lv-width` | `29.2vw`・`15vw` | Lvの欄の左端と幅 |
| `--xl-status-words-left`・`--xl-status-words-width` | `68.6vw`・`15vw` | ことばの数の欄の左端と幅 |
| `--xl-bubble-text` | `#2b2546` | 台詞の文字色 |
| `--xl-words-header-color` | `#3b3f86` | ことば帳の見出しの帯の色 |
| `--foreground` | `#ededed` | 本文の文字の色（読み込み中、エラーの画面など） |
| `--xl-body-font` | システムの書体 | 本文の書体（台詞とステータス表示のほか） |

既定は、デモのスキンの画像に合わせた値です。

ステータス表示の数値は、Botが返した値をそのまま、欄の中央に書きます。欄の左端は画面の左端からの位置で、`status` の画像の枠に合わせて調整します。幅を `auto` にすると、左端から書きます。

`--xl-story-font` には、設定の `font.family` が入ります。

## 4. Botのデータが指す画像（`dataDir`）

Botの応答に書くのはファイル名だけです。画面は `dataDir`（既定は `/data`。作品の `public/data/`）の下の次の場所から読みます。

| 種類 | 置き場所 | 表示 |
|---|---|---|
| 部屋の物（`f`） | `<dataDir>/room/` | `x`・`y`・`w`・`h` の大きさに引き伸ばす |
| ことばの画像（`f`） | `<dataDir>/words/` | 画面の左端から幅100vwで、行の高さ6.5vw。ほかのことばの文字は左から13.5vwの位置で始まるので、画像の文字もそこに合わせる |
| ミッション（`img1`・`img2`） | `<dataDir>/missions/current/`・`cleared/` | 幅88vw |
| 資料（設定の `image`） | `<dataDir>/documents/` | 画面の幅いっぱい |

## 5. 資料（`documents`）

キーが資料のidで、`/documents/<id>/` で開きます。

| 項目 | 内容 |
|---|---|
| `title` | タイトルと、画像の代替テキスト |
| `image` | 画像 |
| `noise` | グリッチの強さの既定。`none`（素の画像）、`noise`（ときどき横にずれる）、`heavyNoise`（常に大きく崩れ、薄く表示し、1画面分だけを見せる）。省略すると `none` |
| `routes` | URLの `?route=` の値ごとの強さ。例: `{"clear": "none", "broken": "heavyNoise"}`。`routes` に無い値の `?route=` は、素の資料を見せずに、無いページとして扱う |
| `background` | 画像の周りの背景色（既定は `#000`） |
| `back` | `true` なら、Roomへ戻るボタンを出す（既定は出さず、資料だけを見せる） |

同じ資料を、物語の進み方によって違う崩れ方で見せられます。台本の `go` で `/documents/memo/?route=broken` のように移ります。

## 6. 作品固有のページ（`pages/`）

作品のフォルダの `pages/<名前>.svelte` を置くと、`/<名前>/` で開けます。ディレクトリで入れ子にでき（`puzzle/stage1.svelte` → `/puzzle/stage1/`）、`index.svelte` はそのディレクトリのページになります。ビルドすると、ページごとの入口（`puzzle/stage1/index.html` など）も作ります。同じpathの標準のページより優先します。

エンジンの部品は `@/`（エンジンの `src/`）から読み込みます。

```svelte
<script lang="ts">
  import PageLayout from "@/components/layout/PageLayout.svelte";
  import BackButton from "@/components/ui/BackButton.svelte";
  import MessageBubble from "@/components/ui/MessageBubble.svelte";
  import UserStatus from "@/components/ui/UserStatus.svelte";
  import { initPage } from "@/lib/page.ts";
  import { pageTitle } from "@/lib/title.svelte.ts";

  // ページ名。イベント中なら <イベント名>:puzzle の台本を取り寄せる
  initPage({ pageName: "puzzle" });
  pageTitle.current = "謎";
</script>

<PageLayout>
  <UserStatus />
  <!-- ここにページの中身 -->
  <BackButton />
  <!-- 置くと、このページの台本で台詞を出せる（画面の下に吹き出しを出す） -->
  <MessageBubble />
</PageLayout>
```

`initPage` に渡せるもの:

| 項目 | 内容 |
|---|---|
| `pageName` | ページ名 |
| `registerHandlers` | ページで受け付けるコマンドのハンドラーを登録する（`engine.registerCommandHandler(名前, 関数, { canExecuteBeforeReady })`）。登録を解除する関数を返す |
| `registerImages` | 表示の前に読み込みを待つ画像を登録する（`loader.registerImages([...])`） |
| `preparePageData` | 表示の前に取り寄せるデータ |
| `waitForImages` | 表示の前に画像の読み込みを待つか（既定 `true`） |

コマンドのハンドラーの引数は、台本に書いた値です。値が読めない時は例外を投げると、台本を止めます。利用者の操作を待つコマンド（謎を解く、選ぶ、など）は、操作を終えた時に解決する Promise を返します。エンジンはその完了を待ってから次のコマンドへ進みます（Promise が失敗すると、台本を止めます）。

アプリの中のページへのリンクは、`pageHref("/words/")`（`src/lib/project.ts`）で書きます。XStoryBotのWebchatで開いている時は、移った先でもWebchatと接続し直せるよう、起動パラメータ（`xsb_client`）を引き継ぎます。

利用者の操作（ボタンを押すなど）からBotへactionを送るには `eventEngine.sendUserAction(action)` を使います。台本の実行中と、前の操作の応答を待つ間は受け付けません（二度押しを防ぐ）。台本の中のようにすぐ送る時は `eventEngine.fetchAndExecuteAction(action)` を使います。どちらも、応答の台本を今の台本の後ろで実行します。利用者の状態は `app.userStatus`（`src/lib/app.svelte.ts`）で読めます。`eventEngine.on(イベント名, 関数)` で、表示できるようになった時（`ready`）、台本を止めた時（`halt`）、状態が変わった時（`stateChange`）などを受け取れます（`src/lib/eventEngine.ts` の `EngineEvents`）。

背景の画像は、`PageLayout` の `bgImage` で変えられます（画像のpath、または `linear-gradient(...)` などのCSSの値）。

`pages/` の下の `.svelte` は、すべてページになります。ページで使う部品は、作品のフォルダのほかの場所（`components/` など）に置いてください。作品のフォルダの中は `@project/` でも読み込めます。

Botとつながずに開くページ（LINEのログインも要らない）にする時は、モジュールのスクリプトで `skipInitialization` を書き出します。Botとの接続（LIFFの初期化など）も `get_status` もしないので、Botの状態は使えません。

```svelte
<script lang="ts" module>
  export const skipInitialization = true;
</script>
```

## 7. 全ページで使うコマンド（`setup.ts`）

作品のフォルダに `setup.ts` を置くと、ページを開く前に一度だけ呼びます。全ページで使うコマンドの登録や、エンジンのイベントの受け取りに使います。標準のコマンドやページのコマンドと同じ名前は使わないでください。

```ts
import { withBase } from "@/lib/project.ts";
import { defineProjectSetup } from "@/lib/setup.ts";
import { requireString } from "@/lib/values.ts";

export default defineProjectSetup((engine) => {
  // 台本の ["sound", "/sounds/bell.mp3"] で音を鳴らす（作品の public/sounds/ に置く）。
  // ファイルの名前が無い時は、例外を投げて台本を止める
  engine.registerCommandHandler("sound", (path: unknown) => {
    void new Audio(withBase(requireString(path, "sound のファイル"))).play().catch(() => {});
  });
});
```

`registerCommandHandler` の3つ目に `{ canExecuteBeforeReady: true }` を渡すと、表示の前にも実行します（画面を変えるだけのコマンド向け）。
