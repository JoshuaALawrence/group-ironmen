import { BaseElement } from "../base-element/base-element";
import { storage } from "../data/storage";

export class RequestDialog extends BaseElement {
  itemName = "";
  private resolveRequest?: (quantity: number | null) => void;

  html(): string {
    return `{{request-dialog.html}}`;
  }

  show(itemName: string): Promise<number | null> {
    this.itemName = itemName;
    this.render();
    this.classList.add("dialog__visible");

    const quantityInput = this.querySelector<HTMLInputElement>(".request-dialog__quantity");
    const confirmBtn = this.querySelector(".request-dialog__confirm");
    const cancelBtn = this.querySelector(".request-dialog__cancel");

    if (quantityInput) {
      quantityInput.focus();
      quantityInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.confirm(quantityInput);
        }
      });
    }

    if (confirmBtn) {
      this.eventListener(confirmBtn, "click", () => this.confirm(quantityInput));
    }

    if (cancelBtn) {
      this.eventListener(cancelBtn, "click", () => {
        this.hide();
        this.resolveRequest?.(null);
      });
    }

    return new Promise<number | null>((resolve) => {
      this.resolveRequest = resolve;
    });
  }

  static parseOsrsQuantity(text: string): number {
    const cleaned = text.trim().toLowerCase().replace(/,/g, "");
    const match = cleaned.match(/^([\d.]+)\s*([kmb])?$/);
    if (!match) return NaN;
    let num = parseFloat(match[1]);
    if (match[2] === "k") num *= 1_000;
    else if (match[2] === "m") num *= 1_000_000;
    else if (match[2] === "b") num *= 1_000_000_000;
    return Math.floor(num);
  }

  private confirm(input: HTMLInputElement | null): void {
    const value = RequestDialog.parseOsrsQuantity(input?.value ?? "1");
    if (isNaN(value) || value < 1) return;
    this.hide();
    this.resolveRequest?.(value);
  }

  hide(): void {
    this.unbindEvents();
    this.classList.remove("dialog__visible");
  }

  static getApiBase(): string {
    const group = storage.getGroup();
    return `/api/group/${group?.groupName}`;
  }

  static getAuthHeaders(): Record<string, string> {
    const group = storage.getGroup();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (group?.groupToken) {
      headers["Authorization"] = group.groupToken;
    }
    return headers;
  }

  static async sendItemRequest(
    itemName: string,
    quantity: number,
    requestedBy: string,
    quantities: Record<string, number>
  ): Promise<boolean> {
    try {
      const res = await fetch(`${RequestDialog.getApiBase()}/request-item`, {
        method: "POST",
        headers: RequestDialog.getAuthHeaders(),
        body: JSON.stringify({
          item_name: itemName,
          quantity,
          requested_by: requestedBy,
          member_quantities: quantities,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

customElements.define("request-dialog", RequestDialog);
