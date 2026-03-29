import { beforeEach, describe, expect, it, vi } from "vitest";

const groupDataMock = vi.hoisted(() => ({
  members: new Map<string, any>(),
}));

const itemDataMock = vi.hoisted(() => ({
  itemDetails: {} as Record<number, unknown>,
  names: new Map<number, string>(),
}));

const calcState = vi.hoisted(() => ({
  activitiesByItem: new Map<string, any[]>(),
  createResults: new Map<string, { bankedItems: any[]; linkedMap: Map<string, any[]> }>(),
  secondaries: new Map<number, { id: number; qty: number }>(),
  itemQtyById: new Map<number, number>(),
  xpRates: new Map<string, number>(),
  lastCreateArgs: [] as Array<{ skill: string; memberNames: string[]; levelLimit: number }>,
  levelForXp: 99,
}));

vi.mock("../data/group-data", () => ({
  groupData: groupDataMock,
}));

vi.mock("../data/item", () => ({
  Item: {
    itemDetails: itemDataMock.itemDetails,
    itemName: vi.fn((id: number) => {
      if (id === 9999) {
        throw new Error("missing item");
      }
      return itemDataMock.names.get(id) ?? `Item ${id}`;
    }),
    imageUrl: vi.fn((id: number) => `/icons/items/${id}.webp`),
  },
}));

vi.mock("../data/skill", () => ({
  Skill: {
    getIcon: vi.fn((skill: string) => `/skills/${skill}.webp`),
  },
  SkillName: {
    Construction: "Construction",
    Cooking: "Cooking",
    Crafting: "Crafting",
    Farming: "Farming",
    Firemaking: "Firemaking",
    Fletching: "Fletching",
    Herblore: "Herblore",
    Hunter: "Hunter",
    Prayer: "Prayer",
    Sailing: "Sailing",
    Smithing: "Smithing",
    Thieving: "Thieving",
  },
}));

vi.mock("../data/pubsub", () => ({
  pubsub: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    publish: vi.fn(),
  },
}));

vi.mock("../rs-tooltip/tooltip-manager", () => ({
  tooltipManager: {
    showTooltip: vi.fn(),
    hideTooltip: vi.fn(),
  },
}));

vi.mock("../banked-xp-page/banked-xp-calc", () => {
  const cloneActivity = (activity: any) => {
    if (!activity) return null;
    return {
      ...activity,
      output: activity.output ? { ...activity.output } : activity.output,
      secondaries: activity.secondaries ? [...activity.secondaries] : activity.secondaries,
    };
  };

  const cloneBankedItem = (bankedItem: any) => ({
    ...bankedItem,
    item: {
      ...bankedItem.item,
      itemIds: [...(bankedItem.item.itemIds ?? [])],
    },
    selectedActivity: cloneActivity(bankedItem.selectedActivity),
  });

  return {
    BANKABLE_SKILLS: ["prayer", "cooking", "farming"],
    MODIFIERS: [
      {
        skill: "prayer",
        type: "static",
        name: "Gilded Altar",
        multiplier: 1.5,
        included: [],
        ignored: [],
        tooltip: "Prayer boost",
      },
      {
        skill: "prayer",
        type: "skillingOutfit",
        name: "Zealot's Robes (Per Piece)",
        included: [],
        ignored: [],
        tooltip: "Piece-based bonus",
        baseBonus: 0.0125,
      },
      {
        skill: "cooking",
        type: "consumption",
        name: "Cooking Gauntlets",
        included: [],
        ignored: [],
        tooltip: "Cooking save chance",
        savePercentage: 0.1,
        multiplier: 1,
      },
    ],
    getActivitiesForItem: vi.fn((itemName: string) => calcState.activitiesByItem.get(itemName) ?? []),
    createBankedItemMap: vi.fn((skill: string, members: Map<string, any>, levelLimit: number) => {
      calcState.lastCreateArgs.push({ skill, memberNames: [...members.keys()], levelLimit });
      const result = calcState.createResults.get(skill) ?? { bankedItems: [], linkedMap: new Map() };
      return {
        bankedItems: result.bankedItems.map(cloneBankedItem),
        linkedMap: new Map([...result.linkedMap.entries()].map(([name, items]) => [name, items.map(cloneBankedItem)])),
      };
    }),
    rebuildLinkedMap: vi.fn((bankedItems: any[]) => {
      const linkedMap = new Map<string, any[]>();
      for (const bankedItem of bankedItems) {
        const linkedItem = bankedItem.selectedActivity?.linkedItem;
        if (!linkedItem) continue;
        if (!linkedMap.has(linkedItem)) {
          linkedMap.set(linkedItem, []);
        }
        linkedMap.get(linkedItem)?.push(bankedItem);
      }
      return linkedMap;
    }),
    calculateBankedXpTotal: vi.fn(
      (bankedItems: any[], _linkedMap: Map<string, any[]>, _enabledModifiers: any[], xpMultiplier: number, cascadeEnabled: boolean) => {
        return bankedItems.reduce((total, bankedItem) => {
          if (bankedItem.ignored || !bankedItem.selectedActivity) {
            return total;
          }
          const baseQty = cascadeEnabled ? calcState.itemQtyById.get(bankedItem.item.itemID) ?? bankedItem.qty : bankedItem.qty;
          const xpRate = calcState.xpRates.get(bankedItem.selectedActivity.name) ?? bankedItem.selectedActivity.xp;
          return total + baseQty * xpRate * xpMultiplier;
        }, 0);
      }
    ),
    calculateSecondaries: vi.fn(() => new Map(calcState.secondaries)),
    getActivityXpRate: vi.fn((activity: any) => calcState.xpRates.get(activity.name) ?? activity.xp),
    getItemQty: vi.fn((bankedItem: any, _linkedMap: Map<string, any[]>, _bankedItems: any[], cascadeEnabled: boolean) => {
      if (!cascadeEnabled) {
        return bankedItem.qty;
      }
      return calcState.itemQtyById.get(bankedItem.item.itemID) ?? bankedItem.qty;
    }),
    getLevelForXp: vi.fn(() => calcState.levelForXp),
  };
});

import { BankedXpPage } from "../banked-xp-page/banked-xp-page";

function createActivity(name: string, level: number, xp: number, overrides: Record<string, unknown> = {}) {
  return {
    name,
    icon: 1,
    displayName: name,
    level,
    xp,
    rngActivity: false,
    experienceItem: "",
    skill: "prayer",
    secondaries: null,
    output: null,
    linkedItem: null,
    ...overrides,
  };
}

function createBankedItem(name: string, itemID: number, qty: number, selectedActivity: any, overrides: Record<string, unknown> = {}) {
  return {
    item: {
      name,
      itemID,
      skill: "prayer",
      category: "NA",
      itemIds: [itemID],
      byDose: false,
    },
    qty,
    selectedActivity,
    ignored: false,
    ...overrides,
  };
}

function renderPageShell(page: BankedXpPage): void {
  page.innerHTML = `
    <div class="banked-xp__skill-tabs">
      <button class="banked-xp__skill-tab" data-skill="cooking">Cooking</button>
      <button class="banked-xp__skill-tab">Missing Skill</button>
    </div>
    <input id="banked-xp__cascade" type="checkbox" ${page.cascadeEnabled ? "checked" : ""} />
    <input id="banked-xp__limit-level" type="checkbox" ${page.limitToLevel ? "checked" : ""} />
    <input id="banked-xp__multiplier" value="${page.xpMultiplier}" />
    <div class="banked-xp__modifiers">${page.renderModifiers()}</div>
    <button id="banked-xp__ignore-all">Ignore all</button>
    <button id="banked-xp__unignore-all">Include all</button>
    <div class="banked-xp__items-count"></div>
    <div class="banked-xp__xp-summary">${page.renderXpSummary()}</div>
    <div class="banked-xp__secondaries-list">${page.renderSecondaries()}</div>
    <div class="banked-xp__items-grid">${page.renderItems()}</div>
  `;
}

describe("banked xp page heavy", () => {
  let backingStore: Map<string, string>;
  let bury: any;
  let altar: any;
  let mixPotion: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    document.body.innerHTML = "";

    backingStore = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return backingStore.has(key) ? backingStore.get(key)! : null;
      },
      setItem(key: string, value: string) {
        backingStore.set(key, String(value));
      },
      removeItem(key: string) {
        backingStore.delete(key);
      },
      clear() {
        backingStore.clear();
      },
    });

    groupDataMock.members = new Map([
      [
        "Alice",
        {
          name: "Alice",
          skills: {
            Prayer: { xp: 1200, level: 55 },
            Cooking: { xp: 300, level: 30 },
          },
          totalItemQuantity: () => 0,
        },
      ],
      [
        "Bob",
        {
          name: "Bob",
          skills: {
            Prayer: { xp: 2400, level: 65 },
          },
          totalItemQuantity: () => 0,
        },
      ],
      [
        "@SHARED",
        {
          name: "@SHARED",
          totalItemQuantity: () => 0,
        },
      ],
    ]);

    Object.keys(itemDataMock.itemDetails).forEach((key) => delete itemDataMock.itemDetails[Number(key)]);
    itemDataMock.names.clear();
    itemDataMock.names.set(1001, "Dragon bones");
    itemDataMock.names.set(1002, "Grimy ranarr");
    itemDataMock.names.set(1003, "Empty vial");
    itemDataMock.names.set(7001, "Prayer potion");
    itemDataMock.itemDetails[1001] = {};
    itemDataMock.itemDetails[1002] = {};

    bury = createActivity("bury", 1, 72, { displayName: "Bury", experienceItem: "Dragon bones" });
    altar = createActivity("altar", 60, 252, { displayName: "Chaos altar", experienceItem: "Dragon bones" });
    mixPotion = createActivity("mix", 20, 30, {
      displayName: "Mix potion",
      skill: "herblore",
      experienceItem: "Grimy ranarr",
      linkedItem: "Prayer potion",
      output: { qty: 1 },
    });

    calcState.activitiesByItem.clear();
    calcState.activitiesByItem.set("Dragon bones", [bury, altar]);
    calcState.activitiesByItem.set("Grimy ranarr", [mixPotion]);
    calcState.activitiesByItem.set("Empty vial", []);
    calcState.createResults.clear();
    calcState.secondaries.clear();
    calcState.itemQtyById.clear();
    calcState.xpRates.clear();
    calcState.lastCreateArgs.length = 0;
    calcState.levelForXp = 88;
    calcState.xpRates.set("bury", 72);
    calcState.xpRates.set("altar", 252);
    calcState.xpRates.set("mix", 30);
    calcState.itemQtyById.set(1001, 25);
    calcState.itemQtyById.set(1002, 15);
    calcState.itemQtyById.set(1003, 0);

    calcState.createResults.set("prayer", {
      bankedItems: [
        createBankedItem("Grimy ranarr", 1002, 15, mixPotion),
        createBankedItem("Dragon bones", 1001, 25, bury),
      ],
      linkedMap: new Map([["Prayer potion", [createBankedItem("Grimy ranarr", 1002, 15, mixPotion)]]]),
    });
    calcState.createResults.set("cooking", {
      bankedItems: [createBankedItem("Empty vial", 1003, 0, null)],
      linkedMap: new Map(),
    });
    calcState.createResults.set("farming", {
      bankedItems: [],
      linkedMap: new Map(),
    });
  });

  it("refreshes data with saved state, member filtering, and fallback render branches", () => {
    backingStore.set(
      "banked-xp-state",
      JSON.stringify({
        selectedSkill: "prayer",
        selectedMember: "Bob",
        storageFilter: "Alice",
        cascadeEnabled: false,
        limitToLevel: true,
        xpMultiplier: 3,
        modifierStates: {
          prayer_0: { enabled: true },
          prayer_1: { pieces: [true, false, true, false] },
        },
      })
    );
    backingStore.set(
      "banked-xp-items",
      JSON.stringify({
        "prayer_Grimy ranarr": { ignored: true, activity: "mix" },
        "prayer_Dragon bones": { ignored: false, activity: "altar" },
      })
    );

    const page = new BankedXpPage();
    page.loadState();
    page.refreshData();

    expect(page.selectedMember).toBe("Bob");
    expect(page.storageFilter).toBe("Alice");
    expect(page.currentXp).toBe(2400);
    expect(page.currentLevel).toBe(65);
    expect(calcState.lastCreateArgs.at(-1)).toEqual({ skill: "prayer", memberNames: ["Alice"], levelLimit: 65 });
    expect(page.bankedItems.map((item) => item.item.name)).toEqual(["Dragon bones", "Grimy ranarr"]);
    expect(page.bankedItems[0].selectedActivity?.name).toBe("altar");
    expect(page.bankedItems[1].ignored).toBe(true);
    expect(page.enabledModifiers).toHaveLength(2);
    expect(page.bankedXpTotal).toBeGreaterThan(0);
    expect(page.endLevel).toBe(88);

    page.currentLevel = 55;
    page.limitToLevel = true;
    expect(page.getFilteredActivities("Dragon bones").map((activity) => activity.name)).toEqual(["bury"]);

    page.limitToLevel = false;
    expect(page.getFilteredActivities("Dragon bones").map((activity) => activity.name)).toEqual(["bury", "altar"]);

    page.storageFilter = "@ALL";
    expect([...page.getFilteredMembers().keys()]).toEqual(["Alice", "Bob", "@SHARED"]);

    page.storageFilter = "Missing";
    expect(page.getFilteredMembers().size).toBe(0);

    page.selectedSkill = "farming";
    expect(page.renderModifiers()).toContain("None for this skill");
    expect(page.renderSecondaries()).toContain("None needed");

    page.bankedItems = [];
    expect(page.renderItems()).toContain("No banked items found for this skill");
    expect(page.getItemDisplayName(9999)).toBe("Item #9999");
    expect(page.formatNumber(1234567)).toBe("1,234,567");

    page.bankedItems = [
      createBankedItem("Empty vial", 1003, 0, null),
      createBankedItem("Dragon bones", 1001, 0, bury),
    ] as any;
    page.linkedMap = new Map();
    calcState.itemQtyById.set(1001, 0);
    calcState.itemQtyById.set(1003, 0);
    const rows = page.renderItemRows();
    expect(rows).not.toContain('data-item-id="1001"');
    expect(rows).not.toContain('data-item-id="1003"');

    backingStore.set("banked-xp-state", "not json");
    backingStore.set("banked-xp-items", "also not json");
    page.loadState();
    expect(page.getSavedItemStates()).toEqual({});
  });

  it("selects a player on connect and covers updateDisplay rebuild and dynamic select handlers", () => {
    const page = new BankedXpPage();
    page.selectedMember = "@SHARED";

    vi.spyOn(page, "render").mockImplementation(() => renderPageShell(page));

    document.body.appendChild(page);

    expect(page.selectedMember).toBe("Alice");
    expect(page.querySelector(".banked-xp__items-grid")?.innerHTML).toContain("banked-xp__item-header");

    const updateItemsSpy = vi.spyOn(page, "updateItemValuesInPlace").mockReturnValueOnce(false);
    page.updateDisplay();
    expect(updateItemsSpy).toHaveBeenCalled();
    expect(page.querySelector(".banked-xp__items-count")?.textContent).toBe("2 items");

    const refreshSpy = vi.spyOn(page, "refreshData");
    const memberSelect = page.querySelector<HTMLSelectElement>("#banked-xp__member-select");
    expect(memberSelect).not.toBeNull();
    memberSelect!.value = "Bob";
    memberSelect!.onchange?.(new Event("change"));
    expect(page.selectedMember).toBe("Bob");
    expect(refreshSpy).toHaveBeenCalled();

    const storageSelect = page.querySelector<HTMLSelectElement>("#banked-xp__storage-select");
    expect(storageSelect).not.toBeNull();
    storageSelect!.value = "@SHARED";
    storageSelect!.onchange?.(new Event("change"));
    expect(page.storageFilter).toBe("@SHARED");

    page.selectedMember = "@SHARED";
    page.handleMembersUpdated();
    expect(page.selectedMember).toBe("Alice");

    const updateDisplaySpy = vi.spyOn(page, "updateDisplay");
    page.handleItemsUpdated();
    expect(updateDisplaySpy).toHaveBeenCalled();
  });

  it("bindEvents handles skill tabs, toggles, modifiers, and bulk ignore controls", () => {
    const page = new BankedXpPage();
    page.selectedSkill = "prayer";
    page.bankedItems = [
      createBankedItem("Dragon bones", 1001, 25, bury),
      createBankedItem("Grimy ranarr", 1002, 15, mixPotion),
    ] as any;

    page.innerHTML = `
      <button class="banked-xp__skill-tab" data-skill="cooking">Cooking</button>
      <button class="banked-xp__skill-tab">No skill</button>
      <input id="banked-xp__cascade" type="checkbox" />
      <input id="banked-xp__limit-level" type="checkbox" />
      <input id="banked-xp__multiplier" value="0" />
      <input class="banked-xp__modifier-check" data-mod-key="prayer_0" type="checkbox" checked />
      <input class="banked-xp__modifier-check" type="checkbox" />
      <button class="banked-xp__modifier-piece" data-mod-key="prayer_1" data-piece="2"></button>
      <button class="banked-xp__modifier-piece" data-piece="-1"></button>
      <button id="banked-xp__ignore-all"></button>
      <button id="banked-xp__unignore-all"></button>
    `;

    const saveStateSpy = vi.spyOn(page, "saveState");
    const refreshSpy = vi.spyOn(page, "refreshData").mockImplementation(() => undefined);
    const renderSpy = vi.spyOn(page, "render").mockImplementation(() => undefined);
    const recalculateSpy = vi.spyOn(page, "recalculate").mockImplementation(() => undefined);
    const updateDisplaySpy = vi.spyOn(page, "updateDisplay").mockImplementation(() => undefined);
    const buildModifiersSpy = vi.spyOn(page, "buildEnabledModifiers");
    const saveItemStatesSpy = vi.spyOn(page, "saveItemStates").mockImplementation(() => undefined);

    page.bindEvents();

    const [skillTab, missingSkillTab] = Array.from(page.querySelectorAll<HTMLElement>(".banked-xp__skill-tab"));
    missingSkillTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.selectedSkill).toBe("prayer");

    const cascadeCheckbox = page.querySelector<HTMLInputElement>("#banked-xp__cascade");
    cascadeCheckbox!.checked = true;
    cascadeCheckbox!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.cascadeEnabled).toBe(true);
    expect(recalculateSpy).toHaveBeenCalled();

    const limitCheckbox = page.querySelector<HTMLInputElement>("#banked-xp__limit-level");
    limitCheckbox!.checked = false;
    limitCheckbox!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.limitToLevel).toBe(false);

    const multiplierInput = page.querySelector<HTMLInputElement>("#banked-xp__multiplier");
    multiplierInput!.value = "0";
    multiplierInput!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.xpMultiplier).toBe(1);

    const [modifierCheckbox, missingModifierCheckbox] = Array.from(
      page.querySelectorAll<HTMLInputElement>(".banked-xp__modifier-check")
    );
    missingModifierCheckbox.checked = true;
    missingModifierCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.modifierStates).toEqual({});

    modifierCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.modifierStates.prayer_0?.enabled).toBe(true);
    expect(buildModifiersSpy).toHaveBeenCalled();

    const [pieceButton, invalidPieceButton] = Array.from(page.querySelectorAll<HTMLButtonElement>(".banked-xp__modifier-piece"));
    invalidPieceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.modifierStates.prayer_1).toBeUndefined();

    pieceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.modifierStates.prayer_1?.pieces?.[2]).toBe(true);
    expect(pieceButton.classList.contains("active")).toBe(true);

    page.querySelector<HTMLElement>("#banked-xp__ignore-all")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems.every((item) => item.ignored)).toBe(true);

    page.querySelector<HTMLElement>("#banked-xp__unignore-all")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems.every((item) => !item.ignored)).toBe(true);

    skillTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.selectedSkill).toBe("cooking");
    expect(refreshSpy).toHaveBeenCalled();
    expect(renderSpy).toHaveBeenCalled();

    expect(saveStateSpy).toHaveBeenCalled();
    expect(saveItemStatesSpy).toHaveBeenCalled();
    expect(updateDisplaySpy).toHaveBeenCalled();
  });

  it("bindItemEvents toggles ignore state and handles activity selection branches", () => {
    const page = new BankedXpPage();
    page.currentLevel = 99;
    page.limitToLevel = true;
    page.bankedItems = [
      createBankedItem("Dragon bones", 1001, 25, bury),
      createBankedItem("Grimy ranarr", 1002, 15, mixPotion),
    ] as any;
    page.innerHTML = `
      <img class="banked-xp__item-icon" data-idx="0" />
      <span class="banked-xp__item-name" data-idx="1"></span>
      <select class="banked-xp__activity-select" data-idx="0">
        <option value="altar">altar</option>
      </select>
      <select class="banked-xp__activity-select" data-idx="0">
        <option value="missing" selected>missing</option>
      </select>
      <select class="banked-xp__activity-select" data-idx="99">
        <option value="altar" selected>altar</option>
      </select>
    `;

    const saveItemStatesSpy = vi.spyOn(page, "saveItemStates").mockImplementation(() => undefined);
    const recalculateSpy = vi.spyOn(page, "recalculate").mockImplementation(() => undefined);
    const updateDisplaySpy = vi.spyOn(page, "updateDisplay").mockImplementation(() => undefined);

    page.bindItemEvents();

    const icon = page.querySelector<HTMLElement>(".banked-xp__item-icon");
    icon!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems[0].ignored).toBe(true);

    const name = page.querySelector<HTMLElement>(".banked-xp__item-name");
    name!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems[1].ignored).toBe(true);

    const selects = Array.from(page.querySelectorAll<HTMLSelectElement>(".banked-xp__activity-select"));
    selects[2].dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.bankedItems[0].selectedActivity?.name).toBe("bury");

    selects[1].dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.bankedItems[0].selectedActivity?.name).toBe("bury");

    selects[0].value = "altar";
    selects[0].dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.bankedItems[0].selectedActivity?.name).toBe("altar");
    expect(page.linkedMap).toBeInstanceOf(Map);
    expect(saveItemStatesSpy).toHaveBeenCalled();
    expect(recalculateSpy).toHaveBeenCalled();
    expect(updateDisplaySpy).toHaveBeenCalled();
  });

  it("updates xp summaries and item rows in place while covering mismatch and empty-state branches", () => {
    const page = new BankedXpPage();
    page.currentXp = 199_999_900;
    page.currentLevel = 99;
    page.endLevel = 100;
    page.selectedSkill = "prayer";
    page.bankedItems = [createBankedItem("Dragon bones", 1001, 25, bury)] as any;
    page.linkedMap = new Map();
    page.bankedXpTotal = 2000;
    page.innerHTML = `
      <div class="banked-xp__item" data-item-id="1001">
        <span class="banked-xp__item-qty"></span>
        <span class="banked-xp__item-xp"></span>
        <span class="banked-xp__item-icon"></span>
      </div>
      <span id="banked-xp__val-current-xp"></span>
      <span id="banked-xp__val-banked-xp"></span>
      <span id="banked-xp__val-end-xp"></span>
      <span id="banked-xp__val-current-level"></span>
      <span id="banked-xp__val-end-level"></span>
    `;

    const updated = page.updateItemValuesInPlace();
    expect(updated).toBe(true);
    expect(page.querySelector(".banked-xp__item-qty")?.textContent).toBe("25");
    expect(page.querySelector(".banked-xp__item-xp")?.textContent).toBe("1,800");
    expect(page.querySelector<HTMLElement>(".banked-xp__item-icon")?.title).toBe("Click to ignore");

    page.updateXpValues();
    expect(page.querySelector("#banked-xp__val-current-xp")?.textContent).toBe("199,999,900");
    expect(page.querySelector("#banked-xp__val-end-xp")?.textContent).toBe("200,000,000");
    expect(page.querySelector<HTMLElement>("#banked-xp__val-end-level")?.style.color).toBe("var(--green)");

    page.bankedItems = [
      createBankedItem("Dragon bones", 1001, 25, bury),
      createBankedItem("Grimy ranarr", 1002, 15, mixPotion),
    ] as any;
    expect(page.updateItemValuesInPlace()).toBe(false);

    page.bankedItems = [createBankedItem("Dragon bones", 1001, 25, bury)] as any;
    page.innerHTML = "";
    expect(page.updateItemValuesInPlace()).toBe(false);

    page.bankedItems = [];
    expect(page.renderItems()).toContain("No banked items found for this skill");
  });
});