import { BaseElement } from "../base-element/base-element";
import { groupData } from "../data/group-data";
import { GroupData } from "../data/group-data";

type DisplayItem = {
  id: number;
  name: string;
  quantity: number;
  quantities: Record<string, number>;
  highAlch: number;
  gePrice: number;
  isTradeable: boolean | null;
  visible: boolean;
  imageUrl: string;
  wikiLink: string;
};

export class InventoryItem extends BaseElement {
  showIndividualItemPrices: boolean;
  playerFilter: string | null;
  hideGePrice: boolean;
  hideAlchPrice: boolean;
  groupedIds: number[] | null;
  intersectionObserver?: IntersectionObserver;
  item!: DisplayItem;

  constructor() {
    super();
    this.showIndividualItemPrices = false;
    this.playerFilter = null;
    this.hideGePrice = false;
    this.hideAlchPrice = false;
    this.groupedIds = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    const itemId = this.getAttribute("item-id");
    this.showIndividualItemPrices = this.hasAttribute("individual-prices");
    this.playerFilter = this.getAttribute("player-filter");
    this.hideGePrice = this.hasAttribute("hide-ge-price");
    this.hideAlchPrice = this.hasAttribute("hide-alch-price");
    const groupedIdsAttr = this.getAttribute("grouped-ids");
    this.groupedIds = groupedIdsAttr ? groupedIdsAttr.split(",").map(Number) : null;

    const setupSubscription = () => {
      if (this.groupedIds) {
        for (const id of this.groupedIds) {
          this.subscribe(`item-update:${id}`, this.handleGroupedUpdate.bind(this));
        }
      } else {
        this.subscribe(`item-update:${itemId}`, (item) => this.handleUpdatedItem(item as DisplayItem));
      }
    };

    const top = this.offsetTop;
    const bottomOfPage = document.body.clientHeight;
    if (top < bottomOfPage) {
      setupSubscription();
    } else {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        for (const x of entries) {
          if (x.isIntersecting && x.target === this) {
            this.intersectionObserver?.disconnect();
            setupSubscription();
            return;
          }
        }
      }, {});
      this.intersectionObserver.observe(this);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  /* eslint-disable no-unused-vars */
  html(): string {
    const item = this.item;
    let playerHtml = "";
    const totalQuantity = this.quantity;

    if (this.playerFilter) {
      playerHtml = this.playerHtml(this.playerFilter);
    } else {
      for (const [playerName, quantity] of Object.entries(item.quantities)) {
        if (quantity === 0) continue;
        playerHtml += this.playerHtml(playerName);
      }
    }

    return `{{inventory-item.html}}`;
  }
  /* eslint-enable no-unused-vars */

  playerHtml(playerName: string): string {
    const quantity = this.item.quantities[playerName];
    const totalQuantity = this.quantity;
    const quantityPercent = Math.round((quantity / totalQuantity) * 100);
    return `
<span class="${quantity === 0 ? "inventory-item__no-quantity" : ""}">${playerName}</span>
<span>${quantity.toLocaleString()}</span>
<div class="inventory-item__quantity-bar"
     style="transform: scaleX(${quantityPercent}%); background: hsl(${quantityPercent}, 100%, 40%);">
</div>
`;
  }

  handleUpdatedItem(item: DisplayItem): void {
    this.item = item;
    this.render();
    this.classList.add("rendered");
  }

  handleGroupedUpdate(): void {
    const variants = (this.groupedIds ?? []).map((id) => groupData.groupItems[id]).filter(Boolean) as DisplayItem[];
    if (variants.length === 0) return;

    const primaryVariant = variants.reduce((a, b) => {
      const chargeA = Number.parseInt(a.name.match(/(\d+)$/)?.[1] ?? "0", 10);
      const chargeB = Number.parseInt(b.name.match(/(\d+)$/)?.[1] ?? "0", 10);
      return chargeB > chargeA ? b : a;
    });
    const baseName = GroupData.getDegradedBaseName(primaryVariant.name) || primaryVariant.name;

    this.item = GroupData.createGroupedItem(baseName, [...variants]) as DisplayItem;
    this.render();
    this.classList.add("rendered");
  }

  get quantity(): number {
    if (this.playerFilter) {
      return this.item.quantities[this.playerFilter] ?? 0;
    }

    return this.item.quantity;
  }

  get highAlch(): string {
    const highAlch = this.item.highAlch;
    if (highAlch === 0) return "N/A";

    if (this.showIndividualItemPrices) {
      return highAlch.toLocaleString() + "gp";
    }

    return (this.quantity * highAlch).toLocaleString() + "gp";
  }

  get gePrice(): string {
    const gePrice = this.item.gePrice;
    if (gePrice === 0) return "N/A";

    if (this.showIndividualItemPrices) {
      return gePrice.toLocaleString() + "gp";
    }

    return (this.quantity * gePrice).toLocaleString() + "gp";
  }

  get tradeabilityLabel(): string | null {
    if (typeof this.item?.isTradeable !== "boolean") {
      return null;
    }

    return this.item.isTradeable ? "Tradeable" : "Untradeable";
  }

  get tradeabilityClassName(): string {
    if (typeof this.item?.isTradeable !== "boolean") {
      return "";
    }

    return this.item.isTradeable
      ? "inventory-item__tradeability inventory-item__tradeability--tradeable"
      : "inventory-item__tradeability inventory-item__tradeability--untradeable";
  }
}
customElements.define("inventory-item", InventoryItem);
