import type { ContextMenuOption } from "./rs-context-menu";

type RsContextMenuElement = Element & {
  show(x: number, y: number, title: string, options: ContextMenuOption[]): void;
  hide(): void;
};

class ContextMenuManager {
  private _menu?: RsContextMenuElement | null;

  get menu(): RsContextMenuElement | null {
    if (this._menu) return this._menu;
    this._menu = document.querySelector("rs-context-menu") as RsContextMenuElement | null;
    return this._menu;
  }

  show(x: number, y: number, title: string, options: ContextMenuOption[]): void {
    this.menu?.show(x, y, title, options);
  }

  hide(): void {
    this.menu?.hide();
  }
}

const contextMenuManager = new ContextMenuManager();

export { contextMenuManager };
export type { ContextMenuOption };
