import { BaseElement } from "../base-element/base-element";
import { groupData } from "../data/group-data";
import { Item } from "../data/item";

export class ItemBox extends BaseElement {
  noTooltip: boolean;
  playerName: string | null;
  veryShortQuantity: boolean;
  quantity: number;
  itemId: number;
  item?: Item;

  constructor() {
    super();
    this.noTooltip = false;
    this.playerName = null;
    this.veryShortQuantity = false;
    this.quantity = 0;
    this.itemId = 0;
  }

  html(): string {
    return `{{item-box.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.noTooltip = this.hasAttribute("no-tooltip");
    this.playerName = this.getAttribute("player-name");
    this.veryShortQuantity = this.hasAttribute("very-short-quantity");
    this.quantity = this.item?.quantity || Number.parseInt(this.getAttribute("item-quantity") ?? "0", 10);
    this.itemId = this.item?.id || Number.parseInt(this.getAttribute("item-id") ?? "0", 10);

    if (!this.noTooltip) {
      this.enableTooltip();
      if (this.item) {
        const inventoryType = this.getAttribute("inventory-type");
        const totalInventoryQuantity =
          inventoryType && this.playerName
            ? groupData.inventoryQuantityForItem(this.item.id, this.playerName, inventoryType)
            : this.item.quantity;
        const stackHighAlch = totalInventoryQuantity * this.item.highAlch;
        const stackGePrice = totalInventoryQuantity * this.item.gePrice;

        this.tooltipText = `
${this.item.name} x ${totalInventoryQuantity}
<br />
HA: ${stackHighAlch.toLocaleString()}
<br />
GE: ${stackGePrice.toLocaleString()}`;
      } else {
        this.tooltipText = `${Item.itemName(this.itemId)} x ${this.quantity.toLocaleString()}`;
      }
    }

    this.render();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }
}
customElements.define("item-box", ItemBox);
