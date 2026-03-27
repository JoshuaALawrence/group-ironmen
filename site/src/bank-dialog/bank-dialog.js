import { BaseElement } from "../base-element/base-element";
import { groupData } from "../data/group-data";

export class BankDialog extends BaseElement {
  constructor() {
    super();
    this.bank = [];
    this.searchQuery = "";
  }

  html() {
    return `{{bank-dialog.html}}`;
  }

  connectedCallback() {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.render();

    this.background = this.querySelector(".dialog__visible");
    this.statusEl = this.querySelector(".bank-dialog__status");
    this.itemsEl = this.querySelector(".bank-dialog__items");
    this.itemCountEl = this.querySelector(".bank-dialog__item-count");
    this.valueEl = this.querySelector(".bank-dialog__value");
    this.searchInput = this.querySelector(".bank-dialog__search-input");

    this.eventListener(this.querySelector(".dialog__close"), "click", this.close.bind(this));
    this.eventListener(this.background, "click", this.closeIfBackgroundClick.bind(this));
    this.eventListener(this.searchInput, "input", this.handleSearch.bind(this), { passive: true });

    this.subscribe(`bank:${this.playerName}`, this.handleBankUpdate.bind(this));

    const memberData = groupData.members.get(this.playerName);
    if (memberData && memberData.bank && memberData.bank.length > 0) {
      this.handleBankUpdate(memberData.bank);
    } else {
      this.setStatus("No bank data available.");
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  closeIfBackgroundClick(evt) {
    if (evt.target === this.background) {
      this.close();
    }
  }

  close() {
    this.remove();
  }

  setStatus(message) {
    this.statusEl.textContent = message;
    this.statusEl.hidden = false;
    this.itemsEl.hidden = true;
  }

  handleSearch() {
    this.searchQuery = this.searchInput.value.toLowerCase().trim();
    this.renderItems();
  }

  handleBankUpdate(bank) {
    this.bank = bank.filter((item) => item.isValid());
    this.statusEl.hidden = true;
    this.itemsEl.hidden = false;
    this.renderItems();
    this.renderValue();
  }

  renderItems() {
    const filtered = this.searchQuery
      ? this.bank.filter((item) => item.name.toLowerCase().includes(this.searchQuery))
      : this.bank;

    this.itemCountEl.textContent = `${filtered.length} items`;

    const fragment = document.createDocumentFragment();
    for (const item of filtered) {
      const slot = document.createElement("div");
      slot.className = "bank-dialog__slot";

      const itemEl = document.createElement("item-box");
      itemEl.setAttribute("player-name", this.playerName);
      itemEl.setAttribute("inventory-type", "bank");
      itemEl.item = item;
      slot.appendChild(itemEl);
      fragment.appendChild(slot);
    }

    this.itemsEl.innerHTML = "";
    this.itemsEl.appendChild(fragment);
  }

  renderValue() {
    let totalGe = 0;
    let totalHa = 0;
    for (const item of this.bank) {
      totalGe += item.gePrice * item.quantity;
      totalHa += item.highAlch * item.quantity;
    }
    this.valueEl.textContent = `GE: ${totalGe.toLocaleString()} | HA: ${totalHa.toLocaleString()}`;
  }
}
customElements.define("bank-dialog", BankDialog);
