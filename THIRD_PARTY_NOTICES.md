# Third-Party Notices

XStoryLIFFは、以下の外部ソフトウェアと書体を利用しています。正確な導入バージョンは `package-lock.json` を参照してください。

## 実行時依存

| パッケージ | 用途 | ライセンス |
|---|---|---|
| `svelte` | 画面の構築 | MIT |
| `@line/liff` | LINEのLIFF SDK | [LINE Developers Agreement](https://terms2.line.me/LINE_Developers_Agreement)に従って利用（パッケージのREADMEを参照） |

## 開発時依存

| パッケージ | 用途 | ライセンス |
|---|---|---|
| `vite` | 開発サーバー・ビルド | MIT |
| `@sveltejs/vite-plugin-svelte` | SvelteのVite統合 | MIT |
| `svelte-check` | Svelteの診断 | MIT |
| `typescript` | 型検査 | Apache-2.0 |
| `@tsconfig/svelte` | TypeScript設定 | MIT |
| `@types/node` | Node.jsの型定義 | MIT |
| `vitest` | 単体テスト | MIT |
| `happy-dom` | 単体テストのDOM | MIT |

各パッケージの推移的依存関係とライセンスファイルは、パッケージマネージャーが導入する各パッケージ内にも保持されます。

## ソースに取り込んだもの

| 対象 | 取り込んだ場所 | ライセンス |
|---|---|---|
| Chakra UI の CSSReset と既定のテーマのグローバルスタイル（`@chakra-ui/react` 2.10.5、`@chakra-ui/theme`） | `src/styles/globals.css` | MIT（下に全文） |

```text
MIT License

Copyright (c) 2019 Segun Adebayo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 書体

| 書体 | 用途 | ライセンス |
|---|---|---|
| Zen Maru Gothic | デモ作品の台詞（Google Fontsから読み込み、同梱しない）。画像の文字 | SIL Open Font License 1.1 |
| Zen Old Mincho | 画像の文字（同梱しない） | SIL Open Font License 1.1 |
