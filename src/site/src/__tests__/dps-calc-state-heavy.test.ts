import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../dps-calc/dps-calc-engine", () => ({
  loadEquipmentData: vi.fn(async () => []),
  loadMonsterData: vi.fn(async () => []),
  getEquipmentById: vi.fn((id: number) => ({ id, name: `item-${id}` })),
  calculateDps: vi.fn(() => ({
    maxHit: 10,
    hitChance: 0.5,
    dps: 5,
    avgHit: 4,
    accuracy: 0.8,
    ttk: 20,
    dpsWithPoison: 5,
    dpsWithoutPoison: 5,
    histogram: [],
  })),
  aggregateEquipmentBonuses: vi.fn(() => ({ atk_stab: 0, str: 0 })),
  getCombatStyles: vi.fn(() => []),
  PRAYERS: {
    piety: { name: "Piety" },
  },
  getConflictingPrayers: vi.fn(() => new Set<string>()),
  POTIONS: {
    none: { name: "None" },
    superCombat: { name: "Super Combat" },
  },
}));

import { DpsCalc } from "../dps-calc/dps-calc";

function createCalc(): DpsCalc {
  const calc = new DpsCalc();

  calc.slayerCheckbox = document.createElement("input");
  calc.wildernessCheckbox = document.createElement("input");
  calc.forinthryCheckbox = document.createElement("input");
  calc.kandarinCheckbox = document.createElement("input");

  calc.numberBuffInputs = [document.createElement("input")];
  calc.numberBuffInputs[0].dataset.buff = "soulreaperStacks";

  calc.loadoutTabs = document.createElement("div");
  calc.memberSelect = document.createElement("select");
  calc.playerSummaryTitle = document.createElement("div");
  calc.playerSummarySubtitle = document.createElement("div");
  calc.playerSummaryLevel = document.createElement("div");

  calc.monsterSearch = document.createElement("input");
  calc.monsterInfo = document.createElement("div");
  calc.monsterResults = document.createElement("div");
  calc.monsterHpInput = document.createElement("input");
  calc.presetSelect = document.createElement("select");
  calc.hitdistHideZeros = document.createElement("input");
  calc.resultsBody = document.createElement("div");
  calc.resultsExtraBody = document.createElement("div");

  const statInput = document.createElement("input");
  statInput.className = "dps-calc__stat-input";
  statInput.dataset.skill = "atk";
  calc.appendChild(statInput);

  const defredInput = document.createElement("input");
  defredInput.className = "dps-calc__defred-input";
  defredInput.dataset.defred = "dwh";
  calc.appendChild(defredInput);

  const defredCb = document.createElement("input");
  defredCb.className = "dps-calc__defred-checkbox";
  defredCb.dataset.defred = "accursed";
  calc.appendChild(defredCb);

  const defredBody = document.createElement("div");
  defredBody.className = "dps-calc__defred-body";
  calc.appendChild(defredBody);

  const monSettingsBody = document.createElement("div");
  monSettingsBody.className = "dps-calc__monsettings-body";
  calc.appendChild(monSettingsBody);

  return calc;
}

describe("dps calc state heavy", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("manages loadouts and tab lifecycle", () => {
    const calc = createCalc();

    const updateEquipmentDisplay = vi.spyOn(calc, "updateEquipmentDisplay").mockImplementation(() => undefined);
    const updateCombatStyles = vi.spyOn(calc, "updateCombatStyles").mockImplementation(() => undefined);
    const updateBonusDisplay = vi.spyOn(calc, "updateBonusDisplay").mockImplementation(() => undefined);
    const renderPrayerGrid = vi.spyOn(calc, "renderPrayerGrid").mockImplementation(() => undefined);
    const renderBoostList = vi.spyOn(calc, "renderBoostList").mockImplementation(() => undefined);
    const updatePlayerSummary = vi.spyOn(calc, "updatePlayerSummary").mockImplementation(() => undefined);
    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);
    const renderResults = vi.spyOn(calc, "renderResults").mockImplementation(() => undefined);

    calc.skills.atk = 90;
    calc.saveCurrentLoadout();

    calc.addLoadout();
    expect(calc.loadouts.length).toBe(2);
    expect(recalculate).toHaveBeenCalled();

    calc.switchLoadout(0);
    expect(updateEquipmentDisplay).toHaveBeenCalled();
    expect(updateCombatStyles).toHaveBeenCalled();
    expect(updateBonusDisplay).toHaveBeenCalled();
    expect(renderPrayerGrid).toHaveBeenCalled();
    expect(renderBoostList).toHaveBeenCalled();
    expect(updatePlayerSummary).toHaveBeenCalled();

    calc.removeLoadout(1);
    expect(calc.loadouts.length).toBe(1);

    calc.renderLoadoutTabs();
    expect(calc.loadoutTabs.querySelectorAll(".dps-calc__loadout-tab").length).toBe(1);

    const label = calc.loadoutTabs.querySelector(".dps-calc__loadout-tab-label") as HTMLElement;
    calc.renameLoadout(0, label);
    const input = calc.loadoutTabs.querySelector("input") as HTMLInputElement;
    input.value = "Renamed";
    input.dispatchEvent(new Event("blur"));
    expect(calc.loadouts[0]?.name).toBe("Renamed");
    expect(renderResults).toHaveBeenCalled();
  });

  it("serializes, persists and resets state", () => {
    const calc = createCalc();
    vi.spyOn(calc, "renderResults").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderHitDistribution").mockImplementation(() => undefined);
    vi.spyOn(calc, "restoreLoadout").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderLoadoutTabs").mockImplementation(() => undefined);

    calc.selectedMonster = {
      id: 1,
      name: "Goblin",
      version: "level 2",
      skills: { hp: 10 },
      inputs: { monsterCurrentHp: 7 },
    } as never;
    calc.hideMisses = false;
    calc.defenceReductions.dwh = 2;

    const state = calc.serializeState();
    expect(state.selectedLoadout).toBe(0);
    expect(state.hideMisses).toBe(false);

    calc.persistToStorage();
    const stored = localStorage.getItem(DpsCalc.STORAGE_KEY);
    expect(stored).toContain("loadouts");

    calc.resetAll();
    expect(calc.loadouts.length).toBe(1);
    expect(calc.monsterSearch.value).toBe("");
  });

  it("restores state from storage", () => {
    const calc = createCalc();
    calc.allMonsters = [
      {
        id: 1,
        name: "Goblin",
        version: null,
        skills: { hp: 10 },
      } as never,
    ];

    const selectMonster = vi.spyOn(calc, "selectMonster").mockImplementation((monster) => {
      calc.selectedMonster = {
        ...(monster as object),
        inputs: {},
      } as never;
    });
    vi.spyOn(calc, "restoreLoadout").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderLoadoutTabs").mockImplementation(() => undefined);
    const recalculate = vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);

    localStorage.setItem(
      DpsCalc.STORAGE_KEY,
      JSON.stringify({
        selectedLoadout: 0,
        hideMisses: true,
        monster: { name: "Goblin", version: null, currentHp: 6 },
        defenceReductions: { dwh: 3, vulnerability: true },
        loadouts: [
          {
            name: "Imported",
            equipment: { weapon: 4151 },
            skills: { atk: 70, str: 70, def: 70, ranged: 70, magic: 70, prayer: 70, hp: 70 },
            selectedStyle: { type: "slash", stance: "aggressive", name: "Slash" },
            selectedPrayers: ["piety"],
            selectedPotion: "superCombat",
            onSlayerTask: true,
            extraBuffs: { soulreaperStacks: 2 },
          },
        ],
      })
    );

    calc.restoreFromStorage();

    expect(selectMonster).toHaveBeenCalled();
    expect(calc.monsterHpInput.value).toBe("6");
    expect(calc.loadouts[0]?.name).toBe("Imported");
    expect(calc.hitdistHideZeros.checked).toBe(true);
    expect(recalculate).toHaveBeenCalled();
  });

  it("exports and imports loadouts", () => {
    const calc = createCalc();
    vi.spyOn(calc, "saveCurrentLoadout").mockImplementation(() => undefined);
    vi.spyOn(calc, "restoreLoadout").mockImplementation(() => undefined);
    vi.spyOn(calc, "renderLoadoutTabs").mockImplementation(() => undefined);
    vi.spyOn(calc, "recalculate").mockImplementation(() => undefined);

    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    calc.exportLoadouts();
    expect(createObjectUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalled();

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsText(): void {
        this.result = JSON.stringify([
          {
            name: "FromFile",
            equipment: { weapon: 11802 },
            skills: { atk: 80, str: 80, def: 80, ranged: 80, magic: 80, prayer: 80, hp: 80 },
            selectedPrayers: ["piety"],
          },
        ]);
        this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
    }

    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);

    const fakeFile = new File(["x"], "dps-loadouts.json", { type: "application/json" });
    calc.loadoutFileInput = {
      files: [fakeFile],
      value: "x",
    } as unknown as HTMLInputElement;

    calc.importLoadouts();
    expect(calc.loadouts.some((x) => x.name === "FromFile")).toBe(true);
  });
});
