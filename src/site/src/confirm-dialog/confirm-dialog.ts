import { BaseElement } from "../base-element/base-element";
import type { ConfirmDialogOptions } from "./confirm-dialog-manager";

export class ConfirmDialog extends BaseElement {
  headline = "";
  body = "";

  html(): string {
    return `{{confirm-dialog.html}}`;
  }

  show(options: ConfirmDialogOptions): void {
    this.headline = options.headline;
    this.body = options.body;
    this.render();

    const confirmYes = this.querySelector(".confirm-dialog__yes");
    const confirmNo = this.querySelector(".confirm-dialog__no");

    if (confirmYes) {
      this.eventListener(confirmYes, "click", () => {
        this.unbindEvents();
        this.hide();
        options.yesCallback();
      });
    }

    if (confirmNo) {
      this.eventListener(confirmNo, "click", () => {
        this.unbindEvents();
        this.hide();
        options.noCallback();
      });
    }

    this.classList.add("dialog__visible");
  }

  hide(): void {
    this.classList.remove("dialog__visible");
  }
}

customElements.define("confirm-dialog", ConfirmDialog);