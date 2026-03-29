import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DisplayItem = {
  id: number;
  name: string;
  quantity: number;
  quantities: Record<string, number>;
  highAlch: number;
  gePrice: number;
  visible: boolean;
  isGrouped?: boolean;
  variantIds?: number[];
};

const mockedState = vi.hoisted(() => {
  const groupDataMock = {
    textFilter: "",
    playerFilter: "@ALL",
    groupItems: {} as Record<number, DisplayItem>,
    getDisplayItems: vi.fn<() => DisplayItem[]>(() => []),
    applyPlayerFilter: vi.fn((player: string) => {
      groupDataMock.playerFilter = player;
    }),
    applyTradeabilityFilter: vi.fn(),
    applyTextFilter: vi.fn((filter: string) => {
      groupDataMock.textFilter = filter;
    }),
  };

  return {
    groupDataMock,
  };
});

vi.mock("../data/group-data", () => ({
  groupData: mockedState.groupDataMock,
}));

import { InventoryPager } from "../inventory-pager/inventory-pager";

const groupDataMock = mockedState.groupDataMock;

function makeItem(overrides: Partial<DisplayItem> = {}): DisplayItem {
  return {
    id: 1,
    name: "Whip",
    quantity: 1,
    quantities: { alice: 1 },
    highAlch: 100,
    gePrice: 120,
    visible: true,
    ...overrides,
  };
}

function addPagerDom() {
  const pageTarget = document.createElement("div");
  pageTarget.className = "items-page__list";
  document.body.appendChild(pageTarget);

  const itemCount = document.createElement("div");
  itemCount.className = "items-page__item-count";
  document.body.appendChild(itemCount);

  const totalGeValue = document.createElement("div");
  totalGeValue.className = "items-page__total-ge-price";
  document.body.appendChild(totalGeValue);

  const totalHaValue = document.createElement("div");
  totalHaValue.className = "items-page__total-ha-price";
  document.body.appendChild(totalHaValue);

  return {
    pageTarget,
    itemCount,
    totalGeValue,
    totalHaValue,
  };
}

describe("inventory pager residual branches", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.clearAllMocks();

    groupDataMock.textFilter = "";
    groupDataMock.playerFilter = "@ALL";
    groupDataMock.groupItems = {};
    groupDataMock.getDisplayItems.mockReturnValue([]);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("covers optional-control fallbacks and grouped rendering without variant ids", () => {
    const dom = addPagerDom();
    const groupedItem = makeItem({
      id: 42,
      name: "Grouped rune",
      quantity: 3,
      quantities: { alice: 3 },
      gePrice: 200,
      highAlch: 150,
      isGrouped: true,
    });
    const swordItem = makeItem({
      id: 7,
      name: "Sword",
      quantity: 1,
      quantities: { alice: 1 },
      gePrice: 90,
      highAlch: 70,
    });

    groupDataMock.getDisplayItems.mockReturnValue([groupedItem, swordItem]);
    groupDataMock.groupItems = {
      7: swordItem,
      42: groupedItem,
      99: makeItem({
        id: 99,
        name: "Hidden",
        quantity: 500,
        quantities: { alice: 500 },
        gePrice: 1,
        highAlch: 1,
        visible: false,
      }),
    };

    const pager = new InventoryPager();
    document.body.appendChild(pager);

    pager.handleSearch();
    pager.handlePlayerFilterChange();
    pager.handleIndividualPricesChange();
    pager.handleGePriceToggle();
    pager.handleAlchPriceToggle();
    pager.handleHideUntradeablesToggle();

    expect(groupDataMock.applyTextFilter).toHaveBeenCalledWith("");
    expect(groupDataMock.applyPlayerFilter).toHaveBeenCalledWith("@ALL");
    expect(groupDataMock.applyTradeabilityFilter).toHaveBeenLastCalledWith(false);
    expect(pager.showIndividualPrices).toBe(false);
    expect(pager.showGePrice).toBe(true);
    expect(pager.showAlchPrice).toBe(true);
    expect(pager.hideUntradeables).toBe(false);
    expect(localStorage.getItem("showGePrice")).toBe("true");
    expect(localStorage.getItem("showAlchPrice")).toBe("true");
    expect(localStorage.getItem("hideUntradeables")).toBe("false");

    expect(dom.pageTarget.children).toHaveLength(2);
    const firstRenderedItem = dom.pageTarget.children[0] as HTMLElement;
    expect(firstRenderedItem.getAttribute("item-id")).toBe("42");
    expect(firstRenderedItem.getAttribute("grouped-ids")).toBe("");
    expect(firstRenderedItem.hasAttribute("individual-prices")).toBe(false);
    expect(firstRenderedItem.hasAttribute("hide-ge-price")).toBe(false);
    expect(firstRenderedItem.hasAttribute("hide-alch-price")).toBe(false);
    expect(firstRenderedItem.hasAttribute("player-filter")).toBe(false);
    expect(dom.itemCount.textContent).toBe("2");
    expect(dom.totalGeValue.textContent).toBe("690");
    expect(dom.totalHaValue.textContent).toBe("520");
  });

  it("covers missing player quantities when a filtered player has none of an item", () => {
    const dom = addPagerDom();
    const item = makeItem({
      id: 111,
      name: "Shared item",
      quantity: 5,
      quantities: { alice: 5 },
      gePrice: 12,
      highAlch: 8,
    });

    groupDataMock.playerFilter = "charlie";
    groupDataMock.getDisplayItems.mockReturnValue([item]);
    groupDataMock.groupItems = {
      111: item,
    };

    const pager = new InventoryPager();
    document.body.appendChild(pager);

    pager.maybeRenderPage(1, true);
    pager.render();

    expect(pager.itemQuantity(item)).toBe(0);
    const renderedItem = dom.pageTarget.querySelector("inventory-item");
    expect(renderedItem?.getAttribute("player-filter")).toBe("charlie");
    expect(dom.itemCount.textContent).toBe("1");
    expect(dom.totalGeValue.textContent).toBe("0");
    expect(dom.totalHaValue.textContent).toBe("0");
  });
});