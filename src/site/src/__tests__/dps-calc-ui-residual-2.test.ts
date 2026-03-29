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
      if (id === 444) return createPiece(id, { name: "Abyssal whip", slot: "weapon", category: "whip" });
      if (id === 555) return createPiece(id, { name: "Mystic robe top", slot: "body" });
      if (id === 25865) return createPiece(id, { name: "Bow of faerdhinen", slot: "weapon", isTwoHanded: true });
      return createPiece(id);
    }),
    calculateDps: vi.fn(() => null),
    aggregateEquipmentBonuses: vi.fn(() => ({
      offensive: { stab: 1, slash: 2, crush: 3, magic: 4, ranged: 5 },
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
    superCombat: { name: "Super Combat", calc: () => ({ melee: true }) },
    ranging: { name: "Ranging", calc: () => ({ ranged: true }) },
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

function createCalc(): DpsCalc {
  const calc = markConnected(new DpsCalc());

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
  calc.hitdistHideZeros.type = "checkbox";
  calc.hitdistCanvas = document.createElement("canvas");
  calc.playerSummaryTitle = document.createElement("div");
  calc.playerSummarySubtitle = document.createElement("div");
  calc.playerSummaryLevel = document.createElement("div");

  calc.slayerCheckbox = document.createElement("input");
  calc.slayerCheckbox.type = "checkbox";
  calc.wildernessCheckbox = document.createElement("input");
  calc.wildernessCheckbox.type = "checkbox";
  calc.forinthryCheckbox = document.createElement("input");
  calc.forinthryCheckbox.type = "checkbox";
  calc.kandarinCheckbox = document.createElement("input");
  calc.kandarinCheckbox.type = "checkbox";

  const validBuffInput = document.createElement("input");
  validBuffInput.dataset.buff = "soulreaperStacks";
  validBuffInput.min = "0";
  validBuffInput.max = "5";

  const invalidBuffInput = document.createElement("input");
  invalidBuffInput.min = "0";
  invalidBuffInput.max = "5";

  calc.numberBuffInputs = [validBuffInput, invalidBuffInput];

  const equipmentContainer = document.createElement("div");
  equipmentContainer.className = "dps-calc__equipment";
  const defredBody = document.createElement("div");
  defredBody.className = "dps-calc__defred-body";
  const monsettingsBody = document.createElement("div");
  monsettingsBody.className = "dps-calc__monsettings-body";

  calc.appendChild(equipmentContainer);
  calc.appendChild(defredBody);
  calc.appendChild(monsettingsBody);

  for (const toggle of [calc.attrsToggle, calc.defredToggle, calc.monsettingsToggle, calc.hitdistToggle]) {
    const chevron = document.createElement("span");
    chevron.className = "dps-calc__chevron";
    toggle.appendChild(chevron);
  }

  Object.defineProperty(calc.hitdistCanvas, "clientWidth", { value: 460, configurable: true });

  for (const skill of ["atk", "str", "def", "ranged", "magic", "prayer", "hp"]) {
    const input = document.createElement("input");
    input.className = "dps-calc__stat-input";
    input.dataset.skill = skill;
    calc.appendChild(input);
  }

  for (const slotName of ["weapon", "shield", "body"]) {
    const slot = document.createElement("button");
    slot.className = "dps-calc__equip-slot";
    slot.dataset.slot = slotName;
    calc.appendChild(slot);
  }

  for (const key of ["dwh", "elderMaul", "bogus"]) {
    const input = document.createElement("input");
    input.className = "dps-calc__defred-input";
    input.dataset.defred = key;
    calc.appendChild(input);
  }

  for (const key of ["accursed", "vulnerability", "bogus"]) {
    const checkbox = document.createElement("input");
    checkbox.className = "dps-calc__defred-checkbox";
    checkbox.type = "checkbox";
    checkbox.dataset.defred = key;
    calc.appendChild(checkbox);
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
  calc.appendChild(calc.hitdistBody);
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

describe("dps calc ui residual 2", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.unstubAllGlobals();
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exports state and imports loadouts defensively across empty, invalid, and mixed files", async () => {
    const calc = createCalc();
    vi.spyOn(calc, "renderResults").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderHitDistribution").mockImplementation(() => undefined);

    calc.selectedPrayers = new Set(["piety"]);
    calc.selectedPotion = "superCombat";
    calc.onSlayerTask = true;
    calc.extraBuffs.soulreaperStacks = 2;

    let exportedBlob: Blob | null = null;
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      exportedBlob = blob as Blob;
      return "blob:test";
    });
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    calc.exportLoadouts();

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test");
    expect(exportedBlob).toBeTruthy();

    const exported = JSON.parse(await (exportedBlob as Blob).text()) as Array<Record<string, unknown>>;
    expect(exported[0]?.selectedPotion).toBe("superCombat");
    expect(exported[0]?.onSlayerTask).toBe(true);
    expect(exported[0]?.selectedPrayers).toEqual(["piety"]);

    let nextReaderResult: string | ArrayBuffer | null = null;

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsText(): void {
        this.result = nextReaderResult;
        this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
    }

    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);

    calc.loadoutFileInput = { files: [], value: "picked.json" } as unknown as HTMLInputElement;
    calc.importLoadouts();
    expect(calc.loadoutFileInput.value).toBe("");
    expect(calc.loadouts).toHaveLength(1);

    const fakeFile = new File(["ignored"], "dps-loadouts.json", { type: "application/json" });
    calc.loadoutFileInput = { files: [fakeFile], value: "picked.json" } as unknown as HTMLInputElement;
    nextReaderResult = new ArrayBuffer(8);
    calc.importLoadouts();
    expect(calc.loadoutFileInput.value).toBe("");
    expect(calc.loadouts).toHaveLength(1);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    calc.loadoutFileInput = { files: [fakeFile], value: "broken.json" } as unknown as HTMLInputElement;
    nextReaderResult = "{not valid json";
    calc.importLoadouts();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(calc.loadouts).toHaveLength(1);

    calc.loadoutFileInput = { files: [fakeFile], value: "valid.json" } as unknown as HTMLInputElement;
    nextReaderResult = JSON.stringify([
      null,
      { foo: "bar" },
      {
        name: "Imported Loadout Name That Is Longer Than Thirty Characters",
        equipment: { weapon: 444, body: 555, ignored: 999 },
        skills: { atk: 0, str: 120, hp: 150, prayer: 70 },
        selectedStyle: { name: "Slash", type: "slash", stance: "aggressive" },
        selectedPrayers: ["rigour", 123],
        selectedPotion: "mysteryPotion",
        onSlayerTask: true,
        extraBuffs: { soulreaperStacks: 4, chinchompaDistance: 7 },
      },
    ]);
    calc.importLoadouts();

    expect(calc.loadoutFileInput.value).toBe("");
    expect(calc.loadouts).toHaveLength(2);
    expect(calc.selectedLoadout).toBe(1);

    const importedLoadout = calc.loadouts[1];
    expect(importedLoadout?.name).toBe("Imported Loadout Name That Is ");
    expect(importedLoadout?.skills.atk).toBe(1);
    expect(importedLoadout?.skills.str).toBe(99);
    expect(importedLoadout?.skills.hp).toBe(99);
    expect(importedLoadout?.skills.prayer).toBe(70);
    expect((importedLoadout?.equipment.weapon as { id?: number } | null)?.id).toBe(444);
    expect((importedLoadout?.equipment.body as { id?: number } | null)?.id).toBe(555);
    expect(importedLoadout?.selectedPrayers.has("rigour")).toBe(true);
    expect(importedLoadout?.selectedPrayers.has("123")).toBe(false);
    expect(importedLoadout?.selectedPotion).toBe("mysteryPotion");
    expect(importedLoadout?.onSlayerTask).toBe(true);
    expect(importedLoadout?.extraBuffs.soulreaperStacks).toBe(4);
    expect(importedLoadout?.extraBuffs.chinchompaDistance).toBe(7);

    calc.selectedMonster = { name: "Goblin", skills: { hp: 12, def: 4 }, inputs: {} } as never;
    engineMock.calculateDps.mockClear();
    engineMock.calculateDps.mockReturnValueOnce({
      maxHit: 10,
      dps: 2.5,
      ttk: 12,
      accuracy: 70,
      specExpected: 3,
      attackSpeed: 4,
      htk: 4,
      hitDist: [
        { name: "0", value: 0.4 },
        { name: "8", value: 0.6 },
      ],
    });

    calc.recalculate();

    expect(engineMock.calculateDps).toHaveBeenCalledTimes(1);
    expect(engineMock.calculateDps.mock.calls[0]?.[0]?.boosts).toEqual({});
    expect(calc.hitDistribution).toEqual([
      { name: "0", value: 0.4 },
      { name: "8", value: 0.6 },
    ]);

    engineMock.calculateDps.mockReturnValueOnce({
      maxHit: 8,
      dps: 2.2,
      ttk: 10,
      accuracy: 65,
      specExpected: 2,
      attackSpeed: 4,
      htk: 5,
    });

    calc.recalculate();
    expect(calc.hitDistribution).toEqual([]);
  });

  it("keeps member selection and summary state synchronized while skipping shared entries", () => {
    const calc = createCalc();
    calc.setupEventListeners();

    pubsubMock.getMostRecent.mockReturnValueOnce([[{ name: "@SHARED" }, { name: "alice" }, { name: "bob" }]]);
    calc.populateMemberSelect();

    expect(Array.from(calc.memberSelect.options).map((option) => option.value)).toEqual(["alice", "bob"]);
    expect(calc.memberSelect.value).toBe("alice");
    expect(calc.playerSummaryTitle.textContent).toBe("alice");

    calc.memberSelect.selectedIndex = 1;
    expect(calc.memberSelect.value).toBe("bob");
    calc.memberSelect.dispatchEvent(new Event("change"));
    expect(calc.playerSummaryTitle.textContent).toBe("bob");

    calc.memberSelect.value = "";
    calc.updatePlayerSummary();
    expect(calc.playerSummaryTitle.textContent).toBe("Manual Loadout");
    expect(calc.playerSummarySubtitle.textContent).toBe("");
    expect(calc.playerSummaryLevel.textContent).toContain("Lvl ");
  });

  it("handles prayer conflicts plus potion and buff toggles including ignored numeric inputs", () => {
    const calc = createCalc();
    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    calc.setupEventListeners();

    calc.selectedPrayers.add("piety");
    calc.renderPrayerGrid();
    const prayerItems = calc.prayerGrid.querySelectorAll(".dps-calc__prayer-item");

    (prayerItems[1] as HTMLElement).click();
    expect(calc.selectedPrayers.has("rigour")).toBe(true);
    expect(calc.selectedPrayers.has("piety")).toBe(false);

    (prayerItems[1] as HTMLElement).click();
    expect(calc.selectedPrayers.has("rigour")).toBe(false);

    calc.renderBoostList();
    const boostItems = calc.boostsList.querySelectorAll(".dps-calc__boost-item");

    (boostItems[0] as HTMLElement).click();
    expect(calc.selectedPotion).toBe("superCombat");

    (boostItems[0] as HTMLElement).click();
    expect(calc.selectedPotion).toBe("none");

    calc.slayerCheckbox.checked = true;
    calc.slayerCheckbox.dispatchEvent(new Event("change"));
    calc.wildernessCheckbox.checked = true;
    calc.wildernessCheckbox.dispatchEvent(new Event("change"));
    calc.forinthryCheckbox.checked = true;
    calc.forinthryCheckbox.dispatchEvent(new Event("change"));
    calc.kandarinCheckbox.checked = true;
    calc.kandarinCheckbox.dispatchEvent(new Event("change"));

    expect(calc.onSlayerTask).toBe(true);
    expect(calc.extraBuffs.inWilderness).toBe(true);
    expect(calc.extraBuffs.forinthrySurge).toBe(true);
    expect(calc.extraBuffs.kandarinDiary).toBe(true);

    calc.numberBuffInputs[0].value = "999";
    calc.numberBuffInputs[0].dispatchEvent(new Event("input"));
    expect(calc.extraBuffs.soulreaperStacks).toBe(5);

    const recalcCallsBeforeInvalidInput = recalculate.mock.calls.length;
    calc.numberBuffInputs[1].value = "3";
    calc.numberBuffInputs[1].dispatchEvent(new Event("input"));
    expect(recalculate).toHaveBeenCalledTimes(recalcCallsBeforeInvalidInput);
  });

  it("covers equipment and monster search fallback flows including removal and clear actions", () => {
    const calc = createCalc();
    vi.spyOn(calc, "updateEquipmentDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateCombatStyles").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateBonusDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderResults").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderHitDistribution").mockImplementation(() => undefined);

    calc.searchSlot = "weapon";
    calc.equipment.weapon = { id: 444, name: "Abyssal whip", slot: "weapon" } as never;
    calc.equipSearchInput.value = "w";
    calc.performEquipSearch();

    const removeItem = calc.equipSearchResults.querySelector(".dps-calc__equip-search-item") as HTMLElement;
    expect(removeItem.textContent).toBe("Remove item");
    removeItem.click();
    expect(calc.equipment.weapon).toBeNull();
    expect(calc.searchSlot).toBeNull();
    expect(calc.equipSearch.style.display).toBe("none");
    expect(calc.equipSearchInline.value).toBe("");

    calc.equipmentDataLoaded = true;
    calc.searchSlot = null;
    calc.allEquipment = [{ id: 555, name: "Mystic robe top", slot: "body", isTwoHanded: false }] as never;
    calc.equipSearchInput.value = "myst";
    calc.performEquipSearch();

    const equipMatch = calc.equipSearchResults.querySelector(".dps-calc__equip-search-item") as HTMLElement;
    equipMatch.click();
    expect((calc.equipment.body as { id?: number } | null)?.id).toBe(555);

    calc.selectedMonster = { name: "Goblin", skills: { hp: 7, def: 1 }, inputs: { monsterCurrentHp: 7 } } as never;
    calc.monsterSearch.value = "g";
    calc.performMonsterSearch();
    expect(calc.monsterResults.style.display).toBe("block");

    const clearMonster = calc.monsterResults.querySelector(".dps-calc__monster-result-item") as HTMLElement;
    expect(clearMonster.textContent).toBe("Clear monster");
    clearMonster.click();
    expect(calc.selectedMonster).toBeNull();
    expect(calc.monsterInfo.style.display).toBe("none");

    calc.monsterDataLoaded = true;
    calc.allMonsters = [{ name: "Goblin", skills: { hp: 6, def: 2 } }] as never;
    calc.monsterSearch.value = "zz";
    calc.performMonsterSearch();
    expect(calc.monsterResults.style.display).toBe("none");
    expect(calc.monsterResults.children).toHaveLength(0);
  });

  it("parses defence reductions and renders result and hit-distribution edge cases", () => {
    const calc = createCalc();
    const context = installCanvasContextMock(calc.hitdistCanvas);
    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    calc.setupEventListeners();

    const dwhInput = getDefredInput(calc, "dwh");
    dwhInput.value = "-7";
    dwhInput.dispatchEvent(new Event("input"));
    expect(calc.defenceReductions.dwh).toBe(0);

    const elderMaulInput = getDefredInput(calc, "elderMaul");
    elderMaulInput.value = "not-a-number";
    elderMaulInput.dispatchEvent(new Event("input"));
    expect(calc.defenceReductions.elderMaul).toBe(0);

    const callsBeforeBogusInput = recalculate.mock.calls.length;
    const bogusInput = getDefredInput(calc, "bogus");
    bogusInput.value = "9";
    bogusInput.dispatchEvent(new Event("input"));
    expect(recalculate).toHaveBeenCalledTimes(callsBeforeBogusInput);

    const accursedCheckbox = getDefredCheckbox(calc, "accursed");
    const vulnerabilityCheckbox = getDefredCheckbox(calc, "vulnerability");
    vulnerabilityCheckbox.checked = true;
    vulnerabilityCheckbox.dispatchEvent(new Event("change"));
    expect(calc.defenceReductions.vulnerability).toBe(true);
    expect(calc.defenceReductions.accursed).toBe(false);
    expect(accursedCheckbox.checked).toBe(false);

    accursedCheckbox.checked = true;
    accursedCheckbox.dispatchEvent(new Event("change"));
    expect(calc.defenceReductions.accursed).toBe(true);
    expect(calc.defenceReductions.vulnerability).toBe(false);
    expect(vulnerabilityCheckbox.checked).toBe(false);

    const callsBeforeBogusCheckbox = recalculate.mock.calls.length;
    const bogusCheckbox = getDefredCheckbox(calc, "bogus");
    bogusCheckbox.checked = true;
    bogusCheckbox.dispatchEvent(new Event("change"));
    expect(recalculate).toHaveBeenCalledTimes(callsBeforeBogusCheckbox);

    calc.loadouts = [DpsCalc.createDefaultLoadout("Solo")];
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
    expect(calc.resultsBody.querySelectorAll("th.dps-calc__rt-header")).toHaveLength(0);
    expect(Array.from(calc.resultsBody.querySelectorAll("td.dps-calc__rt-value")).some((cell) => cell.textContent === "-")).toBe(true);

    calc.loadouts = [DpsCalc.createDefaultLoadout("A"), DpsCalc.createDefaultLoadout("B")];
    calc.loadoutResults = [{ maxHit: 22, dps: 5.1, ttk: 18, accuracy: 65, specExpected: 3, attackSpeed: 4, htk: 6 } as never, null];
    calc.renderResults();
    expect(calc.resultsBody.querySelectorAll("th.dps-calc__rt-header")).toHaveLength(2);
    expect(calc.resultsBody.querySelector(".dps-calc__rt-value--best")).toBeNull();

    calc.hideMisses = true;
    calc.hitDistribution = [{ name: "0", value: 1 }];
    calc.renderHitDistribution();
    expect(
      context.fillText.mock.calls.some((call) => String(call[0]).includes("Select a monster and combat style to view hit distribution"))
    ).toBe(true);

    context.fillText.mockClear();
    context.fillRect.mockClear();
    calc.hideMisses = false;
    calc.hitDistribution = [
      { name: "0", value: 0.25 },
      { name: "12", value: 0.75 },
    ];
    calc.renderHitDistribution();

    expect(context.fillRect).toHaveBeenCalled();
    expect(context.fillText.mock.calls.some((call) => String(call[0]) === "0")).toBe(true);
    expect(context.fillText.mock.calls.some((call) => String(call[0]) === "hitsplat")).toBe(true);
  });
});