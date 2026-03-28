import { BaseElement } from "../base-element/base-element";

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export class MemberSelectDialog extends BaseElement {
  members: string[] = [];
  private resolveSelection?: (name: string) => void;

  html(): string {
    return `{{member-select-dialog.html}}`;
  }

  show(members: string[]): Promise<string> {
    this.members = members;
    this.render();
    this.classList.add("dialog__visible");

    const buttons = this.querySelectorAll(".member-select__btn");
    for (const btn of Array.from(buttons)) {
      this.eventListener(btn, "click", () => {
        const name = btn.getAttribute("data-name") || "";
        this.hide();
        this.resolveSelection?.(name);
      });
    }

    return new Promise<string>((resolve) => {
      this.resolveSelection = resolve;
    });
  }

  hide(): void {
    this.unbindEvents();
    this.classList.remove("dialog__visible");
  }

  renderMembers(): string {
    return this.members
      .map(
        (name) =>
          `<button class="member-select__btn men-button" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
      )
      .join("");
  }
}

customElements.define("member-select-dialog", MemberSelectDialog);
