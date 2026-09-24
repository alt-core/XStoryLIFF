/**
 * 手紙の本文HTMLから、スクリプトを動かせるものだけを取り除く。
 * 表示の表現（style、表、画像、動画、埋め込みなど）はすべて残し、次のものだけを取り除く。
 * 本文に利用者の入力を埋め込んだ時に、LIFFのアクセストークンを盗まれないようにするため。
 * - script・meta・base・template 要素（template の中身は表示されず、確かめる対象からも外れるため）
 * - on で始まる属性（onerror など）と srcdoc 属性
 * - javascript: と vbscript: のURL（href・src など）
 * - SVG のアニメーションで、属性を javascript: のURLや on で始まる属性へ変えるもの
 *
 * 取り除いた後の要素は、HTMLの文字列に戻さずに、そのまま画面へ移す（文字列に戻して読み直すと、読み方の違いで、
 * 取り除いたはずのものが現れることがあるため）。
 */
const REMOVED_ELEMENTS = "script, meta, base, template";
const URL_ATTRIBUTES = ["href", "src", "action", "formaction", "data", "xlink:href", "poster", "background"];
const ANIMATION_ELEMENTS = ["animate", "set", "animatemotion", "animatetransform", "animatecolor"];
const ANIMATION_VALUE_ATTRIBUTES = ["values", "to", "from", "by"];

/** 空白や制御文字を除いた値が javascript: か vbscript: を含むか（anywhere が偽なら、先頭だけを見る） */
function hasScriptUrl(value: string, anywhere = false): boolean {
  const normalized = value.replace(/[\u0000- ]+/gu, "");
  return (anywhere ? /(?:javascript|vbscript):/iu : /^(?:javascript|vbscript):/iu).test(normalized);
}

/** 本文HTMLを読み、取り除いた後の要素を target の文書の断片として返す */
export function sanitizeToFragment(html: string, target: Document = document): DocumentFragment {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  for (const element of Array.from(parsed.body.querySelectorAll(REMOVED_ELEMENTS))) element.remove();
  for (const element of Array.from(parsed.body.querySelectorAll("*"))) {
    const isAnimation = ANIMATION_ELEMENTS.includes(element.localName.toLowerCase());
    if (isAnimation && (element.getAttribute("attributeName") ?? "").trim().toLowerCase().startsWith("on")) {
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        (URL_ATTRIBUTES.includes(name) && hasScriptUrl(attribute.value)) ||
        (isAnimation && ANIMATION_VALUE_ATTRIBUTES.includes(name) && hasScriptUrl(attribute.value, true))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  const fragment = target.createDocumentFragment();
  for (const node of Array.from(parsed.body.childNodes)) fragment.append(target.importNode(node, true));
  return fragment;
}

/** 取り除いた後のHTMLの文字列（確かめる時のためのもの。画面へは sanitizeToFragment で移す） */
export function sanitizeHtml(html: string): string {
  const container = document.createElement("div");
  container.append(sanitizeToFragment(html));
  return container.innerHTML;
}
