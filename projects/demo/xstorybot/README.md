# サンプルシナリオ（XStoryBot）

デモ作品「月灯りの部屋」を、XStoryBotで動かすシナリオです。モック（`npm run dev:mock`）と同じ部屋と台本を、XStoryBotのシナリオで書いています。LINEのトークで見つけたことばが、LIFFのことば帳に並びます。

| ファイル | 内容 |
|---|---|
| `story.tsv` | シナリオ（タブ区切り。Google Sheetsへそのまま貼り付けられる） |
| `manifest.json` | XStoryBotのローカル環境で読むためのシート一覧 |
| `suite.json` | トーク側の確認のケース |

## ローカルで確かめる

XStoryBotのリポジトリで、[ローカルでのシナリオ開発](https://github.com/alt-core/XStoryBot/blob/master/docs/local-development.md)の準備をしてから、次を実行します。`<XStoryLIFF>` は、このリポジトリのpathです。

```sh
cp settings.local.yaml.template settings.yaml
```

`settings.yaml` の `constants` に、部屋を開くURL（「へや」のボタンで使う）を書きます。

```yaml
  constants:
    liff_room: https://liff.line.me/YOUR_LIFF_ID
```

```sh
python tools/local_scenario.py verify --settings settings.yaml --bot bot \
  --tsv <XStoryLIFF>/projects/demo/xstorybot/manifest.json \
  --suite <XStoryLIFF>/projects/demo/xstorybot/suite.json
```

### Webchatで部屋まで確かめる

XStoryBotの手元のWebchatで、トークと部屋（XStoryLIFF）を一緒に動かせます。LINEは要りません。

1. `settings.yaml` の `plugins` に `liff` を足し、`bots.bot` の `interfaces` を次のようにします。会話のBot自身を、LIFFの連携先（`liff_apps`）にします。`YOUR_LIFF_ID` は、上の `liff_room` と同じ値にします。

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

2. XStoryBotのリポジトリで `python tools/local_scenario.py webchat --settings settings.yaml --bot bot --tsv <XStoryLIFF>/projects/demo/xstorybot/manifest.json` を実行します。
3. XStoryLIFFで `VITE_WEBCHAT_ORIGIN=http://127.0.0.1:8765 npm run dev` を実行します。
4. `http://127.0.0.1:8765/chat/bot` を開き、「へや」と送って「部屋へ」を押すと、チャットの中に部屋が開きます。

## LINEとつなぐ

1. シナリオをGoogle Sheetsへ貼り付けるか、TSVのまま読み込みます。
2. Botの `interfaces` に `line` と `liff` を並べ、`plugins.liff` に `allow_origin` と `login_channel_id` を書きます（[公開手順](../../../docs/xstoryliff/deployment.md)）。settingsの `constants` に `liff_room: https://liff.line.me/<LIFF ID>` を書きます。
3. XStoryLIFFを、デモの設定のまま公開します。
4. 友だち追加すると、ルゥがあいさつします。「へや」と送るか、リッチメニューなどから `https://liff.line.me/<LIFF ID>` を開くと、部屋に入れます。

## シナリオの中身

### トーク

| 発言 | 動き |
|---|---|
| （友だち追加） | あいさつ。Lvと最初のことば（かぎ、ほしのうた、■■■■）を用意する |
| こんばんは、月、星、夜、ランプ | ことば帳に加える（同じ語は1回だけ）。「こんばんは」でミッション1を達成 |
| 月明かり | 謎を解く前と後で、答えが変わる |
| かぎ | ことば帳で絵に変えた「かぎ」を、もう一度押した時に届く「かぎ」に答える |
| へや | 部屋とことば帳を開くボタン。URLは定数 `{liff_room}`（Webchatでは、`liff_apps` の `liff_id` で読み替えて開く） |

XStoryBotは、上の行から順に、発言に含まれる語で条件を当てはめます。「月明かり」は、その一部の語「月」より先に書いています。

### LIFF

| action | 動き |
|---|---|
| `get_status` | 状態のJSON（`event`・`lv`・`n_words`・`menu`・`roomObjects`・`words`・`missions`） |
| `intro:room` | 初めて部屋を開いた時の台本。最後の `command` で `intro_2` を取り寄せ、手紙のボタンを演出付きで出す |
| `talk_ruu`、`look_window`、`touch_lamp` | 部屋の物をタップした時の台本 |
| `about_key` | ことば帳の「かぎ」の `onclick`。ことば帳には台詞を出せないので、`set` でことばを絵（`kagi.png`）に変える。`onclick` を外すので、次からは押すとトークへ「かぎ」を送る |
| `touch_jar` → `jar_done` | 床の星をビンへ運ぶ謎。`jar_done` は、謎を始めていなければ受け付けない |
| `open_letter` | 机の手紙から資料へ移る |
| `open_moon_door` | 謎を解くと出る「月の扉」のボタン。崩れた資料（`?route=broken`）へ移る |
| `get_messages`、`message_content:<id>`、`on_message_read:<id>` | 手紙 |
| `read_news` | 号外の手紙を開いた時（`onopen`）。1回だけLvを2にする |

### フラグ

| フラグ | 内容 |
|---|---|
| `$lv`、`$words`、`$word_count` | ステータス表示とことば帳 |
| `$greeted`、`$jar_done`、`$letter_read` | ミッションの達成（ミッション4は `$word_count` が5以上） |
| `$intro_seen` | 登場イベントを見たか。見るまで `event` に `intro` を返し、見た後は `menu` に手紙のボタンを入れる |
| `$jar_started` | 謎を始めたか |
| `$read_<id>`、`$news_opened` | 手紙の既読と、号外を開いたか |

### 書き方の要点

- コマンドの行のJSONは、発言の差し込みと区別するため `{{` `}}` と二重に書きます。ことばの数は `{$word_count}` で差し込んでいます。
- データのJSONは `@set` で変数に作り、`{$変数!j}` で出力します。
- 1回の応答は5行までです。長い台本は、最後の行の `command` で続きを取り寄せます。
