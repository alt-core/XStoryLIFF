# XStoryLIFF

LINEのトークで進む物語に、キャラクターの住む「部屋」や、集めたことばの一覧などの画面を添える、LIFFアプリのエンジンです。[XStoryBot](https://github.com/alt-core/XStoryBot)と組み合わせると、トークとLIFFで同じ利用者の進行（フラグ）を共有できます。

<p align="center"><img src="docs/xstoryliff/images/room.jpg" alt="デモ作品「月灯りの部屋」のRoom" width="360"></p>

できること、LINEとXStoryBotへのつなぎ方、自分の作品の作り方、説明書の一覧は、[エンジンの説明](docs/xstoryliff/README.md)にあります。

## はじめる（LINEなしのデモ）

Node.js 22.18以降を用意して、次を実行し、`http://127.0.0.1:5173/` を開きます。

```sh
npm install
npm run dev:mock
```

## フォークして作品を作る時

この `README.md` は、作品の説明に書き換えてかまいません。エンジンの説明は `docs/xstoryliff/` にまとめてあり、そこに手を入れずにおくと、エンジンの更新を取り込みやすくなります。

## ライセンス

XStoryLIFF本体と、特記のない同梱素材には[MIT License](LICENSE)を適用します（[画像の権利情報](ASSET_CREDITS.md)、[外部ソフトウェアの権利表示](THIRD_PARTY_NOTICES.md)）。
