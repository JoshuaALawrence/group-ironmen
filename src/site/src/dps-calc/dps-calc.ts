import { BaseElement } from "../base-element/base-element";
import { pubsub } from "../data/pubsub";
import {
  loadEquipmentData,
  loadMonsterData,
  getEquipmentById,
  calculateDps,
  aggregateEquipmentBonuses,
  getCombatStyles,
  PRAYERS,
  getConflictingPrayers,
  POTIONS,
  type CalcEquipmentPiece,
  type CalcMonster,
  type DpsHistogramPoint,
  type DpsResult,
} from "./dps-calc-engine";

type EquipmentSlot = "head" | "cape" | "neck" | "weapon" | "body" | "shield" | "legs" | "hands" | "feet" | "ring" | "ammo";
type SkillKey = "atk" | "str" | "def" | "ranged" | "magic" | "prayer" | "hp";
type ActiveTab = "combat" | "skills" | "equipment" | "prayer" | "options";

const NUMERIC_DEFENCE_REDUCTION_KEYS = ["elderMaul", "dwh", "arclight", "emberlight", "tonalztic", "bgs", "seercull", "ayak"] as const;
const BOOLEAN_DEFENCE_REDUCTION_KEYS = ["accursed", "vulnerability"] as const;

const EQUIP_INDEX_TO_SLOT: Partial<Record<number, EquipmentSlot>> = {
  0: "head",
  1: "cape",
  2: "neck",
  3: "weapon",
  4: "body",
  5: "shield",
  7: "legs",
  9: "hands",
  10: "feet",
  12: "ring",
  13: "ammo",
};

const SLOT_PLACEHOLDER: Record<EquipmentSlot, string> = {
  head: "/ui/156-0.png",
  cape: "/ui/157-0.png",
  neck: "/ui/158-0.png",
  weapon: "/ui/159-0.png",
  body: "/ui/161-0.png",
  shield: "/ui/162-0.png",
  legs: "/ui/163-0.png",
  hands: "/ui/164-0.png",
  feet: "/ui/165-0.png",
  ring: "/ui/160-0.png",
  ammo: "/ui/166-0.png",
};

const MONSTER_IMAGE_BASE_URL = "https://tools.runescape.wiki/osrs-dps/cdn/monsters";
const MONSTER_IMAGE_FALLBACK = "/images/skills/Combat_icon.png";
const POTION_KEYS = Object.keys(POTIONS).filter((key): key is Exclude<keyof typeof POTIONS, "none"> => key !== "none");
const TAB_ORDER = ["combat", "skills", "equipment", "prayer", "options"];

type EquipmentPiece = CalcEquipmentPiece & { slot?: EquipmentSlot };

type SkillsState = Record<string, number>;

type CombatStyle = {
  name?: string;
  type: string;
  stance: string;
  [key: string]: unknown;
};

type ExtraBuffs = {
  inWilderness: boolean;
  forinthrySurge: boolean;
  kandarinDiary: boolean;
  soulreaperStacks: number;
  baAttackerLevel: number;
  chinchompaDistance: number;
  [key: string]: boolean | number;
};

type Loadout = {
  name: string;
  equipment: Record<string, EquipmentPiece | null>;
  skills: SkillsState;
  selectedStyle: CombatStyle | null;
  selectedPrayers: Set<string>;
  selectedPotion: string;
  onSlayerTask: boolean;
  extraBuffs: ExtraBuffs;
};

type MonsterRecord = CalcMonster;

type InventoryLikeItem = {
  id: number;
  isValid: () => boolean;
};

type DefenceReductions = {
  elderMaul: number;
  dwh: number;
  arclight: number;
  emberlight: number;
  tonalztic: number;
  bgs: number;
  seercull: number;
  ayak: number;
  accursed: boolean;
  vulnerability: boolean;
};

type DefenceReductionKey = keyof DefenceReductions;
type NumericDefenceReductionKey = (typeof NUMERIC_DEFENCE_REDUCTION_KEYS)[number];
type BooleanDefenceReductionKey = (typeof BOOLEAN_DEFENCE_REDUCTION_KEYS)[number];

type PresetDefinition = Partial<Record<EquipmentSlot, number | null>>;

type ResultRow = {
  key: keyof DpsResult;
  label: string;
  title: string;
  format: (value: number | null | undefined) => string;
  best: "max" | "min";
  highlight?: boolean;
};

function isNumericDefenceReductionKey(key: string): key is NumericDefenceReductionKey {
  return (NUMERIC_DEFENCE_REDUCTION_KEYS as readonly string[]).includes(key);
}

function isBooleanDefenceReductionKey(key: string): key is BooleanDefenceReductionKey {
  return (BOOLEAN_DEFENCE_REDUCTION_KEYS as readonly string[]).includes(key);
}

function isNamedMemberList(value: unknown): value is Array<{ name: string }> {
  return Array.isArray(value) && value.every((entry) => !!entry && typeof entry === "object" && typeof entry.name === "string");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatBonus(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function getStyleIcon(styleType: string): string {
  switch (styleType) {
    case "stab":
      return "/dps-calc/bonuses/dagger.png";
    case "slash":
      return "/dps-calc/bonuses/scimitar.png";
    case "crush":
      return "/dps-calc/bonuses/warhammer.png";
    case "ranged":
      return "/dps-calc/bonuses/ranged.png";
    case "magic":
      return "/dps-calc/bonuses/magic.png";
    default:
      return "/dps-calc/bonuses/attack.png";
  }
}

export class DpsCalc extends BaseElement {
  static STORAGE_KEY = "dps-calc-state";

  loadouts: Loadout[];
  selectedLoadout: number;
  loadoutResults: Array<DpsResult | null>;
  equipment: Record<string, EquipmentPiece | null>;
  skills: SkillsState;
  selectedStyle: CombatStyle | null;
  selectedPrayers: Set<string>;
  selectedPotion: string;
  onSlayerTask: boolean;
  extraBuffs: ExtraBuffs;
  selectedMonster: MonsterRecord | null;
  equipmentDataLoaded: boolean;
  monsterDataLoaded: boolean;
  allEquipment: EquipmentPiece[];
  allMonsters: MonsterRecord[];
  searchSlot: EquipmentSlot | null;
  searchDebounceTimer: ReturnType<typeof window.setTimeout> | null;
  monsterSearchDebounceTimer: ReturnType<typeof window.setTimeout> | null;
  activeTab: ActiveTab;
  resultsExpanded: boolean;
  hideMisses: boolean;
  hitDistribution: DpsHistogramPoint[];
  defenceReductions: DefenceReductions;
  memberSelect!: HTMLSelectElement;
  loadBtn!: HTMLButtonElement;
  tabButtons!: HTMLButtonElement[];
  tabContents!: HTMLElement[];
  styleList!: HTMLElement;
  prayerGrid!: HTMLElement;
  boostsList!: HTMLElement;
  slayerCheckbox!: HTMLInputElement;
  wildernessCheckbox!: HTMLInputElement;
  forinthryCheckbox!: HTMLInputElement;
  kandarinCheckbox!: HTMLInputElement;
  numberBuffInputs!: HTMLInputElement[];
  monsterSearch!: HTMLInputElement;
  monsterResults!: HTMLElement;
  monsterInfo!: HTMLElement;
  monsterNameDisplay!: HTMLElement;
  monsterWeakness!: HTMLElement;
  monsterAttrs!: HTMLElement;
  monsterAttrList!: HTMLElement;
  monsterHpInput!: HTMLInputElement;
  loadoutTabs!: HTMLElement;
  loadoutAddBtn!: HTMLButtonElement;
  loadoutExportBtn!: HTMLButtonElement;
  loadoutImportBtn!: HTMLButtonElement;
  loadoutFileInput!: HTMLInputElement;
  loadoutClearBtn!: HTMLButtonElement;
  resultsBody!: HTMLElement;
  resultsExtraBody!: HTMLElement;
  presetSelect!: HTMLSelectElement;
  equipSearchInline!: HTMLInputElement;
  equipSearch!: HTMLElement;
  equipSearchInput!: HTMLInputElement;
  equipSearchResults!: HTMLElement;
  equipSearchClose!: HTMLButtonElement;
  attrsToggle!: HTMLElement;
  defredToggle!: HTMLElement;
  monsettingsToggle!: HTMLElement;
  showMoreBtn!: HTMLElement;
  hitdistToggle!: HTMLElement;
  hitdistBody!: HTMLElement;
  hitdistHideZeros!: HTMLInputElement;
  hitdistCanvas!: HTMLCanvasElement;
  playerSummaryTitle!: HTMLElement;
  playerSummarySubtitle!: HTMLElement;
  playerSummaryLevel!: HTMLElement;

  constructor() {
    super();
    this.loadouts = [DpsCalc.createDefaultLoadout()];
    this.selectedLoadout = 0;
    this.loadoutResults = [];

    // Active loadout state (mirrors loadouts[selectedLoadout])
    this.equipment = this.loadouts[0].equipment;
    this.skills = this.loadouts[0].skills;
    this.selectedStyle = this.loadouts[0].selectedStyle;
    this.selectedPrayers = this.loadouts[0].selectedPrayers;
    this.selectedPotion = this.loadouts[0].selectedPotion;
    this.onSlayerTask = this.loadouts[0].onSlayerTask;
    this.extraBuffs = this.loadouts[0].extraBuffs;

    this.selectedMonster = null;
    this.equipmentDataLoaded = false;
    this.monsterDataLoaded = false;
    this.allEquipment = [];
    this.allMonsters = [];
    this.searchSlot = null;
    this.searchDebounceTimer = null;
    this.monsterSearchDebounceTimer = null;
    this.activeTab = "equipment";
    this.resultsExpanded = false;
    this.hideMisses = true;
    this.hitDistribution = [];
    this.defenceReductions = {
      elderMaul: 0,
      dwh: 0,
      arclight: 0,
      emberlight: 0,
      tonalztic: 0,
      bgs: 0,
      seercull: 0,
      ayak: 0,
      accursed: false,
      vulnerability: false,
    };
  }

  static createDefaultLoadout(name = "Loadout 1"): Loadout {
    return {
      name,
      equipment: {
        head: null,
        cape: null,
        neck: null,
        ammo: null,
        weapon: null,
        body: null,
        shield: null,
        legs: null,
        hands: null,
        feet: null,
        ring: null,
      },
      skills: { atk: 99, str: 99, def: 99, ranged: 99, magic: 99, prayer: 99, hp: 99 },
      selectedStyle: null,
      selectedPrayers: new Set(),
      selectedPotion: "none",
      onSlayerTask: false,
      extraBuffs: {
        inWilderness: false,
        forinthrySurge: false,
        kandarinDiary: false,
        soulreaperStacks: 0,
        baAttackerLevel: 0,
        chinchompaDistance: 4,
      },
    };
  }

  saveCurrentLoadout(): void {
    const lo = this.loadouts[this.selectedLoadout];
    if (!lo) return;
    lo.equipment = this.equipment;
    lo.skills = { ...this.skills };
    lo.selectedStyle = this.selectedStyle;
    lo.selectedPrayers = new Set(this.selectedPrayers);
    lo.selectedPotion = this.selectedPotion;
    lo.onSlayerTask = this.onSlayerTask;
    lo.extraBuffs = { ...this.extraBuffs };
  }

  restoreLoadout(index: number): void {
    const lo = this.loadouts[index];
    if (!lo) return;
    this.equipment = lo.equipment;
    this.skills = lo.skills;
    this.selectedStyle = lo.selectedStyle;
    this.selectedPrayers = lo.selectedPrayers;
    this.selectedPotion = lo.selectedPotion;
    this.onSlayerTask = lo.onSlayerTask;
    this.extraBuffs = lo.extraBuffs;

    // Restore UI inputs
    for (const input of this.querySelectorAll<HTMLInputElement>(".dps-calc__stat-input")) {
      const skill = input.dataset.skill as SkillKey | undefined;
      if (skill && this.skills[skill] !== undefined) input.value = String(this.skills[skill]);
    }
    this.slayerCheckbox.checked = this.onSlayerTask;
    this.wildernessCheckbox.checked = this.extraBuffs.inWilderness;
    this.forinthryCheckbox.checked = this.extraBuffs.forinthrySurge;
    this.kandarinCheckbox.checked = this.extraBuffs.kandarinDiary;
    for (const input of this.numberBuffInputs) {
      const key = input.dataset.buff;
      if (key && this.extraBuffs[key] !== undefined) input.value = String(this.extraBuffs[key]);
    }

    this.updateEquipmentDisplay();
    this.updateCombatStyles();
    this.updateBonusDisplay();
    this.renderPrayerGrid();
    this.renderBoostList();
    this.updatePlayerSummary();
  }

  switchLoadout(index: number): void {
    if (index === this.selectedLoadout) return;
    this.saveCurrentLoadout();
    this.selectedLoadout = index;
    this.restoreLoadout(index);
    this.renderLoadoutTabs();
    this.recalculate();
  }

  addLoadout(): void {
    this.saveCurrentLoadout();
    const name = `Loadout ${this.loadouts.length + 1}`;
    this.loadouts.push(DpsCalc.createDefaultLoadout(name));
    this.selectedLoadout = this.loadouts.length - 1;
    this.restoreLoadout(this.selectedLoadout);
    this.renderLoadoutTabs();
    this.recalculate();
  }

  removeLoadout(index: number): void {
    if (this.loadouts.length <= 1) return;
    this.loadouts.splice(index, 1);
    if (this.selectedLoadout >= this.loadouts.length) {
      this.selectedLoadout = this.loadouts.length - 1;
    } else if (this.selectedLoadout > index) {
      this.selectedLoadout -= 1;
    } else if (this.selectedLoadout === index) {
      this.selectedLoadout = Math.min(index, this.loadouts.length - 1);
    }
    this.restoreLoadout(this.selectedLoadout);
    this.renderLoadoutTabs();
    this.recalculate();
  }

  renderLoadoutTabs(): void {
    const container = this.loadoutTabs;
    if (!container) return;
    container.innerHTML = "";
    this.loadouts.forEach((lo, i) => {
      const tab = document.createElement("div");
      tab.className = "dps-calc__loadout-tab";
      tab.classList.toggle("dps-calc__loadout-tab--active", i === this.selectedLoadout);

      const label = document.createElement("span");
      label.className = "dps-calc__loadout-tab-label";
      label.textContent = lo.name;
      label.addEventListener("click", () => this.switchLoadout(i), { passive: true });
      label.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        this.renameLoadout(i, label);
      });
      tab.appendChild(label);

      if (this.loadouts.length > 1) {
        const close = document.createElement("span");
        close.className = "dps-calc__loadout-tab-close";
        close.textContent = "\u00d7";
        close.addEventListener(
          "click",
          (e) => {
            e.stopPropagation();
            this.removeLoadout(i);
          },
          { passive: true }
        );
        tab.appendChild(close);
      }

      container.appendChild(tab);
    });
  }

  renameLoadout(index: number, labelEl: HTMLElement): void {
    const lo = this.loadouts[index];
    if (!lo) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "dps-calc__loadout-tab-rename";
    input.value = lo.name;
    input.maxLength = 30;

    const commit = () => {
      const newName = input.value.trim() || lo.name;
      lo.name = newName;
      this.renderLoadoutTabs();
      this.renderResults();
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") {
        input.value = lo.name;
        input.blur();
      }
    });

    labelEl.replaceWith(input);
    input.focus();
    input.select();
  }

  serializeState(): Record<string, unknown> {
    this.saveCurrentLoadout();
    return {
      loadouts: this.loadouts.map((lo) => ({
        name: lo.name,
        equipment: Object.fromEntries(
          Object.entries(lo.equipment).map(([slot, item]) => [slot, item ? item.id : null])
        ),
        skills: { ...lo.skills },
        selectedStyle: lo.selectedStyle
          ? { name: lo.selectedStyle.name, type: lo.selectedStyle.type, stance: lo.selectedStyle.stance }
          : null,
        selectedPrayers: [...lo.selectedPrayers],
        selectedPotion: lo.selectedPotion,
        onSlayerTask: lo.onSlayerTask,
        extraBuffs: { ...lo.extraBuffs },
      })),
      selectedLoadout: this.selectedLoadout,
      monster: this.selectedMonster
        ? {
            name: this.selectedMonster.name,
            version: this.selectedMonster.version || null,
            currentHp: this.selectedMonster.inputs?.monsterCurrentHp ?? null,
          }
        : null,
      defenceReductions: { ...this.defenceReductions },
      hideMisses: this.hideMisses,
    };
  }

  persistToStorage(): void {
    try {
      localStorage.setItem(DpsCalc.STORAGE_KEY, JSON.stringify(this.serializeState()));
    } catch (_) {
      /* quota exceeded or private mode */
    }
  }

  restoreFromStorage(): void {
    let data;
    try {
      const raw = localStorage.getItem(DpsCalc.STORAGE_KEY);
      if (!raw) return;
      data = JSON.parse(raw);
    } catch (_) {
      return;
    }
    if (!data || typeof data !== "object") return;

    // Restore monster first (needed by recalculate)
    if (data.monster && typeof data.monster === "object") {
      const m = this.allMonsters.find(
        (mon) => mon.name === data.monster.name && (mon.version || null) === (data.monster.version || null)
      );
      if (m) {
        this.selectMonster(m);
        if (data.monster.currentHp != null) {
          const hp = clamp(data.monster.currentHp, 0, m.skills?.hp ?? 1);
          this.monsterHpInput.value = String(hp);
          this.selectedMonster = {
            ...this.selectedMonster,
            inputs: { ...(this.selectedMonster.inputs || {}), monsterCurrentHp: hp },
          };
        }
      }
    }

    // Restore defence reductions
    if (data.defenceReductions && typeof data.defenceReductions === "object") {
      Object.assign(this.defenceReductions, data.defenceReductions);
      for (const input of this.querySelectorAll<HTMLInputElement>(".dps-calc__defred-input")) {
        const key = input.dataset.defred;
        if (key && key in this.defenceReductions) input.value = String(this.defenceReductions[key as keyof DefenceReductions]);
      }
      for (const cb of this.querySelectorAll<HTMLInputElement>(".dps-calc__defred-checkbox")) {
        const key = cb.dataset.defred;
        if (key && key in this.defenceReductions) cb.checked = Boolean(this.defenceReductions[key as keyof DefenceReductions]);
      }
    }

    // Restore loadouts
    if (Array.isArray(data.loadouts) && data.loadouts.length > 0) {
      const restored = [];
      for (const entry of data.loadouts) {
        if (!entry || typeof entry !== "object" || !entry.name) continue;
        const lo = DpsCalc.createDefaultLoadout(String(entry.name).slice(0, 30));
        if (entry.equipment && typeof entry.equipment === "object") {
          for (const [slot, id] of Object.entries(entry.equipment)) {
            if (Object.prototype.hasOwnProperty.call(lo.equipment, slot)) {
              lo.equipment[slot] = id !== null ? getEquipmentById(Number(id)) : null;
            }
          }
        }
        if (entry.skills && typeof entry.skills === "object") {
          for (const key of Object.keys(lo.skills)) {
            if (typeof entry.skills[key] === "number") lo.skills[key] = clamp(entry.skills[key], 1, 99);
          }
        }
        if (entry.selectedStyle && typeof entry.selectedStyle === "object") {
          lo.selectedStyle = entry.selectedStyle;
        }
        if (Array.isArray(entry.selectedPrayers)) {
          lo.selectedPrayers = new Set(entry.selectedPrayers.filter((k: unknown): k is string => typeof k === "string"));
        }
        if (typeof entry.selectedPotion === "string") lo.selectedPotion = entry.selectedPotion;
        if (typeof entry.onSlayerTask === "boolean") lo.onSlayerTask = entry.onSlayerTask;
        if (entry.extraBuffs && typeof entry.extraBuffs === "object") {
          Object.assign(lo.extraBuffs, entry.extraBuffs);
        }
        restored.push(lo);
      }
      if (restored.length > 0) {
        this.loadouts = restored;
        this.selectedLoadout = clamp(data.selectedLoadout || 0, 0, this.loadouts.length - 1);
        this.equipment = this.loadouts[this.selectedLoadout].equipment;
        this.skills = this.loadouts[this.selectedLoadout].skills;
        this.selectedStyle = this.loadouts[this.selectedLoadout].selectedStyle;
        this.selectedPrayers = this.loadouts[this.selectedLoadout].selectedPrayers;
        this.selectedPotion = this.loadouts[this.selectedLoadout].selectedPotion;
        this.onSlayerTask = this.loadouts[this.selectedLoadout].onSlayerTask;
        this.extraBuffs = this.loadouts[this.selectedLoadout].extraBuffs;
        this.restoreLoadout(this.selectedLoadout);
        this.renderLoadoutTabs();
      }
    }

    if (typeof data.hideMisses === "boolean") {
      this.hideMisses = data.hideMisses;
      if (this.hitdistHideZeros) this.hitdistHideZeros.checked = this.hideMisses;
    }

    this.recalculate();
  }

  resetAll(): void {
    this.loadouts = [DpsCalc.createDefaultLoadout()];
    this.selectedLoadout = 0;
    this.equipment = this.loadouts[0].equipment;
    this.skills = this.loadouts[0].skills;
    this.selectedStyle = this.loadouts[0].selectedStyle;
    this.selectedPrayers = this.loadouts[0].selectedPrayers;
    this.selectedPotion = this.loadouts[0].selectedPotion;
    this.onSlayerTask = this.loadouts[0].onSlayerTask;
    this.extraBuffs = this.loadouts[0].extraBuffs;
    this.selectedMonster = null;
    this.hitDistribution = [];
    this.loadoutResults = [];
    this.defenceReductions = {
      elderMaul: 0,
      dwh: 0,
      arclight: 0,
      emberlight: 0,
      tonalztic: 0,
      bgs: 0,
      seercull: 0,
      ayak: 0,
      accursed: false,
      vulnerability: false,
    };

    // Reset UI
    this.restoreLoadout(0);
    this.renderLoadoutTabs();
    this.monsterSearch.value = "";
    this.monsterInfo.style.display = "none";
    this.monsterResults.style.display = "none";
    for (const input of this.querySelectorAll<HTMLInputElement>(".dps-calc__defred-input")) input.value = "0";
    for (const cb of this.querySelectorAll<HTMLInputElement>(".dps-calc__defred-checkbox")) cb.checked = false;
    this.monsterHpInput.value = "";
    this.presetSelect.value = "";

    this.renderResults();
    this.renderHitDistribution();
    this.persistToStorage();
  }

  exportLoadouts(): void {
    this.saveCurrentLoadout();
    const data = this.loadouts.map((lo) => ({
      name: lo.name,
      equipment: Object.fromEntries(Object.entries(lo.equipment).map(([slot, item]) => [slot, item ? item.id : null])),
      skills: { ...lo.skills },
      selectedStyle: lo.selectedStyle
        ? { name: lo.selectedStyle.name, type: lo.selectedStyle.type, stance: lo.selectedStyle.stance }
        : null,
      selectedPrayers: [...lo.selectedPrayers],
      selectedPotion: lo.selectedPotion,
      onSlayerTask: lo.onSlayerTask,
      extraBuffs: { ...lo.extraBuffs },
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dps-loadouts.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  importLoadouts(): void {
    const file = this.loadoutFileInput.files[0];
    this.loadoutFileInput.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== "string") {
          return;
        }
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) return;
        this.saveCurrentLoadout();
        for (const entry of data) {
          if (!entry || typeof entry !== "object" || !entry.name) continue;
          const lo = DpsCalc.createDefaultLoadout(String(entry.name).slice(0, 30));
          if (entry.equipment && typeof entry.equipment === "object") {
            for (const [slot, id] of Object.entries(entry.equipment)) {
              if (Object.prototype.hasOwnProperty.call(lo.equipment, slot)) {
                lo.equipment[slot] = id !== null ? getEquipmentById(Number(id)) : null;
              }
            }
          }
          if (entry.skills && typeof entry.skills === "object") {
            for (const key of Object.keys(lo.skills)) {
              if (typeof entry.skills[key] === "number") lo.skills[key] = clamp(entry.skills[key], 1, 99);
            }
          }
          if (entry.selectedStyle && typeof entry.selectedStyle === "object") {
            lo.selectedStyle = entry.selectedStyle;
          }
          if (Array.isArray(entry.selectedPrayers)) {
            lo.selectedPrayers = new Set(entry.selectedPrayers.filter((k: unknown): k is string => typeof k === "string"));
          }
          if (typeof entry.selectedPotion === "string") lo.selectedPotion = entry.selectedPotion;
          if (typeof entry.onSlayerTask === "boolean") lo.onSlayerTask = entry.onSlayerTask;
          if (entry.extraBuffs && typeof entry.extraBuffs === "object") {
            Object.assign(lo.extraBuffs, entry.extraBuffs);
          }
          this.loadouts.push(lo);
        }
        this.selectedLoadout = this.loadouts.length - 1;
        this.restoreLoadout(this.selectedLoadout);
        this.renderLoadoutTabs();
        this.recalculate();
      } catch (e) {
        console.warn("Failed to import loadouts:", e);
      }
    };
    reader.readAsText(file);
  }

  html(): string {
    return `{{dps-calc.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.cacheElements();
    this.setupEventListeners();
    this.populateInitialUi();
    this.loadData();
    this.updateCombatStyles();
    this.updateBonusDisplay();
    this.renderHitDistribution();
  }

  disconnectedCallback(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.monsterSearchDebounceTimer) {
      clearTimeout(this.monsterSearchDebounceTimer);
      this.monsterSearchDebounceTimer = null;
    }
    super.disconnectedCallback();
  }

  cacheElements(): void {
    this.memberSelect = this.querySelector<HTMLSelectElement>(".dps-calc__member-select")!;
    this.loadBtn = this.querySelector<HTMLButtonElement>(".dps-calc__load-btn")!;
    this.tabButtons = Array.from(this.querySelectorAll<HTMLButtonElement>(".dps-calc__tab-btn"));
    this.tabContents = Array.from(this.querySelectorAll<HTMLElement>(".dps-calc__tab-content"));
    this.styleList = this.querySelector<HTMLElement>(".dps-calc__style-list")!;
    this.prayerGrid = this.querySelector<HTMLElement>(".dps-calc__prayer-grid")!;
    this.boostsList = this.querySelector<HTMLElement>(".dps-calc__boosts-list")!;
    this.slayerCheckbox = this.querySelector<HTMLInputElement>(".dps-calc__slayer-checkbox")!;
    this.wildernessCheckbox = this.querySelector<HTMLInputElement>(".dps-calc__wilderness-checkbox")!;
    this.forinthryCheckbox = this.querySelector<HTMLInputElement>(".dps-calc__forinthry-checkbox")!;
    this.kandarinCheckbox = this.querySelector<HTMLInputElement>(".dps-calc__kandarin-checkbox")!;
    this.numberBuffInputs = Array.from(this.querySelectorAll<HTMLInputElement>(".dps-calc__num-option-input"));
    this.monsterSearch = this.querySelector<HTMLInputElement>(".dps-calc__monster-search")!;
    this.monsterResults = this.querySelector<HTMLElement>(".dps-calc__monster-results")!;
    this.monsterInfo = this.querySelector<HTMLElement>(".dps-calc__monster-info")!;
    this.monsterNameDisplay = this.querySelector<HTMLElement>(".dps-calc__monster-name-display")!;
    this.monsterWeakness = this.querySelector<HTMLElement>(".dps-calc__monster-weakness")!;
    this.monsterAttrs = this.querySelector<HTMLElement>(".dps-calc__monster-attrs")!;
    this.monsterAttrList = this.querySelector<HTMLElement>(".dps-calc__monster-attr-list")!;
    this.monsterHpInput = this.querySelector<HTMLInputElement>(".dps-calc__monster-hp-input")!;
    this.loadoutTabs = this.querySelector<HTMLElement>(".dps-calc__loadout-tabs")!;
    this.loadoutAddBtn = this.querySelector<HTMLButtonElement>(".dps-calc__loadout-add")!;
    this.loadoutExportBtn = this.querySelector<HTMLButtonElement>(".dps-calc__loadout-export")!;
    this.loadoutImportBtn = this.querySelector<HTMLButtonElement>(".dps-calc__loadout-import")!;
    this.loadoutFileInput = this.querySelector<HTMLInputElement>(".dps-calc__loadout-file")!;
    this.loadoutClearBtn = this.querySelector<HTMLButtonElement>(".dps-calc__loadout-clear")!;
    this.resultsBody = this.querySelector<HTMLElement>(".dps-calc__results-body")!;
    this.resultsExtraBody = this.querySelector<HTMLElement>(".dps-calc__results-extra")!;
    this.presetSelect = this.querySelector<HTMLSelectElement>(".dps-calc__preset-select")!;
    this.equipSearchInline = this.querySelector<HTMLInputElement>(".dps-calc__equip-search-inline")!;
    this.equipSearch = this.querySelector<HTMLElement>(".dps-calc__equip-search")!;
    this.equipSearchInput = this.querySelector<HTMLInputElement>(".dps-calc__equip-search-input")!;
    this.equipSearchResults = this.querySelector<HTMLElement>(".dps-calc__equip-search-results")!;
    this.equipSearchClose = this.querySelector<HTMLButtonElement>(".dps-calc__equip-search-close")!;
    this.attrsToggle = this.querySelector<HTMLElement>(".dps-calc__attrs-toggle")!;
    this.defredToggle = this.querySelector<HTMLElement>(".dps-calc__defred-toggle")!;
    this.monsettingsToggle = this.querySelector<HTMLElement>(".dps-calc__monsettings-toggle")!;
    this.showMoreBtn = this.querySelector<HTMLElement>(".dps-calc__show-more-btn")!;
    this.hitdistToggle = this.querySelector<HTMLElement>(".dps-calc__hitdist-toggle")!;
    this.hitdistBody = this.querySelector<HTMLElement>(".dps-calc__hitdist-body")!;
    this.hitdistHideZeros = this.querySelector<HTMLInputElement>(".dps-calc__hitdist-hide-zeros")!;
    this.hitdistCanvas = this.querySelector<HTMLCanvasElement>(".dps-calc__hitdist-canvas")!;
    this.playerSummaryTitle = this.querySelector<HTMLElement>(".dps-calc__player-summary-title")!;
    this.playerSummarySubtitle = this.querySelector<HTMLElement>(".dps-calc__player-summary-subtitle")!;
    this.playerSummaryLevel = this.querySelector<HTMLElement>(".dps-calc__player-summary-level")!;
  }

  setupEventListeners() {
    this.eventListener(this.loadBtn, "click", () => this.loadMemberEquipment(), { passive: true });
    this.eventListener(this.memberSelect, "change", () => this.updatePlayerSummary(), { passive: true });

    for (const button of this.tabButtons) {
      this.eventListener(button, "click", () => this.setActiveTab(button.dataset.tab), { passive: true });
    }

    for (const input of this.querySelectorAll(".dps-calc__stat-input")) {
      this.eventListener(
        input,
        "input",
        (event) => {
          const target = event.target as HTMLInputElement | null;
          if (!target) {
            return;
          }
          this.updateSkillValue(target, target.value);
        },
        { passive: true }
      );
    }

    for (const slot of this.querySelectorAll(".dps-calc__equip-slot")) {
      this.eventListener(
        slot,
        "click",
        (event) => {
          event.stopPropagation();
          const slotName = (slot as HTMLElement).dataset.slot;
          if (slotName && this.equipment[slotName]) {
            this.equipment[slotName] = null;
            this.updateEquipmentDisplay();
            this.updateCombatStyles();
            this.updateBonusDisplay();
            this.recalculate();
          }
        },
        { passive: false }
      );
    }

    this.eventListener(this.loadoutAddBtn, "click", () => this.addLoadout(), { passive: true });
    this.eventListener(this.loadoutExportBtn, "click", () => this.exportLoadouts(), { passive: true });
    this.eventListener(this.loadoutImportBtn, "click", () => this.loadoutFileInput.click(), { passive: true });
    this.eventListener(this.loadoutFileInput, "change", () => this.importLoadouts(), { passive: true });
    this.eventListener(this.loadoutClearBtn, "click", () => this.resetAll(), { passive: true });

    this.eventListener(
      this.presetSelect,
      "change",
      () => {
        const key = this.presetSelect.value;
        if (key) this.applyPreset(key);
        this.presetSelect.value = "";
      },
      { passive: true }
    );

    this.eventListener(
      this.equipSearchInline,
      "focus",
      () => {
        this.openEquipmentSearch();
      },
      { passive: true }
    );

    this.eventListener(
      this.equipSearchInline,
      "input",
      () => {
        this.syncInlineSearchToOverlay();
        this.openEquipmentSearch();
        this.handleEquipSearchInput();
      },
      { passive: true }
    );

    this.eventListener(
      this.equipSearchInput,
      "input",
      () => {
        this.syncOverlaySearchToInline();
        this.handleEquipSearchInput();
      },
      { passive: true }
    );

    this.eventListener(this.equipSearchClose, "click", () => this.closeEquipmentSearch(), { passive: true });

    this.eventListener(
      this.slayerCheckbox,
      "change",
      (event) => {
        this.onSlayerTask = Boolean((event.target as HTMLInputElement | null)?.checked);
        this.recalculate();
      },
      { passive: true }
    );

    this.eventListener(
      this.wildernessCheckbox,
      "change",
      (event) => {
        this.extraBuffs.inWilderness = Boolean((event.target as HTMLInputElement | null)?.checked);
        this.recalculate();
      },
      { passive: true }
    );

    this.eventListener(
      this.forinthryCheckbox,
      "change",
      (event) => {
        this.extraBuffs.forinthrySurge = Boolean((event.target as HTMLInputElement | null)?.checked);
        this.recalculate();
      },
      { passive: true }
    );

    this.eventListener(
      this.kandarinCheckbox,
      "change",
      (event) => {
        this.extraBuffs.kandarinDiary = Boolean((event.target as HTMLInputElement | null)?.checked);
        this.recalculate();
      },
      { passive: true }
    );

    for (const input of this.numberBuffInputs) {
      this.eventListener(
        input,
        "input",
        (event) => {
          const target = event.target as HTMLInputElement | null;
          if (!target) {
            return;
          }
          const key = target.dataset.buff;
          if (!key) return;
          const min = parseInt(target.min || "0", 10);
          const max = parseInt(target.max || "999", 10);
          const nextValue = clamp(parseInt(target.value, 10) || 0, min, max);
          target.value = String(nextValue);
          this.extraBuffs[key] = nextValue;
          this.recalculate();
        },
        { passive: true }
      );
    }

    this.eventListener(this.monsterSearch, "input", () => this.handleMonsterSearchInput(), { passive: true });
    this.eventListener(
      this.monsterSearch,
      "focus",
      () => {
        if (this.selectedMonster || (this.monsterSearch.value || "").length >= 2) {
          this.handleMonsterSearchInput();
        }
      },
      { passive: true }
    );

    this.eventListener(
      this.monsterHpInput,
      "input",
      () => {
        if (!this.selectedMonster) return;
        const maxHp = this.selectedMonster.skills?.hp || 1;
        const nextValue = clamp(parseInt(this.monsterHpInput.value, 10) || 0, 0, maxHp);
        this.monsterHpInput.value = String(nextValue);
        this.selectedMonster = {
          ...this.selectedMonster,
          inputs: { ...(this.selectedMonster.inputs || {}), monsterCurrentHp: nextValue },
        };
        this.recalculate();
      },
      { passive: true }
    );

    this.eventListener(
      this.attrsToggle,
      "click",
      () => {
        this.toggleCollapsible(this.attrsToggle, this.monsterAttrs);
      },
      { passive: true }
    );

    this.eventListener(
      this.defredToggle,
      "click",
      () => {
        this.toggleCollapsible(this.defredToggle, this.querySelector(".dps-calc__defred-body"));
      },
      { passive: true }
    );

    for (const input of this.querySelectorAll<HTMLInputElement>(".dps-calc__defred-input")) {
      this.eventListener(
        input,
        "input",
        () => {
          const key = input.dataset.defred;
          if (!key || !isNumericDefenceReductionKey(key)) return;
          this.defenceReductions[key] = Math.max(0, parseInt(input.value, 10) || 0);
          this.recalculate();
        },
        { passive: true }
      );
    }

    for (const checkbox of this.querySelectorAll<HTMLInputElement>(".dps-calc__defred-checkbox")) {
      this.eventListener(
        checkbox,
        "change",
        () => {
          const key = checkbox.dataset.defred;
          if (!key || !isBooleanDefenceReductionKey(key)) return;
          this.defenceReductions[key] = checkbox.checked;
          // Accursed and vulnerability are mutually exclusive
          if (key === "accursed" && checkbox.checked) {
            this.defenceReductions.vulnerability = false;
            const vulnCb = this.querySelector<HTMLInputElement>('.dps-calc__defred-checkbox[data-defred="vulnerability"]');
            if (vulnCb) vulnCb.checked = false;
          } else if (key === "vulnerability" && checkbox.checked) {
            this.defenceReductions.accursed = false;
            const accCb = this.querySelector<HTMLInputElement>('.dps-calc__defred-checkbox[data-defred="accursed"]');
            if (accCb) accCb.checked = false;
          }
          this.recalculate();
        },
        { passive: true }
      );
    }

    this.eventListener(
      this.monsettingsToggle,
      "click",
      () => {
        this.toggleCollapsible(this.monsettingsToggle, this.querySelector(".dps-calc__monsettings-body"));
      },
      { passive: true }
    );

    this.eventListener(
      this.showMoreBtn,
      "click",
      () => {
        this.resultsExpanded = !this.resultsExpanded;
        this.resultsExtraBody.style.display = this.resultsExpanded ? "block" : "none";
        this.showMoreBtn.innerHTML = this.resultsExpanded
          ? '<span class="dps-calc__show-more-arrow">&#x2191;</span>Show less<span class="dps-calc__show-more-arrow">&#x2191;</span>'
          : '<span class="dps-calc__show-more-arrow">&#x2193;</span>Show more<span class="dps-calc__show-more-arrow">&#x2193;</span>';
      },
      { passive: true }
    );

    this.eventListener(
      this.hitdistToggle,
      "click",
      () => {
        const isOpen = this.hitdistBody.style.display !== "none";
        this.hitdistBody.style.display = isOpen ? "none" : "block";
        this.hitdistToggle.querySelector(".dps-calc__chevron")?.classList.toggle("dps-calc__chevron--open", !isOpen);
        if (!isOpen) {
          this.renderHitDistribution();
        }
      },
      { passive: true }
    );

    this.eventListener(
      this.hitdistHideZeros,
      "change",
      (event) => {
        this.hideMisses = Boolean((event.target as HTMLInputElement | null)?.checked);
        this.renderHitDistribution();
      },
      { passive: true }
    );

    this.eventListener(
      document,
      "click",
      (event) => {
        const eventTarget = event.target as Node | null;
        if (!this.monsterResults.contains(eventTarget) && event.target !== this.monsterSearch) {
          this.monsterResults.style.display = "none";
        }

        const target = event.target instanceof Element ? event.target : null;
        const clickedInsideEquipSearch = target ? this.equipSearch.contains(target) : false;
        const clickedInlineSearch = target === this.equipSearchInline;
        const clickedEquipSlot = target ? !!target.closest(".dps-calc__equip-slot") : false;
        if (!clickedInsideEquipSearch && !clickedInlineSearch && !clickedEquipSlot) {
          this.closeEquipmentSearch();
        }
      },
      { passive: true }
    );

    this.subscribe("members-updated", (members) => {
      if (isNamedMemberList(members)) {
        this.populateMemberSelectFromData(members);
      }
    });
  }

  populateInitialUi() {
    this.populateMemberSelect();
    this.renderLoadoutTabs();
    this.renderPrayerGrid();
    this.renderBoostList();
    this.setActiveTab(this.activeTab);
    this.updatePlayerSummary();
    this.resultsExtraBody.style.display = "none";
    this.hitdistBody.style.display = "block";
    this.monsterInfo.style.display = "none";
    this.monsterAttrs.style.display = "none";
    this.querySelector<HTMLElement>(".dps-calc__defred-body")!.style.display = "none";
    this.querySelector<HTMLElement>(".dps-calc__monsettings-body")!.style.display = "block";
  }

  populateMemberSelect() {
    const mostRecent = pubsub.getMostRecent("members-updated");
    if (mostRecent && isNamedMemberList(mostRecent[0])) {
      this.populateMemberSelectFromData(mostRecent[0]);
    }
  }

  populateMemberSelectFromData(members?: Array<{ name: string }>) {
    this.memberSelect.innerHTML = "";
    if (!members) return;

    for (const member of members) {
      if (member.name === "@SHARED") continue;
      const option = document.createElement("option");
      option.value = member.name;
      option.textContent = member.name;
      this.memberSelect.appendChild(option);
    }

    if (this.memberSelect.options.length > 0 && !this.memberSelect.value) {
      this.memberSelect.value = this.memberSelect.options[0].value;
    }

    this.updatePlayerSummary();
  }

  calculateCombatLevel() {
    const base = 0.25 * (this.skills.def + this.skills.hp + Math.floor(this.skills.prayer / 2));
    const melee = 0.325 * (this.skills.atk + this.skills.str);
    const ranged = 0.325 * Math.floor((this.skills.ranged * 3) / 2);
    const magic = 0.325 * Math.floor((this.skills.magic * 3) / 2);
    return Math.floor(base + Math.max(melee, ranged, magic));
  }

  updatePlayerSummary() {
    if (!this.playerSummaryTitle || !this.playerSummaryLevel) return;

    const selectedMember = this.memberSelect?.value?.trim();
    this.playerSummaryTitle.textContent = selectedMember || "Manual Loadout";
    if (this.playerSummarySubtitle) {
      this.playerSummarySubtitle.textContent = "";
    }
    this.playerSummaryLevel.textContent = `Lvl ${this.calculateCombatLevel()}`;
  }

  setActiveTab(tab: string) {
    if (!TAB_ORDER.includes(tab as ActiveTab)) return;
    this.activeTab = tab as ActiveTab;

    for (const button of this.tabButtons) {
      button.classList.toggle("dps-calc__tab-btn--active", button.dataset.tab === tab);
    }

    for (const content of this.tabContents) {
      content.classList.toggle("dps-calc__tab-content--active", content.dataset.tabContent === tab);
    }

    if (tab === "combat") {
      this.updateCombatStyles();
    }
  }

  updateSkillValue(input: HTMLInputElement, value: string) {
    const skill = input.dataset.skill;
    const nextValue = clamp(parseInt(value, 10) || 1, 1, 99);
    input.value = String(nextValue);
    if (skill) {
      this.skills[skill] = nextValue;
    }
    this.updatePlayerSummary();
    this.recalculate();
  }

  async loadData() {
    try {
      this.allEquipment = await loadEquipmentData();
      this.equipmentDataLoaded = true;
    } catch (error) {
      console.warn("Failed to load equipment data:", error);
    }

    try {
      this.allMonsters = await loadMonsterData();
      this.monsterDataLoaded = true;
    } catch (error) {
      console.warn("Failed to load monster data:", error);
    }

    this.restoreFromStorage();
  }

  getMonsterDisplayName(monster: MonsterRecord) {
    return monster.name + (monster.version ? ` (${monster.version})` : "");
  }

  getMonsterImageSources(monster: MonsterRecord) {
    if (!monster?.image) return [MONSTER_IMAGE_FALLBACK];
    const encodedImage = encodeURIComponent(String(monster.image));
    return [
      `/images/monsters/${encodedImage}`,
      `/images/${encodedImage}`,
      `${MONSTER_IMAGE_BASE_URL}/${encodedImage}`,
      MONSTER_IMAGE_FALLBACK,
    ];
  }

  createMonsterImage(monster: MonsterRecord, className: string) {
    const image = document.createElement("img");
    const sources = this.getMonsterImageSources(monster);
    let sourceIndex = 0;

    image.className = className;
    image.loading = "lazy";
    image.alt = monster?.name || "Monster";
    image.src = sources[sourceIndex];
    image.addEventListener("error", () => {
      sourceIndex += 1;
      if (sourceIndex < sources.length) {
        image.src = sources[sourceIndex];
      }
    });

    return image;
  }

  renderSelectedMonster(monster: MonsterRecord) {
    this.monsterNameDisplay.innerHTML = "";
    const icon = this.createMonsterImage(monster, "dps-calc__monster-selected-icon");
    const content = document.createElement("div");

    const title = document.createElement("div");
    title.className = "dps-calc__monster-name-text";
    title.textContent = monster.name;
    content.appendChild(title);

    if (monster.version) {
      const version = document.createElement("div");
      version.className = "dps-calc__monster-name-version";
      version.textContent = monster.version;
      content.appendChild(version);
    }

    this.monsterNameDisplay.append(icon, content);
  }

  applyPreset(key: string) {
    const PRESETS: Record<string, PresetDefinition> = {
      max_melee: {
        head: 26382,
        cape: 21295,
        neck: 29801,
        ammo: 22947,
        body: 26384,
        shield: 22322,
        legs: 26386,
        hands: 22981,
        feet: 31097,
        ring: 28307,
      },
      max_ranged: {
        head: 27235,
        cape: 28955,
        neck: 19547,
        ammo: 11212,
        body: 27238,
        legs: 27241,
        hands: 26235,
        feet: 31097,
        ring: 28310,
      },
      max_mage: {
        head: 21018,
        cape: 21791,
        neck: 12002,
        ammo: 22947,
        body: 21021,
        legs: 21024,
        hands: 31106,
        feet: 31097,
        ring: 28313,
      },
      mid_melee: {
        head: 10828,
        cape: 6570,
        neck: 6585,
        ammo: 20229,
        body: 10551,
        shield: 12954,
        legs: 21304,
        hands: 7462,
        feet: 11840,
        ring: 11773,
      },
      mid_ranged: {
        head: 12496,
        cape: 22109,
        neck: 6585,
        ammo: 11212,
        body: 12492,
        legs: 12494,
        hands: 7462,
        feet: 19921,
        ring: 11771,
      },
      mid_mage: {
        head: 4708,
        cape: 21791,
        neck: 12002,
        ammo: 20229,
        body: 4712,
        legs: 4714,
        hands: 7462,
        feet: 6920,
        ring: 11770,
      },
      bowfa: {
        head: 23971,
        cape: 28955,
        neck: 19547,
        ammo: 22947,
        weapon: 25865,
        body: 23975,
        legs: 23979,
        hands: 26235,
        feet: 31097,
        ring: 28310,
      },
      blood_moon: {
        head: 29028,
        body: 29022,
        weapon: 28997,
        shield: null,
        legs: 29025,
      },
      dharoks: {
        head: 4716,
        cape: 21295,
        neck: 29801,
        ammo: 22947,
        weapon: 4718,
        body: 4720,
        shield: null,
        legs: 4722,
        hands: 22981,
        feet: 31097,
        ring: 28307,
      },
      veracs: {
        head: 4753,
        cape: 21295,
        neck: 29801,
        ammo: 22947,
        weapon: 4755,
        body: 4757,
        shield: null,
        legs: 4759,
        hands: 22981,
        feet: 31097,
        ring: 28307,
      },
      void_melee: {
        head: 11665,
        cape: 21295,
        neck: 29801,
        ammo: 22947,
        body: 13072,
        shield: 22322,
        legs: 13073,
        hands: 8842,
        feet: 31097,
        ring: 28307,
      },
      void_ranged: {
        head: 11664,
        cape: 28955,
        neck: 19547,
        ammo: 11212,
        body: 13072,
        legs: 13073,
        hands: 8842,
        feet: 31097,
        ring: 28310,
      },
      void_mage: {
        head: 11663,
        cape: 21791,
        neck: 12002,
        ammo: 22947,
        body: 13072,
        legs: 13073,
        hands: 8842,
        feet: 31097,
        ring: 28313,
      },
      tank: {
        head: 22326,
        cape: 21295,
        neck: 6585,
        ammo: 22947,
        weapon: 21015,
        body: 22327,
        shield: null,
        legs: 22328,
        hands: 7462,
        feet: 21733,
        ring: 19710,
      },
    };

    const preset = PRESETS[key];
    if (!preset) return;

    for (const slot of Object.keys(this.equipment)) {
      this.equipment[slot] = null;
    }
    for (const [slot, id] of Object.entries(preset)) {
      this.equipment[slot] = id !== null ? getEquipmentById(Number(id)) : null;
    }
    if (this.equipment.weapon?.isTwoHanded) {
      this.equipment.shield = null;
    }

    // Update loadout name from preset label
    const presetLabels: Record<string, string> = {
      max_melee: "Max Melee",
      max_ranged: "Max Ranged",
      max_mage: "Max Mage",
      mid_melee: "Mid Melee",
      mid_ranged: "Mid Ranged",
      mid_mage: "Mid Mage",
      bowfa: "Bowfa",
      blood_moon: "Blood Moon",
      dharoks: "Dharok's",
      veracs: "Verac's",
      void_melee: "Void Melee",
      void_ranged: "Void Ranged",
      void_mage: "Void Mage",
      tank: "Tank",
    };
    this.loadouts[this.selectedLoadout].name = presetLabels[key] || key;
    this.renderLoadoutTabs();

    this.updateEquipmentDisplay();
    this.updateCombatStyles();
    this.updateBonusDisplay();
    this.recalculate();
  }

  loadMemberEquipment() {
    const memberName = this.memberSelect.value;
    if (!memberName) return;

    const equipResult = pubsub.getMostRecent(`equipment:${memberName}`);
    const skillsResult = pubsub.getMostRecent(`skills:${memberName}`);
    const equipmentItems = (equipResult ? equipResult[0] : null) as InventoryLikeItem[] | null;
    const memberSkills = (skillsResult ? skillsResult[0] : null) as Record<string, { level?: number }> | null;

    this.equipment = {
      head: null,
      cape: null,
      neck: null,
      ammo: null,
      weapon: null,
      body: null,
      shield: null,
      legs: null,
      hands: null,
      feet: null,
      ring: null,
    };

    if (equipmentItems) {
      for (let index = 0; index < equipmentItems.length; index += 1) {
        const item = equipmentItems[index];
        if (!item || !item.isValid()) continue;
        const slotName = EQUIP_INDEX_TO_SLOT[index];
        if (!slotName) continue;
        const equipPiece = getEquipmentById(item.id);
        if (equipPiece) {
          this.equipment[slotName] = equipPiece;
        } else {
          // Item worn but not in DPS calc database - show it with zero stats
          this.equipment[slotName] = {
            id: item.id,
            name: `Unknown item (${item.id})`,
            slot: slotName,
            speed: 4,
            category: "",
            bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
            offensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
            defensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
          };
        }
      }
    }

    if (memberSkills) {
      this.skills.atk = Math.min(99, memberSkills.Attack?.level || 99);
      this.skills.str = Math.min(99, memberSkills.Strength?.level || 99);
      this.skills.def = Math.min(99, memberSkills.Defence?.level || 99);
      this.skills.ranged = Math.min(99, memberSkills.Ranged?.level || 99);
      this.skills.magic = Math.min(99, memberSkills.Magic?.level || 99);
      this.skills.prayer = Math.min(99, memberSkills.Prayer?.level || 99);
      this.skills.hp = Math.min(99, memberSkills.Hitpoints?.level || 99);

      for (const input of this.querySelectorAll<HTMLInputElement>(".dps-calc__stat-input")) {
        const skill = input.dataset.skill;
        if (this.skills[skill] !== undefined) {
          input.value = String(this.skills[skill]);
        }
      }
    }

    this.updateEquipmentDisplay();
    this.updateCombatStyles();
    this.updateBonusDisplay();
    this.loadouts[this.selectedLoadout].name = memberName;
    this.renderLoadoutTabs();
    this.updatePlayerSummary();
    this.recalculate();

    // If the member is in combat with an NPC, auto-select that monster (only if none set)
    if (this.monsterDataLoaded && !this.selectedMonster) {
      const interactingResult = pubsub.getMostRecent(`interacting:${memberName}`);
      const interacting = (interactingResult ? interactingResult[0] : null) as { name?: string } | null;
      if (interacting?.name) {
        const npcName = interacting.name.toLowerCase();
        const monster = this.allMonsters.find((m) => m.name.toLowerCase() === npcName);
        if (monster) {
          this.selectMonster(monster);
        }
      }
    }
  }

  updateEquipSlotHighlight() {
    for (const slotEl of this.querySelectorAll<HTMLElement>(".dps-calc__equip-slot")) {
      slotEl.classList.toggle("dps-calc__equip-slot--active", slotEl.dataset.slot === this.searchSlot);
    }
  }

  updateEquipmentDisplay() {
    for (const slotEl of this.querySelectorAll<HTMLElement>(".dps-calc__equip-slot")) {
      const slot = slotEl.dataset.slot as EquipmentSlot | undefined;
      const piece = this.equipment[slot];
      if (piece) {
        slotEl.innerHTML = `<img loading="lazy" src="/icons/items/${piece.id}.webp" title="${piece.name}" onerror="this.src='${SLOT_PLACEHOLDER[slot]}'" />`;
      } else {
        slotEl.innerHTML = `<img loading="lazy" src="${slot ? SLOT_PLACEHOLDER[slot] : SLOT_PLACEHOLDER.weapon}" class="dps-calc__slot-placeholder" />`;
      }
    }

    this.updateEquipSlotHighlight();
  }

  syncInlineSearchToOverlay() {
    this.equipSearchInput.value = this.equipSearchInline.value;
  }

  syncOverlaySearchToInline() {
    this.equipSearchInline.value = this.equipSearchInput.value;
  }

  openEquipmentSearch() {
    const anchor = this.equipSearchInline || this.querySelector(".dps-calc__equipment");
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const parentRect = this.getBoundingClientRect();
      this.equipSearch.style.left = `${rect.left - parentRect.left}px`;
      this.equipSearch.style.top = `${rect.bottom - parentRect.top + 4}px`;
    }

    this.equipSearch.style.display = "block";
    this.syncInlineSearchToOverlay();
    this.performEquipSearch();
  }

  closeEquipmentSearch() {
    this.equipSearch.style.display = "none";
    this.searchSlot = null;
    this.updateEquipSlotHighlight();
  }

  handleEquipSearchInput() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => this.performEquipSearch(), 120);
  }

  performEquipSearch() {
    const query = (this.equipSearchInput.value || "").toLowerCase().trim();
    this.equipSearchResults.innerHTML = "";

    if (this.searchSlot) {
      const clearElement = document.createElement("div");
      clearElement.className = "dps-calc__equip-search-item";
      clearElement.textContent = "Remove item";
      clearElement.addEventListener(
        "click",
        () => {
          this.equipment[this.searchSlot] = null;
          this.closeEquipmentSearch();
          this.equipSearchInline.value = "";
          this.updateEquipmentDisplay();
          this.updateCombatStyles();
          this.updateBonusDisplay();
          this.recalculate();
        },
        { passive: true }
      );
      this.equipSearchResults.appendChild(clearElement);
    }

    if (!this.equipmentDataLoaded || query.length < 2) return;

    const matches = [];
    for (const item of this.allEquipment) {
      if (this.searchSlot && item.slot !== this.searchSlot) continue;
      const name = item.name.toLowerCase();
      if (!name.includes(query)) continue;
      let score;
      if (name === query) score = 0;
      else if (name.startsWith(query)) score = 1;
      else score = 2 + name.indexOf(query);
      matches.push({ item, score });
    }
    matches.sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name));

    let count = 0;
    for (const { item } of matches) {
      if (count >= 50) break;

      const element = document.createElement("div");
      element.className = "dps-calc__equip-search-item";

      const icon = document.createElement("img");
      icon.loading = "lazy";
      icon.src = `/icons/items/${item.id}.webp`;
      icon.width = 24;
      icon.height = 24;
      icon.onerror = () => {
        icon.src = SLOT_PLACEHOLDER[item.slot] || SLOT_PLACEHOLDER.weapon;
      };

      const label = document.createElement("span");
      label.textContent = item.name + (item.version ? ` (${item.version})` : "");

      element.append(icon, label);
      element.addEventListener(
        "click",
        () => {
          const targetSlot = this.searchSlot || item.slot;
          if (!targetSlot) return;
          this.equipment[targetSlot] = item;
          if (targetSlot === "weapon" && item.isTwoHanded) {
            this.equipment.shield = null;
          }

          this.equipSearchInline.value = "";
          this.closeEquipmentSearch();
          this.updateEquipmentDisplay();
          this.updateCombatStyles();
          this.updateBonusDisplay();
          this.recalculate();
        },
        { passive: true }
      );

      this.equipSearchResults.appendChild(element);
      count += 1;
    }
  }

  renderBoostList() {
    const POTION_ICONS: Partial<Record<keyof typeof POTIONS, number | null>> = {
      none: null,
      attack: 121,
      strength: 113,
      magic: 3040,
      ranging: 169,
      super_attack: 145,
      super_strength: 157,
      super_magic: 11726,
      super_ranging: 11722,
      super_combat: 12695,
      overload: 11730,
      overload_plus: 20995,
      smelling_salts: 27343,
      imbued_heart: 20724,
      saturated_heart: 27641,
    };
    this.boostsList.innerHTML = "";
    for (const key of POTION_KEYS) {
      const potion = POTIONS[key];
      const item = document.createElement("div");
      item.className = "dps-calc__boost-item";
      item.classList.toggle("dps-calc__boost-item--active", this.selectedPotion === key);

      const iconId = POTION_ICONS[key];
      if (iconId) {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = `/icons/items/${iconId}.webp`;
        img.className = "dps-calc__boost-icon";
        item.appendChild(img);
      }

      const label = document.createElement("span");
      label.className = "dps-calc__boost-label";
      label.textContent = potion.name;

      const check = document.createElement("span");
      check.className = "dps-calc__boost-check";
      if (this.selectedPotion === key) {
        check.classList.add("dps-calc__boost-check--active");
        check.textContent = "✓";
      }

      item.append(label, check);
      item.addEventListener(
        "click",
        () => {
          this.selectedPotion = this.selectedPotion === key ? "none" : key;
          this.renderBoostList();
          this.recalculate();
        },
        { passive: true }
      );

      this.boostsList.appendChild(item);
    }
  }

  renderPrayerGrid() {
    this.prayerGrid.innerHTML = "";
    for (const [key, prayer] of Object.entries(PRAYERS)) {
      const item = document.createElement("div");
      item.className = "dps-calc__prayer-item";
      item.classList.toggle("dps-calc__prayer-item--active", this.selectedPrayers.has(key));
      item.title = prayer.name;

      const icon = document.createElement("img");
      icon.loading = "lazy";
      icon.src = `/images/prayers/${prayer.name.replace(/ /g, "_")}.png`;
      icon.className = "dps-calc__prayer-icon";

      item.appendChild(icon);
      item.addEventListener(
        "click",
        () => {
          if (this.selectedPrayers.has(key)) {
            this.selectedPrayers.delete(key);
          } else {
            const conflicts = getConflictingPrayers(key);
            for (const c of conflicts) this.selectedPrayers.delete(c);
            this.selectedPrayers.add(key);
          }
          this.renderPrayerGrid();
          this.recalculate();
        },
        { passive: true }
      );

      this.prayerGrid.appendChild(item);
    }
  }

  updateCombatStyles() {
    const weapon = this.equipment.weapon;
    const category = weapon?.category || "";
    const styles = getCombatStyles(category);
    const previousSelection = this.selectedStyle?.name;
    this.styleList.innerHTML = "";

    if (styles.length === 0) {
      this.selectedStyle = null;
      return;
    }

    this.selectedStyle = styles.find((style) => style.name === previousSelection) || styles[0];

    for (const style of styles) {
      const item = document.createElement("div");
      item.className = "dps-calc__style-item";
      item.classList.toggle(
        "dps-calc__style-item--active",
        this.selectedStyle.name === style.name && this.selectedStyle.type === style.type
      );

      const icon = document.createElement("img");
      icon.loading = "lazy";
      icon.src = getStyleIcon(style.type);
      icon.className = "dps-calc__stat-icon";

      const content = document.createElement("div");
      const name = document.createElement("div");
      name.className = "dps-calc__style-item-name";
      name.textContent = style.name;

      const type = document.createElement("div");
      type.className = "dps-calc__style-item-type";
      type.textContent = `${(style.type || "none").replace(/^./, (char) => char.toUpperCase())}, ${style.stance}`;
      content.append(name, type);

      const check = document.createElement("span");
      check.className = "dps-calc__style-item-check";
      check.textContent = item.classList.contains("dps-calc__style-item--active") ? "✓" : "";

      item.append(icon, content, check);
      item.addEventListener(
        "click",
        () => {
          this.selectedStyle = style;
          this.updateCombatStyles();
          this.recalculate();
        },
        { passive: true }
      );

      this.styleList.appendChild(item);
    }
  }

  updateBonusDisplay() {
    const totals = aggregateEquipmentBonuses(this.equipment);
    const speed = this.equipment.weapon?.speed ?? 0;
    this.querySelector('[data-bonus="off-stab"]').textContent = formatBonus(totals.offensive.stab);
    this.querySelector('[data-bonus="off-slash"]').textContent = formatBonus(totals.offensive.slash);
    this.querySelector('[data-bonus="off-crush"]').textContent = formatBonus(totals.offensive.crush);
    this.querySelector('[data-bonus="off-magic"]').textContent = formatBonus(totals.offensive.magic);
    this.querySelector('[data-bonus="off-ranged"]').textContent = formatBonus(totals.offensive.ranged);
    this.querySelector('[data-bonus="def-stab"]').textContent = formatBonus(totals.defensive.stab);
    this.querySelector('[data-bonus="def-slash"]').textContent = formatBonus(totals.defensive.slash);
    this.querySelector('[data-bonus="def-crush"]').textContent = formatBonus(totals.defensive.crush);
    this.querySelector('[data-bonus="def-magic"]').textContent = formatBonus(totals.defensive.magic);
    this.querySelector('[data-bonus="def-ranged"]').textContent = formatBonus(totals.defensive.ranged);
    this.querySelector('[data-bonus="str"]').textContent = formatBonus(totals.bonuses.str);
    this.querySelector('[data-bonus="ranged_str"]').textContent = formatBonus(totals.bonuses.ranged_str);
    this.querySelector('[data-bonus="magic_str"]').textContent = formatBonus(totals.bonuses.magic_str);
    this.querySelector('[data-bonus="prayer"]').textContent = formatBonus(totals.bonuses.prayer);
    this.querySelector('[data-bonus="speed"]').textContent = `${speed}`;
  }

  handleMonsterSearchInput() {
    clearTimeout(this.monsterSearchDebounceTimer);
    this.monsterSearchDebounceTimer = setTimeout(() => this.performMonsterSearch(), 120);
  }

  performMonsterSearch() {
    const query = this.monsterSearch.value.toLowerCase().trim();
    this.monsterResults.innerHTML = "";

    if (this.selectedMonster) {
      const clearItem = document.createElement("div");
      clearItem.className = "dps-calc__monster-result-item";
      clearItem.textContent = "Clear monster";
      clearItem.addEventListener("click", () => this.clearMonster(), { passive: true });
      this.monsterResults.appendChild(clearItem);
    }

    if (query.length < 2 || !this.monsterDataLoaded) {
      this.monsterResults.style.display = this.selectedMonster ? "block" : "none";
      return;
    }

    const matches = [];
    for (const monster of this.allMonsters) {
      const name = monster.name.toLowerCase();
      if (!name.includes(query)) continue;
      // Score: exact match > starts with > earlier index > alphabetical
      let score;
      if (name === query) score = 0;
      else if (name.startsWith(query)) score = 1;
      else score = 2 + name.indexOf(query);
      matches.push({ monster, score });
    }
    matches.sort((a, b) => a.score - b.score || a.monster.name.localeCompare(b.monster.name));

    let count = 0;
    for (const { monster } of matches) {
      if (count >= 30) break;

      const item = document.createElement("div");
      item.className = "dps-calc__monster-result-item";

      const icon = this.createMonsterImage(monster, "dps-calc__monster-result-icon");
      const content = document.createElement("div");

      const name = document.createElement("div");
      const nameText = document.createElement("span");
      nameText.textContent = monster.name;
      name.appendChild(nameText);

      if (monster.version) {
        const version = document.createElement("span");
        version.className = "dps-calc__monster-result-version";
        version.textContent = ` (${monster.version})`;
        name.appendChild(version);
      }

      const meta = document.createElement("div");
      meta.className = "dps-calc__monster-result-meta";
      meta.textContent = `HP: ${monster.skills.hp}, Def: ${monster.skills.def}`;

      content.append(name, meta);
      item.append(icon, content);
      item.addEventListener("click", () => this.selectMonster(monster), { passive: true });
      this.monsterResults.appendChild(item);
      count += 1;
    }

    this.monsterResults.style.display = count > 0 || this.selectedMonster ? "block" : "none";
  }

  clearMonster() {
    this.selectedMonster = null;
    this.monsterSearch.value = "";
    this.monsterResults.style.display = "none";
    this.monsterInfo.style.display = "none";
    this.monsterNameDisplay.innerHTML = "";
    this.hitDistribution = [];
    this.loadoutResults = [];
    this.renderResults();
    this.renderHitDistribution();
    this.persistToStorage();
  }

  selectMonster(monster: MonsterRecord) {
    this.selectedMonster = {
      ...monster,
      inputs: { ...(monster.inputs || {}), monsterCurrentHp: monster.skills?.hp || 1 },
    };

    this.monsterSearch.value = "";
    this.monsterResults.style.display = "none";
    this.monsterInfo.style.display = "block";
    this.renderSelectedMonster(monster);

    const skills = monster.skills || {};
    const def = monster.defensive || {};
    const off = monster.offensive || {};

    this.querySelector('[data-mstat="hp"]').textContent = String(skills.hp ?? 0);
    this.querySelector('[data-mstat="atk"]').textContent = String(skills.atk ?? 0);
    this.querySelector('[data-mstat="str"]').textContent = String(skills.str ?? 0);
    this.querySelector('[data-mstat="def"]').textContent = String(skills.def ?? 0);
    this.querySelector('[data-mstat="magic"]').textContent = String(skills.magic ?? 0);
    this.querySelector('[data-mstat="ranged"]').textContent = String(skills.ranged ?? 0);
    this.querySelector('[data-mstat="off-atk"]').textContent = String(off.atk ?? 0);
    this.querySelector('[data-mstat="off-str"]').textContent = String(off.str ?? 0);
    this.querySelector('[data-mstat="off-magic"]').textContent = String(off.magic ?? 0);
    this.querySelector('[data-mstat="off-mstr"]').textContent = String(off.magic_str ?? 0);
    this.querySelector('[data-mstat="off-range"]').textContent = String(off.ranged ?? 0);
    this.querySelector('[data-mstat="off-rstr"]').textContent = String(off.ranged_str ?? 0);
    this.querySelector('[data-mstat="def-stab"]').textContent = String(def.stab ?? 0);
    this.querySelector('[data-mstat="def-slash"]').textContent = String(def.slash ?? 0);
    this.querySelector('[data-mstat="def-crush"]').textContent = String(def.crush ?? 0);
    this.querySelector('[data-mstat="def-magic"]').textContent = String(def.magic ?? 0);
    this.querySelector('[data-mstat="def-light"]').textContent = String(def.light ?? 0);
    this.querySelector('[data-mstat="def-standard"]').textContent = String(def.standard ?? 0);
    this.querySelector('[data-mstat="def-heavy"]').textContent = String(def.heavy ?? 0);

    if (monster.elementalWeaknessType && monster.elementalWeaknessPercent) {
      this.monsterWeakness.textContent = `Weak to ${monster.elementalWeaknessType}: +${monster.elementalWeaknessPercent}%`;
      this.monsterWeakness.style.display = "block";
    } else {
      this.monsterWeakness.style.display = "none";
    }

    const attrs = monster.attributes || [];
    this.monsterAttrList.innerHTML = "";
    for (const attr of attrs) {
      const tag = document.createElement("span");
      tag.className = "dps-calc__monster-attr-tag";
      tag.textContent = String(attr);
      this.monsterAttrList.appendChild(tag);
    }

    this.monsterHpInput.max = String(skills.hp ?? 1);
    this.monsterHpInput.value = String(skills.hp ?? 1);

    // Reset defensive reductions
    this.defenceReductions = {
      elderMaul: 0,
      dwh: 0,
      arclight: 0,
      emberlight: 0,
      tonalztic: 0,
      bgs: 0,
      seercull: 0,
      ayak: 0,
      accursed: false,
      vulnerability: false,
    };
    for (const input of this.querySelectorAll<HTMLInputElement>(".dps-calc__defred-input")) {
      input.value = "0";
    }
    for (const cb of this.querySelectorAll<HTMLInputElement>(".dps-calc__defred-checkbox")) {
      cb.checked = false;
    }

    this.recalculate();
  }

  toggleCollapsible(button: HTMLElement | null, body: HTMLElement | null) {
    if (!button || !body) return;
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "block";
    button.querySelector(".dps-calc__chevron")?.classList.toggle("dps-calc__chevron--open", !isOpen);
  }

  _calculateForLoadout(lo: Loadout): DpsResult | null {
    if (!lo.selectedStyle || !this.selectedMonster) return null;
    const potionKey = lo.selectedPotion in POTIONS ? (lo.selectedPotion as keyof typeof POTIONS) : "none";
    const potion = POTIONS[potionKey] || POTIONS.none;
    const boosts = potion ? potion.calc(lo.skills) : {};
    return calculateDps({
      skills: lo.skills,
      boosts,
      equipment: lo.equipment,
      style: lo.selectedStyle,
      prayerKeys: [...lo.selectedPrayers],
      onSlayerTask: lo.onSlayerTask,
      monster: this.selectedMonster,
      spell: null,
      defenceReductions: this.defenceReductions,
      buffs: {
        inWilderness: lo.extraBuffs.inWilderness,
        forinthrySurge: lo.extraBuffs.forinthrySurge,
        kandarinDiary: lo.extraBuffs.kandarinDiary,
        soulreaperStacks: lo.extraBuffs.soulreaperStacks,
        baAttackerLevel: lo.extraBuffs.baAttackerLevel,
        chinchompaDistance: lo.extraBuffs.chinchompaDistance,
        currentHp: lo.skills.hp,
      },
    });
  }

  recalculate() {
    this.saveCurrentLoadout();

    // Calculate all loadouts
    this.loadoutResults = this.loadouts.map((lo) => this._calculateForLoadout(lo));

    // Hit distribution for selected loadout
    const activeResult = this.loadoutResults[this.selectedLoadout];
    this.hitDistribution = activeResult && Array.isArray(activeResult.hitDist) ? activeResult.hitDist : [];

    this.renderResults();
    this.renderHitDistribution();
    this.persistToStorage();
  }

  renderResults() {
    const results = this.loadoutResults;
    const count = results.length;
    const multi = count > 1;

    const ROWS: ResultRow[] = [
      {
        key: "maxHit",
        label: "Max hit",
        title: "The maximum hit that you will deal to the monster",
        format: (v) => (v !== null && v !== undefined ? `${Math.max(0, v)}` : "-"),
        best: "max",
      },
      {
        key: "dps",
        label: "DPS",
        title: "The average damage you will deal per-second",
        format: (v) => (Number.isFinite(v) ? v.toFixed(3) : "-"),
        best: "max",
        highlight: true,
      },
      {
        key: "ttk",
        label: "Avg. TTK",
        title: "The average time (in seconds) it will take to defeat the monster",
        format: (v) => (Number.isFinite(v) && v > 0 ? `${v.toFixed(1)}s` : "-"),
        best: "min",
      },
      {
        key: "accuracy",
        label: "Accuracy",
        title: "How accurate you are against the monster",
        format: (v) => (Number.isFinite(v) ? `${v.toFixed(2)}%` : "-"),
        best: "max",
      },
      {
        key: "specExpected",
        label: "Spec expected hit",
        title: "Expected damage of the special attack per use, including misses",
        format: (v) => (Number.isFinite(v) ? v.toFixed(1) : "-"),
        best: "max",
      },
    ];
    const EXTRA_ROWS: ResultRow[] = [
      {
        key: "attackSpeed",
        label: "Attack Speed",
        title: "Attack speed in ticks and seconds",
        format: (v) => (Number.isFinite(v) && v > 0 ? `${v}t (${(v * 0.6).toFixed(1)}s)` : "-"),
        best: "min",
      },
      {
        key: "htk",
        label: "Avg. Hits to Kill",
        title: "Average number of hits to defeat the monster",
        format: (v) => (Number.isFinite(v) && v > 0 ? v.toFixed(1) : "-"),
        best: "min",
      },
    ];

    const buildTable = (rows: ResultRow[]) => {
      const table = document.createElement("table");
      table.className = "dps-calc__results-table";

      if (multi) {
        const thead = document.createElement("thead");
        const hRow = document.createElement("tr");
        const blank = document.createElement("th");
        blank.className = "dps-calc__rt-label";
        hRow.appendChild(blank);
        this.loadouts.forEach((lo, i) => {
          const th = document.createElement("th");
          th.className = "dps-calc__rt-header";
          th.classList.toggle("dps-calc__rt-header--active", i === this.selectedLoadout);
          th.textContent = lo.name;
          th.addEventListener("click", () => this.switchLoadout(i), { passive: true });
          hRow.appendChild(th);
        });
        thead.appendChild(hRow);
        table.appendChild(thead);
      }

      const tbody = document.createElement("tbody");
      for (const row of rows) {
        const tr = document.createElement("tr");
        const labelTd = document.createElement("td");
        labelTd.className = "dps-calc__rt-label";
        const labelSpan = document.createElement("span");
        labelSpan.className = "dps-calc__rt-underline";
        labelSpan.title = row.title;
        labelSpan.textContent = row.label;
        labelTd.appendChild(labelSpan);
        tr.appendChild(labelTd);

        // Find best value for highlighting
        const values = results.map((r) => (r ? (r[row.key] as number | null | undefined) : null));
        const numericValues = values.filter((v) => Number.isFinite(v) && (v as number) > 0) as number[];
        let bestValue = null;
        if (multi && numericValues.length > 0) {
          bestValue = row.best === "min" ? Math.min(...numericValues) : Math.max(...numericValues);
        }

        for (let i = 0; i < count; i++) {
          const td = document.createElement("td");
          td.className = "dps-calc__rt-value";
          if (row.highlight) td.classList.add("dps-calc__rt-value--dps");
          const val = results[i] ? (results[i][row.key] as number | null | undefined) : null;
          td.textContent = row.format(val);
          if (multi && bestValue !== null && Number.isFinite(val) && val === bestValue && numericValues.length > 1) {
            td.classList.add("dps-calc__rt-value--best");
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      return table;
    };

    this.resultsBody.innerHTML = "";
    this.resultsBody.appendChild(buildTable(ROWS));

    this.resultsExtraBody.innerHTML = "";
    this.resultsExtraBody.appendChild(buildTable(EXTRA_ROWS));
  }

  renderHitDistribution() {
    if (!this.hitdistCanvas) return;
    const canvas = this.hitdistCanvas;
    const context = canvas.getContext("2d");
    if (!context) return;

    const data = this.hideMisses
      ? this.hitDistribution.filter((point) => parseInt(point.name, 10) !== 0)
      : this.hitDistribution;

    const width = canvas.clientWidth || 460;
    const height = 225;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(255, 255, 255, 0.02)";
    context.fillRect(0, 0, width, height);

    if (data.length === 0) {
      context.fillStyle = "#8b857d";
      context.font = "13px sans-serif";
      context.textAlign = "center";
      context.fillText("Select a monster and combat style to view hit distribution", width / 2, height / 2);
      return;
    }

    const padding = { top: 18, right: 16, bottom: 36, left: 44 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const highest = Math.max(...data.map((point) => point.value), 0.01);
    const stepSize = 10 ** Math.floor(Math.log10(highest) - 1);
    const domainMax = Math.ceil(highest / stepSize) * stepSize;
    const yTicks = 4;

    context.strokeStyle = "rgba(160, 160, 160, 0.5)";
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    for (let tick = 0; tick <= yTicks; tick += 1) {
      const y = padding.top + (plotHeight / yTicks) * tick;
      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(width - padding.right, y);
      context.stroke();
    }

    const xStep = plotWidth / data.length;
    for (let index = 0; index <= data.length; index += 1) {
      const x = padding.left + xStep * index;
      context.beginPath();
      context.moveTo(x, padding.top);
      context.lineTo(x, padding.top + plotHeight);
      context.stroke();
    }

    context.setLineDash([]);
    context.strokeStyle = "#6b655c";
    context.beginPath();
    context.moveTo(padding.left, padding.top);
    context.lineTo(padding.left, padding.top + plotHeight);
    context.lineTo(width - padding.right, padding.top + plotHeight);
    context.stroke();

    const barWidth = Math.max(6, xStep - 5);
    context.fillStyle = "#d7b98a";
    data.forEach((point, index) => {
      const ratio = domainMax === 0 ? 0 : point.value / domainMax;
      const barHeight = ratio * plotHeight;
      const x = padding.left + xStep * index + (xStep - barWidth) / 2;
      const y = padding.top + plotHeight - barHeight;
      context.fillRect(x, y, barWidth, barHeight);
    });

    context.fillStyle = "#8f877c";
    context.font = "11px sans-serif";
    context.textAlign = "right";
    for (let tick = 0; tick <= yTicks; tick += 1) {
      const value = domainMax - (domainMax / yTicks) * tick;
      const y = padding.top + (plotHeight / yTicks) * tick + 4;
      context.fillText(`${parseFloat((value * 100).toFixed(2))}%`, padding.left - 6, y);
    }

    const xLabelStep = data.length > 16 ? Math.ceil(data.length / 12) : 1;
    context.textAlign = "center";
    data.forEach((point, index) => {
      if (index % xLabelStep !== 0) return;
      const x = padding.left + xStep * index + xStep / 2;
      context.fillText(`${point.name}`, x, height - 18);
    });

    context.save();
    context.translate(14, padding.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText("chance", 0, 0);
    context.restore();
    context.fillText("hitsplat", padding.left + plotWidth / 2, height - 2);
  }
}

DpsCalc.STORAGE_KEY = "dps-calc-state";

customElements.define("dps-calc", DpsCalc);
