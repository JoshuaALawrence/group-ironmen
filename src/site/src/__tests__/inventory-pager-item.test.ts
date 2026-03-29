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
  isTradeable?: boolean | null;
  imageUrl?: string;
  wikiLink?: string;
};

type SearchElement = HTMLElement & {
  searchInput: HTMLInputElement;
  value: string | undefined;
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
    getDegradedBaseName: vi.fn((name: string) => name.replace(/\s+\(\d+\)$/, "")),
    createGroupedItem: vi.fn((name: string, variants: DisplayItem[]) => ({
      id: variants[0]?.id ?? 0,
      name,
      quantity: variants.reduce((total, variant) => total + variant.quantity, 0),
      quantities: variants.reduce<Record<string, number>>((allQuantities, variant) => {
        Object.entries(variant.quantities).forEach(([player, quantity]) => {
          allQuantities[player] = (allQuantities[player] ?? 0) + quantity;
        });
        return allQuantities;
      }, {}),
      highAlch: variants[0]?.highAlch ?? 0,
      gePrice: variants[0]?.gePrice ?? 0,
      isTradeable: true,
      visible: true,
      imageUrl: variants[0]?.imageUrl ?? "",
      wikiLink: variants[0]?.wikiLink ?? "",
    })),
    contextMenuShow: vi.fn(),
    requestQuantity: vi.fn(async () => 1),
    sendItemRequest: vi.fn(async () => true),
    getActiveMember: vi.fn(() => "alice"),
    ensureWebhook: vi.fn(async () => undefined),
    webhookStatusMock: {
      ensure: vi.fn(async () => undefined),
      hasWebhook: true,
    },
  };
});

mockedState.webhookStatusMock.ensure = mockedState.ensureWebhook;

vi.mock("../data/group-data", () => ({
  groupData: mockedState.groupDataMock,
  GroupData: {
    getDegradedBaseName: mockedState.getDegradedBaseName,
    createGroupedItem: mockedState.createGroupedItem,
  },
}));

vi.mock("../rs-context-menu/context-menu-manager", () => ({
  contextMenuManager: {
    show: mockedState.contextMenuShow,
  },
}));

vi.mock("../request-dialog/request-dialog-manager", () => ({
  requestDialogManager: {
    requestQuantity: mockedState.requestQuantity,
  },
}));

vi.mock("../request-dialog/request-dialog", () => ({
  RequestDialog: {
    sendItemRequest: mockedState.sendItemRequest,
  },
}));

vi.mock("../data/storage", () => ({
  storage: {
    getActiveMember: mockedState.getActiveMember,
  },
}));

vi.mock("../data/webhook-status", () => ({
  webhookStatus: mockedState.webhookStatusMock,
}));

import { pubsub } from "../data/pubsub";
import { InventoryItem } from "../inventory-item/inventory-item";
import { InventoryPager } from "../inventory-pager/inventory-pager";

const groupDataMock = mockedState.groupDataMock;

function makeItem(overrides: Partial<DisplayItem> = {}): DisplayItem {
  return {
    id: 1,
    name: "Whip",
    quantity: 3,
    quantities: { alice: 3, bob: 0 },
    highAlch: 1_000,
    gePrice: 1_200,
    isTradeable: true,
    visible: true,
    imageUrl: "/item.webp",
    wikiLink: "https://example.test/item",
    ...overrides,
  };
}

function addPagerDom() {
  const pageTarget = document.createElement("div");
  pageTarget.className = "items-page__list";
  document.body.appendChild(pageTarget);

  const sortTarget = document.createElement("select");
  sortTarget.className = "items-page__sort";
  sortTarget.innerHTML = [
    '<option value="totalquantity">Total quantity</option>',
    '<option value="highalch">High alch</option>',
    '<option value="geprice">GE price</option>',
    '<option value="alphabetical">Alphabetical</option>',
  ].join("");
  document.body.appendChild(sortTarget);

  const itemCount = document.createElement("div");
  itemCount.className = "items-page__item-count";
  document.body.appendChild(itemCount);

  const totalGeValue = document.createElement("div");
  totalGeValue.className = "items-page__total-ge-price";
  document.body.appendChild(totalGeValue);

  const totalHaValue = document.createElement("div");
  totalHaValue.className = "items-page__total-ha-price";
  document.body.appendChild(totalHaValue);

  const searchInput = document.createElement("input");
  const searchElement = document.createElement("div") as SearchElement;
  searchElement.className = "items-page__search";
  searchElement.searchInput = searchInput;
  let currentValue = "";
  Object.defineProperty(searchElement, "value", {
    configurable: true,
    get: () => currentValue,
    set: (value: string | undefined) => {
      currentValue = value ?? "";
      searchInput.value = currentValue;
    },
  });
  document.body.appendChild(searchElement);

  const showIndividualPrices = document.createElement("input");
  showIndividualPrices.id = "items-page__individual-items";
  showIndividualPrices.type = "checkbox";
  document.body.appendChild(showIndividualPrices);

  const showGePrice = document.createElement("input");
  showGePrice.id = "items-page__show-ge-price";
  showGePrice.type = "checkbox";
  document.body.appendChild(showGePrice);

  const showAlchPrice = document.createElement("input");
  showAlchPrice.id = "items-page__show-alch-price";
  showAlchPrice.type = "checkbox";
  document.body.appendChild(showAlchPrice);

  const hideUntradeables = document.createElement("input");
  hideUntradeables.id = "items-page__hide-untradeables";
  hideUntradeables.type = "checkbox";
  document.body.appendChild(hideUntradeables);

  const playerFilter = document.createElement("select");
  playerFilter.className = "items-page__player-filter";
  playerFilter.innerHTML = '<option value="@ALL">All</option><option value="alice">alice</option>';
  document.body.appendChild(playerFilter);

  return {
    pageTarget,
    sortTarget,
    itemCount,
    totalGeValue,
    totalHaValue,
    searchElement,
    showIndividualPrices,
    showGePrice,
    showAlchPrice,
    hideUntradeables,
    playerFilter,
  };
}

type MockObserverInstance = {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

let observerInstances: MockObserverInstance[] = [];

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    observerInstances.push(this);
  }
}

describe("inventory pager and item", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.clearAllMocks();
    vi.stubGlobal("alert", vi.fn());
    observerInstances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver as unknown as typeof IntersectionObserver);
    Object.defineProperty(document.body, "clientHeight", {
      configurable: true,
      value: 200,
    });

    groupDataMock.textFilter = "preset search";
    groupDataMock.playerFilter = "@ALL";
    groupDataMock.groupItems = {};
    groupDataMock.getDisplayItems.mockReturnValue([]);
    mockedState.webhookStatusMock.hasWebhook = true;
    mockedState.requestQuantity.mockResolvedValue(1);
    mockedState.sendItemRequest.mockResolvedValue(true);
    mockedState.getActiveMember.mockReturnValue("alice");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.unstubAllGlobals();
  });

  it("initializes pager controls, handles DOM events, and renders page attributes", () => {
    const dom = addPagerDom();
    localStorage.setItem("showGePrice", "false");
    localStorage.setItem("showAlchPrice", "false");
    localStorage.setItem("hideUntradeables", "true");
    dom.showIndividualPrices.checked = true;

    const items = [
      makeItem({ id: 10, name: "Sword", quantity: 2, quantities: { alice: 1, bob: 1 }, highAlch: 300, gePrice: 500 }),
      makeItem({ id: 20, name: "Rune", quantity: 15, quantities: { alice: 10, bob: 5 }, highAlch: 5, gePrice: 10, isGrouped: true, variantIds: [20, 21] }),
      makeItem({ id: 30, name: "Bow", quantity: 1, quantities: { alice: 1 }, highAlch: 800, gePrice: 750 }),
    ];
    groupDataMock.getDisplayItems.mockReturnValue(items);
    groupDataMock.groupItems = {
      10: items[0],
      20: items[1],
      30: items[2],
      40: makeItem({ id: 40, name: "Hidden", quantity: 50, visible: false, highAlch: 50, gePrice: 100 }),
    };

    const pager = new InventoryPager();
    pager.pageLimit = 2;
    document.body.appendChild(pager);

    expect(dom.searchElement.searchInput.value).toBe("preset search");
    expect(dom.showGePrice.checked).toBe(false);
    expect(dom.showAlchPrice.checked).toBe(false);
    expect(dom.hideUntradeables.checked).toBe(true);
    expect(groupDataMock.applyTradeabilityFilter).toHaveBeenCalledWith(true);

    pager.maybeRenderPage(1, true);
    expect(dom.pageTarget.children).toHaveLength(2);

    const firstItem = dom.pageTarget.children[0] as HTMLElement;
    expect(firstItem.getAttribute("item-id")).toBe("20");
    expect(firstItem.getAttribute("grouped-ids")).toBe("20,21");
    expect(firstItem.hasAttribute("individual-prices")).toBe(true);
    expect(firstItem.hasAttribute("hide-ge-price")).toBe(true);
    expect(firstItem.hasAttribute("hide-alch-price")).toBe(true);

    dom.searchElement.value = "  RuNe  ";
    dom.searchElement.dispatchEvent(new Event("input", { bubbles: true }));
    expect(groupDataMock.applyTextFilter).toHaveBeenCalledWith("rune");

    dom.sortTarget.value = "alphabetical";
    dom.sortTarget.dispatchEvent(new Event("change", { bubbles: true }));
    expect((dom.pageTarget.children[0] as HTMLElement).getAttribute("item-id")).toBe("30");

    dom.showIndividualPrices.checked = false;
    dom.showIndividualPrices.dispatchEvent(new Event("change", { bubbles: true }));
    expect((dom.pageTarget.children[0] as HTMLElement).hasAttribute("individual-prices")).toBe(false);

    dom.playerFilter.value = "alice";
    dom.playerFilter.dispatchEvent(new Event("change", { bubbles: true }));
    expect(groupDataMock.applyPlayerFilter).toHaveBeenCalledWith("alice");
    expect((dom.pageTarget.children[0] as HTMLElement).getAttribute("player-filter")).toBe("alice");

    dom.showGePrice.checked = true;
    dom.showGePrice.dispatchEvent(new Event("change", { bubbles: true }));
    expect(localStorage.getItem("showGePrice")).toBe("true");
    expect((dom.pageTarget.children[0] as HTMLElement).hasAttribute("hide-ge-price")).toBe(false);

    dom.showAlchPrice.checked = true;
    dom.showAlchPrice.dispatchEvent(new Event("change", { bubbles: true }));
    expect(localStorage.getItem("showAlchPrice")).toBe("true");
    expect((dom.pageTarget.children[0] as HTMLElement).hasAttribute("hide-alch-price")).toBe(false);

    dom.hideUntradeables.checked = false;
    dom.hideUntradeables.dispatchEvent(new Event("change", { bubbles: true }));
    expect(localStorage.getItem("hideUntradeables")).toBe("false");
    expect(groupDataMock.applyTradeabilityFilter).toHaveBeenLastCalledWith(false);

    const secondPageButton = document.createElement("button");
    secondPageButton.className = "inventory-pager__button";
    Object.defineProperty(secondPageButton, "innerText", {
      configurable: true,
      value: "2",
    });
    pager.appendChild(secondPageButton);
    secondPageButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pager.currentPage).toBe(2);
    expect(dom.itemCount.textContent).toBe("3");
    expect(dom.totalGeValue.textContent).toBe("1,350");
    expect(dom.totalHaValue.textContent).toBe("1,150");
  });

  it("covers pager paging helpers, empty state, and update no-op paths", () => {
    const pager = new InventoryPager();
    pager.pageLimit = 2;
    pager.pageTarget = document.createElement("div");
    pager.totalGeValue = document.createElement("div");
    pager.totalHaValue = document.createElement("div");
    pager.itemCount = document.createElement("div");

    const items = [
      makeItem({ id: 1, name: "Delta", quantity: 7, highAlch: 10, gePrice: 9 }),
      makeItem({ id: 2, name: "Bravo", quantity: 5, highAlch: 100, gePrice: 90 }),
      makeItem({ id: 3, name: "Charlie", quantity: 3, highAlch: 300, gePrice: 400 }),
      makeItem({ id: 4, name: "Alpha", quantity: 2, highAlch: 1, gePrice: 2 }),
      makeItem({ id: 5, name: "Echo", quantity: 1, highAlch: 500, gePrice: 600 }),
    ];

    expect(pager.pageUpdated(undefined, [items[0]])).toBe(true);
    expect(pager.pageUpdated([items[0]], [items[0], items[1]])).toBe(true);
    expect(pager.pageUpdated([items[0]], [items[1]])).toBe(true);
    expect(pager.pageUpdated([items[0], items[1]], [items[0], items[1]])).toBe(false);

    expect(pager.compareOnQuantity(items[0], items[1])).toBeLessThan(0);
    pager.showIndividualPrices = false;
    expect(pager.compareOnHighAlch(items[0], items[1])).toBeGreaterThan(0);
    expect(pager.compareOnGePrice(items[0], items[1])).toBeGreaterThan(0);
    pager.showIndividualPrices = true;
    expect(pager.compareOnHighAlch(items[0], items[1])).toBeGreaterThan(0);
    expect(pager.compareOnGePrice(items[0], items[1])).toBeGreaterThan(0);
    expect(pager.compareAlphabetical(items[3], items[1])).toBeLessThan(0);

    groupDataMock.playerFilter = "alice";
    expect(pager.itemQuantity(makeItem({ quantity: 9, quantities: { alice: 4 } }))).toBe(4);
    groupDataMock.playerFilter = "@ALL";
    expect(pager.itemQuantity(makeItem({ quantity: 9, quantities: { alice: 4 } }))).toBe(9);

    pager.compare = pager.compareAlphabetical.bind(pager);
    expect(pager.getPage(2, items).map((item) => item.id)).toEqual([3, 1]);

    groupDataMock.getDisplayItems.mockReturnValue(items.slice(0, 2));
    groupDataMock.groupItems = {
      1: items[0],
      2: items[1],
    };
    pager.currentPage = 9;
    pager.pageItems = pager.getPage(1, items.slice(0, 2));
    const renderPageSpy = vi.spyOn(pager, "renderPage");
    const updateItemValuesSpy = vi.spyOn(pager, "updateItemValues");
    pager.maybeRenderPage(9);
    expect(pager.currentPage).toBe(1);
    expect(renderPageSpy).not.toHaveBeenCalled();
    expect(updateItemValuesSpy).toHaveBeenCalledTimes(1);

    const renderSpy = vi.spyOn(pager, "render");
    pager.numberOfItems = 2;
    groupDataMock.getDisplayItems.mockReturnValue([items[0], items[1]]);
    pager.handleUpdatedItems();
    expect(renderSpy).not.toHaveBeenCalled();

    groupDataMock.getDisplayItems.mockReturnValue([]);
    groupDataMock.groupItems = {};
    pager.handleUpdatedItems();
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(pager.numberOfItems).toBe(0);
    expect(pager.numberOfPages).toBe(0);
    expect(pager.pageTarget.children).toHaveLength(0);
    expect(pager.totalGeValue.textContent).toBe("0");
    expect(pager.totalHaValue.textContent).toBe("0");
  });

  it("subscribes inventory items immediately and exposes quantity and price branches", () => {
    const item = new InventoryItem();
    item.setAttribute("item-id", "101");
    Object.defineProperty(item, "offsetTop", {
      configurable: true,
      value: 0,
    });

    const renderSpy = vi.spyOn(item, "render").mockImplementation(() => undefined);
    document.body.appendChild(item);
    expect(pubsub.anyoneListening("item-update:101")).toBe(true);

    const updatedItem = makeItem({
      id: 101,
      quantity: 4,
      quantities: { alice: 3, bob: 0 },
      highAlch: 2_000,
      gePrice: 3_000,
    });
    pubsub.publish("item-update:101", updatedItem);

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(item.classList.contains("rendered")).toBe(true);
    expect(item.playerHtml("bob")).toContain("inventory-item__no-quantity");
    expect(item.quantity).toBe(4);

    item.playerFilter = "alice";
    expect(item.quantity).toBe(3);

    item.showIndividualItemPrices = false;
    expect(item.highAlch).toBe("6,000gp");
    expect(item.gePrice).toBe("9,000gp");

    item.showIndividualItemPrices = true;
    expect(item.highAlch).toBe("2,000gp");
    expect(item.gePrice).toBe("3,000gp");

    item.item = makeItem({ id: 101, highAlch: 0, gePrice: 0, isTradeable: null });
    expect(item.highAlch).toBe("N/A");
    expect(item.gePrice).toBe("N/A");
    expect(item.tradeabilityLabel).toBeNull();
    expect(item.tradeabilityClassName).toBe("");

    item.item = makeItem({ id: 101, isTradeable: false });
    expect(item.tradeabilityLabel).toBe("Untradeable");
    expect(item.tradeabilityClassName).toContain("untradeable");
  });

  it("defers grouped subscriptions until intersection and disconnects observers", () => {
    const item = new InventoryItem();
    item.setAttribute("grouped-ids", "201,202");
    Object.defineProperty(item, "offsetTop", {
      configurable: true,
      value: 500,
    });

    const renderSpy = vi.spyOn(item, "render").mockImplementation(() => undefined);
    document.body.appendChild(item);

    expect(observerInstances).toHaveLength(1);
    expect(pubsub.anyoneListening("item-update:201")).toBe(false);
    expect(observerInstances[0]?.observe).toHaveBeenCalledWith(item);

    observerInstances[0]?.callback([{ isIntersecting: false, target: item } as IntersectionObserverEntry], observerInstances[0] as never);
    expect(pubsub.anyoneListening("item-update:201")).toBe(false);

    groupDataMock.groupItems = {
      201: makeItem({ id: 201, name: "Abyssal whip (50)", quantity: 2, highAlch: 1_500, gePrice: 1_600 }),
      202: makeItem({ id: 202, name: "Abyssal whip (100)", quantity: 1, highAlch: 1_700, gePrice: 1_800 }),
    };
    observerInstances[0]?.callback([{ isIntersecting: true, target: item } as IntersectionObserverEntry], observerInstances[0] as never);
    expect(observerInstances[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(pubsub.anyoneListening("item-update:201")).toBe(true);
    expect(pubsub.anyoneListening("item-update:202")).toBe(true);

    pubsub.publish("item-update:201");
  expect(mockedState.getDegradedBaseName).toHaveBeenCalledWith("Abyssal whip (50)");
    expect(mockedState.createGroupedItem).toHaveBeenCalledWith("Abyssal whip", expect.any(Array));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(item.classList.contains("rendered")).toBe(true);
    expect(item.item.name).toBe("Abyssal whip");

    const disconnectingItem = new InventoryItem();
    disconnectingItem.setAttribute("item-id", "999");
    Object.defineProperty(disconnectingItem, "offsetTop", {
      configurable: true,
      value: 500,
    });
    document.body.appendChild(disconnectingItem);
    const disconnectObserver = observerInstances[1];
    disconnectingItem.disconnectedCallback();
    expect(disconnectObserver?.disconnect).toHaveBeenCalledTimes(1);

    const groupedItemWithoutVariants = new InventoryItem();
    groupedItemWithoutVariants.groupedIds = [777];
    const groupedRenderSpy = vi.spyOn(groupedItemWithoutVariants, "render").mockImplementation(() => undefined);
    groupDataMock.groupItems = {};
    groupedItemWithoutVariants.handleGroupedUpdate();
    expect(groupedRenderSpy).not.toHaveBeenCalled();
  });

  it("handles inventory item context menu no-op, alert, failure, and success paths", async () => {
    const missingItem = new InventoryItem();
    missingItem.handleContextMenu({ preventDefault: vi.fn() } as unknown as MouseEvent);
    expect(mockedState.contextMenuShow).not.toHaveBeenCalled();

    const item = new InventoryItem();
    item.item = makeItem({
      id: 303,
      name: "Abyssal whip",
      quantity: 5,
      quantities: { alice: 4, bob: 1 },
    });

    const event = {
      clientX: 10,
      clientY: 20,
      preventDefault: vi.fn(),
    } as unknown as MouseEvent;

    item.handleContextMenu(event);
    await Promise.resolve();
    expect(mockedState.contextMenuShow).not.toHaveBeenCalled();

    const page = document.createElement("items-page");
    page.appendChild(item);

    mockedState.webhookStatusMock.hasWebhook = false;
    item.handleContextMenu(event);
    await Promise.resolve();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockedState.contextMenuShow).toHaveBeenCalledTimes(1);
    const disabledOption = mockedState.contextMenuShow.mock.calls[0]?.[3]?.[0];
    expect(disabledOption.label).toBe("Request (no webhook)");
    expect(disabledOption.disabled).toBe(true);
    expect(disabledOption.highlightedText).toBeUndefined();

    mockedState.contextMenuShow.mockClear();
    mockedState.webhookStatusMock.hasWebhook = true;
    item.handleContextMenu(event);
    await Promise.resolve();
    const option = mockedState.contextMenuShow.mock.calls[0]?.[3]?.[0];
    expect(option.label).toBe("Request");
    expect(option.disabled).toBe(false);
    expect(option.highlightedText).toBe("Abyssal whip");

    mockedState.requestQuantity.mockResolvedValueOnce(null);
    await option.callback();
    expect(mockedState.sendItemRequest).not.toHaveBeenCalled();

    mockedState.requestQuantity.mockResolvedValueOnce(0);
    await option.callback();
    expect(mockedState.sendItemRequest).not.toHaveBeenCalled();

    mockedState.requestQuantity.mockResolvedValueOnce(2);
    mockedState.getActiveMember.mockReturnValueOnce(null);
    await option.callback();
    expect(globalThis.alert).toHaveBeenCalledWith("Please set your identity in Group Settings first.");

    mockedState.requestQuantity.mockResolvedValueOnce(2);
    mockedState.sendItemRequest.mockResolvedValueOnce(false);
    await option.callback();
    expect(mockedState.sendItemRequest).toHaveBeenCalledWith("Abyssal whip", 2, "alice", { alice: 4, bob: 1 });
    expect(globalThis.alert).toHaveBeenCalledWith(
      "Failed to send request. Make sure a Discord webhook is configured in Group Settings."
    );

    mockedState.requestQuantity.mockResolvedValueOnce(3);
    mockedState.sendItemRequest.mockResolvedValueOnce(true);
    const alertCallsBeforeSuccess = (globalThis.alert as ReturnType<typeof vi.fn>).mock.calls.length;
    await option.callback();
    expect(mockedState.sendItemRequest).toHaveBeenLastCalledWith("Abyssal whip", 3, "alice", { alice: 4, bob: 1 });
    expect((globalThis.alert as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(alertCallsBeforeSuccess);
  });
});