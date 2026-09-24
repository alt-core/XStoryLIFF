import { describe, expect, it } from "vitest";
import { sanitizeHtml, sanitizeToFragment } from "../src/lib/sanitize.ts";

describe("手紙の本文の無害化", () => {
  it("スクリプトを動かす要素と属性を取り除く", () => {
    expect(sanitizeHtml('<p onclick="steal()">本文</p><script>steal()</script>')).toBe("<p>本文</p>");
    expect(sanitizeHtml('<img src="x.png" onerror="steal()">')).toBe('<img src="x.png">');
    expect(sanitizeHtml('<meta http-equiv="refresh" content="0;url=https://example.com"><base href="https://example.com/">本文')).toBe("本文");
    expect(sanitizeHtml('<iframe srcdoc="<script>steal()</script>"></iframe>')).toBe("<iframe></iframe>");
  });

  it("javascript: の URL を取り除く（空白や制御文字を挟んでも）", () => {
    expect(sanitizeHtml('<a href="javascript:steal()">リンク</a>')).toBe("<a>リンク</a>");
    expect(sanitizeHtml('<a href=" java&#x09;script:steal()">リンク</a>')).toBe("<a>リンク</a>");
    expect(sanitizeHtml('<a href="VBScript:steal()">リンク</a>')).toBe("<a>リンク</a>");
  });

  it("SVG のアニメーションで、属性を javascript: や on で始まる属性へ変えるものを取り除く", () => {
    const html = sanitizeHtml(
      '<svg><a><animate attributeName="href" values="0;javascript:steal()"></animate><set attributeName="onclick" to="steal()"></set><text>押す</text></a></svg>'
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<set");
    expect(html).toContain('attributeName="href"');
  });

  it("template は中身ごと取り除く", () => {
    expect(sanitizeHtml('<p>本文</p><template><img src="x.png" onerror="steal()"></template>')).toBe("<p>本文</p>");
  });

  it("画面へは、取り除いた後の要素をそのまま移す", () => {
    const fragment = sanitizeToFragment('<p onclick="steal()" style="color:red">本文</p><script>steal()</script>');
    expect(fragment.ownerDocument).toBe(document);
    expect(fragment.querySelectorAll("script, [onclick]")).toHaveLength(0);
    expect(fragment.querySelector("p")?.getAttribute("style")).toBe("color:red");
  });

  it("表示の表現は残す", () => {
    const html = '<p style="color:#c33;font-weight:bold">見出し</p><a href="../documents/note/">資料</a><img src="/data/a.png" alt="絵">';
    expect(sanitizeHtml(html)).toBe(html);
  });
});
