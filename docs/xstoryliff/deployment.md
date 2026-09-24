# 公開手順

## 1. LINE DevelopersでLIFFアプリを作る

LIFFアプリは、XStoryBotが使うMessaging APIチャネルと**同じプロバイダー**のLINEログインチャネルに作ります。LINEのユーザーIDはプロバイダーごとに異なるため、プロバイダーが違うと、トークとLIFFが別の利用者として扱われ、フラグを共有できません。

| 設定 | 値 |
|---|---|
| サイズ | Full |
| エンドポイントURL | 画面を置くURL（例: `https://liff.example.com/`） |
| Scope | `profile`（Botが利用者を確かめるため）、`chat_message.write`（ことばなどをトークへ送るため） |

トークへの送信は、LIFFをBotとのトーク画面から開いた時だけ使えます。

## 2. XStoryBotにLIFFをつなぐ

XStoryBotの設定で、`liff` pluginとBotのinterfaceを有効にします。

```yaml
plugins:
  liff:
    allow_origin: "https://liff.example.com"   # 画面を置くorigin。pathは含めない。複数なら配列で書く
    login_channel_id: "1234567890"             # LIFFアプリを作ったLINEログインチャネルのID（必須）
    ignore_unhandled_action: true              # シナリオに無いLIFFのactionは、空の応答にする

bots:
  story:
    interfaces:
      - type: line   # 既存の line interface はそのまま残し、liff を加える
      - type: liff
```

- `login_channel_id` は、Messaging APIチャネルではなく、LIFFアプリを作ったLINEログインチャネルのIDです。書かないと、XStoryBotのLIFF APIが503を返します。XStoryBotは、アクセストークンの発行先がこのチャネルかを確かめます。
- `ignore_unhandled_action: true` にすると、イベントの台本の無いページを開いた時（`intro:words` など）に、空の応答が返ります。XStoryLIFFは、台本が無ければ何もしません。

シナリオには、少なくとも `##liff.get_status` を書きます（[連携仕様](protocol.md)）。

## 3. ビルドする

使う作品は、`.env` の `XSTORYLIFF_PROJECT` で選びます（書かなければ同梱のデモ）。

`.env.example` を `.env.local`（本番用だけなら `.env.production.local`）へコピーし、値を書きます。`VITE_` で始まる値は画面に埋め込まれて公開されるので、秘密の値は書かないでください。

| 変数 | 内容 |
|---|---|
| `VITE_LIFF_ID` | LIFF ID |
| `VITE_API_BASE_URL` | XStoryBotのAPIの基点（`https://<Botのホスト>`）。LIFF APIは `<基点>/liff/<Bot名>/message` |
| `VITE_BOT` | XStoryBotのBot名（上の `story` など） |
| `VITE_FORWARD_URL` | 任意。LINEアプリの外で開かれた時の転送先（友だち追加のページなど）。書かなければ、LINEログインして表示する |
| `VITE_WEBCHAT_ORIGIN` | XStoryBotのWebchatでも使う時に、Webchatの画面のorigin（[下の節](#xstorybotのwebchatで使う)） |

```sh
npm run build
```

LINEの3つ（`VITE_LIFF_ID`・`VITE_API_BASE_URL`・`VITE_BOT`）がそろっていない時は、ビルドを止めます。Webchatだけで使う場合は、`VITE_WEBCHAT_ORIGIN` だけでかまいません。LINEとWebchatの両方を書けば、1つのビルドを両方で使えます。

サブパスへ置く場合は、配置先のpathを指定します。設定やBotの応答の `/` で始まるpathは、このpathからのpathになります。

```sh
npm run build -- --base=/works/story/
```

## 4. 静的ホストへ置く

`dist/` の中身を、HTTPSで配信できる静的ホストへ置きます。サーバーの処理は要りません。

`dist/` には、ページごとに `words/index.html` のような入口が入っています。LIFFの `https://liff.line.me/<LIFF ID>/words/` を開くと、まずエンドポイントURLを開き、`liff.init()` が `/words/` へ移ります（二次リダイレクト）。移った先でこの入口を読み込むため、配置先は**ディレクトリのindex（`/words/` → `words/index.html`）を返せる**必要があります。移る前のページは、Botへ何も送りません。Firebase Hosting、Cloudflare Pages、Netlify、GitHub Pages、S3のウェブサイトエンドポイントはそのまま使えます。CloudFront＋S3（REST）だけの構成では、サブディレクトリのindexを返す設定を追加してください。

キャッシュは、`index.html` と各ページの `index.html` を短く、`assets/` 配下（ファイル名にハッシュが付く）を長くするのが安全です。

## 5. 利用者を案内する

| 開くページ | URL |
|---|---|
| Room | `https://liff.line.me/<LIFF ID>` |
| ことば帳 | `https://liff.line.me/<LIFF ID>/words/` |
| ミッション（達成済みのタブ） | `https://liff.line.me/<LIFF ID>/missions/?tab=cleared` |
| 手紙（特定の1通） | `https://liff.line.me/<LIFF ID>/messages/?id=welcome` |
| 資料 | `https://liff.line.me/<LIFF ID>/documents/memo/` |
| リンク集 | `https://liff.line.me/<LIFF ID>/links/` |

リッチメニューや、シナリオのボタン・メッセージのリンクから案内します。

## XStoryBotのWebchatで使う

XStoryBotのWebchatは、登録したページをチャットの中のiframeで開き、URLに `xsb_client=webchat` を付けます。XStoryLIFFは、これを見てWebchatの画面と接続し、LINEと同じシナリオで動きます。進行は、Webchatの署名付きのセーブ（利用者のブラウザー）に保存されます。

1. XStoryBotの設定で、会話のBotに `webchat` のinterfaceを加え、`liff_apps` にXStoryLIFFを登録します。Webchat自体の設定（署名の鍵、許可するoriginなど）は、XStoryBotの[Webchatガイド](https://github.com/alt-core/XStoryBot/blob/master/docs/webchat.md)に従います。

   ```yaml
   bots:
     story:
       interfaces:
         - type: line
         - type: liff
         - type: webchat
           params:
             liff_apps:
               room:
                 bot: story                        # 会話のBot自身。トークとLIFFでフラグとシーンを共有する
                 url: https://liff.example.com/    # XStoryLIFFを置いたURL
                 liff_id: YOUR_LIFF_ID             # LINE用のLIFF URLを、このURLへ読み替えて開く
                 match: prefix                     # 配下のページ（/words/ など）も同じアプリとして開く
   ```

2. XStoryLIFFを、`VITE_WEBCHAT_ORIGIN` にWebchatの画面のorigin（`https://chat.example.com` など。pathは含めない）を書いてビルドします。XStoryLIFFは、このoriginの画面とだけやり取りします。
3. 配置先が、Webchatの画面からのiframeでの表示を許すようにします（`X-Frame-Options` で拒まない、CSPを使う場合は `frame-ancestors` にWebchatのoriginを含める）。

シナリオのリンクは、LINE用のLIFF URL（`https://liff.line.me/<LIFF ID>/words/` など）のままでかまいません。Webchatは `liff_id` を見て、登録したURLの配下（`https://liff.example.com/words/`）へ読み替えます。URLを定数（XStoryBotのsettingsの `constants`）にしておくと、シナリオにLIFF IDを書かずに済みます（[サンプル](../../projects/demo/xstorybot/)の `{liff_room}`）。

Webchatでの違い:

- ページを移る時（メニュー、戻るボタン、`go`、リンク集、手紙の本文のリンク）は、`xsb_client=webchat` を引き継ぎます。作品固有のページでアプリの中へリンクする時は、`pageHref()`（`src/lib/project.ts`）を使います。
- トークへの送信（メニューの `send`、ことばのタップ、`send_chat`）は、Webchatのチャットへの発言になります。LIFFを閉じる操作は、ページの表示を閉じます。
- 外部のリンク（リンク集の `isExternal` など）は、新しいタブで開きます。`go` で外部のURLへ移ると、iframeの中で開くので、埋め込みを拒むサイトは表示されません。

## LINEなしのデモを公開する

モックで動くデモは、LINEの設定なしで静的ホストに置けます。

```sh
XSTORYLIFF_PROJECT=demo npm run build:mock -- --base=/xstoryliff-demo/
```

## 更新する時の注意

- 状態のJSONの項目の意味を変える時は、画面とシナリオを同時に更新します。古い画面が残っていても壊れないよう、項目は足す形で変えるのが安全です。
- 物語の先で使う画像を、先に作品の `public/` へ置いて公開しても、名前を知っていれば開けます。秘密にはなりません。
