export interface Notice {
  id: number;
  text: string;
}

/**
 * 画面下の短いお知らせ。次の2つにだけ使う。
 * - 不具合で台本を止めた時に、開き直すよう知らせる
 * - モック（LINEなし）で、トークへの送信やLIFFを閉じる操作の代わりに表示する
 */
class Notices {
  list = $state.raw<Notice[]>([]);
}

export const notices = new Notices();

let nextId = 1;

export function notify(text: string, durationMilliseconds = 4000): void {
  const notice = { id: nextId++, text };
  notices.list = [...notices.list, notice];
  setTimeout(() => {
    notices.list = notices.list.filter((item) => item.id !== notice.id);
  }, durationMilliseconds);
}
