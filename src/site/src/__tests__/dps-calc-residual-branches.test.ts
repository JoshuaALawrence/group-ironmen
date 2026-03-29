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
      if (id === 333) return createPiece(id, { name: "Rune kiteshield", slot: "shield" });
      if (id === 444) return createPiece(id, { name: "Abyssal whip", slot: "weapon", category: "whip" });
      if (id === 25865) return createPiece(id, { name: "Bow of faerdhinen", slot: "weapon", isTwoHanded: true });
      return createPiece(id);
    }),
    calculateDps: vi.fn(() => null),
    aggregateEquipmentBonuses: vi.fn(() => ({
      offensive: { stab: 1, slash: 2, crush: 3, magic: -4, ranged: 5 },
      defensive: { stab: 6, slash: 7, crush: 8, magic: 9, ranged: 10 },
      bonuses: { str: 11, ranged_str: 12, magic_str: 13, prayer: 14 },
    })),
    getCombatStyles: vi.fn(() => [
      { name: "Slash", type: "slash", stance: "aggressive" },
      { name: "Crush", type: "crush", stance: "controlled" },
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

const createdCalcs: DpsCalc[] = [];

function markConnected(calc: DpsCalc): DpsCalc {
  Object.defineProperty(calc, "isConnected", {
    configurable: true,
    get: () => true,
  });
  return calc;
}

function createCalc({ attach = false }: { attach?: boolean } = {}): DpsCalc {
  const calc = new DpsCalc();

  calc.memberSelect = document.createElement("select");
  calc.memberSelect.innerHTML = '<option value="alice">alice</option>';
  calc.memberSelect.value = "alice";
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
  calc.slayerCheckbox = document.createElement("input");
  calc.wildernessCheckbox = document.createElement("input");
  calc.forinthryCheckbox = document.createElement("input");
  calc.kandarinCheckbox = document.createElement("input");

  const validBuffInput = document.createElement("input");
  validBuffInput.dataset.buff = "soulreaperStacks";
  validBuffInput.min = "0";
  validBuffInput.max = "5";
  const invalidBuffInput = document.createElement("input");
  invalidBuffInput.min = "0";
  invalidBuffInput.max = "5";
  calc.numberBuffInputs = [validBuffInput, invalidBuffInput];

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

  const attrsChevron = document.createElement("span");
  attrsChevron.className = "dps-calc__chevron";
  calc.attrsToggle.appendChild(attrsChevron);

  const defredChevron = document.createElement("span");
  defredChevron.className = "dps-calc__chevron";
  calc.defredToggle.appendChild(defredChevron);

  const monsettingsChevron = document.createElement("span");
  monsettingsChevron.className = "dps-calc__chevron";
  calc.monsettingsToggle.appendChild(monsettingsChevron);

  const hitdistChevron = document.createElement("span");
  hitdistChevron.className = "dps-calc__chevron";
  calc.hitdistToggle.appendChild(hitdistChevron);

  Object.defineProperty(calc.hitdistCanvas, "clientWidth", { value: 460, configurable: true });

  const defredBody = document.createElement("div");
  defredBody.className = "dps-calc__defred-body";
  const monsettingsBody = document.createElement("div");
  monsettingsBody.className = "dps-calc__monsettings-body";
  const equipmentContainer = document.createElement("div");
  equipmentContainer.className = "dps-calc__equipment";

  calc.appendChild(defredBody);
  calc.appendChild(monsettingsBody);
  calc.appendChild(equipmentContainer);

  for (const skill of ["atk", "str", "def", "ranged", "magic", "prayer", "hp"]) {
    const statInput = document.createElement("input");
    statInput.className = "dps-calc__stat-input";
    statInput.dataset.skill = skill;
    calc.appendChild(statInput);
  }

  for (const slotName of ["weapon", "shield"]) {
    const slot = document.createElement("button");
    slot.className = "dps-calc__equip-slot";
    slot.dataset.slot = slotName;
    calc.appendChild(slot);
  }

  for (const key of ["dwh", "elderMaul", "bogus"]) {
    const defredInput = document.createElement("input");
    defredInput.className = "dps-calc__defred-input";
    defredInput.dataset.defred = key;
    calc.appendChild(defredInput);
  }

  for (const key of ["accursed", "vulnerability", "bogus"]) {
    const defredCheckbox = document.createElement("input");
    defredCheckbox.className = "dps-calc__defred-checkbox";
    defredCheckbox.dataset.defred = key;
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

  for (const key of [
    "off-stab",
    "off-slash",
    "off-crush",
    "off-magic",
    "off-ranged",
    "def-stab",
    "def-slash",
    "def-crush",
    "def-magic",
    "def-ranged",
    "str",
    "ranged_str",
    "magic_str",
    "prayer",
    "speed",
  ]) {
    const bonus = document.createElement("span");
    bonus.dataset.bonus = key;
    calc.appendChild(bonus);
  }

  calc.appendChild(calc.resultsBody);
  calc.appendChild(calc.resultsExtraBody);
  calc.appendChild(calc.hitdistCanvas);
  calc.appendChild(calc.monsterInfo);
  calc.appendChild(calc.monsterNameDisplay);
  calc.appendChild(calc.monsterWeakness);
  calc.appendChild(calc.monsterAttrList);
  calc.appendChild(calc.monsterResults);
  calc.appendChild(calc.monsterSearch);
  calc.appendChild(calc.monsterHpInput);
  calc.appendChild(calc.equipSearch);
  calc.appendChild(calc.equipSearchResults);
  calc.appendChild(calc.equipSearchInline);
  calc.appendChild(calc.equipSearchInput);
  calc.appendChild(calc.styleList);
  calc.appendChild(calc.prayerGrid);
  calc.appendChild(calc.boostsList);
  calc.appendChild(calc.hitdistBody);

  if (attach) {
    markConnected(calc);
  }

  createdCalcs.push(calc);
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

function getDefredInput(calc: DpsCalc, key: string): HTMLInputElement {
  return calc.querySelector(`.dps-calc__defred-input[data-defred="${key}"]`) as HTMLInputElement;
}

function getDefredCheckbox(calc: DpsCalc, key: string): HTMLInputElement {
  return calc.querySelector(`.dps-calc__defred-checkbox[data-defred="${key}"]`) as HTMLInputElement;
}

describe("dps calc residual branches", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    pubsubMock.getMostRecent.mockReset();
    pubsubMock.subscribe.mockReset();
    pubsubMock.unsubscribe.mockReset();
    engineMock.loadEquipmentData.mockReset();
    engineMock.loadEquipmentData.mockResolvedValue([]);
    engineMock.loadMonsterData.mockReset();
    engineMock.loadMonsterData.mockResolvedValue([]);
    engineMock.getEquipmentById.mockClear();
    engineMock.calculateDps.mockReset();
    engineMock.calculateDps.mockReturnValue(null);
    engineMock.aggregateEquipmentBonuses.mockClear();
    engineMock.getCombatStyles.mockReset();
    engineMock.getCombatStyles.mockReturnValue([
      { name: "Slash", type: "slash", stance: "aggressive" },
      { name: "Crush", type: "crush", stance: "controlled" },
    ]);
    engineMock.getConflictingPrayers.mockClear();
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  });

  afterEach(() => {
    createdCalcs.splice(0).forEach((calc) => calc.unbindEvents());
    document.body.replaceChildren();
    localStorage.clear();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("restores persisted state while clamping and ignoring malformed entries", () => {
    const calc = createCalc();
    vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);

    calc.allMonsters = [
      {
        name: "Goblin",
        version: "Normal",
        image: "goblin.webp",
        skills: { hp: 12, def: 3 },
      } as never,
    ];

    localStorage.setItem(
      DpsCalc.STORAGE_KEY,
      JSON.stringify({
        monster: { name: "Goblin", version: "Normal", currentHp: 99 },
        defenceReductions: { dwh: 7, accursed: true, vulnerability: false },
        loadouts: [
          null,
          {
            name: "x".repeat(40),
            equipment: { head: 111, weapon: 444, shield: 333, unused: 999 },
            skills: { atk: 120, str: 80, hp: 0, prayer: 250 },
            selectedStyle: { name: "Slash", type: "slash", stance: "aggressive" },
            selectedPrayers: ["rigour", 123],
            selectedPotion: "ranging",
            onSlayerTask: true,
            extraBuffs: { soulreaperStacks: 9, chinchompaDistance: 7 },
          },
        ],
        selectedLoadout: 99,
        hideMisses: false,
      })
    );

    calc.restoreFromStorage();

    expect(calc.loadouts).toHaveLength(1);
    expect(calc.selectedLoadout).toBe(0);
    expect(calc.loadouts[0]?.name).toBe("x".repeat(30));
    expect(calc.equipment.head?.id).toBe(111);
    expect(calc.equipment.weapon?.id).toBe(444);
    expect(calc.skills.atk).toBe(99);
    expect(calc.skills.hp).toBe(1);
    expect(calc.skills.prayer).toBe(99);
    expect(calc.selectedStyle?.name).toBe("Slash");
    expect([...calc.selectedPrayers]).toEqual(["rigour"]);
    expect(calc.selectedPotion).toBe("ranging");
    expect(calc.onSlayerTask).toBe(true);
    expect(calc.extraBuffs.soulreaperStacks).toBe(9);
    expect(calc.extraBuffs.chinchompaDistance).toBe(7);
    expect(calc.selectedMonster?.inputs?.monsterCurrentHp).toBe(12);
    expect(calc.monsterHpInput.value).toBe("12");
    expect(getDefredInput(calc, "dwh").value).toBe("7");
    expect(getDefredCheckbox(calc, "accursed").checked).toBe(true);
    expect(getDefredCheckbox(calc, "vulnerability").checked).toBe(false);
    expect(calc.hideMisses).toBe(false);
    expect(calc.hitdistHideZeros.checked).toBe(false);
  });

  it("covers helper fallbacks for data loading and monster rendering helpers", async () => {
    const calc = createCalc();
    const restoreFromStorage = vi.spyOn(calc, "restoreFromStorage").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    engineMock.loadEquipmentData.mockRejectedValueOnce(new Error("equipment failed"));
    engineMock.loadMonsterData.mockResolvedValueOnce([{ name: "Shade", image: "shade.webp", skills: { hp: 8 } }]);

    await calc.loadData();

    expect(calc.equipmentDataLoaded).toBe(false);
    expect(calc.monsterDataLoaded).toBe(true);
    expect(calc.allMonsters).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith("Failed to load equipment data:", expect.any(Error));
    expect(restoreFromStorage).toHaveBeenCalledTimes(1);

    expect(calc.getMonsterImageSources({ name: "Nameless" } as never)).toEqual(["/images/skills/Combat_icon.png"]);
    expect(calc.getMonsterDisplayName({ name: "Shade", version: "Echo" } as never)).toBe("Shade (Echo)");

    const image = calc.createMonsterImage({ name: "Shade", image: "shade.webp" } as never, "icon");
    for (let index = 0; index < 4; index += 1) {
      image.dispatchEvent(new Event("error"));
    }
    expect(image.className).toBe("icon");
    expect(image.alt).toBe("Shade");
    expect(image.src).toContain("/images/skills/Combat_icon.png");

    calc.renderSelectedMonster({ name: "Shade", image: "shade.webp" } as never);
    expect(calc.monsterNameDisplay.textContent).toContain("Shade");
    expect(calc.monsterNameDisplay.querySelector(".dps-calc__monster-name-version")).toBeNull();

    expect(() => calc.toggleCollapsible(null, null)).not.toThrow();
  });

  it("wires summary, defence reduction, monster hp, and toggle branches while ignoring invalid inputs", () => {
    const calc = createCalc({ attach: true });
    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    const renderHitDistribution = vi.spyOn(calc, "renderHitDistribution").mockImplementation(() => undefined);

    calc.playerSummarySubtitle = undefined as unknown as HTMLElement;
    calc.setupEventListeners();

    const membersUpdatedHandler = pubsubMock.subscribe.mock.calls.find((call) => call[0] === "members-updated")?.[1] as
      | ((members: unknown) => void)
      | undefined;
    membersUpdatedHandler?.([{ nope: true }]);
    expect(calc.memberSelect.options.length).toBe(1);

    const dwhInput = getDefredInput(calc, "dwh");
    dwhInput.value = "-5";
    dwhInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(calc.defenceReductions.dwh).toBe(0);

    const callsAfterValidNumeric = recalculate.mock.calls.length;
    const invalidNumeric = getDefredInput(calc, "bogus");
    invalidNumeric.value = "9";
    invalidNumeric.dispatchEvent(new Event("input", { bubbles: true }));
    expect(recalculate).toHaveBeenCalledTimes(callsAfterValidNumeric);

    const vulnerabilityCheckbox = getDefredCheckbox(calc, "vulnerability");
    vulnerabilityCheckbox.checked = true;
    vulnerabilityCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(calc.defenceReductions.vulnerability).toBe(true);
    expect(calc.defenceReductions.accursed).toBe(false);

    const accursedCheckbox = getDefredCheckbox(calc, "accursed");
    accursedCheckbox.checked = true;
    accursedCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(calc.defenceReductions.accursed).toBe(true);
    expect(calc.defenceReductions.vulnerability).toBe(false);
    expect(vulnerabilityCheckbox.checked).toBe(false);

    const callsAfterBoolean = recalculate.mock.calls.length;
    const invalidCheckbox = getDefredCheckbox(calc, "bogus");
    invalidCheckbox.checked = true;
    invalidCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(recalculate).toHaveBeenCalledTimes(callsAfterBoolean);

    recalculate.mockClear();
    calc.selectedMonster = null;
    calc.monsterHpInput.value = "18";
    calc.monsterHpInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(recalculate).not.toHaveBeenCalled();

    calc.selectedMonster = { name: "Goblin", skills: { hp: 12 }, inputs: {} } as never;
    calc.monsterHpInput.value = "99";
    calc.monsterHpInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(calc.monsterHpInput.value).toBe("12");
    expect(calc.selectedMonster.inputs?.monsterCurrentHp).toBe(12);

    recalculate.mockClear();
    calc.numberBuffInputs[0].value = "99";
    calc.numberBuffInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    expect(calc.extraBuffs.soulreaperStacks).toBe(5);
    expect(recalculate).toHaveBeenCalledTimes(1);

    const callsAfterBuff = recalculate.mock.calls.length;
    calc.numberBuffInputs[1].value = "2";
    calc.numberBuffInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    expect(recalculate).toHaveBeenCalledTimes(callsAfterBuff);

    calc.memberSelect.innerHTML = '<option value=""></option>';
    calc.memberSelect.value = "";
    calc.updatePlayerSummary();
    expect(calc.playerSummaryTitle.textContent).toBe("Manual Loadout");
    expect(calc.playerSummaryLevel.textContent).toMatch(/^Lvl /);

    calc.resultsExtraBody.style.display = "none";
    calc.showMoreBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calc.resultsExpanded).toBe(true);
    expect(calc.resultsExtraBody.style.display).toBe("block");
    expect(calc.showMoreBtn.textContent).toContain("Show less");

    calc.hitdistBody.style.display = "none";
    calc.hitdistToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calc.hitdistBody.style.display).toBe("block");
    expect(renderHitDistribution).toHaveBeenCalledTimes(1);

    calc.hitdistToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calc.hitdistBody.style.display).toBe("none");
    expect(renderHitDistribution).toHaveBeenCalledTimes(1);
  });

  it("covers search focus guards, debounce handling, document click branches, and guarded search results", () => {
    const calc = createCalc({ attach: true });
    const documentAddEventListener = vi.spyOn(document, "addEventListener");
    calc.setupEventListeners();

    const handleMonsterSearchInput = vi.spyOn(calc, "handleMonsterSearchInput");
    const performEquipSearch = vi.spyOn(calc, "performEquipSearch").mockImplementation(() => undefined);
    const performMonsterSearch = vi.spyOn(calc, "performMonsterSearch").mockImplementation(() => undefined);

    calc.monsterSearch.value = "g";
    calc.monsterSearch.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    expect(handleMonsterSearchInput).not.toHaveBeenCalled();

    calc.monsterSearch.value = "go";
    calc.monsterSearch.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    expect(handleMonsterSearchInput).toHaveBeenCalledTimes(1);

    calc.selectedMonster = { name: "Goblin", skills: { hp: 12 }, inputs: {} } as never;
    calc.monsterSearch.value = "g";
    calc.monsterSearch.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    expect(handleMonsterSearchInput).toHaveBeenCalledTimes(2);

    vi.runOnlyPendingTimers();
    performMonsterSearch.mockClear();

    calc.handleEquipSearchInput();
    calc.handleEquipSearchInput();
    vi.advanceTimersByTime(119);
    expect(performEquipSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(performEquipSearch).toHaveBeenCalledTimes(1);

    calc.handleMonsterSearchInput();
    calc.handleMonsterSearchInput();
    vi.advanceTimersByTime(119);
    expect(performMonsterSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(performMonsterSearch).toHaveBeenCalledTimes(1);

    performEquipSearch.mockRestore();
    performMonsterSearch.mockRestore();

    const closeEquipmentSearch = vi.spyOn(calc, "closeEquipmentSearch").mockImplementation(() => undefined);
    const documentClickHandler = documentAddEventListener.mock.calls.find((call) => call[0] === "click")?.[1] as
      | EventListener
      | undefined;

    const insideEquipSearch = document.createElement("div");
    calc.equipSearch.appendChild(insideEquipSearch);
    const insideClick = new MouseEvent("click");
    Object.defineProperty(insideClick, "target", { value: insideEquipSearch });
    documentClickHandler?.(insideClick);
    expect(closeEquipmentSearch).not.toHaveBeenCalled();

    const inlineClick = new MouseEvent("click");
    Object.defineProperty(inlineClick, "target", { value: calc.equipSearchInline });
    documentClickHandler?.(inlineClick);
    expect(closeEquipmentSearch).not.toHaveBeenCalled();

    const equipSlot = calc.querySelector(".dps-calc__equip-slot") as HTMLElement;
    const slotClick = new MouseEvent("click");
    Object.defineProperty(slotClick, "target", { value: equipSlot });
    documentClickHandler?.(slotClick);
    expect(closeEquipmentSearch).not.toHaveBeenCalled();

    const outside = document.createElement("div");
    const outsideClick = new MouseEvent("click");
    Object.defineProperty(outsideClick, "target", { value: outside });
    documentClickHandler?.(outsideClick);
    expect(closeEquipmentSearch).toHaveBeenCalledTimes(1);

    closeEquipmentSearch.mockClear();
    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    calc.equipmentDataLoaded = true;
    calc.searchSlot = null;
    calc.allEquipment = [{ id: 900, name: "Mystery relic", speed: 4 } as never];
    calc.equipSearchInput.value = "my";
    calc.performEquipSearch();

    const guardedItem = calc.equipSearchResults.querySelector(".dps-calc__equip-search-item") as HTMLElement;
    guardedItem.click();
    expect(calc.equipment.weapon).toBeNull();
    expect(closeEquipmentSearch).not.toHaveBeenCalled();
    expect(recalculate).not.toHaveBeenCalled();

    calc.monsterDataLoaded = true;
    calc.selectedMonster = null;
    calc.allMonsters = [];
    calc.monsterSearch.value = "zz";
    calc.performMonsterSearch();
    expect(calc.monsterResults.style.display).toBe("none");
  });

  it("covers potion toggles, style fallback text, result highlighting, and dense chart labels", () => {
    const calc = createCalc();
    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);

    calc.renderBoostList();

    const boostItems = Array.from(calc.boostsList.querySelectorAll(".dps-calc__boost-item"));
    const superCombat = boostItems.find((item) => item.textContent?.includes("Super Combat")) as HTMLElement;
    const ranging = boostItems.find((item) => item.textContent?.includes("Ranging")) as HTMLElement;

    expect(superCombat.querySelector("img")).toBeNull();
    expect(ranging.querySelector("img")).toBeTruthy();

    ranging.click();
    expect(calc.selectedPotion).toBe("ranging");
    expect(recalculate).toHaveBeenCalledTimes(1);

    calc.renderBoostList();
    const activeRanging = Array.from(calc.boostsList.querySelectorAll(".dps-calc__boost-item")).find((item) =>
      item.textContent?.includes("Ranging")
    ) as HTMLElement;
    activeRanging.click();
    expect(calc.selectedPotion).toBe("none");

    engineMock.getCombatStyles.mockReturnValueOnce([]);
    calc.updateCombatStyles();
    expect(calc.selectedStyle).toBeNull();

    engineMock.getCombatStyles.mockReturnValueOnce([{ name: "Controlled", type: "", stance: "shared" }]);
    calc.selectedStyle = { name: "Controlled", type: "", stance: "shared" } as never;
    calc.updateCombatStyles();
    expect(calc.styleList.textContent).toContain("None, shared");

    calc.loadouts = [DpsCalc.createDefaultLoadout("A"), DpsCalc.createDefaultLoadout("B")];
    calc.selectedLoadout = 0;
    calc.loadoutResults = [
      { maxHit: 24, dps: 6.2, ttk: 20, accuracy: 72, specExpected: 4, attackSpeed: 4, htk: 8 } as never,
      { maxHit: 18, dps: 4.5, ttk: 24, accuracy: 68, specExpected: 2, attackSpeed: 5, htk: 9 } as never,
    ];

    calc.renderResults();
    expect(calc.resultsBody.querySelectorAll(".dps-calc__rt-value--best").length).toBeGreaterThan(0);
    expect(calc.resultsExtraBody.querySelectorAll(".dps-calc__rt-value--best").length).toBeGreaterThan(0);

    const context = installCanvasContextMock(calc.hitdistCanvas);
    calc.hideMisses = false;
    calc.hitDistribution = Array.from({ length: 12 }, (_value, index) => ({
      name: String(index),
      value: (index + 1) / 120,
    }));
    calc.renderHitDistribution();

    const numericLabels = context.fillText.mock.calls
      .map((call) => String(call[0]))
      .filter((value) => /^\d+$/.test(value));

    expect(numericLabels).toHaveLength(12);
    expect(numericLabels[0]).toBe("0");
    expect(numericLabels.at(-1)).toBe("11");
  });
});