/*
  作品の書体の読み込み。台詞を、読み込み途中の別の書体で見せないようにする。
  Google Fonts の日本語の書体などは、文字の範囲ごとにファイルが分かれていて、画面に出た文字の分だけ後から読み込まれる。
  そのため、書体のCSSを読み込んだ後、よく使う文字と、これから出す台詞の文字のファイルを、表示の前に読み込む。
  読み込めない時や遅い時も、物語を止めないよう、一定の時間で待つのをやめる。
*/

/** 待つ時間の上限（ミリ秒） */
const TIMEOUT = 3000;

/** 表示の前に読み込む文字（かな、英数字、よく使う記号） */
const BASIC_CHARACTERS = [
  String.fromCharCode(...Array.from({ length: 0x3096 - 0x3041 + 1 }, (_, i) => 0x3041 + i)),
  String.fromCharCode(...Array.from({ length: 0x30fa - 0x30a1 + 1 }, (_, i) => 0x30a1 + i)),
  "ー、。「」『』…！？　0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
].join("");

let family = "";

function withTimeout(task: Promise<unknown>): Promise<void> {
  return Promise.race([task.then(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, TIMEOUT))]).catch((error) => {
    console.error("書体を読み込めませんでした:", error);
  });
}

/** 書体のCSSを読み込む（読み込めなくても先へ進む） */
function loadStylesheet(href: string): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => {
      console.error(`書体のCSSを読み込めませんでした: ${href}`);
      resolve();
    };
    document.head.append(link);
  });
}

/** 作品の書体を読み込む。書体のCSS（cssUrl）と、よく使う文字の書体のファイルを読み込み終えるまで待つ */
export function loadStoryFont(familyName: string, cssUrl?: string): Promise<void> {
  family = familyName;
  return withTimeout(
    (async () => {
      if (cssUrl) await loadStylesheet(cssUrl);
      await loadGlyphs(BASIC_CHARACTERS);
    })()
  );
}

/** 文字列に使われている文字の書体のファイルを読み込む（台詞を出す前に呼ぶ） */
export function loadGlyphs(text: string): Promise<void> {
  if (!family || !text || typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const name = family.replace(/["\\]/gu, "\\$&");
  // 台詞は標準の太さ、ステータス表示は太字で使う
  return withTimeout(Promise.all(["normal", "bold"].map((weight) => document.fonts.load(`${weight} 1em "${name}"`, text))));
}
