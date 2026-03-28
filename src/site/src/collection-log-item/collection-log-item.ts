import { BaseElement } from "../base-element/base-element";
import { collectionLog } from "../data/collection-log";
import { Item } from "../data/item";

export class CollectionLogItem extends BaseElement {
  playerName: string | null;
  itemId: number;
  otherPlayers: string[];

  constructor() {
    super();
    this.playerName = null;
    this.itemId = 0;
    this.otherPlayers = [];
  }

  html(): string {
    return `{{collection-log-item.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.itemId = Number.parseInt(this.getAttribute("item-id") ?? "0", 10);
    this.enableTooltip();

    const tooltipLines = [Item.itemName(this.itemId)];
    for (const playerName of collectionLog.playerNames) {
      const quantity = collectionLog.unlockedItemCount(playerName, this.itemId);
      if (quantity > 0) {
        tooltipLines.push(`<player-icon player-name="${playerName}"></player-icon> ${playerName} - ${quantity}`);
      }
    }
    this.tooltipText = tooltipLines.join("<br >");

    this.otherPlayers = collectionLog.otherPlayers;
    this.render();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }
}

customElements.define("collection-log-item", CollectionLogItem);
