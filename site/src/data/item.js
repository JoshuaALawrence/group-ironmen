import { utility } from "../utility";
import { pubsub } from "./pubsub";
import { api } from "./api";

const DEGRADED_CHARGES = new Set([0, 25, 50, 75, 100]);

export class Item {
  constructor(id, quantity) {
    if (typeof id === "string") {
      this.id = parseInt(id);
    } else {
      this.id = id;
    }
    this.quantity = quantity;
    this.visible = true;
  }

  static imageUrl(itemId, quantity) {
    const itemDetails = Item.itemDetails[itemId];
    let imageId = itemDetails.id;
    if (itemDetails.stacks) {
      for (const stack of itemDetails.stacks) {
        if (quantity >= stack.count) {
          imageId = stack.id;
        }
      }
    }
    return `/icons/items/${imageId}.webp`;
  }

  static itemName(itemId) {
    return Item.itemDetails[itemId].name;
  }

  static shortQuantity(quantity) {
    return utility.formatShortQuantity(quantity);
  }

  static veryShortQuantity(quantity) {
    return utility.formatVeryShortQuantity(quantity);
  }

  get imageUrl() {
    return Item.imageUrl(this.id, this.quantity);
  }

  get shortQuantity() {
    return Item.shortQuantity(this.quantity);
  }

  get veryShortQuantity() {
    return Item.veryShortQuantity(this.quantity);
  }

  get name() {
    return Item.itemDetails[this.id].name;
  }

  get wikiLink() {
    return `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${this.id}`;
  }

  get highAlch() {
    return Item.itemDetails[this.id].highalch;
  }

  get gePrice() {
    const price = Item.gePrices[this.id];
    if (price) return price;

    const itemDetails = Item.itemDetails[this.id];
    const match = itemDetails?.name?.match(/^(.+)\s+(\d+)$/);
    if (match && DEGRADED_CHARGES.has(parseInt(match[2]))) {
      const baseId = Item.itemNameToId?.[match[1].toLowerCase()];
      if (baseId !== undefined) {
        return Item.gePrices[baseId] || 0;
      }
    }

    return 0;
  }

  get isTradeable() {
    const itemDetails = Item.itemDetails[this.id];
    if (typeof itemDetails?.isTradeable === "boolean") {
      if (itemDetails.isTradeable) return true;

      const match = itemDetails.name.match(/^(.+)\s+(\d+)$/);
      if (match && DEGRADED_CHARGES.has(parseInt(match[2]))) {
        const baseId = Item.itemNameToId?.[match[1].toLowerCase()];
        if (baseId !== undefined) {
          const baseDetails = Item.itemDetails[baseId];
          if (baseDetails?.isTradeable === true) return true;
        }
      }

      return false;
    }
    return null;
  }

  isValid() {
    return this.id > 0;
  }

  isRunePouch() {
    return this.quantity === 1 && (this.id === 12791 || this.id === 27281);
  }

  static parseItemData(data) {
    const result = [];
    for (let i = 0; i < data.length; ++i) {
      if (data[i].id <= 0) {
        result.push(new Item(0, 0));
        continue;
      }

      if (!Item.itemDetails[data[i].id]) {
        console.warn(`Unrecognized item id: ${data[i].id}`);
        continue;
      }

      const item = new Item(data[i].id, data[i].quantity);
      result.push(item);
    }

    return result;
  }

  static async loadItems() {
    const response = await fetch("/data/item_data.json");
    Item.itemDetails = await response.json();
    Item.itemNameToId = {};
    for (const [itemId, itemDetails] of Object.entries(Item.itemDetails)) {
      const stacks = itemDetails.stacks;
      itemDetails.stacks = stacks ? stacks.map((stack) => ({ id: stack[1], count: stack[0] })) : null;
      itemDetails.id = itemId;
      const lowerName = itemDetails.name.toLowerCase();
      if (!Item.itemNameToId[lowerName]) {
        Item.itemNameToId[lowerName] = itemId;
      }
    }

    pubsub.publish("item-data-loaded");
  }

  static async loadGePrices() {
    const response = await api.getGePrices();
    Item.gePrices = await response.json();
  }

  static randomItem(quantity = null) {
    const keys = Object.keys(Item.itemDetails);
    const key = keys[(keys.length * Math.random()) << 0];
    const item = Item.itemDetails[key];
    return [item.id, quantity ? quantity : Math.round(Math.random() * 100000 + 1)];
  }

  static randomItems(count, quantity) {
    let result = [];
    for (let i = 0; i < count; ++i) {
      result.push(...Item.randomItem(quantity));
    }
    return result;
  }
}
