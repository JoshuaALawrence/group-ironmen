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
    getEquipmentById: vi.fn((id: number) => {
      if (id === 111) return createPiece(id, { name: "Bronze full helm", slot: "head" });
      if (id === 222) return undefined;
      if (id === 333) return createPiece(id, { name: "Rune kiteshield", slot: "shield" });
      if (id === 444) return createPiece(id, { name: "Abyssal whip", slot: "weapon", category: "whip" });
      return createPiece(id);
    }),
    calculateDps: vi.fn(() => null),
    aggregateEquipmentBonuses: vi.fn(() => ({
      offensive: { stab: 1, slash: 2, crush: 3, magic: 4, ranged: 5 },
      defensive: { stab: 6, slash: 7, crush: 8, magic: 9, ranged: 10 },
      bonuses: { str: 11, ranged_str: 12, magic_str: 13, prayer: 14 },
    })),
    getCombatStyles: vi.fn(() => [
      { name: "Stab", type: "stab", stance: "accurate" },
      { name: "Slash", type: "slash", stance: "aggressive" },
    ]),
    getConflictingPrayers: vi.fn((key: string) => (key === "rigour" ? new Set<string>(["piety"]) : new Set<string>())),
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

function createCalc(): DpsCalc {
  const calc = new DpsCalc();

  calc.memberSelect = document.createElement("select");
  calc.loadBtn = document.createElement("button");
  calc.tabButtons = [document.createElement("button"), document.createElement("button")];
  calc.tabButtons[0].dataset.tab = "combat";
  calc.tabButtons[1].dataset.tab = "skills";
  calc.tabContents = [document.createElement("div"), document.createElement("div")];
  calc.tabContents[0].dataset.tabContent = "combat";
  calc.tabContents[1].dataset.tabContent = "skills";

  calc.styleList = document.createElement("div");
  calc.prayerGrid = document.createElement("div");
  calc.boostsList = document.createElement("div");
  calc.resultsBody = document.createElement("div");
  calc.resultsExtraBody = document.createElement("div");
  calc.hitdistBody = document.createElement("div");
  calc.monsterInfo = document.createElement("div");
  calc.monsterNameDisplay = document.createElement("div");
  calc.monsterWeakness = document.createElement("div");
  calc.monsterAttrs = document.createElement("div");
  calc.monsterAttrList = document.createElement("div");
  calc.monsterSearch = document.createElement("input");
  calc.monsterResults = document.createElement("div");
  calc.monsterHpInput = document.createElement("input");
  calc.loadoutTabs = document.createElement("div");
  calc.loadoutAddBtn = document.createElement("button");
  calc.loadoutExportBtn = document.createElement("button");
  calc.loadoutImportBtn = document.createElement("button");
  calc.loadoutFileInput = document.createElement("input");
  calc.loadoutClearBtn = document.createElement("button");
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
  calc.hitdistHideZeros = document.createElement("input");
  calc.playerSummaryTitle = document.createElement("div");
  calc.playerSummarySubtitle = document.createElement("div");
  calc.playerSummaryLevel = document.createElement("div");
  calc.slayerCheckbox = document.createElement("input");
  calc.wildernessCheckbox = document.createElement("input");
  calc.forinthryCheckbox = document.createElement("input");
  calc.kandarinCheckbox = document.createElement("input");
  calc.numberBuffInputs = [document.createElement("input")];
  calc.numberBuffInputs[0].dataset.buff = "soulreaperStacks";
  calc.numberBuffInputs[0].min = "0";
  calc.numberBuffInputs[0].max = "5";

  const hitChevron = document.createElement("span");
  hitChevron.className = "dps-calc__chevron";
  calc.hitdistToggle.appendChild(hitChevron);

  calc.hitdistCanvas = document.createElement("canvas");
  Object.defineProperty(calc.hitdistCanvas, "clientWidth", { value: 460, configurable: true });

  const defredBody = document.createElement("div");
  defredBody.className = "dps-calc__defred-body";
  const monSettingsBody = document.createElement("div");
  monSettingsBody.className = "dps-calc__monsettings-body";
  calc.appendChild(defredBody);
  calc.appendChild(monSettingsBody);

  for (const skill of ["atk", "hp"]) {
    const statInput = document.createElement("input");
    statInput.className = "dps-calc__stat-input";
    statInput.dataset.skill = skill;
    calc.appendChild(statInput);
  }

  for (const key of ["dwh", "elderMaul"]) {
    const defredInput = document.createElement("input");
    defredInput.className = "dps-calc__defred-input";
    defredInput.dataset.defred = key;
    defredInput.value = "5";
    calc.appendChild(defredInput);
  }

  for (const key of ["accursed", "vulnerability"]) {
    const defredCheckbox = document.createElement("input");
    defredCheckbox.className = "dps-calc__defred-checkbox";
    defredCheckbox.dataset.defred = key;
    defredCheckbox.checked = true;
    calc.appendChild(defredCheckbox);
  }

  for (const key of [
    "hp",
    "atk",
    "str",
    "def",
    "magic",
    "ranged",
    "off-atk",
    "off-str",
    "off-magic",
    "off-mstr",
    "off-range",
    "off-rstr",
    "def-stab",
    "def-slash",
    "def-crush",
    "def-magic",
    "def-light",
    "def-standard",
    "def-heavy",
  ]) {
    const stat = document.createElement("span");
    stat.dataset.mstat = key;
    calc.appendChild(stat);
  }

  calc.appendChild(calc.resultsBody);
  calc.appendChild(calc.resultsExtraBody);
  calc.appendChild(calc.hitdistCanvas);
  calc.appendChild(calc.monsterNameDisplay);
  calc.appendChild(calc.monsterWeakness);
  calc.appendChild(calc.monsterAttrList);
  calc.appendChild(calc.equipSearch);
  calc.appendChild(calc.equipSearchResults);
  calc.appendChild(calc.equipSearchInline);
  calc.appendChild(calc.equipSearchInput);

  return calc;
}

function installCanvasContextMock(canvas: HTMLCanvasElement) {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    restore: vi.fn(),
    fillStyle: "",
    font: "",
    textAlign: "left" as CanvasTextAlign,
    strokeStyle: "",
    lineWidth: 1,
  };

  vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  return context;
}

describe("dps calc focused branch coverage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    pubsubMock.getMostRecent.mockReset();
    engineMock.getCombatStyles.mockReset();
    engineMock.getCombatStyles.mockReturnValue([
      { name: "Stab", type: "stab", stance: "accurate" },
      { name: "Slash", type: "slash", stance: "aggressive" },
    ]);
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("covers preset labels, invalid presets, member load fallbacks, and member-load early returns", () => {
    const calc = createCalc();

    const renderLoadoutTabs = vi.spyOn(calc, "renderLoadoutTabs").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateEquipmentDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateCombatStyles").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateBonusDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "updatePlayerSummary").mockImplementation(() => undefined);
    vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    const selectMonster = vi.spyOn(calc, "selectMonster").mockImplementation(() => undefined);

    calc.applyPreset("max_melee");
    expect(calc.loadouts[0]?.name).toBe("Max Melee");
    expect(calc.equipment.shield?.id).toBe(22322);

    const renderCallsAfterValidPreset = renderLoadoutTabs.mock.calls.length;
    calc.applyPreset("not-a-preset");
    expect(renderLoadoutTabs).toHaveBeenCalledTimes(renderCallsAfterValidPreset);

    calc.memberSelect.innerHTML = '<option value="bravo">bravo</option>';
    calc.memberSelect.value = "";
    calc.loadMemberEquipment();
    expect(pubsubMock.getMostRecent).not.toHaveBeenCalledWith("equipment:bravo");

    calc.memberSelect.value = "bravo";
    calc.monsterDataLoaded = true;
    calc.selectedMonster = { name: "Already Selected", skills: { hp: 9 }, inputs: {} } as never;

    pubsubMock.getMostRecent.mockImplementation((key: string) => {
      if (key === "equipment:bravo") {
        return [
          [
            { id: 111, isValid: () => true },
            { id: 999, isValid: () => false },
            { id: 998, isValid: () => true },
            { id: 444, isValid: () => true },
            { id: 222, isValid: () => true },
            { id: 333, isValid: () => true },
            { id: 997, isValid: () => true },
          ],
        ];
      }
      if (key === "skills:bravo") {
        return [
          {
            Attack: { level: 120 },
            Strength: { level: 88 },
            Defence: { level: 77 },
            Ranged: { level: 66 },
            Magic: { level: 55 },
            Prayer: { level: 44 },
            Hitpoints: { level: 33 },
          },
        ];
      }
      if (key === "interacting:bravo") {
        return [{ name: "Goblin" }];
      }
      return null;
    });

    calc.loadMemberEquipment();

    expect(calc.equipment.head?.id).toBe(111);
    expect(calc.equipment.weapon?.id).toBe(444);
    expect(calc.equipment.body?.id).toBe(222);
    expect(calc.equipment.body?.name).toBe("Unknown item (222)");
    expect(calc.equipment.legs).toBeNull();
    expect(calc.skills.atk).toBe(99);
    expect(calc.skills.hp).toBe(33);
    expect(calc.querySelector<HTMLInputElement>('.dps-calc__stat-input[data-skill="atk"]')?.value).toBe("99");
    expect(calc.loadouts[0]?.name).toBe("bravo");
    expect(selectMonster).not.toHaveBeenCalled();
  });

  it("covers style and prayer selection toggles plus equipment and monster search early-return paths", () => {
    const calc = createCalc();

    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    const closeEquipmentSearch = vi.spyOn(calc, "closeEquipmentSearch").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderResults").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderHitDistribution").mockImplementation(() => undefined);
    vi.spyOn(calc, "persistToStorage").mockImplementation(() => undefined);

    calc.updateCombatStyles();
    const styleItems = calc.styleList.querySelectorAll(".dps-calc__style-item");
    (styleItems[1] as HTMLElement).click();
    expect(calc.selectedStyle?.name).toBe("Slash");

    calc.updateCombatStyles();
    expect(calc.styleList.querySelectorAll(".dps-calc__style-item--active").length).toBe(1);
    expect(calc.selectedStyle?.name).toBe("Slash");

    calc.selectedPrayers.add("rigour");
    calc.renderPrayerGrid();
    const rigourItem = Array.from(calc.prayerGrid.querySelectorAll(".dps-calc__prayer-item")).find(
      (item) => item.getAttribute("title") === "Rigour"
    ) as HTMLElement;
    rigourItem.click();
    expect(calc.selectedPrayers.has("rigour")).toBe(false);

    calc.searchSlot = "weapon";
    calc.equipmentDataLoaded = true;
    calc.equipSearchInput.value = "x";
    calc.performEquipSearch();
    expect(calc.equipSearchResults.querySelectorAll(".dps-calc__equip-search-item").length).toBe(1);
    expect(calc.equipSearchResults.textContent).toContain("Remove item");

    calc.searchSlot = null;
    calc.allEquipment = [{ id: 900, name: "Mystery relic", speed: 4 } as never];
    calc.equipSearchInput.value = "mystery";
    recalculate.mockClear();
    closeEquipmentSearch.mockClear();
    calc.performEquipSearch();
    const searchResult = calc.equipSearchResults.querySelector(".dps-calc__equip-search-item") as HTMLElement;
    searchResult.click();
    expect(closeEquipmentSearch).not.toHaveBeenCalled();
    expect(recalculate).not.toHaveBeenCalled();

    calc.selectedMonster = { name: "Goblin", skills: { hp: 10 }, inputs: {} } as never;
    calc.monsterSearch.value = "g";
    calc.performMonsterSearch();
    expect(calc.monsterResults.style.display).toBe("block");
    const clearMonsterItem = calc.monsterResults.querySelector(".dps-calc__monster-result-item") as HTMLElement;
    clearMonsterItem.click();
    expect(calc.selectedMonster).toBeNull();
    expect(calc.monsterInfo.style.display).toBe("none");
  });

  it("covers member list, manual summary, invalid tab selection, and monster rendering without weakness data", () => {
    const calc = createCalc();

    const updatePlayerSummary = vi.spyOn(calc, "updatePlayerSummary");

    pubsubMock.getMostRecent.mockReturnValue([[{ nope: true }]]);
    calc.populateMemberSelect();
    expect(calc.memberSelect.options.length).toBe(0);

    updatePlayerSummary.mockClear();
    calc.populateMemberSelectFromData(undefined);
    expect(updatePlayerSummary).not.toHaveBeenCalled();

    calc.memberSelect.innerHTML = '<option value=""> </option>';
    calc.memberSelect.value = "";
    calc.updatePlayerSummary();
    expect(calc.playerSummaryTitle.textContent).toBe("Manual Loadout");

    calc.activeTab = "equipment";
    calc.setActiveTab("not-a-tab");
    expect(calc.activeTab).toBe("equipment");

    vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    calc.selectMonster({ name: "Blob", skills: { hp: 18, def: 5 } } as never);
    expect(calc.monsterWeakness.style.display).toBe("none");
    expect(calc.monsterAttrList.children.length).toBe(0);
    expect(calc.monsterHpInput.max).toBe("18");
    expect(calc.querySelector<HTMLInputElement>('.dps-calc__defred-input[data-defred="dwh"]')?.value).toBe("0");
    expect(calc.querySelector<HTMLInputElement>('.dps-calc__defred-checkbox[data-defred="accursed"]')?.checked).toBe(false);
  });

  it("covers single and multi-loadout result tables plus filtered and dense hit-distribution rendering", () => {
    const calc = createCalc();
    const context = installCanvasContextMock(calc.hitdistCanvas);

    calc.loadouts = [DpsCalc.createDefaultLoadout("Solo")];
    calc.selectedLoadout = 0;
    calc.loadoutResults = [
      {
        maxHit: 0,
        dps: Number.NaN,
        ttk: 0,
        accuracy: Number.NaN,
        specExpected: undefined,
        attackSpeed: 0,
        htk: 0,
      } as never,
    ];

    calc.renderResults();
    expect(calc.resultsBody.querySelectorAll("th.dps-calc__rt-header").length).toBe(0);
    expect(Array.from(calc.resultsBody.querySelectorAll("td.dps-calc__rt-value")).some((cell) => cell.textContent === "-")).toBe(true);

    calc.loadouts = [DpsCalc.createDefaultLoadout("A"), DpsCalc.createDefaultLoadout("B")];
    calc.loadoutResults = [
      { maxHit: 24, dps: 6.5, ttk: 20, accuracy: 70, specExpected: 4, attackSpeed: 4, htk: 8 } as never,
      { maxHit: 22, dps: 5.2, ttk: 18, accuracy: 60, specExpected: 3, attackSpeed: 5, htk: 7 } as never,
    ];
    const switchLoadout = vi.spyOn(calc, "switchLoadout").mockImplementation(() => undefined);
    calc.renderResults();
    const headers = calc.resultsBody.querySelectorAll("th.dps-calc__rt-header");
    (headers[1] as HTMLElement).click();
    expect(headers.length).toBe(2);
    expect(switchLoadout).toHaveBeenCalledWith(1);
    expect(calc.resultsExtraBody.querySelector("table")).toBeTruthy();

    calc.hideMisses = true;
    calc.hitDistribution = [{ name: "0", value: 1 }];
    calc.renderHitDistribution();
    expect(
      context.fillText.mock.calls.some((call) => String(call[0]).includes("Select a monster and combat style"))
    ).toBe(true);

    context.fillText.mockClear();
    calc.hideMisses = false;
    calc.hitDistribution = Array.from({ length: 20 }, (_value, index) => ({
      name: String(index),
      value: (index + 1) / 200,
    }));
    calc.renderHitDistribution();

    const xAxisLabels = context.fillText.mock.calls
      .map((call) => String(call[0]))
      .filter((value) => /^\d+$/.test(value));

    expect(xAxisLabels.length).toBe(10);
    expect(xAxisLabels[0]).toBe("0");
    expect(xAxisLabels.at(-1)).toBe("18");
  });
});