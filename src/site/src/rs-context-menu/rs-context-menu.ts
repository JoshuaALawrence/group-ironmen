import { BaseElement } from "../base-element/base-element";

export type ContextMenuOption = {
  label: string;
  highlightedText?: string;
  disabled?: boolean;
  callback: () => void;
};

export class RsContextMenu extends BaseElement {
  title = "";
  options: ContextMenuOption[] = [];
  private closeHandler?: (e: Event) => void;
  private scrollHandler?: () => void;

  html(): string {
    return `{{rs-context-menu.html}}`;
  }

  renderOptions(): string {
    return this.options
      .map(
        (opt, i) =>
          `<button class="context-menu__option${opt.disabled ? " context-menu__option--disabled" : ""}" data-index="${i}"${opt.disabled ? " disabled" : ""}>${opt.label}${opt.highlightedText ? ` <span>${opt.highlightedText}</span>` : ""}</button>`
      )
      .join("");
  }

  show(x: number, y: number, title: string, options: ContextMenuOption[]): void {
    // Clean up any previous listeners before re-showing
    this.removeCloseListeners();

    this.title = title;
    this.options = options;
    this.render();

    this.classList.add("context-menu--visible");

    // Position the menu, clamping to viewport
    const rect = this.firstElementChild?.getBoundingClientRect();
    const menuWidth = rect?.width ?? 150;
    const menuHeight = rect?.height ?? 100;

    const clampedX = Math.min(x, window.innerWidth - menuWidth - 4);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 4);

    this.style.left = `${Math.max(0, clampedX)}px`;
    this.style.top = `${Math.max(0, clampedY)}px`;

    // Bind option clicks
    const buttons = this.querySelectorAll(".context-menu__option");
    for (const btn of Array.from(buttons)) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = Number(btn.getAttribute("data-index"));
        this.hide();
        this.options[index]?.callback();
      });
    }

    // Close on any click or right-click outside the menu
    this.closeHandler = (e: Event) => {
      if (!this.contains(e.target as Node)) {
        this.hide();
      }
    };

    this.scrollHandler = () => this.hide();

    // Defer so the current event doesn't immediately close
    setTimeout(() => {
      if (this.closeHandler) {
        document.addEventListener("click", this.closeHandler);
        document.addEventListener("contextmenu", this.closeHandler);
      }
      if (this.scrollHandler) {
        document.addEventListener("scroll", this.scrollHandler, true);
      }
    }, 0);
  }

  private removeCloseListeners(): void {
    if (this.closeHandler) {
      document.removeEventListener("click", this.closeHandler);
      document.removeEventListener("contextmenu", this.closeHandler);
      this.closeHandler = undefined;
    }
    if (this.scrollHandler) {
      document.removeEventListener("scroll", this.scrollHandler, true);
      this.scrollHandler = undefined;
    }
  }

  hide(): void {
    this.removeCloseListeners();
    this.classList.remove("context-menu--visible");
  }
}

customElements.define("rs-context-menu", RsContextMenu);
