import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockedState = vi.hoisted(() => {
  const applyPlayerFilter = vi.fn();
  const applyTradeabilityFilter = vi.fn();
  const applyTextFilter = vi.fn();
  const getDisplayItems = vi.fn();

  return {
    applyPlayerFilter,
    applyTradeabilityFilter,
    applyTextFilter,
    groupDataMock: {
      textFilter: "",
      playerFilter: "@ALL",
      applyPlayerFilter,
      applyTradeabilityFilter,
      applyTextFilter,
      getDisplayItems,
      groupItems: {} as Record<number, { gePrice: number; highAlch: number; quantity: number; visible: boolean; quantities: Record<string, number> }>,
      members: new Map<string, { bank?: Array<{ id: number; quantity: number; highAlch: number; isValid: () => boolean }> }>(),
    },
  };
});

vi.mock("../data/group-data", () => ({
  groupData: mockedState.groupDataMock,
  GroupData: {
    getDegradedBaseName: vi.fn(() => "Abyssal whip"),
    createGroupedItem: vi.fn((name: string, variants: Array<{ id: number; quantity: number; gePrice: number; highAlch: number }>) => ({
      id: variants[0]?.id ?? 0,
      name,
      quantity: variants.reduce((s, x) => s + x.quantity, 0),
      quantities: { alice: variants.reduce((s, x) => s + x.quantity, 0) },
      highAlch: variants[0]?.highAlch ?? 0,
      gePrice: variants[0]?.gePrice ?? 0,
      isTradeable: true,
      visible: true,
      imageUrl: "",
      wikiLink: "",
    })),
  },
}));

vi.mock("../rs-context-menu/context-menu-manager", () => ({
  contextMenuManager: {
    show: vi.fn(),
  },
}));

vi.mock("../request-dialog/request-dialog-manager", () => ({
  requestDialogManager: {
    requestQuantity: vi.fn(async () => 1),
  },
}));

vi.mock("../request-dialog/request-dialog", () => ({
  RequestDialog: {
    sendItemRequest: vi.fn(async () => true),
  },
}));

vi.mock("../data/storage", () => ({
  storage: {
    getActiveMember: vi.fn(() => "alice"),
  },
}));

vi.mock("../data/webhook-status", () => ({
  webhookStatus: {
    ensure: vi.fn(async () => undefined),
    hasWebhook: true,
  },
}));

vi.mock("../utility", () => ({
  utility: {
    formatShortQuantity: vi.fn((x: number) => `${x}`),
  },
}));

import { InventoryPager } from "../inventory-pager/inventory-pager";
import { InventoryItem } from "../inventory-item/inventory-item";
import { PlayerPanel } from "../player-panel/player-panel";
import { contextMenuManager } from "../rs-context-menu/context-menu-manager";
import { requestDialogManager } from "../request-dialog/request-dialog-manager";

const groupDataMock = mockedState.groupDataMock;
const applyPlayerFilter = mockedState.applyPlayerFilter;
const applyTradeabilityFilter = mockedState.applyTradeabilityFilter;
const applyTextFilter = mockedState.applyTextFilter;

describe("inventory and player panel heavy", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    groupDataMock.playerFilter = "@ALL";
    groupDataMock.groupItems = {};
    groupDataMock.getDisplayItems.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles inventory pager sorting, paging and totals", () => {
    const pager = new InventoryPager();
    pager.pageLimit = 2;
    pager.pageTarget = document.createElement("div");
    pager.sortTarget = document.createElement("select");
    pager.itemCount = document.createElement("div");
    pager.totalGeValue = document.createElement("div");
    pager.totalHaValue = document.createElement("div");
    pager.showGePriceInput = document.createElement("input");
    pager.showAlchPriceInput = document.createElement("input");
    pager.hideUntradeablesInput = document.createElement("input");
    pager.showIndividualPricesInput = document.createElement("input");
    pager.playerFilter = document.createElement("select");
    pager.searchElement = { searchInput: document.createElement("input"), value: "Whip" } as never;

    const items = [
      { id: 1, name: "Whip", quantity: 3, quantities: { alice: 3 }, highAlch: 1000, gePrice: 1200, visible: true },
      { id: 2, name: "Bow", quantity: 1, quantities: { alice: 1 }, highAlch: 500, gePrice: 600, visible: true },
      { id: 3, name: "Rune", quantity: 10, quantities: { alice: 10 }, highAlch: 5, gePrice: 10, visible: true },
    ];

    groupDataMock.getDisplayItems.mockReturnValue(items);
    groupDataMock.groupItems = {
      1: { gePrice: 1200, highAlch: 1000, quantity: 3, visible: true, quantities: { alice: 3 } },
      2: { gePrice: 600, highAlch: 500, quantity: 1, visible: true, quantities: { alice: 1 } },
    };

    pager.handleSortChange();
    pager.handleSearch();
    pager.handlePlayerFilterChange();
    pager.handleIndividualPricesChange();
    pager.handleGePriceToggle();
    pager.handleAlchPriceToggle();
    pager.handleHideUntradeablesToggle();

    pager.maybeRenderPage(1, true);
    expect(pager.pageTarget.querySelectorAll("inventory-item").length).toBe(2);
    expect(pager.itemCount.textContent).toBe("3");
    expect(pager.totalGeValue.textContent).toBe("4,200");
    expect(pager.totalHaValue.textContent).toBe("3,500");

    const changed = pager.pageUpdated([{ id: 1 } as never], [{ id: 2 } as never]);
    expect(changed).toBe(true);

    groupDataMock.playerFilter = "alice";
    expect(pager.itemQuantity(items[0] as never)).toBe(3);
    expect(applyPlayerFilter).toHaveBeenCalled();
    expect(applyTextFilter).toHaveBeenCalled();
    expect(applyTradeabilityFilter).toHaveBeenCalled();
  });

  it("handles inventory item updates and context menu", async () => {
    const item = new InventoryItem();
    item.item = {
      id: 1,
      name: "Abyssal whip",
      quantity: 3,
      quantities: { alice: 3, bob: 0 },
      highAlch: 1000,
      gePrice: 1200,
      isTradeable: true,
      visible: true,
      imageUrl: "",
      wikiLink: "",
    };

    const render = vi.spyOn(item, "render").mockImplementation(() => undefined);
    item.handleUpdatedItem(item.item);
    expect(render).toHaveBeenCalled();

    item.groupedIds = [1, 2];
    groupDataMock.groupItems[1] = {
      gePrice: 1000,
      highAlch: 900,
      quantity: 2,
      visible: true,
      quantities: { alice: 2 },
      name: "Abyssal whip (50)",
      id: 1,
    } as never;
    groupDataMock.groupItems[2] = {
      gePrice: 1200,
      highAlch: 1000,
      quantity: 1,
      visible: true,
      quantities: { alice: 1 },
      name: "Abyssal whip (100)",
      id: 2,
    } as never;
    item.handleGroupedUpdate();
    expect(item.item.name).toContain("Abyssal whip");

    expect(item.playerHtml("alice")).toContain("alice");
    expect(item.quantity).toBeGreaterThan(0);
    expect(item.highAlch).toContain("gp");
    expect(item.gePrice).toContain("gp");
    expect(item.tradeabilityLabel).toBe("Tradeable");
    expect(item.tradeabilityClassName).toContain("tradeable");

    const page = document.createElement("items-page");
    page.appendChild(item);
    item.handleContextMenu(new MouseEvent("contextmenu", { clientX: 10, clientY: 12 }));
    await Promise.resolve();
    expect(contextMenuManager.show).toHaveBeenCalled();

    const menuItems = (contextMenuManager.show as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[3] as Array<{
      callback: () => Promise<void>;
    }>;
    await menuItems[0].callback();
    expect(requestDialogManager.requestQuantity).toHaveBeenCalled();
  });

  it("handles player panel actions and bank value updates", () => {
    const panel = new PlayerPanel();
    panel.playerName = "alice";
    panel.contentArea = document.createElement("div");
    panel.bankValueTextEl = document.createElement("div");
    panel.bankValueImgEl = document.createElement("img");

    const tab = document.createElement("button");
    tab.setAttribute("data-component", "player-inventory");
    panel.appendChild(tab);

    panel.handleBankValueUpdate([
      { id: 995, quantity: 100000, highAlch: 0, isValid: () => true },
      { id: 1, quantity: 2, highAlch: 1000, isValid: () => true },
    ]);
    expect(panel.bankValueTextEl.textContent).toBe("102000");
    expect(panel.bankValueImgEl.src).toContain("998.webp");

    panel.handleCollectionLogClick();
    panel.handleBankClick();
    panel.handleBossKcClick();
    expect(document.body.querySelector("collection-log")).toBeTruthy();
    expect(document.body.querySelector("bank-dialog")).toBeTruthy();
    expect(document.body.querySelector("boss-kc-dialog")).toBeTruthy();

    panel.handleMiniBarClick({ target: tab } as unknown as Event);
    expect(panel.contentArea.querySelector("player-inventory")).toBeTruthy();
    expect(panel.classList.contains("expanded")).toBe(true);

    panel.handleMiniBarClick({ target: tab } as unknown as Event);
    expect(panel.classList.contains("expanded")).toBe(false);
  });
});
