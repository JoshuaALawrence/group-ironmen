import { describe, expect, it } from "vitest";
import { GroupData } from "../data/group-data.js";
import { Item } from "../data/item.js";

describe("Item", () => {
  it("exposes tradeability when item data includes it", () => {
    Item.itemDetails = {
      1: { name: "Coins", highalch: 0, isTradeable: true },
      2: { name: "Quest item", highalch: 0, isTradeable: false },
      3: { name: "Legacy item", highalch: 0 },
    };
    Item.gePrices = {};

    expect(new Item(1, 1).isTradeable).toBe(true);
    expect(new Item(2, 1).isTradeable).toBe(false);
    expect(new Item(3, 1).isTradeable).toBeNull();
  });

  it("can hide only explicitly untradeable items", () => {
    const data = new GroupData();
    data.groupItems = {
      1: { id: 1, name: "Coins", quantities: { Alice: 10 }, isTradeable: true, visible: true },
      2: { id: 2, name: "Quest item", quantities: { Alice: 1 }, isTradeable: false, visible: true },
      3: { id: 3, name: "Legacy item", quantities: { Alice: 1 }, isTradeable: null, visible: true },
    };

    data.applyTradeabilityFilter(true);

    expect(data.groupItems[1].visible).toBe(true);
    expect(data.groupItems[2].visible).toBe(false);
    expect(data.groupItems[3].visible).toBe(true);
  });
});
