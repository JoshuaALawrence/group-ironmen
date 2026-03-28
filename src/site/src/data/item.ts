import { utility } from "../utility";
import { pubsub } from "./pubsub";
import { api } from "./api";

const DEGRADED_CHARGES = new Set([0, 25, 50, 75, 100]);

type RawItemStack = [number, number];

type ItemStack = {
  id: number;
  count: number;
};

type ItemDetail = {
  id?: number;
  name: string;
  highalch: number;
  isTradeable?: boolean;
  stacks?: Array<ItemStack | RawItemStack> | null;
};

type ItemPayload = {
  id: number | string;
  quantity: number;
};

export class Item {
  static itemDetails: Record<number, ItemDetail> = {};
  static itemNameToId: Record<string, number> = {};
  static gePrices: Record<number, number> = {};

  id: number;
  quantity: number;
  visible: boolean;
  quantities?: Record<string, number>;

  constructor(id: number | string, quantity: number) {
    if (typeof id === "string") {
      this.id = parseInt(id);
    } else {
      this.id = id;
    }
    this.quantity = quantity;
    this.visible = true;
  }

  static imageUrl(itemId: number, quantity: number) {
    const itemDetails = Item.itemDetails[itemId];
    let imageId = itemDetails.id ?? itemId;
    if (itemDetails.stacks) {
      for (const stack of itemDetails.stacks) {
        const parsedStack = Array.isArray(stack) ? { id: stack[1], count: stack[0] } : stack;
        if (quantity >= parsedStack.count) {
          imageId = parsedStack.id;
        }
      }
    }
    return `/icons/items/${imageId}.webp`;
  }

  static itemName(itemId: number) {
    return Item.itemDetails[itemId].name;
  }

  static shortQuantity(quantity: number) {
    return utility.formatShortQuantity(quantity);
  }

  static veryShortQuantity(quantity: number) {
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

  static parseItemData(data: ItemPayload[]) {
    const result: Item[] = [];
    for (let i = 0; i < data.length; ++i) {
      const itemId = Number(data[i].id);
      if (itemId <= 0) {
        result.push(new Item(0, 0));
        continue;
      }

      if (!Item.itemDetails[itemId]) {
        console.warn(`Unrecognized item id: ${data[i].id}`);
        continue;
      }

      const item = new Item(itemId, data[i].quantity);
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
      itemDetails.stacks = stacks ? stacks.map((stack) => (Array.isArray(stack) ? { id: stack[1], count: stack[0] } : stack)) : null;
      itemDetails.id = Number(itemId);
      const lowerName = itemDetails.name.toLowerCase();
      if (!Item.itemNameToId[lowerName]) {
        Item.itemNameToId[lowerName] = Number(itemId);
      }
    }

    pubsub.publish("item-data-loaded");
  }

  static async loadGePrices() {
    const response = await api.getGePrices();
    Item.gePrices = await response.json();
  }

  static randomItem(quantity: number | null = null) {
    const keys = Object.keys(Item.itemDetails);
    const key = keys[(keys.length * Math.random()) << 0];
    const item = Item.itemDetails[Number(key)];
    return [item.id ?? Number(key), quantity ? quantity : Math.round(Math.random() * 100000 + 1)];
  }

  static randomItems(count: number, quantity?: number) {
    const result: Array<number> = [];
    for (let i = 0; i < count; ++i) {
      result.push(...Item.randomItem(quantity));
    }
    return result;
  }
}
