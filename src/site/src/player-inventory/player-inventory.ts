import { BaseElement } from "../base-element/base-element";

type InventoryItemData = {
  isValid: () => boolean;
  isRunePouch: () => boolean;
};

type ItemBoxElement = HTMLElement & {
  item?: InventoryItemData;
};

export class PlayerInventory extends BaseElement {
  inventoryEl: HTMLElement | null;
  playerName: string | null;

  constructor() {
    super();
    this.inventoryEl = null;
    this.playerName = null;
  }

  html(): string {
    return `{{player-inventory.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.inventoryEl = this.querySelector<HTMLElement>(".player-inventory__inventory");
    this.playerName = this.getAttribute("player-name");
    this.subscribe(`inventory:${this.playerName}`, (inventory) => this.handleUpdatedInventory(inventory as InventoryItemData[]));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  handleUpdatedInventory(inventory: InventoryItemData[]): void {
    const items = document.createDocumentFragment();
    for (let position = 0; position < inventory.length; ++position) {
      const item = inventory[position];
      if (!item.isValid()) continue;
      const row = Math.floor(position / 4);
      const column = position - row * 4;
      const itemEl = document.createElement("item-box") as ItemBoxElement;
      itemEl.style.gridColumn = `${column + 1} / ${column + 1}`;
      itemEl.style.gridRow = `${row + 1} / ${row + 1}`;
      itemEl.setAttribute("player-name", this.playerName ?? "");
      itemEl.setAttribute("inventory-type", "inventory");
      if (item.isRunePouch()) {
        itemEl.setAttribute("no-tooltip", "true");
      }
      itemEl.item = item;
      items.appendChild(itemEl);
    }

    if (this.inventoryEl) {
      this.inventoryEl.innerHTML = "";
      this.inventoryEl.appendChild(items);
    }
  }
}
customElements.define("player-inventory", PlayerInventory);
