import { BaseElement } from "../base-element/base-element";
import { groupData } from "../data/group-data";
import { Item } from "../data/item";

type ItemBoxElement = HTMLElement & {
  item?: Item;
};

export class BankDialog extends BaseElement {
  bank: Item[];
  searchQuery: string;
  playerName: string | null;
  background: HTMLElement | null;
  statusEl: HTMLElement | null;
  itemsEl: HTMLElement | null;
  itemCountEl: HTMLElement | null;
  valueEl: HTMLElement | null;
  searchInput: HTMLInputElement | null;

  constructor() {
    super();
    this.bank = [];
    this.searchQuery = "";
    this.playerName = null;
    this.background = null;
    this.statusEl = null;
    this.itemsEl = null;
    this.itemCountEl = null;
    this.valueEl = null;
    this.searchInput = null;
  }

  html(): string {
    return `{{bank-dialog.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.render();

    this.background = this.querySelector<HTMLElement>(".dialog__visible");
    this.statusEl = this.querySelector<HTMLElement>(".bank-dialog__status");
    this.itemsEl = this.querySelector<HTMLElement>(".bank-dialog__items");
    this.itemCountEl = this.querySelector<HTMLElement>(".bank-dialog__item-count");
    this.valueEl = this.querySelector<HTMLElement>(".bank-dialog__value");
    this.searchInput = this.querySelector<HTMLInputElement>(".bank-dialog__search-input");

    const closeButton = this.querySelector<HTMLElement>(".dialog__close");
    if (closeButton) {
      this.eventListener(closeButton, "click", this.close.bind(this));
    }
    if (this.background) {
      this.eventListener(this.background, "click", this.closeIfBackgroundClick.bind(this));
    }
    if (this.searchInput) {
      this.eventListener(this.searchInput, "input", this.handleSearch.bind(this), { passive: true });
    }

    this.subscribe(`bank:${this.playerName}`, this.handleBankUpdate.bind(this));

    const memberData = groupData.members.get(this.playerName);
    if (memberData && memberData.bank && memberData.bank.length > 0) {
      this.handleBankUpdate(memberData.bank);
    } else {
      this.setStatus("No bank data available.");
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  closeIfBackgroundClick(evt: MouseEvent): void {
    if (evt.target === this.background) {
      this.close();
    }
  }

  close(): void {
    this.remove();
  }

  setStatus(message: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = message;
      this.statusEl.hidden = false;
    }
    if (this.itemsEl) {
      this.itemsEl.hidden = true;
    }
  }

  handleSearch(): void {
    this.searchQuery = this.searchInput?.value.toLowerCase().trim() ?? "";
    this.renderItems();
  }

  handleBankUpdate(bank: Item[]): void {
    this.bank = bank.filter((item) => item.isValid());
    if (this.statusEl) {
      this.statusEl.hidden = true;
    }
    if (this.itemsEl) {
      this.itemsEl.hidden = false;
    }
    this.renderItems();
    this.renderValue();
  }

  renderItems(): void {
    const filtered = this.searchQuery
      ? this.bank.filter((item) => item.name.toLowerCase().includes(this.searchQuery))
      : this.bank;

    if (this.itemCountEl) {
      this.itemCountEl.textContent = `${filtered.length} items`;
    }

    if (!this.itemsEl) {
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of filtered) {
      const slot = document.createElement("div");
      slot.className = "bank-dialog__slot";

      const itemEl = document.createElement("item-box") as ItemBoxElement;
      itemEl.setAttribute("player-name", this.playerName);
      itemEl.setAttribute("inventory-type", "bank");
      itemEl.item = item;
      slot.appendChild(itemEl);
      fragment.appendChild(slot);
    }

    this.itemsEl.innerHTML = "";
    this.itemsEl.appendChild(fragment);
  }

  renderValue(): void {
    let totalGe = 0;
    let totalHa = 0;
    for (const item of this.bank) {
      totalGe += item.gePrice * item.quantity;
      totalHa += item.highAlch * item.quantity;
    }
    if (this.valueEl) {
      this.valueEl.textContent = `GE: ${totalGe.toLocaleString()} | HA: ${totalHa.toLocaleString()}`;
    }
  }
}
customElements.define("bank-dialog", BankDialog);
