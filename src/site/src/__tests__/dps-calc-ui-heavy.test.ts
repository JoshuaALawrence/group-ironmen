import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const pubsubMock = vi.hoisted(() => ({
  getMostRecent: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

const engineMock = vi.hoisted(() => ({
  loadEquipmentData: vi.fn(async () => [{ id: 1, name: "Bronze sword" }]),
  loadMonsterData: vi.fn(async () => [{ name: "Goblin", image: "goblin.webp", skills: { hp: 10, def: 1 } }]),
  getEquipmentById: vi.fn((id: number) => ({ id, name: `item-${id}`, isTwoHanded: id === 25865 })),
  calculateDps: vi.fn(() => null),
  aggregateEquipmentBonuses: vi.fn(() => ({
    offensive: { stab: 1, slash: 2, crush: 3, magic: 4, ranged: 5 },
    defensive: { stab: 6, slash: 7, crush: 8, magic: 9, ranged: 10 },
    bonuses: { str: 11, ranged_str: 12, magic_str: 13, prayer: 14 },
  })),
  getCombatStyles: vi.fn(() => [{ name: "Slash", type: "slash", stance: "aggressive" }]),
  getConflictingPrayers: vi.fn((key: string) => (key === "rigour" ? new Set<string>(["piety"]) : new Set<string>())),
}));

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
  PRAYERS: { piety: { name: "Piety" }, rigour: { name: "Rigour" } },
  getConflictingPrayers: engineMock.getConflictingPrayers,
  POTIONS: {
    none: { name: "None", calc: () => ({}) },
    superCombat: { name: "Super Combat", calc: () => ({}) },
    ranging: { name: "Ranging", calc: () => ({}) },
  },
}));

import { DpsCalc } from "../dps-calc/dps-calc";

function setupCalc(): DpsCalc {
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

  calc.resultsExtraBody = document.createElement("div");
  calc.hitdistBody = document.createElement("div");
  calc.monsterInfo = document.createElement("div");

  const defredBody = document.createElement("div");
  defredBody.className = "dps-calc__defred-body";
  calc.appendChild(defredBody);
  const monSettings = document.createElement("div");
  monSettings.className = "dps-calc__monsettings-body";
  calc.appendChild(monSettings);

  calc.playerSummaryTitle = document.createElement("div");
  calc.playerSummarySubtitle = document.createElement("div");
  calc.playerSummaryLevel = document.createElement("div");

  calc.styleList = document.createElement("div");
  calc.prayerGrid = document.createElement("div");
  calc.boostsList = document.createElement("div");

  calc.monsterNameDisplay = document.createElement("div");
  calc.monsterWeakness = document.createElement("div");
  calc.monsterSearch = document.createElement("input");
  calc.monsterResults = document.createElement("div");
  calc.monsterHpInput = document.createElement("input");
  calc.monsterAttrs = document.createElement("div");
  calc.monsterAttrList = document.createElement("div");

  calc.loadoutTabs = document.createElement("div");
  calc.equipSearchInline = document.createElement("input");
  calc.equipSearch = document.createElement("div");
  calc.equipSearchInput = document.createElement("input");
  calc.equipSearchResults = document.createElement("div");
  calc.equipSearchClose = document.createElement("button");

  calc.loadoutAddBtn = document.createElement("button");
  calc.loadoutExportBtn = document.createElement("button");
  calc.loadoutImportBtn = document.createElement("button");
  calc.loadoutFileInput = document.createElement("input");
  calc.loadoutClearBtn = document.createElement("button");

  calc.attrsToggle = document.createElement("button");
  calc.defredToggle = document.createElement("button");
  calc.monsettingsToggle = document.createElement("button");
  calc.showMoreBtn = document.createElement("button");
  calc.hitdistToggle = document.createElement("button");
  calc.hitdistHideZeros = document.createElement("input");

  const hitChevron = document.createElement("span");
  hitChevron.className = "dps-calc__chevron";
  calc.hitdistToggle.appendChild(hitChevron);

  const attrsChevron = document.createElement("span");
  attrsChevron.className = "dps-calc__chevron";
  calc.attrsToggle.appendChild(attrsChevron);

  const defredChevron = document.createElement("span");
  defredChevron.className = "dps-calc__chevron";
  calc.defredToggle.appendChild(defredChevron);

  const monsettingsChevron = document.createElement("span");
  monsettingsChevron.className = "dps-calc__chevron";
  calc.monsettingsToggle.appendChild(monsettingsChevron);

  calc.hitdistCanvas = document.createElement("canvas");
  Object.defineProperty(calc.hitdistCanvas, "clientWidth", { value: 460, configurable: true });

  calc.slayerCheckbox = document.createElement("input");
  calc.wildernessCheckbox = document.createElement("input");
  calc.forinthryCheckbox = document.createElement("input");
  calc.kandarinCheckbox = document.createElement("input");
  calc.numberBuffInputs = [document.createElement("input")];
  calc.numberBuffInputs[0].dataset.buff = "soulreaperStacks";
  calc.numberBuffInputs[0].min = "0";
  calc.numberBuffInputs[0].max = "5";

  calc.presetSelect = document.createElement("select");

  const statInput = document.createElement("input");
  statInput.className = "dps-calc__stat-input";
  statInput.dataset.skill = "atk";
  calc.appendChild(statInput);

  const slot = document.createElement("button");
  slot.className = "dps-calc__equip-slot";
  slot.dataset.slot = "weapon";
  calc.appendChild(slot);

  const shieldSlot = document.createElement("button");
  shieldSlot.className = "dps-calc__equip-slot";
  shieldSlot.dataset.slot = "shield";
  calc.appendChild(shieldSlot);

  const defredInput = document.createElement("input");
  defredInput.className = "dps-calc__defred-input";
  defredInput.dataset.defred = "dwh";
  calc.appendChild(defredInput);

  const accursedCb = document.createElement("input");
  accursedCb.className = "dps-calc__defred-checkbox";
  accursedCb.dataset.defred = "accursed";
  calc.appendChild(accursedCb);

  const vulnCb = document.createElement("input");
  vulnCb.className = "dps-calc__defred-checkbox";
  vulnCb.dataset.defred = "vulnerability";
  calc.appendChild(vulnCb);

  const mstatKeys = [
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
  ];

  for (const key of mstatKeys) {
    const stat = document.createElement("span");
    stat.dataset.mstat = key;
    calc.appendChild(stat);
  }

  const bonusKeys = [
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
  ];

  for (const key of bonusKeys) {
    const bonus = document.createElement("span");
    bonus.dataset.bonus = key;
    calc.appendChild(bonus);
  }

  calc.appendChild(calc.monsterWeakness);
  calc.appendChild(calc.monsterAttrList);
  calc.appendChild(calc.equipSearch);
  calc.appendChild(calc.equipSearchResults);
  calc.appendChild(calc.equipSearchInline);
  calc.appendChild(calc.equipSearchInput);
  calc.appendChild(calc.resultsBody = document.createElement("div"));
  calc.appendChild(calc.hitdistCanvas);

  return calc;
}

function installCanvasContextMock(canvas: HTMLCanvasElement) {
  const ctx = {
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

  vi.spyOn(canvas, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return ctx;
}

describe("dps calc ui heavy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("applies presets and loads member equipment", () => {
    const calc = setupCalc();
    calc.monsterDataLoaded = true;
    calc.allMonsters = [{ name: "Goblin", image: "goblin.webp", skills: { hp: 10 } }] as never;

    vi.spyOn(calc, "renderLoadoutTabs").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateEquipmentDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateCombatStyles").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateBonusDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "updatePlayerSummary").mockImplementation(() => undefined);
    vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    const selectMonster = vi.spyOn(calc, "selectMonster").mockImplementation(() => undefined);

    calc.applyPreset("bowfa");
    expect(calc.equipment.weapon?.id).toBe(25865);
    expect(calc.equipment.shield).toBeNull();

    pubsubMock.getMostRecent.mockImplementation((key: string) => {
      if (key === "equipment:alice") {
        return [[{ id: 1234, isValid: () => true }]];
      }
      if (key === "skills:alice") {
        return [[{ Attack: { level: 70 }, Strength: { level: 80 }, Defence: { level: 60 } }]];
      }
      if (key === "interacting:alice") {
        return [{ name: "Goblin" }];
      }
      return null;
    });

    calc.loadMemberEquipment();
    expect(calc.loadouts[0]?.name).toBe("alice");
    expect(selectMonster).toHaveBeenCalled();
  });

  it("handles summary, tabs, loading and monster presentation", async () => {
    const calc = setupCalc();

    vi.spyOn(calc, "renderLoadoutTabs").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderPrayerGrid").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderBoostList").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateCombatStyles").mockImplementation(() => undefined);
    vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    vi.spyOn(calc, "restoreFromStorage").mockImplementation(() => undefined);

    calc.populateInitialUi();
    calc.populateMemberSelectFromData([{ name: "@SHARED" }, { name: "alice" }]);
    expect(calc.memberSelect.options.length).toBe(1);

    const lvl = calc.calculateCombatLevel();
    expect(lvl).toBeGreaterThan(3);
    calc.updatePlayerSummary();
    expect(calc.playerSummaryTitle.textContent).toBe("alice");

    calc.setActiveTab("combat");
    expect(calc.activeTab).toBe("combat");

    const skillInput = document.createElement("input");
    skillInput.dataset.skill = "atk";
    calc.updateSkillValue(skillInput, "120");
    expect(calc.skills.atk).toBe(99);

    await calc.loadData();
    expect(calc.equipmentDataLoaded).toBe(true);
    expect(calc.monsterDataLoaded).toBe(true);

    const monster = { name: "Goblin", version: "Lvl 2", image: "goblin.webp", skills: { hp: 10 } } as never;
    expect(calc.getMonsterDisplayName(monster)).toContain("Goblin");
    expect(calc.getMonsterImageSources(monster).length).toBeGreaterThan(1);

    const img = calc.createMonsterImage(monster, "icon");
    expect(img.className).toBe("icon");
    img.dispatchEvent(new Event("error"));

    calc.renderSelectedMonster(monster);
    expect(calc.monsterNameDisplay.textContent).toContain("Goblin");

    const button = document.createElement("button");
    const chevron = document.createElement("span");
    chevron.className = "dps-calc__chevron";
    button.appendChild(chevron);
    const body = document.createElement("div");
    body.style.display = "block";
    calc.toggleCollapsible(button, body);
    expect(body.style.display).toBe("none");

    calc.syncInlineSearchToOverlay();
    calc.syncOverlaySearchToInline();
  });

  it("handles equipment and monster search flows with rendering", () => {
    const calc = setupCalc();
    installCanvasContextMock(calc.hitdistCanvas);

    calc.equipmentDataLoaded = true;
    calc.searchSlot = "weapon";
    calc.allEquipment = [
      { id: 100, name: "Dragon sword", slot: "weapon", isTwoHanded: false },
      { id: 25865, name: "Bow of faerdhinen", slot: "weapon", isTwoHanded: true },
      { id: 101, name: "Rune platebody", slot: "body", isTwoHanded: false },
    ] as never;

    calc.equipment.weapon = { id: 100, name: "Dragon sword", slot: "weapon" } as never;
    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateCombatStyles").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateBonusDisplay").mockImplementation(() => undefined);

    calc.equipSearchInput.value = "dr";
    calc.performEquipSearch();
    const removeItem = calc.equipSearchResults.querySelector(".dps-calc__equip-search-item") as HTMLElement;
    removeItem.click();
    expect(calc.equipment.weapon).toBeNull();

    calc.searchSlot = "weapon";
    calc.equipSearchInput.value = "bow";
    calc.performEquipSearch();
    const searchItems = calc.equipSearchResults.querySelectorAll(".dps-calc__equip-search-item");
    const bowItem = searchItems[1] as HTMLElement;
    bowItem.click();
    expect(calc.equipment.weapon?.id).toBe(25865);
    expect(calc.equipment.shield).toBeNull();
    expect(recalculate).toHaveBeenCalled();

    calc.monsterDataLoaded = true;
    calc.allMonsters = [
      {
        name: "Goblin",
        version: "Lvl 2",
        image: "goblin.webp",
        skills: { hp: 10, def: 3, atk: 1, str: 1, magic: 1, ranged: 1 },
        defensive: { stab: 2, slash: 2, crush: 2, magic: 2, light: 2, standard: 2, heavy: 2 },
        offensive: { atk: 1, str: 1, magic: 1, magic_str: 1, ranged: 1, ranged_str: 1 },
        elementalWeaknessType: "water",
        elementalWeaknessPercent: 20,
        attributes: ["undead", "goblin"],
      },
    ] as never;

    calc.monsterSearch.value = "go";
    calc.performMonsterSearch();
    const monsterItem = calc.monsterResults.querySelector(".dps-calc__monster-result-item") as HTMLElement;
    monsterItem.click();
    expect(calc.selectedMonster?.name).toBe("Goblin");
    expect(calc.monsterWeakness.textContent).toContain("Weak to water");
    expect(calc.monsterAttrList.children.length).toBe(2);

    calc.monsterSearch.value = "";
    calc.clearMonster();
    expect(calc.selectedMonster).toBeNull();
    expect(calc.monsterInfo.style.display).toBe("none");
  });

  it("renders prayers, boosts, combat styles, results and hit distribution", () => {
    const calc = setupCalc();
    const ctx = installCanvasContextMock(calc.hitdistCanvas);

    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    engineMock.getCombatStyles.mockReturnValueOnce([]).mockReturnValue([
      { name: "Stab", type: "stab", stance: "accurate" },
      { name: "Slash", type: "slash", stance: "aggressive" },
    ]);

    calc.updateCombatStyles();
    expect(calc.selectedStyle).toBeNull();
    calc.updateCombatStyles();
    expect(calc.styleList.querySelectorAll(".dps-calc__style-item").length).toBe(2);

    calc.selectedPrayers.add("piety");
    calc.renderPrayerGrid();
    const prayerItems = calc.prayerGrid.querySelectorAll(".dps-calc__prayer-item");
    (prayerItems[1] as HTMLElement).click();
    expect(calc.selectedPrayers.has("rigour")).toBe(true);
    expect(calc.selectedPrayers.has("piety")).toBe(false);

    calc.renderBoostList();
    const boostItems = calc.boostsList.querySelectorAll(".dps-calc__boost-item");
    (boostItems[0] as HTMLElement).click();
    expect(calc.selectedPotion).toBe("superCombat");
    (boostItems[0] as HTMLElement).click();
    expect(calc.selectedPotion).toBe("none");

    calc.equipment.weapon = { id: 1333, speed: 4, slot: "weapon", name: "Sword" } as never;
    calc.updateBonusDisplay();
    expect(calc.querySelector('[data-bonus="off-stab"]')?.textContent).toBe("+1");
    expect(calc.querySelector('[data-bonus="speed"]')?.textContent).toBe("4");

    calc.loadouts = [DpsCalc.createDefaultLoadout("A"), DpsCalc.createDefaultLoadout("B")];
    calc.selectedLoadout = 1;
    calc.loadoutResults = [
      { maxHit: 30, dps: 7.111, ttk: 20.1, accuracy: 70.11, specExpected: 10.5, attackSpeed: 4, htk: 10 } as never,
      { maxHit: 32, dps: 8.222, ttk: 18.1, accuracy: 71.11, specExpected: 12.5, attackSpeed: 5, htk: 9 } as never,
    ];
    calc.renderResults();
    expect(calc.resultsBody.querySelectorAll("th.dps-calc__rt-header").length).toBe(2);
    expect(calc.resultsBody.querySelector(".dps-calc__rt-value--best")).toBeTruthy();

    calc.hitDistribution = [];
    calc.renderHitDistribution();
    expect(ctx.fillText).toHaveBeenCalled();

    calc.hideMisses = true;
    calc.hitDistribution = [
      { name: "0", value: 0.1 },
      { name: "5", value: 0.2 },
      { name: "10", value: 0.3 },
    ];
    calc.renderHitDistribution();
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(recalculate).toHaveBeenCalled();
  });

  it("binds event listeners and handles interaction paths", () => {
    const calc = setupCalc();
    installCanvasContextMock(calc.hitdistCanvas);

    vi.spyOn(calc, "eventListener").mockImplementation((subject, eventName, handler, options = {}) => {
      subject.addEventListener(eventName, handler as EventListener, options);
    });
    vi.spyOn(calc, "subscribe").mockImplementation((_name, handler) => {
      handler([{ name: "@SHARED" }, { name: "alice" }]);
    });

    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    vi.spyOn(calc, "addLoadout").mockImplementation(() => undefined);
    vi.spyOn(calc, "exportLoadouts").mockImplementation(() => undefined);
    vi.spyOn(calc, "importLoadouts").mockImplementation(() => undefined);
    vi.spyOn(calc, "resetAll").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateEquipmentDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateCombatStyles").mockImplementation(() => undefined);
    vi.spyOn(calc, "updateBonusDisplay").mockImplementation(() => undefined);
    vi.spyOn(calc, "performEquipSearch").mockImplementation(() => undefined);
    vi.spyOn(calc, "performMonsterSearch").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderHitDistribution").mockImplementation(() => undefined);
    vi.spyOn(calc, "openEquipmentSearch").mockImplementation(() => undefined);
    vi.spyOn(calc, "closeEquipmentSearch").mockImplementation(() => undefined);
    vi.spyOn(calc, "toggleCollapsible").mockImplementation(() => undefined);

    calc.equipment.weapon = { id: 1, name: "Bronze sword", slot: "weapon" } as never;
    calc.selectedMonster = { name: "Goblin", skills: { hp: 10 }, inputs: {} } as never;

    calc.setupEventListeners();

    calc.memberSelect.dispatchEvent(new Event("change"));
    calc.tabButtons[0].dispatchEvent(new Event("click"));
    calc.querySelector<HTMLInputElement>(".dps-calc__stat-input")?.dispatchEvent(new Event("input", { bubbles: true }));
    calc.querySelector<HTMLElement>('.dps-calc__equip-slot[data-slot="weapon"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );

    calc.loadoutAddBtn.dispatchEvent(new Event("click"));
    calc.loadoutExportBtn.dispatchEvent(new Event("click"));
    calc.loadoutImportBtn.dispatchEvent(new Event("click"));
    calc.loadoutFileInput.dispatchEvent(new Event("change"));
    calc.loadoutClearBtn.dispatchEvent(new Event("click"));

    calc.presetSelect.value = "bowfa";
    calc.presetSelect.dispatchEvent(new Event("change"));

    calc.equipSearchInline.dispatchEvent(new Event("focus"));
    calc.equipSearchInline.dispatchEvent(new Event("input"));
    calc.equipSearchInput.dispatchEvent(new Event("input"));
    vi.runAllTimers();

    calc.equipSearchClose.dispatchEvent(new Event("click"));
    calc.slayerCheckbox.checked = true;
    calc.slayerCheckbox.dispatchEvent(new Event("change"));
    calc.wildernessCheckbox.checked = true;
    calc.wildernessCheckbox.dispatchEvent(new Event("change"));
    calc.forinthryCheckbox.checked = true;
    calc.forinthryCheckbox.dispatchEvent(new Event("change"));
    calc.kandarinCheckbox.checked = true;
    calc.kandarinCheckbox.dispatchEvent(new Event("change"));

    calc.numberBuffInputs[0].value = "99";
    calc.numberBuffInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    expect(calc.extraBuffs.soulreaperStacks).toBe(5);

    calc.monsterSearch.dispatchEvent(new Event("input"));
    calc.monsterSearch.dispatchEvent(new Event("focus"));
    vi.runAllTimers();

    calc.selectedMonster = { name: "Goblin", skills: { hp: 10 }, inputs: {} } as never;
    calc.monsterHpInput.value = "999";
    calc.monsterHpInput.dispatchEvent(new Event("input"));
    expect(calc.monsterHpInput.value).toBe("10");

    calc.attrsToggle.dispatchEvent(new Event("click"));
    calc.defredToggle.dispatchEvent(new Event("click"));
    calc.monsettingsToggle.dispatchEvent(new Event("click"));

    const defredInput = calc.querySelector<HTMLInputElement>('.dps-calc__defred-input[data-defred="dwh"]');
    if (defredInput) {
      defredInput.value = "3";
      defredInput.dispatchEvent(new Event("input"));
    }

    const accursedCb = calc.querySelector<HTMLInputElement>('.dps-calc__defred-checkbox[data-defred="accursed"]');
    const vulnCb = calc.querySelector<HTMLInputElement>('.dps-calc__defred-checkbox[data-defred="vulnerability"]');
    if (accursedCb && vulnCb) {
      vulnCb.checked = true;
      vulnCb.dispatchEvent(new Event("change"));
      accursedCb.checked = true;
      accursedCb.dispatchEvent(new Event("change"));
      expect(vulnCb.checked).toBe(false);
    }

    calc.showMoreBtn.dispatchEvent(new Event("click"));
    calc.showMoreBtn.dispatchEvent(new Event("click"));
    calc.hitdistToggle.dispatchEvent(new Event("click"));
    calc.hitdistHideZeros.checked = false;
    calc.hitdistHideZeros.dispatchEvent(new Event("change"));

    document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(recalculate).toHaveBeenCalled();

  });
});
