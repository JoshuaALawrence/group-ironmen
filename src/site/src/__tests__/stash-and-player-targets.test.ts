import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const targetState = vi.hoisted(() => ({
  groupData: {
    members: new Map<
      string,
      {
        name: string;
        bank?: Array<{ id: number; quantity: number; highAlch: number; isValid: () => boolean }>;
        totalItemQuantity: (itemId: number) => number;
      }
    >(),
  },
  itemName: vi.fn((itemId: number) => `Item ${itemId}`),
  imageUrl: vi.fn((itemId: number) => `/icons/${itemId}.webp`),
  formatShortQuantity: vi.fn((value: number) => `${value}`),
}));

vi.mock("../data/group-data", () => ({
  groupData: targetState.groupData,
}));

vi.mock("../data/item", () => ({
  Item: {
    itemName: targetState.itemName,
    imageUrl: targetState.imageUrl,
  },
}));

vi.mock("../utility", () => ({
  utility: {
    formatShortQuantity: targetState.formatShortQuantity,
  },
}));

vi.mock("../stash-page/stash-data", () => ({
  DIFFICULTIES: ["Easy", "Hard"],
  DIFFICULTY_COLORS: { Easy: "#0f0", Hard: "#f00" },
  STASHES: [
    {
      name: "Varrock Square",
      difficulty: "Easy",
      clues: [
        {
          text: "Wear a hat",
          items: [{ name: "Fancy Hat", iconId: 1, itemIds: [1] }],
        },
      ],
    },
    {
      name: "Cave Entrance",
      difficulty: "Hard",
      clues: [
        {
          text: "Bring the full set",
          items: [
            { name: "Full Set", iconId: 2, itemIds: [2, 3], isAll: true },
            { name: "Any Boots", iconId: 4, itemIds: [4, 5] },
          ],
        },
      ],
    },
  ],
  getStashesByDifficulty: (difficulty: string) => {
    const all = [
      {
        name: "Varrock Square",
        difficulty: "Easy",
        clues: [
          {
            text: "Wear a hat",
            items: [{ name: "Fancy Hat", iconId: 1, itemIds: [1] }],
          },
        ],
      },
      {
        name: "Cave Entrance",
        difficulty: "Hard",
        clues: [
          {
            text: "Bring the full set",
            items: [
              { name: "Full Set", iconId: 2, itemIds: [2, 3], isAll: true },
              { name: "Any Boots", iconId: 4, itemIds: [4, 5] },
            ],
          },
        ],
      },
    ];
    return difficulty === "All" ? all : all.filter((stash) => stash.difficulty === difficulty);
  },
}));

import { StashPage } from "../stash-page/stash-page";
import { PlayerPanel } from "../player-panel/player-panel";

describe("stash page and player panel target components", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();

    targetState.groupData.members.clear();
    targetState.groupData.members.set("Alice", {
      name: "Alice",
      bank: [
        { id: 995, quantity: 100000, highAlch: 0, isValid: () => true },
        { id: 1, quantity: 2, highAlch: 500, isValid: () => false },
      ],
      totalItemQuantity: (itemId: number) => {
        switch (itemId) {
          case 1:
            return 2;
          case 2:
            return 2;
          case 3:
            return 1;
          case 4:
            return 0;
          case 5:
            return 2;
          default:
            return 0;
        }
      },
    });
    targetState.groupData.members.set("Bob", {
      name: "Bob",
      bank: [],
      totalItemQuantity: (itemId: number) => {
        switch (itemId) {
          case 1:
            return 1;
          case 2:
            return 2;
          case 3:
            return 0;
          case 4:
            return 1;
          case 5:
            return 0;
          default:
            return 0;
        }
      },
    });
    targetState.groupData.members.set("@SHARED", {
      name: "@SHARED",
      bank: [],
      totalItemQuantity: () => 0,
    });

    targetState.itemName.mockImplementation((itemId: number) => {
      if (itemId === 3) {
        throw new Error("missing name");
      }
      return `Item ${itemId}`;
    });
    targetState.imageUrl.mockImplementation((itemId: number) => {
      if (itemId === 4) {
        throw new Error("missing icon");
      }
      return `/icons/${itemId}.webp`;
    });
    targetState.formatShortQuantity.mockImplementation((value: number) => `${value}`);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("covers stash status calculations, filters, and empty rendering branches", () => {
    const page = new StashPage();

    expect(page.getMemberCount()).toBe(2);
    const hardStatus = page.getStashStatus({
      name: "Cave Entrance",
      difficulty: "Hard",
      clues: [
        {
          text: "Bring the full set",
          items: [
            { name: "Full Set", iconId: 2, itemIds: [2, 3], isAll: true },
            { name: "Any Boots", iconId: 4, itemIds: [4, 5] },
          ],
        },
      ],
    });
    expect(hardStatus.allComplete).toBe(false);
    expect(hardStatus.clueStatuses[0].items[0]).toMatchObject({ satisfied: false });
    expect((hardStatus.clueStatuses[0].items[0] as { children: Array<{ name: string }> }).children[1]?.name).toBe("Item 3");
    expect(page.safeItemName(3)).toBe("Item 3");

    page.selectedTier = "All";
    expect(page.renderSummary()).toContain("Need 2x each item");
    expect(page.renderTierTabs()).toContain('data-tier="Hard"');
    expect(page.renderStashes()).toContain("Varrock Square");
    expect(page.renderStashes()).toContain("missing-item");
    expect(page.getIconUrl(4)).toBe("");

    page.hideComplete = true;
    expect(page.getFilteredStashes().map((stash) => stash.name)).toEqual(["Cave Entrance"]);

    page.hideComplete = false;
    page.selectedTier = "Hard";
    page.searchQuery = "boots";
    expect(page.getFilteredStashes().map((stash) => stash.name)).toEqual(["Cave Entrance"]);
    page.searchQuery = "easy";
    expect(page.getFilteredStashes()).toEqual([]);
    expect(page.renderStashes()).toContain("No stashes to show");

    targetState.groupData.members.clear();
    expect(page.getMemberCount()).toBe(1);
  });

  it("covers stash-page bound UI events for tier, hide-complete, and search updates", () => {
    const markup = `
      <button class="stash-page__tier-tab" data-tier="All">All</button>
      <button class="stash-page__tier-tab" data-tier="Hard">Hard</button>
      <label><input id="stash-page__hide-complete" type="checkbox" /></label>
      <input id="stash-page__search" value="" />
      <div class="stash-page__grid"></div>
      <div class="stash-page__count"></div>
    `;
    const page = new StashPage();
    vi.spyOn(page, "html").mockReturnValue(markup);

    document.body.appendChild(page);

    const hardTab = page.querySelectorAll<HTMLElement>(".stash-page__tier-tab")[1];
    hardTab.click();
    expect(page.selectedTier).toBe("Hard");

    const hideComplete = page.querySelector<HTMLInputElement>("#stash-page__hide-complete");
    if (!hideComplete) {
      throw new Error("expected hide-complete input");
    }
    hideComplete.checked = true;
    hideComplete.dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.hideComplete).toBe(true);

    const search = page.querySelector<HTMLInputElement>("#stash-page__search");
    if (!search) {
      throw new Error("expected search input");
    }
    search.value = "cave";
    search.dispatchEvent(new Event("input", { bubbles: true }));

    expect(page.searchQuery).toBe("cave");
    expect(page.querySelector(".stash-page__grid")?.innerHTML).toContain("Cave Entrance");
    expect(page.querySelector(".stash-page__count")?.textContent).toBe("1 stashes");
  });

  it("covers player-panel startup, dialog actions, tab switching, collapse, and bank calculations", () => {
    const panel = new PlayerPanel();
    panel.setAttribute("player-name", "Alice");
    vi.spyOn(panel, "html").mockReturnValue(`
      <div class="player-panel__content"></div>
      <div class="player-panel__minibar">
        <button data-component="player-inventory">Inventory</button>
        <button data-component="player-skills">Skills</button>
      </div>
      <button class="player-panel__collection-log">Collection Log</button>
      <button class="player-panel__bank">Bank</button>
      <button class="player-panel__boss-kc">Boss KC</button>
      <div class="player-panel__bank-value">
        <span class="player-panel__bank-value-text"></span>
        <img />
      </div>
    `);

    document.body.appendChild(panel);

    expect(panel.bankValueTextEl?.textContent).toBe("100000");
    expect(panel.bankValueImgEl?.src).toContain("998.webp");

    panel.querySelector<HTMLButtonElement>(".player-panel__collection-log")?.click();
    panel.querySelector<HTMLButtonElement>(".player-panel__bank")?.click();
    panel.querySelector<HTMLButtonElement>(".player-panel__boss-kc")?.click();
    expect(document.body.querySelector("collection-log")?.getAttribute("player-name")).toBe("Alice");
    expect(document.body.querySelector("bank-dialog")?.getAttribute("player-name")).toBe("Alice");
    expect(document.body.querySelector("boss-kc-dialog")?.getAttribute("player-name")).toBe("Alice");

    const tabs = panel.querySelectorAll<HTMLButtonElement>(".player-panel__minibar button");
    tabs[0].click();
    expect(panel.querySelector("player-inventory")).toBeTruthy();
    expect(panel.classList.contains("expanded")).toBe(true);
    expect(tabs[0].classList.contains("player-panel__tab-active")).toBe(true);

    tabs[1].click();
    expect(panel.querySelector("player-skills")).toBeTruthy();
    expect(tabs[0].classList.contains("player-panel__tab-active")).toBe(false);
    expect(tabs[1].classList.contains("player-panel__tab-active")).toBe(true);

    tabs[1].click();
    expect(panel.contentArea?.textContent).toBe("");
    expect(panel.activeComponent).toBeNull();
    expect(panel.classList.contains("expanded")).toBe(false);
  });

  it("covers player-panel invalid targets and high coin stack image selection", () => {
    const panel = new PlayerPanel();
    panel.contentArea = document.createElement("div");
    panel.bankValueTextEl = document.createElement("div");
    panel.bankValueImgEl = document.createElement("img");

    panel.handleMiniBarClick({ target: document.createElement("div") } as Event);
    expect(panel.activeComponent).toBeNull();

    panel.handleBankValueUpdate([
      { id: 995, quantity: 1500000000, highAlch: 0, isValid: () => true },
      { id: 25, quantity: 10, highAlch: 5000, isValid: () => false },
    ]);
    expect(panel.bankValueTextEl.textContent).toBe("1500000000");
    expect(panel.bankValueImgEl.src).toContain("1004.webp");
  });
});