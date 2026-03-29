import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pubsubMock = vi.hoisted(() => ({
  getMostRecent: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

const engineMock = vi.hoisted(() => {
  const createPiece = (id: number, overrides: Record<string, unknown> = {}) => ({
    id,
    name: `item-${id}`,
    slot: "weapon",
    speed: 4,
    category: "slash",
    bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
    offensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    defensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    ...overrides,
  });

  return {
    loadEquipmentData: vi.fn(async () => []),
    loadMonsterData: vi.fn(async () => []),
    getEquipmentById: vi.fn((id: number) => createPiece(id)),
    calculateDps: vi.fn(() => null),
    aggregateEquipmentBonuses: vi.fn(() => ({
      offensive: { stab: 1, slash: 2, crush: 3, magic: 4, ranged: 5 },
      defensive: { stab: 6, slash: 7, crush: 8, magic: 9, ranged: 10 },
      bonuses: { str: 11, ranged_str: 12, magic_str: 13, prayer: 14 },
    })),
    getCombatStyles: vi.fn(() => [{ name: "Slash", type: "slash", stance: "aggressive" }]),
    getConflictingPrayers: vi.fn(() => new Set<string>()),
  };
});

vi.mock("../data/pubsub", () => ({
  pubsub: pubsubMock,
}));

vi.mock("../dps-calc/dps-calc-engine", () => ({
  loadEquipmentData: engineMock.loadEquipmentData,
  loadMonsterData: engineMock.loadMonsterData,
  getEquipmentById: engineMock.getEquipmentById,
  calculateDps: engineMock.calculateDps,
  aggregateEquipmentBonuses: engineMock.aggregateEquipmentBonuses,
  getCombatStyles: engineMock.getCombatStyles,
  PRAYERS: {
    piety: { name: "Piety" },
    rigour: { name: "Rigour" },
  },
  getConflictingPrayers: engineMock.getConflictingPrayers,
  POTIONS: {
    none: { name: "None", calc: () => ({}) },
    superCombat: { name: "Super Combat", calc: () => ({}) },
    ranging: { name: "Ranging", calc: () => ({}) },
  },
}));

import { DpsCalc } from "../dps-calc/dps-calc";

function createPiece(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `item-${id}`,
    slot: "weapon",
    speed: 4,
    category: "slash",
    bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
    offensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    defensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    ...overrides,
  };
}

function rect(left: number, top: number, width = 120, height = 24): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function createCalc(): DpsCalc {
  const calc = new DpsCalc();

  calc.memberSelect = document.createElement("select");
  calc.loadBtn = document.createElement("button");
  calc.styleList = document.createElement("div");
  calc.prayerGrid = document.createElement("div");
  calc.boostsList = document.createElement("div");
  calc.slayerCheckbox = document.createElement("input");
  calc.wildernessCheckbox = document.createElement("input");
  calc.forinthryCheckbox = document.createElement("input");
  calc.kandarinCheckbox = document.createElement("input");
  calc.numberBuffInputs = [document.createElement("input")];
  calc.numberBuffInputs[0].dataset.buff = "soulreaperStacks";
  calc.numberBuffInputs[0].min = "0";
  calc.numberBuffInputs[0].max = "5";

  calc.monsterSearch = document.createElement("input");
  calc.monsterResults = document.createElement("div");
  calc.monsterInfo = document.createElement("div");
  calc.monsterNameDisplay = document.createElement("div");
  calc.monsterWeakness = document.createElement("div");
  calc.monsterAttrs = document.createElement("div");
  calc.monsterAttrList = document.createElement("div");
  calc.monsterHpInput = document.createElement("input");

  calc.loadoutTabs = document.createElement("div");
  calc.loadoutAddBtn = document.createElement("button");
  calc.loadoutExportBtn = document.createElement("button");
  calc.loadoutImportBtn = document.createElement("button");
  calc.loadoutFileInput = document.createElement("input");
  calc.loadoutClearBtn = document.createElement("button");
  calc.resultsBody = document.createElement("div");
  calc.resultsExtraBody = document.createElement("div");
  calc.presetSelect = document.createElement("select");

  calc.equipSearchInline = document.createElement("input");
  calc.equipSearch = document.createElement("div");
  calc.equipSearchInput = document.createElement("input");
  calc.equipSearchResults = document.createElement("div");
  calc.equipSearchClose = document.createElement("button");

  calc.attrsToggle = document.createElement("button");
  calc.defredToggle = document.createElement("button");
  calc.monsettingsToggle = document.createElement("button");
  calc.showMoreBtn = document.createElement("button");
  calc.hitdistToggle = document.createElement("button");
  calc.hitdistBody = document.createElement("div");
  calc.hitdistHideZeros = document.createElement("input");
  calc.hitdistCanvas = document.createElement("canvas");
  calc.playerSummaryTitle = document.createElement("div");
  calc.playerSummarySubtitle = document.createElement("div");
  calc.playerSummaryLevel = document.createElement("div");

  const equipmentContainer = document.createElement("div");
  equipmentContainer.className = "dps-calc__equipment";
  calc.appendChild(equipmentContainer);

  for (const skill of ["atk", "str", "def", "ranged", "magic", "prayer", "hp"]) {
    const input = document.createElement("input");
    input.className = "dps-calc__stat-input";
    input.dataset.skill = skill;
    calc.appendChild(input);
  }

  for (const slotName of ["weapon", "shield"]) {
    const slot = document.createElement("button");
    slot.className = "dps-calc__equip-slot";
    slot.dataset.slot = slotName;
    calc.appendChild(slot);
  }

  const orphanSlot = document.createElement("button");
  orphanSlot.className = "dps-calc__equip-slot";
  calc.appendChild(orphanSlot);

  calc.appendChild(calc.loadoutTabs);
  calc.appendChild(calc.resultsBody);
  calc.appendChild(calc.resultsExtraBody);
  calc.appendChild(calc.equipSearch);
  calc.appendChild(calc.equipSearchResults);
  calc.appendChild(calc.equipSearchInline);
  calc.appendChild(calc.equipSearchInput);
  calc.appendChild(calc.monsterResults);
  calc.appendChild(calc.monsterInfo);
  calc.appendChild(calc.monsterNameDisplay);
  calc.appendChild(calc.monsterWeakness);
  calc.appendChild(calc.monsterAttrList);

  return calc;
}

describe("dps calc extra ui coverage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("covers loadout tab event paths plus rename enter and escape branches", () => {
    const calc = createCalc();
    const switchLoadout = vi.spyOn(calc, "switchLoadout");
    const removeLoadout = vi.spyOn(calc, "removeLoadout");
    const renameLoadout = vi.spyOn(calc, "renameLoadout");

    vi.spyOn(calc, "updateEquipmentDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateCombatStyles").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateBonusDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderPrayerGrid").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderBoostList").mockImplementation(() => undefined);
    vi.spyOn(calc, "updatePlayerSummary").mockImplementation(() => undefined);
    vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    const renderResults = vi.spyOn(calc, "renderResults").mockImplementation(() => undefined);

    calc.loadouts = [
      DpsCalc.createDefaultLoadout("Alpha"),
      DpsCalc.createDefaultLoadout("Bravo"),
      DpsCalc.createDefaultLoadout("Charlie"),
    ];
    calc.selectedLoadout = 2;
    calc.renderLoadoutTabs();

    const firstLabel = calc.loadoutTabs.querySelector(".dps-calc__loadout-tab-label") as HTMLElement;
    firstLabel.click();
    expect(switchLoadout).toHaveBeenCalledWith(0);
    expect(calc.selectedLoadout).toBe(0);

    calc.selectedLoadout = 1;
    calc.renderLoadoutTabs();

    const bravoLabel = calc.loadoutTabs.querySelectorAll(".dps-calc__loadout-tab-label")[1] as HTMLElement;
    bravoLabel.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(renameLoadout).toHaveBeenCalledWith(1, expect.any(HTMLElement));

    let renameInput = calc.loadoutTabs.querySelector(".dps-calc__loadout-tab-rename") as HTMLInputElement;
    const enterBlur = vi.spyOn(renameInput, "blur");
    renameInput.value = "Renamed Bravo";
    renameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(enterBlur).toHaveBeenCalledTimes(1);
    renameInput.dispatchEvent(new Event("blur"));
    expect(calc.loadouts[1]?.name).toBe("Renamed Bravo");

    calc.renderLoadoutTabs();
    const renamedLabel = calc.loadoutTabs.querySelectorAll(".dps-calc__loadout-tab-label")[1] as HTMLElement;
    renamedLabel.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    renameInput = calc.loadoutTabs.querySelector(".dps-calc__loadout-tab-rename") as HTMLInputElement;
    const escapeBlur = vi.spyOn(renameInput, "blur");
    renameInput.value = "Should Not Persist";
    renameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(escapeBlur).toHaveBeenCalledTimes(1);
    renameInput.dispatchEvent(new Event("blur"));

    expect(calc.loadouts[1]?.name).toBe("Renamed Bravo");
    expect(renderResults).toHaveBeenCalledTimes(2);

    calc.selectedLoadout = 2;
    calc.renderLoadoutTabs();
    const closeButtons = calc.loadoutTabs.querySelectorAll(".dps-calc__loadout-tab-close");
    (closeButtons[0] as HTMLElement).click();

    expect(removeLoadout).toHaveBeenCalledWith(0);
    expect(calc.loadouts.map((loadout) => loadout.name)).toEqual(["Renamed Bravo", "Charlie"]);
    expect(calc.selectedLoadout).toBe(1);

    const activeClose = calc.loadoutTabs.querySelectorAll(".dps-calc__loadout-tab-close")[1] as HTMLElement;
    activeClose.click();

    expect(calc.loadouts.map((loadout) => loadout.name)).toEqual(["Renamed Bravo"]);
    expect(calc.selectedLoadout).toBe(0);
    expect(calc.loadoutTabs.querySelectorAll(".dps-calc__loadout-tab-close")).toHaveLength(0);
  });

  it("covers equipment slot DOM rendering, highlight toggling, and search overlay positioning", () => {
    const calc = createCalc();
    const weaponSlot = calc.querySelector('[data-slot="weapon"]') as HTMLElement;
    const shieldSlot = calc.querySelector('[data-slot="shield"]') as HTMLElement;
    const orphanSlot = calc.querySelectorAll(".dps-calc__equip-slot")[2] as HTMLElement;
    const performEquipSearch = vi.spyOn(calc, "performEquipSearch").mockImplementation(() => undefined);

    vi.spyOn(calc.equipSearchInline, "getBoundingClientRect").mockReturnValue(rect(60, 90));
    vi.spyOn(calc, "getBoundingClientRect").mockReturnValue(rect(15, 20, 320, 260));

    calc.equipSearchInline.value = "whip";
    calc.openEquipmentSearch();

    expect(calc.equipSearch.style.left).toBe("45px");
    expect(calc.equipSearch.style.top).toBe("98px");
    expect(calc.equipSearch.style.display).toBe("block");
    expect(calc.equipSearchInput.value).toBe("whip");
    expect(performEquipSearch).toHaveBeenCalledTimes(1);

    performEquipSearch.mockRestore();

    calc.searchSlot = "weapon";
    calc.equipment.weapon = createPiece(4151, { name: "Abyssal whip", slot: "weapon" }) as never;
    calc.updateEquipmentDisplay();

    expect(weaponSlot.classList.contains("dps-calc__equip-slot--active")).toBe(true);
    expect(weaponSlot.innerHTML).toContain("/icons/items/4151.webp");
    expect(weaponSlot.innerHTML).toContain("Abyssal whip");
    expect(shieldSlot.innerHTML).toContain("/ui/162-0.png");
    expect(orphanSlot.innerHTML).toContain("/ui/159-0.png");

    calc.closeEquipmentSearch();

    expect(calc.equipSearch.style.display).toBe("none");
    expect(calc.searchSlot).toBeNull();
    expect(weaponSlot.classList.contains("dps-calc__equip-slot--active")).toBe(false);
  });

  it("covers equipment search ordering, result cap, icon fallback, and selection", () => {
    const calc = createCalc();
    vi.spyOn(calc, "updateEquipmentDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateCombatStyles").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateBonusDisplay").mockImplementation(() => undefined);
    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);

    calc.equipmentDataLoaded = true;
    calc.searchSlot = "weapon";
    calc.equipSearch.style.display = "block";
    calc.allEquipment = [
      createPiece(1000, { name: "blade", slot: "weapon" }),
      createPiece(1001, { name: "blade of dawn", slot: "weapon" }),
      createPiece(1002, { name: "nightblade", slot: "weapon", version: "Beta" }),
      ...Array.from({ length: 60 }, (_value, index) =>
        createPiece(2000 + index, { name: `extremely late blade extra ${index}`, slot: "weapon" })
      ),
    ] as never;

    calc.equipSearchInput.value = "blade";
    calc.performEquipSearch();

    const items = calc.equipSearchResults.querySelectorAll(".dps-calc__equip-search-item");
    const labels = Array.from(items)
      .slice(1, 4)
      .map((item) => item.textContent?.trim());

    expect(items).toHaveLength(51);
    expect(items[0]?.textContent).toBe("Remove item");
    expect(labels).toEqual(["blade", "blade of dawn", "nightblade (Beta)"]);

    const firstIcon = items[1]?.querySelector("img") as HTMLImageElement;
    firstIcon.dispatchEvent(new Event("error"));
    expect(firstIcon.src).toContain("/ui/159-0.png");

    (items[1] as HTMLElement).click();

    expect((calc.equipment.weapon as { id?: number } | null)?.id).toBe(1000);
    expect(calc.searchSlot).toBeNull();
    expect(calc.equipSearch.style.display).toBe("none");
    expect(recalculate).toHaveBeenCalledTimes(1);
  });

  it("covers monster search ordering, result cap, and meta rendering", () => {
    const calc = createCalc();

    calc.monsterDataLoaded = true;
    calc.allMonsters = [
      { name: "Goblin", version: "Lvl 2", image: "goblin.webp", skills: { hp: 10, def: 2 } },
      { name: "Goblin Guard", skills: { hp: 18, def: 5 } },
      { name: "Hobgoblin", skills: { hp: 28, def: 8 } },
      ...Array.from({ length: 40 }, (_value, index) => ({
        name: `very late goblin extra ${index}`,
        skills: { hp: 3, def: 1 },
      })),
    ] as never;

    calc.monsterSearch.value = "goblin";
    calc.performMonsterSearch();

    const items = calc.monsterResults.querySelectorAll(".dps-calc__monster-result-item");
    const labels = Array.from(items).slice(0, 3).map((item) => item.textContent || "");

    expect(items).toHaveLength(30);
    expect(labels[0]).toContain("Goblin");
    expect(labels[0]).toContain("Lvl 2");
    expect(labels[0]).toContain("HP: 10, Def: 2");
    expect(labels[1]).toContain("Goblin Guard");
    expect(labels[2]).toContain("Hobgoblin");
    expect(calc.monsterResults.style.display).toBe("block");
  });
});