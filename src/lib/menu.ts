import type { MenuButton } from "./config.ts";
import type { UserStatus } from "./types.ts";

export interface MenuEntry {
  button: MenuButton;
  /** 台本で出したボタン（演出付きで現れる） */
  revealed: boolean;
}

/**
 * Room の下に出すボタン（設定の順）。Bot が get_status の menu で返したIDと、台本で roomObjects の同じ名前に visible を set したもの。
 * menu が無い時や配列でない時は、何も出さない（指示されていないものは見せない）。
 */
export function menuEntries(buttons: MenuButton[], status: UserStatus | null | undefined): MenuEntry[] {
  const menu = Array.isArray(status?.menu) ? status.menu : [];
  return buttons
    .map((button) => ({ button, revealed: Boolean(status?.roomObjects?.[button.id]?.visible) }))
    .filter(({ button, revealed }) => revealed || menu.includes(button.id));
}
