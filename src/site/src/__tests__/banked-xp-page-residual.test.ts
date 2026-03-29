import { beforeEach, describe, expect, it, vi } from "vitest";

const groupDataMock = vi.hoisted(() => ({
  members: new Map<string, any>(),
}));

const itemDataMock = vi.hoisted(() => ({
  itemDetails: {} as Record<number, unknown>,
  names: new Map<number, string>(),
}));

const pubsubMock = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  publish: vi.fn(),
}));

const calcState = vi.hoisted(() => ({
  activitiesByItem: new Map<string, any[]>(),
  createResults: new Map<string, { bankedItems: any[]; linkedMap: Map<string, any[]> }>(),
  secondaries: new Map<number, { id: number; qty: number }>(),
  itemQtyById: new Map<number, number>(),
  xpRates: new Map<string, number>(),
  levelForXp: 1,
  lastCreateArgs: [] as Array<{ skill: string; memberNames: string[]; levelLimit: number }>,
}));

vi.mock("../data/group-data", () => ({
  groupData: groupDataMock,
}));

vi.mock("../data/item", () => ({
  Item: {
    itemDetails: itemDataMock.itemDetails,
    itemName: vi.fn((id: number) => itemDataMock.names.get(id) ?? `Item ${id}`),
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
  pubsub: pubsubMock,
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
    BANKABLE_SKILLS: ["prayer", "cooking"],
    MODIFIERS: [
      {
        skill: "prayer",
        type: "static",
        name: "Prayer Focus",
        multiplier: 1.1,
        included: [],
        ignored: [],
      },
      {
        skill: "prayer",
        type: "skillingOutfit",
        name: "Mystery Outfit",
        included: [],
        ignored: [],
      },
      {
        skill: "cooking",
        type: "static",
        name: "Cooking Gauntlets",
        multiplier: 1.05,
        included: [],
        ignored: [],
        tooltip: "Cooking boost",
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
          const qty = cascadeEnabled ? calcState.itemQtyById.get(bankedItem.item.itemID) ?? bankedItem.qty : bankedItem.qty;
          const xpRate = calcState.xpRates.get(bankedItem.selectedActivity.name) ?? bankedItem.selectedActivity.xp;
          return total + qty * xpRate * xpMultiplier;
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
    <div class="banked-xp__modifiers">${page.renderModifiers()}</div>
    <button id="banked-xp__ignore-all">Ignore all</button>
    <button id="banked-xp__unignore-all">Include all</button>
    <div class="banked-xp__items-count"></div>
    <div class="banked-xp__xp-summary">${page.renderXpSummary()}</div>
    <div class="banked-xp__secondaries-list">${page.renderSecondaries()}</div>
    <div class="banked-xp__items-grid">${page.renderItems()}</div>
  `;
}

describe("banked xp page residual", () => {
  let backingStore: Map<string, string>;
  let bury: any;
  let altar: any;
  let mix: any;

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
        "@SHARED",
        {
          name: "@SHARED",
          totalItemQuantity: () => 0,
        },
      ],
    ]);

    Object.keys(itemDataMock.itemDetails).forEach((key) => delete itemDataMock.itemDetails[Number(key)]);
    itemDataMock.names.clear();
    itemDataMock.names.set(2001, "Dust");
    itemDataMock.names.set(2002, "Bones");
    itemDataMock.names.set(2003, "Herb");
    itemDataMock.names.set(3001, "Secondary dust");
    itemDataMock.itemDetails[2002] = {};

    bury = createActivity("bury", 1, 72, { displayName: "Bury" });
    altar = createActivity("altar", 60, 252, { displayName: "Chaos altar" });
    mix = createActivity("mix", 10, 40, { displayName: "Mix herb", linkedItem: "Potion" });

    calcState.activitiesByItem.clear();
    calcState.activitiesByItem.set("Bones", [bury, altar]);
    calcState.activitiesByItem.set("Herb", [mix]);
    calcState.activitiesByItem.set("Dust", []);
    calcState.createResults.clear();
    calcState.secondaries.clear();
    calcState.itemQtyById.clear();
    calcState.xpRates.clear();
    calcState.lastCreateArgs.length = 0;
    calcState.levelForXp = 50;
    calcState.xpRates.set("bury", 72);
    calcState.xpRates.set("altar", 252);
    calcState.xpRates.set("mix", 40);
    calcState.itemQtyById.set(2001, 0);
    calcState.itemQtyById.set(2002, 4);
    calcState.itemQtyById.set(2003, 3);

    calcState.createResults.set("prayer", {
      bankedItems: [createBankedItem("Herb", 2003, 3, null), createBankedItem("Bones", 2002, 4, bury)],
      linkedMap: new Map(),
    });
    calcState.createResults.set("cooking", {
      bankedItems: [],
      linkedMap: new Map(),
    });
  });

  it("restores saved state and handles member and storage edge cases", () => {
    backingStore.set(
      "banked-xp-state",
      JSON.stringify({
        selectedSkill: "prayer",
        selectedMember: "@SHARED",
        storageFilter: "Missing",
        cascadeEnabled: false,
        limitToLevel: false,
        xpMultiplier: 0,
        modifierStates: {
          prayer_0: { enabled: true },
          prayer_1: { pieces: [true, false, false, false] },
        },
      })
    );
    backingStore.set(
      "banked-xp-items",
      JSON.stringify({
        prayer_Herb: { ignored: true, activity: "mix" },
        prayer_Bones: { ignored: false, activity: "missing" },
      })
    );

    const page = new BankedXpPage();
    vi.spyOn(page, "render").mockImplementation(() => renderPageShell(page));

    document.body.appendChild(page);

    expect(page.selectedMember).toBe("@SHARED");
    expect(page.storageFilter).toBe("Missing");
    expect(page.xpMultiplier).toBe(1);
    expect(calcState.lastCreateArgs.at(-1)).toEqual({
      skill: "prayer",
      memberNames: [],
      levelLimit: -1,
    });
    expect(page.bankedItems.find((item) => item.item.name === "Herb")?.ignored).toBe(true);
    expect(page.bankedItems.find((item) => item.item.name === "Herb")?.selectedActivity?.name).toBe("mix");
    expect(page.bankedItems.find((item) => item.item.name === "Bones")?.selectedActivity?.name).toBe("bury");
    expect(page.enabledModifiers).toHaveLength(2);
    expect(pubsubMock.subscribe).toHaveBeenCalledWith("members-updated", expect.any(Function));
    expect(pubsubMock.subscribe).toHaveBeenCalledWith("items-updated", expect.any(Function));
    expect(pubsubMock.subscribe).toHaveBeenCalledWith("skills:@SHARED", expect.any(Function));

    page.handleMembersUpdated();
    expect(page.selectedMember).toBe("@SHARED");

    groupDataMock.members.set("Alice", {
      name: "Alice",
      skills: {
        Prayer: { xp: 5000, level: 70 },
      },
      totalItemQuantity: () => 0,
    });
    page.handleMembersUpdated();

    expect(page.selectedMember).toBe("Alice");
    expect(page.currentXp).toBe(5000);
    expect(page.currentLevel).toBe(70);
  });

  it("binds modifier, item, and bulk selection events across no-op branches", () => {
    groupDataMock.members.set("Alice", {
      name: "Alice",
      skills: {
        Prayer: { xp: 2500, level: 75 },
      },
      totalItemQuantity: () => 0,
    });

    const page = new BankedXpPage();
    page.selectedSkill = "prayer";
    page.currentLevel = 75;
    page.bankedItems = [createBankedItem("Bones", 2002, 4, bury), createBankedItem("Herb", 2003, 3, mix)] as any;
    page.innerHTML = `
      <input id="banked-xp__cascade" type="checkbox" />
      <input id="banked-xp__limit-level" type="checkbox" checked />
      <input id="banked-xp__multiplier" value="0" />
      <input class="banked-xp__modifier-check" data-mod-key="prayer_0" type="checkbox" checked />
      <input class="banked-xp__modifier-check" type="checkbox" checked />
      <button class="banked-xp__modifier-piece" data-mod-key="prayer_1"></button>
      <button class="banked-xp__modifier-piece" data-mod-key="prayer_1" data-piece="0"></button>
      <button id="banked-xp__ignore-all"></button>
      <button id="banked-xp__unignore-all"></button>
      <img class="banked-xp__item-icon" />
      <img class="banked-xp__item-icon" data-idx="0" />
      <span class="banked-xp__item-name"></span>
      <span class="banked-xp__item-name" data-idx="1"></span>
      <select class="banked-xp__activity-select"><option value="altar" selected>altar</option></select>
      <select class="banked-xp__activity-select" data-idx="0"><option value="altar" selected>altar</option></select>
    `;

    const updateDisplaySpy = vi.spyOn(page, "updateDisplay").mockImplementation(() => undefined);
    const recalculateSpy = vi.spyOn(page, "recalculate").mockImplementation(() => undefined);
    const buildModifiersSpy = vi.spyOn(page, "buildEnabledModifiers");
    const saveItemStatesSpy = vi.spyOn(page, "saveItemStates").mockImplementation(() => undefined);
    const saveStateSpy = vi.spyOn(page, "saveState").mockImplementation(() => undefined);

    page.bindEvents();

    const icons = Array.from(page.querySelectorAll<HTMLElement>(".banked-xp__item-icon"));
    icons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems[0].ignored).toBe(false);

    icons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems[0].ignored).toBe(true);

    const names = Array.from(page.querySelectorAll<HTMLElement>(".banked-xp__item-name"));
    names[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems[1].ignored).toBe(false);

    names[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems[1].ignored).toBe(true);

    const selects = Array.from(page.querySelectorAll<HTMLSelectElement>(".banked-xp__activity-select"));
    selects[0].dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.bankedItems[0].selectedActivity?.name).toBe("bury");

    selects[1].value = "altar";
    selects[1].dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.bankedItems[0].selectedActivity?.name).toBe("altar");

    const modifierChecks = Array.from(page.querySelectorAll<HTMLInputElement>(".banked-xp__modifier-check"));
    modifierChecks[1].dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.modifierStates.prayer_0).toBeUndefined();

    modifierChecks[0].dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.modifierStates.prayer_0?.enabled).toBe(true);

    const pieceButtons = Array.from(page.querySelectorAll<HTMLButtonElement>(".banked-xp__modifier-piece"));
    pieceButtons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.modifierStates.prayer_1).toBeUndefined();

    pieceButtons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.modifierStates.prayer_1?.pieces?.[0]).toBe(true);

    const cascadeCheckbox = page.querySelector<HTMLInputElement>("#banked-xp__cascade");
    cascadeCheckbox!.checked = true;
    cascadeCheckbox!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.cascadeEnabled).toBe(true);

    const limitCheckbox = page.querySelector<HTMLInputElement>("#banked-xp__limit-level");
    limitCheckbox!.checked = false;
    limitCheckbox!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.limitToLevel).toBe(false);

    const multiplierInput = page.querySelector<HTMLInputElement>("#banked-xp__multiplier");
    multiplierInput!.value = "0";
    multiplierInput!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(page.xpMultiplier).toBe(1);

    page.querySelector<HTMLElement>("#banked-xp__ignore-all")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems.every((item) => item.ignored)).toBe(true);

    page.querySelector<HTMLElement>("#banked-xp__unignore-all")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.bankedItems.every((item) => !item.ignored)).toBe(true);

    expect(buildModifiersSpy).toHaveBeenCalled();
    expect(recalculateSpy).toHaveBeenCalled();
    expect(updateDisplaySpy).toHaveBeenCalled();
    expect(saveItemStatesSpy).toHaveBeenCalled();
    expect(saveStateSpy).toHaveBeenCalled();
  });

  it("renders and updates fallbacks for hidden items, modifier states, and empty activity rows", () => {
    groupDataMock.members.set("Alice", {
      name: "Alice",
      skills: {
        Prayer: { xp: 1500, level: 50 },
      },
      totalItemQuantity: () => 0,
    });

    calcState.secondaries.set(3001, { id: 3001, qty: 6 });
    calcState.activitiesByItem.set("Bones", []);

    const page = new BankedXpPage();
    page.selectedSkill = "prayer";
    page.selectedMember = "Alice";
    page.currentXp = 1500;
    page.currentLevel = 50;
    page.endLevel = 50;
    page.modifierStates = {
      prayer_0: { enabled: true },
      prayer_1: { pieces: [true, false, false, false] },
    };
    page.buildEnabledModifiers();
    page.bankedItems = [
      createBankedItem("Dust", 2001, 0, bury),
      createBankedItem("Bones", 2002, 4, null, { ignored: true }),
      createBankedItem("Herb", 2003, 3, null),
    ] as any;
    page.linkedMap = new Map();
    page.innerHTML = `
      <div class="banked-xp__items-count"></div>
      <div class="banked-xp__secondaries-list"></div>
      <div class="banked-xp__items-grid">
        <div class="banked-xp__item" data-item-id="2002">
          <span class="banked-xp__item-qty"></span>
          <span class="banked-xp__item-xp"></span>
          <span class="banked-xp__item-icon"></span>
        </div>
        <div class="banked-xp__item" data-item-id="2003">
          <span class="banked-xp__item-qty"></span>
          <span class="banked-xp__item-xp"></span>
          <span class="banked-xp__item-icon"></span>
        </div>
      </div>
      <span id="banked-xp__val-current-xp"></span>
      <span id="banked-xp__val-banked-xp"></span>
      <span id="banked-xp__val-end-xp"></span>
      <span id="banked-xp__val-current-level"></span>
      <span id="banked-xp__val-end-level"></span>
    `;

    const modifiersHtml = page.renderModifiers();
    expect(modifiersHtml).toContain("checked");
    expect(modifiersHtml).toContain("Mystery Outfit");
    expect(modifiersHtml).toContain("active");
    expect(modifiersHtml).toContain(">Helm<");
    expect(modifiersHtml).not.toContain("banked-xp__modifier-tooltip");

    const itemRows = page.renderItemRows();
    expect(itemRows).not.toContain('data-item-id="2001"');
    expect(itemRows).toContain("banked-xp__item ignored");
    expect(itemRows).toContain("Click to include");
    expect(itemRows).toContain("<span style='color:#888'>-</span>");
    expect(itemRows).toContain("Mix herb (40xp, lvl 10)</option>");

    page.updateDisplay();

    const rows = Array.from(page.querySelectorAll<HTMLElement>(".banked-xp__item"));
    expect(rows[0].querySelector(".banked-xp__item-qty")?.textContent).toBe("4");
    expect(rows[0].querySelector(".banked-xp__item-xp")?.textContent).toBe("0");
    expect(rows[0].querySelector<HTMLElement>(".banked-xp__item-icon")?.title).toBe("Click to include");
    expect(rows[1].querySelector(".banked-xp__item-qty")?.textContent).toBe("3");
    expect(rows[1].querySelector(".banked-xp__item-xp")?.textContent).toBe("0");
    expect(page.querySelector(".banked-xp__items-count")?.textContent).toBe("2 items");
    expect(page.querySelector("#banked-xp__val-current-xp")?.textContent).toBe("1,500");
    expect(page.querySelector("#banked-xp__val-end-xp")?.textContent).toBe("1,500");
    expect(page.querySelector<HTMLElement>("#banked-xp__val-end-level")?.style.color).toBe("inherit");
    expect(page.querySelector(".banked-xp__secondaries-list")?.textContent).toContain("Secondary dust");
    expect(page.querySelector(".banked-xp__secondaries-list")?.innerHTML).not.toContain("<img");
    expect(page.renderXpSummary()).toContain("color: inherit");
  });
});