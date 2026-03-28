/**
 * DPS Calculator Engine - 1:1 port from osrs-dps-calc
 * Full PlayerVsNPCCalc + BaseCalc port to vanilla JS.
 */
import {
  Hitsplat,
  WeightedHit,
  HitDistribution,
  AttackDistribution,
  flatLimitTransformer,
  linearMinTransformer,
  cappedRerollTransformer,
  multiplyTransformer,
  divisionTransformer,
  flatAddTransformer,
} from "./dps-calc-hitdist";

import {
  SECONDS_PER_TICK,
  DEFAULT_ATTACK_SPEED,
  BLOWPIPE_IDS,
  TOMBS_OF_AMASCUT_MONSTER_IDS,
  VERZIK_P1_IDS,
  TEKTON_IDS,
  GUARDIAN_IDS,
  OLM_HEAD_IDS,
  OLM_MELEE_HAND_IDS,
  OLM_MAGE_HAND_IDS,
  GLOWING_CRYSTAL_IDS,
  ICE_DEMON_IDS,
  VESPULA_IDS,
  NIGHTMARE_TOTEM_IDS,
  ZULRAH_IDS,
  IMMUNE_TO_MELEE_DAMAGE_NPC_IDS,
  IMMUNE_TO_NON_SALAMANDER_MELEE_DAMAGE_NPC_IDS,
  IMMUNE_TO_RANGED_DAMAGE_NPC_IDS,
  IMMUNE_TO_MAGIC_DAMAGE_NPC_IDS,
  IMMUNE_TO_BURN_DAMAGE_NPC_IDS,
  USES_DEFENCE_LEVEL_FOR_MAGIC_DEFENCE_NPC_IDS,
  BA_ATTACKER_MONSTERS,
  ONE_HIT_MONSTERS,
  ALWAYS_MAX_HIT_MONSTERS,
  GUARANTEED_ACCURACY_MONSTERS,
  WEAPON_SPEC_COSTS,
  CAST_STANCES,
  MonsterAttribute,
  EquipmentCategory,
  P2_WARDEN_IDS,
  KEPHRI_OVERLORD_IDS,
  HUEYCOATL_TAIL_IDS,
  HUEYCOATL_PHASE_IDS,
  DOOM_OF_MOKHAIOTL_IDS,
  ABYSSAL_SIRE_TRANSITION_IDS,
  YAMA_IDS,
  YAMA_VOID_FLARE_IDS,
  ECLIPSE_MOON_IDS,
  TITAN_BOSS_IDS,
  TITAN_ELEMENTAL_IDS,
  VERZIK_IDS,
  VARDORVIS_IDS,
  SOTETSEG_IDS,
  NIGHTMARE_IDS,
  AKKHA_IDS,
  BABA_IDS,
  KEPHRI_SHIELDED_IDS,
  KEPHRI_UNSHIELDED_IDS,
  ZEBAK_IDS,
  P3_WARDEN_IDS,
  TOA_OBELISK_IDS,
  NEX_IDS,
  ARAXXOR_IDS,
  HUEYCOATL_IDS,
} from "./dps-calc-constants";

import { dClawDist, burningClawSpec, burningClawDoT } from "./dps-calc-claws";
import { opalBolts, pearlBolts, diamondBolts, dragonstoneBolts, onyxBolts, rubyBolts } from "./dps-calc-bolts";

export type NumericStatMap = Record<string, number>;

export type CalcEquipmentPiece = {
  id: number;
  name: string;
  version?: string;
  category?: string;
  speed?: number;
  isTwoHanded?: boolean;
  bonuses?: NumericStatMap;
  offensive?: NumericStatMap;
  defensive?: NumericStatMap;
  itemVars?: Record<string, number>;
  [key: string]: unknown;
};

export type CalcSpell = {
  name?: string;
  spellbook?: string;
  element?: string;
  max_hit?: number;
  [key: string]: unknown;
};

export type CalcBuffs = {
  onSlayerTask?: boolean;
  inWilderness?: boolean;
  forinthrySurge?: boolean;
  chargeSpell?: boolean;
  markOfDarkness?: boolean;
  markOfDarknessSpell?: boolean;
  usingSunfireRunes?: boolean;
  sunfireRunes?: boolean;
  soulreaperStacks?: number;
  kandarinDiary?: boolean;
  currentHp?: number;
  baAttackerLevel?: number;
  chinchompaDistance?: number;
  [key: string]: boolean | number | undefined;
};

export type CalcCombatStyle = {
  name?: string;
  type: string;
  stance: string;
  [key: string]: unknown;
};

export type CalcMonster = {
  id: number;
  name: string;
  version?: string | null;
  size?: number;
  attributes?: Array<string | number>;
  skills: NumericStatMap;
  inputs?: Record<string, string | number | boolean | undefined>;
  offensive?: NumericStatMap;
  defensive?: NumericStatMap;
  weakness?: { element?: string; severity?: number };
  [key: string]: unknown;
};

export type CalcPlayer = {
  skills: NumericStatMap;
  boosts: NumericStatMap;
  equipment: Record<string, CalcEquipmentPiece | null>;
  style: CalcCombatStyle;
  spell?: CalcSpell | null;
  prayers?: string[];
  buffs: CalcBuffs;
  bonuses: NumericStatMap;
  offensive: NumericStatMap;
  defensive: NumericStatMap;
  currentPrayer?: number;
  attackSpeed?: number;
  [key: string]: unknown;
};

export type DefenceReductionMap = Record<string, number | boolean | undefined>;

export type CalcOptions = {
  usingSpecialAttack?: boolean;
  disableMonsterScaling?: boolean;
  overrideDefenceRoll?: number;
  baseMonster?: CalcMonster;
  defenceReductions?: DefenceReductionMap;
  [key: string]: unknown;
};

export type DpsHistogramPoint = { name: string; value: number };

export type DpsResult = {
  dps: number;
  maxHit: number;
  minHit?: number;
  accuracy: number;
  attackSpeed: number;
  attackRoll: number;
  defenceRoll: number;
  htk: number;
  ttk: number;
  hitDist: DpsHistogramPoint[];
  specExpected?: number | null;
  dotExpected?: number;
  dotMax?: number;
};

type CombatDamageStyle = "melee" | "ranged" | "magic";

type CalculateDpsInput = {
  skills: NumericStatMap;
  boosts?: NumericStatMap;
  equipment?: Record<string, CalcEquipmentPiece | null>;
  style: CalcCombatStyle | null;
  prayerKeys?: string[];
  onSlayerTask?: boolean;
  monster: CalcMonster | null;
  spell?: CalcSpell | null;
  buffs?: CalcBuffs;
  defenceReductions?: DefenceReductionMap;
};

type EquipmentBonusTotals = {
  bonuses: NumericStatMap;
  offensive: NumericStatMap;
  defensive: NumericStatMap;
};

type PrayerFactor = [number, number] | null;

type PrayerDefinition = {
  name: string;
  combatStyle: string;
  factorAccuracy: PrayerFactor;
  factorStrength: PrayerFactor;
  factorDefence: PrayerFactor;
  drainRate: number;
};

type PotionDefinition = {
  name: string;
  calc: (skills: NumericStatMap) => NumericStatMap;
};

function getReductionNumber(reductions: DefenceReductionMap, key: string): number {
  return Number(reductions[key] || 0);
}

function getCombatDamageStyle(styleType: string): CombatDamageStyle {
  if (styleType === "ranged") return "ranged";
  if (styleType === "magic") return "magic";
  return "melee";
}

function isVampyre(attrs: Array<string | number>) {
  return (attrs || []).some(
    (a) => a === MonsterAttribute.VAMPYRE_1 || a === MonsterAttribute.VAMPYRE_2 || a === MonsterAttribute.VAMPYRE_3
  );
}

// ── Data loading ──
let equipmentData: CalcEquipmentPiece[] | null = null;
let monsterData: CalcMonster[] | null = null;
let spellData: CalcSpell[] | null = null;
let equipmentById: Map<number, CalcEquipmentPiece> | null = null;

export async function loadEquipmentData() {
  if (equipmentData) return equipmentData;
  const resp = await fetch("/data/equipment.json");
  equipmentData = await resp.json();
  equipmentById = new Map();
  for (const item of equipmentData) equipmentById.set(item.id, item);
  return equipmentData;
}

export async function loadMonsterData() {
  if (monsterData) return monsterData;
  const resp = await fetch("/data/monsters.json");
  monsterData = await resp.json();
  return monsterData;
}

export async function loadSpellData() {
  if (spellData) return spellData;
  const resp = await fetch("/data/spells.json");
  spellData = await resp.json();
  return spellData;
}

export function getEquipmentById(id: number) {
  return equipmentById?.get(id) || null;
}

export function getSpells() {
  return spellData || [];
}

export function spellByName(name: string) {
  return spellData?.find((s) => s.name === name) || null;
}

// ── Prayers ──
export const PRAYERS: Record<string, PrayerDefinition> = {
  thick_skin: {
    name: "Thick Skin",
    combatStyle: "melee",
    factorAccuracy: null,
    factorStrength: null,
    factorDefence: [105, 100],
    drainRate: 3,
  },
  burst_of_strength: {
    name: "Burst of Strength",
    combatStyle: "melee",
    factorAccuracy: null,
    factorStrength: [105, 100],
    factorDefence: null,
    drainRate: 3,
  },
  clarity_of_thought: {
    name: "Clarity of Thought",
    combatStyle: "melee",
    factorAccuracy: [105, 100],
    factorStrength: null,
    factorDefence: null,
    drainRate: 3,
  },
  rock_skin: {
    name: "Rock Skin",
    combatStyle: "melee",
    factorAccuracy: null,
    factorStrength: null,
    factorDefence: [110, 100],
    drainRate: 6,
  },
  superhuman_strength: {
    name: "Superhuman Strength",
    combatStyle: "melee",
    factorAccuracy: null,
    factorStrength: [110, 100],
    factorDefence: null,
    drainRate: 6,
  },
  improved_reflexes: {
    name: "Improved Reflexes",
    combatStyle: "melee",
    factorAccuracy: [110, 100],
    factorStrength: null,
    factorDefence: null,
    drainRate: 6,
  },
  steel_skin: {
    name: "Steel Skin",
    combatStyle: "melee",
    factorAccuracy: null,
    factorStrength: null,
    factorDefence: [115, 100],
    drainRate: 12,
  },
  ultimate_strength: {
    name: "Ultimate Strength",
    combatStyle: "melee",
    factorAccuracy: null,
    factorStrength: [115, 100],
    factorDefence: null,
    drainRate: 12,
  },
  incredible_reflexes: {
    name: "Incredible Reflexes",
    combatStyle: "melee",
    factorAccuracy: [115, 100],
    factorStrength: null,
    factorDefence: null,
    drainRate: 12,
  },
  chivalry: {
    name: "Chivalry",
    combatStyle: "melee",
    factorAccuracy: [115, 100],
    factorStrength: [118, 100],
    factorDefence: [120, 100],
    drainRate: 24,
  },
  piety: {
    name: "Piety",
    combatStyle: "melee",
    factorAccuracy: [120, 100],
    factorStrength: [123, 100],
    factorDefence: [125, 100],
    drainRate: 24,
  },
  sharp_eye: {
    name: "Sharp Eye",
    combatStyle: "ranged",
    factorAccuracy: [105, 100],
    factorStrength: [105, 100],
    factorDefence: null,
    drainRate: 3,
  },
  hawk_eye: {
    name: "Hawk Eye",
    combatStyle: "ranged",
    factorAccuracy: [110, 100],
    factorStrength: [110, 100],
    factorDefence: null,
    drainRate: 6,
  },
  eagle_eye: {
    name: "Eagle Eye",
    combatStyle: "ranged",
    factorAccuracy: [115, 100],
    factorStrength: [115, 100],
    factorDefence: null,
    drainRate: 12,
  },
  deadeye: {
    name: "Deadeye",
    combatStyle: "ranged",
    factorAccuracy: [118, 100],
    factorStrength: [118, 100],
    factorDefence: null,
    drainRate: 24,
  },
  rigour: {
    name: "Rigour",
    combatStyle: "ranged",
    factorAccuracy: [120, 100],
    factorStrength: [123, 100],
    factorDefence: [125, 100],
    drainRate: 24,
  },
  mystic_will: {
    name: "Mystic Will",
    combatStyle: "magic",
    factorAccuracy: [105, 100],
    factorStrength: null,
    factorDefence: null,
    drainRate: 3,
  },
  mystic_lore: {
    name: "Mystic Lore",
    combatStyle: "magic",
    factorAccuracy: [110, 100],
    factorStrength: null,
    factorDefence: null,
    drainRate: 6,
  },
  mystic_might: {
    name: "Mystic Might",
    combatStyle: "magic",
    factorAccuracy: [115, 100],
    factorStrength: null,
    factorDefence: null,
    drainRate: 12,
  },
  mystic_vigour: {
    name: "Mystic Vigour",
    combatStyle: "magic",
    factorAccuracy: [118, 100],
    factorStrength: null,
    factorDefence: null,
    drainRate: 18,
  },
  augury: {
    name: "Augury",
    combatStyle: "magic",
    factorAccuracy: [125, 100],
    factorStrength: null,
    factorDefence: [125, 100],
    drainRate: 24,
  },
};

// ARM prayers (melee strength only), BRAIN prayers (melee accuracy only),
// and SKIN prayers (defence only) can all stack with each other.
// All other offensive prayers are solo (they bundle multiple stats).
const ARM_PRAYERS = new Set(["burst_of_strength", "superhuman_strength", "ultimate_strength"]);
const BRAIN_PRAYERS = new Set(["clarity_of_thought", "improved_reflexes", "incredible_reflexes"]);
const SKIN_PRAYERS = new Set(["thick_skin", "rock_skin", "steel_skin"]);

export function getConflictingPrayers(key: string) {
  if (ARM_PRAYERS.has(key)) {
    // ARM: conflicts with other ARMs and all non-BRAIN/non-SKIN prayers
    return new Set([...Object.keys(PRAYERS)].filter((k) => k !== key && !BRAIN_PRAYERS.has(k) && !SKIN_PRAYERS.has(k)));
  }
  if (BRAIN_PRAYERS.has(key)) {
    // BRAIN: conflicts with other BRAINs and all non-ARM/non-SKIN prayers
    return new Set([...Object.keys(PRAYERS)].filter((k) => k !== key && !ARM_PRAYERS.has(k) && !SKIN_PRAYERS.has(k)));
  }
  if (SKIN_PRAYERS.has(key)) {
    // SKIN: conflicts with other SKINs and all non-ARM/non-BRAIN prayers
    return new Set([...Object.keys(PRAYERS)].filter((k) => k !== key && !ARM_PRAYERS.has(k) && !BRAIN_PRAYERS.has(k)));
  }
  // Everything else (Piety, Rigour, Eagle Eye, etc.): conflicts with ALL other prayers
  return new Set([...Object.keys(PRAYERS)].filter((k) => k !== key));
}

const PRAYER_MAGIC_DMG: Record<string, number> = {
  mystic_will: 0,
  mystic_lore: 10,
  mystic_might: 20,
  mystic_vigour: 30,
  augury: 40,
};

// ── Potions ──
export const POTIONS: Record<string, PotionDefinition> = {
  none: { name: "None", calc: () => ({}) },
  attack: { name: "Attack", calc: (s) => ({ atk: Math.floor(3 + s.atk * 0.1) }) },
  strength: { name: "Strength", calc: (s) => ({ str: Math.floor(3 + s.str * 0.1) }) },
  magic: { name: "Magic", calc: () => ({ magic: 4 }) },
  ranging: { name: "Ranging", calc: (s) => ({ ranged: Math.floor(4 + s.ranged * 0.1) }) },
  super_attack: { name: "Super Attack", calc: (s) => ({ atk: Math.floor(5 + s.atk * 0.15) }) },
  super_strength: { name: "Super Strength", calc: (s) => ({ str: Math.floor(5 + s.str * 0.15) }) },
  super_magic: { name: "Super Magic", calc: (s) => ({ magic: Math.floor(5 + s.magic * 0.15) }) },
  super_ranging: { name: "Super Ranging", calc: (s) => ({ ranged: Math.floor(5 + s.ranged * 0.15) }) },
  super_combat: {
    name: "Super Combat",
    calc: (s) => ({
      atk: Math.floor(5 + s.atk * 0.15),
      str: Math.floor(5 + s.str * 0.15),
      def: Math.floor(5 + s.def * 0.15),
    }),
  },
  overload: {
    name: "Overload",
    calc: (s) => ({
      atk: Math.floor(5 + s.atk * 0.13),
      str: Math.floor(5 + s.str * 0.13),
      def: Math.floor(5 + s.def * 0.13),
      magic: Math.floor(5 + s.magic * 0.13),
      ranged: Math.floor(5 + s.ranged * 0.13),
    }),
  },
  overload_plus: {
    name: "Overload (+)",
    calc: (s) => ({
      atk: Math.floor(6 + s.atk * 0.16),
      str: Math.floor(6 + s.str * 0.16),
      def: Math.floor(6 + s.def * 0.16),
      magic: Math.floor(6 + s.magic * 0.16),
      ranged: Math.floor(6 + s.ranged * 0.16),
    }),
  },
  smelling_salts: {
    name: "Smelling Salts",
    calc: (s) => ({
      atk: Math.floor(11 + s.atk * 0.16),
      str: Math.floor(11 + s.str * 0.16),
      def: Math.floor(11 + s.def * 0.16),
      magic: Math.floor(11 + s.magic * 0.16),
      ranged: Math.floor(11 + s.ranged * 0.16),
    }),
  },
  imbued_heart: { name: "Imbued Heart", calc: (s) => ({ magic: Math.floor(1 + s.magic * 0.1) }) },
  saturated_heart: { name: "Saturated Heart", calc: (s) => ({ magic: Math.floor(4 + s.magic * 0.1) }) },
};

// ── Defence Reductions ──
function getDefenceFloor(monster: CalcMonster) {
  const id = monster.id;
  if (VERZIK_IDS.includes(id) || VARDORVIS_IDS.includes(id)) return monster.skills.def;
  if (SOTETSEG_IDS.includes(id)) return 100;
  if (NIGHTMARE_IDS.includes(id)) return 120;
  if (AKKHA_IDS.includes(id)) return 70;
  if (BABA_IDS.includes(id)) return 60;
  if (KEPHRI_UNSHIELDED_IDS.includes(id) || KEPHRI_SHIELDED_IDS.includes(id)) return 60;
  if (ZEBAK_IDS.includes(id)) return 50;
  if (P3_WARDEN_IDS.includes(id)) return 120;
  if (TOA_OBELISK_IDS.includes(id)) return 60;
  if (NEX_IDS.includes(id)) return 250;
  if (ARAXXOR_IDS.includes(id)) return 90;
  if (HUEYCOATL_IDS.includes(id)) return 120;
  if (YAMA_IDS.includes(id)) return 145;
  return 0;
}

export function applyDefenceReductions(monster: CalcMonster, reductions: DefenceReductionMap | undefined) {
  if (!reductions) return monster;
  const baseSkills = { ...monster.skills };
  const defenceFloor = getDefenceFloor(monster);

  let m = { ...monster, skills: { ...monster.skills }, defensive: { ...monster.defensive } };

  const clampSkills = (skills: Record<string, number>) => {
    for (const k of Object.keys(skills)) {
      const floor = k === "def" ? defenceFloor : 0;
      skills[k] = Math.max(floor, skills[k]);
    }
    return skills;
  };

  const newSkills = (partial: Record<string, number>) => {
    const clamped = clampSkills(partial);
    m = { ...m, skills: { ...m.skills, ...clamped } };
    return m;
  };

  // Accursed and Vulnerability are mutually exclusive
  if (reductions.accursed) {
    newSkills({
      def: Math.trunc((m.skills.def * 17) / 20),
      magic: Math.trunc((m.skills.magic * 17) / 20),
    });
  } else if (reductions.vulnerability) {
    newSkills({ def: Math.trunc((m.skills.def * 9) / 10) });
  }

  for (let i = 0; i < getReductionNumber(reductions, "elderMaul"); i++) {
    newSkills({ def: m.skills.def - Math.trunc((m.skills.def * 35) / 100) });
  }

  for (let i = 0; i < getReductionNumber(reductions, "dwh"); i++) {
    newSkills({ def: m.skills.def - Math.trunc((m.skills.def * 3) / 10) });
  }

  const reduceArclight = (iter: number, factor: number[]) => {
    if (iter === 0) return;
    const [num, den] = factor;
    newSkills({
      atk: m.skills.atk - iter * (Math.trunc((num * baseSkills.atk) / den) + 1),
      str: m.skills.str - iter * (Math.trunc((num * baseSkills.str) / den) + 1),
      def: m.skills.def - iter * (Math.trunc((num * baseSkills.def) / den) + 1),
    });
  };

  const isDemon = (monster.attributes || []).includes(MonsterAttribute.DEMON);
  reduceArclight(getReductionNumber(reductions, "arclight"), isDemon ? [2, 20] : [1, 20]);
  reduceArclight(getReductionNumber(reductions, "emberlight"), isDemon ? [3, 20] : [1, 20]);

  for (let i = 0; i < getReductionNumber(reductions, "tonalztic"); i++) {
    newSkills({ def: m.skills.def - Math.trunc(m.skills.magic / 10) });
  }

  if (getReductionNumber(reductions, "seercull") > 0) {
    newSkills({ magic: m.skills.magic - getReductionNumber(reductions, "seercull") });
  }

  let bgsDmg = getReductionNumber(reductions, "bgs");
  if (bgsDmg > 0) {
    const drainStat = (k: string) => {
      const startLevel = m.skills[k];
      newSkills({ [k]: startLevel - bgsDmg });
      if (m.skills[k] > 0) {
        bgsDmg = 0;
      } else {
        bgsDmg -= startLevel;
      }
    };
    drainStat("def");
    drainStat("str");
    drainStat("atk");
    drainStat("magic");
    drainStat("ranged");
  }

  if (getReductionNumber(reductions, "ayak") > 0 && m.defensive.magic > 0) {
    m = { ...m, defensive: { ...m.defensive, magic: Math.max(0, m.defensive.magic - getReductionNumber(reductions, "ayak")) } };
  }

  return m;
}

// ── Combat styles ──
export function getCombatStyles(category: string | undefined) {
  switch (category) {
    case "2h Sword":
      return [
        { name: "Chop", type: "slash", stance: "Accurate" },
        { name: "Slash", type: "slash", stance: "Aggressive" },
        { name: "Smash", type: "crush", stance: "Aggressive" },
        { name: "Block", type: "slash", stance: "Defensive" },
      ];
    case "Axe":
      return [
        { name: "Chop", type: "slash", stance: "Accurate" },
        { name: "Hack", type: "slash", stance: "Aggressive" },
        { name: "Smash", type: "crush", stance: "Aggressive" },
        { name: "Block", type: "slash", stance: "Defensive" },
      ];
    case "Blunt":
    case "Polestaff":
      return [
        { name: "Pound", type: "crush", stance: "Accurate" },
        { name: "Pummel", type: "crush", stance: "Aggressive" },
        { name: "Block", type: "crush", stance: "Defensive" },
      ];
    case "Bow":
    case "Crossbow":
    case "Thrown":
      return [
        { name: "Accurate", type: "ranged", stance: "Accurate" },
        { name: "Rapid", type: "ranged", stance: "Rapid" },
        { name: "Longrange", type: "ranged", stance: "Longrange" },
      ];
    case "Chinchompas":
      return [
        { name: "Short fuse", type: "ranged", stance: "Accurate" },
        { name: "Medium fuse", type: "ranged", stance: "Rapid" },
        { name: "Long fuse", type: "ranged", stance: "Longrange" },
      ];
    case "Claw":
      return [
        { name: "Chop", type: "slash", stance: "Accurate" },
        { name: "Slash", type: "slash", stance: "Aggressive" },
        { name: "Lunge", type: "stab", stance: "Controlled" },
        { name: "Block", type: "slash", stance: "Defensive" },
      ];
    case "Dagger":
      return [
        { name: "Stab", type: "stab", stance: "Accurate" },
        { name: "Lunge", type: "stab", stance: "Aggressive" },
        { name: "Slash", type: "slash", stance: "Aggressive" },
        { name: "Block", type: "stab", stance: "Defensive" },
      ];
    case "Partisan":
      return [
        { name: "Stab", type: "stab", stance: "Accurate" },
        { name: "Lunge", type: "stab", stance: "Aggressive" },
        { name: "Pound", type: "crush", stance: "Aggressive" },
        { name: "Block", type: "stab", stance: "Defensive" },
      ];
    case "Pickaxe":
      return [
        { name: "Spike", type: "stab", stance: "Accurate" },
        { name: "Impale", type: "stab", stance: "Aggressive" },
        { name: "Smash", type: "crush", stance: "Aggressive" },
        { name: "Block", type: "stab", stance: "Defensive" },
      ];
    case "Polearm":
      return [
        { name: "Jab", type: "stab", stance: "Controlled" },
        { name: "Swipe", type: "slash", stance: "Aggressive" },
        { name: "Fend", type: "stab", stance: "Defensive" },
      ];
    case "Powered Staff":
    case "Powered Wand":
      return [
        { name: "Accurate", type: "magic", stance: "Accurate" },
        { name: "Longrange", type: "magic", stance: "Longrange" },
      ];
    case "Scythe":
      return [
        { name: "Reap", type: "slash", stance: "Accurate" },
        { name: "Chop", type: "slash", stance: "Aggressive" },
        { name: "Jab", type: "crush", stance: "Aggressive" },
        { name: "Block", type: "slash", stance: "Defensive" },
      ];
    case "Slash Sword":
      return [
        { name: "Chop", type: "slash", stance: "Accurate" },
        { name: "Slash", type: "slash", stance: "Aggressive" },
        { name: "Lunge", type: "stab", stance: "Controlled" },
        { name: "Block", type: "slash", stance: "Defensive" },
      ];
    case "Spear":
      return [
        { name: "Lunge", type: "stab", stance: "Controlled" },
        { name: "Swipe", type: "slash", stance: "Controlled" },
        { name: "Pound", type: "crush", stance: "Controlled" },
        { name: "Block", type: "stab", stance: "Defensive" },
      ];
    case "Spiked":
      return [
        { name: "Pound", type: "crush", stance: "Accurate" },
        { name: "Pummel", type: "crush", stance: "Aggressive" },
        { name: "Spike", type: "stab", stance: "Controlled" },
        { name: "Block", type: "crush", stance: "Defensive" },
      ];
    case "Stab Sword":
      return [
        { name: "Stab", type: "stab", stance: "Accurate" },
        { name: "Lunge", type: "stab", stance: "Aggressive" },
        { name: "Slash", type: "slash", stance: "Aggressive" },
        { name: "Block", type: "stab", stance: "Defensive" },
      ];
    case "Staff":
      return [
        { name: "Bash", type: "crush", stance: "Accurate" },
        { name: "Pound", type: "crush", stance: "Aggressive" },
        { name: "Focus", type: "crush", stance: "Defensive" },
      ];
    case "Bladed Staff":
      return [
        { name: "Jab", type: "stab", stance: "Accurate" },
        { name: "Swipe", type: "slash", stance: "Aggressive" },
        { name: "Fend", type: "crush", stance: "Defensive" },
      ];
    case "Whip":
      return [
        { name: "Flick", type: "slash", stance: "Accurate" },
        { name: "Lash", type: "slash", stance: "Controlled" },
        { name: "Deflect", type: "slash", stance: "Defensive" },
      ];
    case "Bludgeon":
      return [
        { name: "Pound", type: "crush", stance: "Aggressive" },
        { name: "Pummel", type: "crush", stance: "Aggressive" },
        { name: "Smash", type: "crush", stance: "Aggressive" },
      ];
    case "Salamander":
      return [
        { name: "Scorch", type: "slash", stance: "Aggressive" },
        { name: "Flare", type: "ranged", stance: "Rapid" },
        { name: "Blaze", type: "magic", stance: "Defensive" },
      ];
    case "Banner":
      return [
        { name: "Lunge", type: "stab", stance: "Accurate" },
        { name: "Swipe", type: "slash", stance: "Aggressive" },
        { name: "Pound", type: "crush", stance: "Controlled" },
        { name: "Block", type: "stab", stance: "Defensive" },
      ];
    case "Bulwark":
      return [
        { name: "Pummel", type: "crush", stance: "Accurate" },
        { name: "Block", type: "crush", stance: "Defensive" },
      ];
    default:
      return [
        { name: "Punch", type: "crush", stance: "Accurate" },
        { name: "Kick", type: "crush", stance: "Aggressive" },
        { name: "Block", type: "crush", stance: "Defensive" },
      ];
  }
}

// ── Equipment bonus aggregation ──
export function aggregateEquipmentBonuses(equipment: Record<string, CalcEquipmentPiece | null>): EquipmentBonusTotals {
  const totals = {
    bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
    offensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    defensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
  };
  for (const piece of Object.values(equipment)) {
    if (!piece) continue;
    for (const key of Object.keys(totals.bonuses)) (totals.bonuses as Record<string, number>)[key] += piece.bonuses?.[key] || 0;
    for (const key of Object.keys(totals.offensive)) (totals.offensive as Record<string, number>)[key] += piece.offensive?.[key] || 0;
    for (const key of Object.keys(totals.defensive)) (totals.defensive as Record<string, number>)[key] += piece.defensive?.[key] || 0;
  }
  return totals;
}

function getRangedDamageType(category: string | undefined) {
  switch (category) {
    case "Thrown":
      return "light";
    case "Bow":
      return "standard";
    case "Crossbow":
    case "Chinchompas":
      return "heavy";
    case "Salamander":
      return "mixed";
    default:
      return "standard";
  }
}

function calculateAttackSpeed(player: CalcPlayer, monster: CalcMonster) {
  let attackSpeed = player.equipment.weapon?.speed || DEFAULT_ATTACK_SPEED;
  if (player.style.type === "ranged" && player.style.stance === "Rapid") attackSpeed -= 1;
  else if (CAST_STANCES.includes(player.style.stance)) {
    if (
      player.equipment.weapon?.name === "Harmonised nightmare staff" &&
      player.spell?.spellbook === "standard" &&
      player.style.stance !== "Manual Cast"
    )
      attackSpeed = 4;
    else if (player.equipment.weapon?.name === "Twinflame staff") attackSpeed = 6;
    else attackSpeed = 5;
  }
  if (monster.id === 7223 && player.style.stance !== "Manual Cast") {
    if (["Bone mace", "Bone shortbow", "Bone staff"].includes(player.equipment.weapon?.name || "")) attackSpeed = 1;
  }
  return Math.max(attackSpeed, 1);
}

function calculateEquipmentBonusesFromGear(player: CalcPlayer, monster: CalcMonster): EquipmentBonusTotals {
  const totals = aggregateEquipmentBonuses(player.equipment);
  if (BLOWPIPE_IDS.includes(player.equipment.weapon?.id || 0)) {
    const dartId = player.equipment.weapon?.itemVars?.blowpipeDartId;
    if (dartId) {
      const dart = getEquipmentById(dartId);
      if (dart) totals.bonuses.ranged_str += dart.bonuses.ranged_str;
    }
  }
  if (player.equipment.weapon?.name === "Tumeken's shadow" && player.style.stance !== "Manual Cast") {
    const factor = TOMBS_OF_AMASCUT_MONSTER_IDS.includes(monster.id) ? 4 : 3;
    totals.bonuses.magic_str = Math.min(1000, totals.bonuses.magic_str * factor);
    totals.offensive.magic *= factor;
  }
  if (
    player.equipment.weapon?.name === "Keris partisan of amascut" &&
    !TOMBS_OF_AMASCUT_MONSTER_IDS.includes(monster.id)
  ) {
    totals.bonuses.str -= 22;
    totals.offensive.stab -= 50;
  }
  if (
    player.equipment.weapon?.name === "Dinh's bulwark" ||
    player.equipment.weapon?.name === "Dinh's blazing bulwark"
  ) {
    const d = totals.defensive;
    totals.bonuses.str += Math.max(0, Math.trunc((d.stab + d.slash + d.crush + d.ranged - 800) / 12) - 38);
  }
  if (player.spell?.spellbook === "ancient" && CAST_STANCES.includes(player.style.stance)) {
    let vp = 0;
    if (player.equipment.head?.name?.includes("Virtus")) vp++;
    if (player.equipment.body?.name?.includes("Virtus")) vp++;
    if (player.equipment.legs?.name?.includes("Virtus")) vp++;
    totals.bonuses.magic_str += 30 * vp;
  }
  if (
    player.equipment.head?.name === "Void mage helm" &&
    player.equipment.body?.name === "Elite void top" &&
    player.equipment.legs?.name === "Elite void robe" &&
    player.equipment.hands?.name === "Void knight gloves"
  ) {
    totals.bonuses.magic_str += 50;
  }
  const cape = player.equipment.cape;
  const dizanasCharged =
    cape?.name === "Dizana's max cape" ||
    cape?.name === "Blessed dizana's quiver" ||
    (cape?.name === "Dizana's quiver" && cape?.version === "Charged");
  if (dizanasCharged && player.equipment.ammo) {
    totals.offensive.ranged += 10;
    totals.bonuses.ranged_str += 1;
  }
  return totals;
}

// ══════════════════════════════════════════
// PlayerVsNPCCalc
// ══════════════════════════════════════════
export class PlayerVsNPCCalc {
  opts: CalcOptions;
  player: CalcPlayer;
  baseMonster: CalcMonster;
  monster: CalcMonster;
  allEquippedItems: string[];
  _equipBonuses: EquipmentBonusTotals;
  _fangMinMax: [number, number] | null;
  _voidwakerMinMax: [number, number] | null;
  _wardenMinMax: [number, number] | null;
  _meleeMinHit: number;
  _rangedMinHit: number;
  _magicMinHit: number;
  _accurateZeroApplicable: boolean;
  _cachedDist: AttackDistribution | null;

  constructor(player: CalcPlayer, monster: CalcMonster, opts: CalcOptions = {}) {
    this.opts = { usingSpecialAttack: false, disableMonsterScaling: false, ...opts };
    this.player = player;
    this.baseMonster = monster;
    this.monster = monster;
    this.allEquippedItems = [];
    if (player.equipment) {
      for (const v of Object.values(player.equipment) as Array<{ name?: string }>) {
        if (v?.name) this.allEquippedItems.push(v.name);
      }
    }
    this._equipBonuses = calculateEquipmentBonusesFromGear(player, monster);
    this.player.offensive = this._equipBonuses.offensive;
    this.player.defensive = this._equipBonuses.defensive;
    this.player.bonuses = this._equipBonuses.bonuses;
    this.player.attackSpeed = calculateAttackSpeed(player, monster);
    this._fangMinMax = null;
    this._voidwakerMinMax = null;
    this._wardenMinMax = null;
    this._meleeMinHit = 0;
    this._rangedMinHit = 0;
    this._magicMinHit = 0;
    this._accurateZeroApplicable = true;
    this._cachedDist = null;
  }

  // ── Wearing helpers ──
  wearing(item: string | string[]): boolean {
    return Array.isArray(item)
      ? item.some((i) => this.allEquippedItems.includes(i))
      : this.allEquippedItems.includes(item);
  }

  wearingAll(items: string[]): boolean {
    return items.every((i) => this.allEquippedItems.includes(i));
  }

  isUsingMeleeStyle(): boolean {
    return ["slash", "crush", "stab"].includes(this.player.style.type || "");
  }

  // ── Void checks ──
  isWearingVoidRobes() {
    return (
      this.wearing(["Void knight top", "Void knight top (or)", "Elite void top", "Elite void top (or)"]) &&
      this.wearing(["Void knight robe", "Void knight robe (or)", "Elite void robe", "Elite void robe (or)"]) &&
      this.wearing("Void knight gloves")
    );
  }

  isWearingEliteVoidRobes() {
    return (
      this.wearing(["Elite void top", "Elite void top (or)"]) &&
      this.wearing(["Elite void robe", "Elite void robe (or)"]) &&
      this.wearing("Void knight gloves")
    );
  }

  isWearingMeleeVoid() {
    return this.isWearingVoidRobes() && this.wearing(["Void melee helm", "Void melee helm (or)"]);
  }

  isWearingEliteRangedVoid() {
    return this.isWearingEliteVoidRobes() && this.wearing(["Void ranger helm", "Void ranger helm (or)"]);
  }

  isWearingRangedVoid() {
    return this.isWearingVoidRobes() && this.wearing(["Void ranger helm", "Void ranger helm (or)"]);
  }

  isWearingMagicVoid() {
    return this.isWearingVoidRobes() && this.wearing(["Void mage helm", "Void mage helm (or)"]);
  }

  isWearingEliteMagicVoid() {
    return this.isWearingEliteVoidRobes() && this.wearing(["Void mage helm", "Void mage helm (or)"]);
  }

  // ── Equipment checks ──
  isWearingBlackMask() {
    const headName = (this.player.equipment.head?.name || "").toLowerCase();
    return this.isWearingImbuedBlackMask() || headName.includes("black mask") || headName.includes("slayer helmet");
  }

  isWearingImbuedBlackMask() {
    const headName = (this.player.equipment.head?.name || "").toLowerCase();
    return (headName.includes("black mask") || headName.includes("slayer helmet")) && headName.includes("(i)");
  }

  isWearingSmokeStaff() {
    return this.wearing(["Smoke battlestaff", "Mystic smoke staff", "Twinflame staff"]);
  }

  isWearingTzhaarWeapon() {
    return this.wearing([
      "Tzhaar-ket-em",
      "Tzhaar-ket-om",
      "Tzhaar-ket-om (t)",
      "Toktz-xil-ak",
      "Toktz-xil-ek",
      "Toktz-mej-tal",
    ]);
  }

  isWearingObsidian() {
    return this.wearingAll(["Obsidian helmet", "Obsidian platelegs", "Obsidian platebody"]);
  }

  isWearingBerserkerNecklace() {
    return this.wearing(["Berserker necklace", "Berserker necklace (or)"]);
  }

  isWearingCrystalBow() {
    return this.wearing("Crystal bow") || this.allEquippedItems.some((ei) => ei.includes("Bow of faerdhinen"));
  }

  isWearingFang() {
    return this.wearing(["Osmumten's fang", "Osmumten's fang (or)"]);
  }

  isWearingAccursedSceptre() {
    return this.wearing(["Accursed sceptre", "Accursed sceptre (a)"]);
  }

  isWearingBlowpipe() {
    return this.wearing(["Toxic blowpipe", "Blazing blowpipe"]);
  }

  isWearingGodsword() {
    return this.wearing([
      "Ancient godsword",
      "Armadyl godsword",
      "Bandos godsword",
      "Saradomin godsword",
      "Zamorak godsword",
    ]);
  }

  isWearingScythe() {
    return this.wearing("Scythe of vitur") || this.allEquippedItems.some((ei) => ei.includes("of vitur"));
  }

  isWearingKeris() {
    return this.allEquippedItems.some((ei) => ei.includes("Keris"));
  }

  isWearingTwoHitWeapon() {
    return this.wearing(["Torag's hammers", "Sulphur blades", "Glacial temotli", "Earthbound tecpatl"]);
  }

  isWearingDharok() {
    return this.wearingAll(["Dharok's helm", "Dharok's platebody", "Dharok's platelegs", "Dharok's greataxe"]);
  }

  isWearingVeracs() {
    return this.wearingAll(["Verac's helm", "Verac's brassard", "Verac's plateskirt", "Verac's flail"]);
  }

  isWearingKarils() {
    return this.wearingAll([
      "Karil's coif",
      "Karil's leathertop",
      "Karil's leatherskirt",
      "Karil's crossbow",
      "Amulet of the damned",
    ]);
  }

  isWearingAhrims() {
    return this.wearingAll([
      "Ahrim's staff",
      "Ahrim's hood",
      "Ahrim's robetop",
      "Ahrim's robeskirt",
      "Amulet of the damned",
    ]);
  }

  isWearingBloodMoonSet() {
    return this.wearingAll(["Dual macuahuitl", "Blood moon helm", "Blood moon chestplate", "Blood moon tassets"]);
  }

  isWearingSilverWeapon() {
    if (this.player.equipment.ammo?.name?.startsWith("Silver bolts") && this.player.style.type === "ranged")
      return true;
    return (
      this.isUsingMeleeStyle() &&
      this.wearing([
        "Blessed axe",
        "Ivandis flail",
        "Blisterwood flail",
        "Silver sickle",
        "Silver sickle (b)",
        "Emerald sickle",
        "Emerald sickle (b)",
        "Enchanted emerald sickle (b)",
        "Ruby sickle (b)",
        "Enchanted ruby sickle (b)",
        "Blisterwood sickle",
        "Silverlight",
        "Darklight",
        "Arclight",
        "Rod of ivandis",
        "Wolfbane",
      ])
    );
  }

  wearingVampyrebane(tier: string | number) {
    const t2 = tier === MonsterAttribute.VAMPYRE_2;
    return (
      (t2 || this.isUsingMeleeStyle()) &&
      this.wearing([...(t2 ? ["Rod of ivandis"] : []), "Ivandis flail", "Blisterwood sickle", "Blisterwood flail"])
    );
  }

  isWearingLeafBladedWeapon() {
    if (this.isUsingMeleeStyle() && this.wearing(["Leaf-bladed battleaxe", "Leaf-bladed spear", "Leaf-bladed sword"]))
      return true;
    if (this.player.spell?.name === "Magic Dart") return true;
    if (this.wearing(["Broad arrows", "Broad bolts", "Amethyst broad bolts"]) && this.player.style.type === "ranged")
      return true;
    return false;
  }

  isWearingCorpbaneWeapon() {
    const w = this.player.equipment.weapon;
    if (!w) return false;
    const isStab = this.player.style.type === "stab";
    if (this.isWearingFang()) return isStab;
    if (w.name.endsWith("halberd")) return isStab;
    if (w.name.includes("spear") && w.name !== "Blue moon spear") return isStab;
    return this.player.style.type === "magic";
  }

  isRevWeaponBuffApplicable() {
    if (!this.player.buffs.inWilderness || this.player.equipment.weapon?.version !== "Charged") return false;
    switch (this.player.style.type) {
      case "magic":
        return this.wearing([
          "Accursed sceptre",
          "Accursed sceptre (a)",
          "Thammaron's sceptre",
          "Thammaron's sceptre (a)",
        ]);
      case "ranged":
        return this.wearing(["Craw's bow", "Webweaver bow"]);
      default:
        return this.wearing(["Ursine chainmace", "Viggora's chainmace"]);
    }
  }

  isWearingRatBoneWeapon() {
    return this.wearing(["Bone mace", "Bone shortbow", "Bone staff"]);
  }

  isChargeSpellApplicable() {
    if (!this.player.buffs.chargeSpell) return false;
    switch (this.player.spell?.name) {
      case "Saradomin Strike":
        return this.wearing([
          "Saradomin cape",
          "Imbued saradomin cape",
          "Saradomin max cape",
          "Imbued saradomin max cape",
        ]);
      case "Claws of Guthix":
        return this.wearing(["Guthix cape", "Imbued guthix cape", "Guthix max cape", "Imbued guthix max cape"]);
      case "Flames of Zamorak":
        return this.wearing(["Zamorak cape", "Imbued zamorak cape", "Zamorak max cape", "Imbued zamorak max cape"]);
      default:
        return false;
    }
  }

  isUsingDemonbane() {
    switch (this.player.style.type) {
      case "magic":
        return this.player.spell?.name?.includes("Demonbane") || false;
      case "ranged":
        return this.wearing(["Scorching bow"]);
      default:
        return this.wearing(["Silverlight", "Darklight", "Arclight", "Emberlight", "Bone claws", "Burning claws"]);
    }
  }

  isUsingAbyssal() {
    return (
      this.isUsingMeleeStyle() &&
      this.wearing(["Abyssal bludgeon", "Abyssal dagger", "Abyssal whip", "Abyssal tentacle"])
    );
  }

  tdUnshieldedBonusApplies() {
    if (this.monster.name !== "Tormented Demon" || this.monster.inputs?.phase !== "Unshielded") return false;
    switch (this.player.style.type) {
      case "magic":
        return !!this.player.spell;
      case "ranged":
        return getRangedDamageType(this.player.equipment.weapon?.category) === "heavy";
      case "crush":
        return true;
      default:
        return false;
    }
  }

  demonbaneVulnerability() {
    if (this.monster.name === "Duke Sucellus") return 70;
    if (YAMA_IDS.includes(this.monster.id)) return 120;
    if (YAMA_VOID_FLARE_IDS.includes(this.monster.id)) return 200;
    return 100;
  }

  demonbaneFactor(weaponDemonbane: number): [number, number] {
    const v = this.demonbaneVulnerability();
    return [Math.trunc((weaponDemonbane * v) / 100), 100];
  }

  getCombatPrayers() {
    const keys = this.player.prayers || [];
    if (keys.length === 0)
      return { factorAccuracy: null, factorStrength: null, factorDefence: null, combatStyle: null };
    if (keys.length === 1)
      return PRAYERS[keys[0]] || { factorAccuracy: null, factorStrength: null, factorDefence: null, combatStyle: null };
    // Merge multiple prayers (ARM + BRAIN + SKIN stacking)
    let factorAccuracy = null,
      factorStrength = null,
      factorDefence = null,
      combatStyle = null;
    for (const k of keys) {
      const p = PRAYERS[k];
      if (!p) continue;
      if (p.factorAccuracy) factorAccuracy = p.factorAccuracy;
      if (p.factorStrength) factorStrength = p.factorStrength;
      if (p.factorDefence) factorDefence = p.factorDefence;
      if (p.combatStyle) combatStyle = p.combatStyle;
    }
    return { factorAccuracy, factorStrength, factorDefence, combatStyle };
  }

  // ══════════════════════════════
  // NPC Defence Roll
  // ══════════════════════════════
  getNPCDefenceRoll() {
    if (this.opts.overrideDefenceRoll !== undefined) return this.opts.overrideDefenceRoll;
    let styleType = this.player.style.type;
    if (this.opts.usingSpecialAttack) {
      if (
        this.wearing([
          "Dragon claws",
          "Dragon dagger",
          "Dragon halberd",
          "Dragon longsword",
          "Dragon scimitar",
          "Crystal halberd",
          "Abyssal dagger",
          "Saradomin sword",
          "Arkan blade",
        ]) ||
        this.isWearingGodsword()
      ) {
        styleType = "slash";
      } else if (this.wearing(["Arclight", "Emberlight", "Dragon sword"])) {
        styleType = "stab";
      } else if (this.wearing(["Voidwaker", "Saradomin's blessed sword"])) {
        styleType = "magic";
      } else if (this.wearing("Dragon mace")) {
        styleType = "crush";
      }
      if (this.isWearingAccursedSceptre()) styleType = "magic";
    }
    let effectiveDefLevel, defBonus;
    if (styleType === "magic") {
      effectiveDefLevel = USES_DEFENCE_LEVEL_FOR_MAGIC_DEFENCE_NPC_IDS.includes(this.monster.id)
        ? this.monster.skills.def + 9
        : this.monster.skills.magic + 9;
      defBonus = this.monster.defensive?.magic || 0;
    } else {
      effectiveDefLevel = this.monster.skills.def + 9;
      if (styleType === "ranged") {
        const dmgType = getRangedDamageType(this.player.equipment.weapon?.category || "Bow");
        if (dmgType === "mixed") {
          defBonus = Math.trunc(
            ((this.monster.defensive?.light || 0) +
              (this.monster.defensive?.standard || 0) +
              (this.monster.defensive?.heavy || 0)) /
              3
          );
        } else {
          defBonus = this.monster.defensive?.[dmgType] || this.monster.defensive?.ranged || 0;
        }
      } else {
        defBonus = this.monster.defensive?.[styleType] || 0;
      }
    }
    if (
      TOMBS_OF_AMASCUT_MONSTER_IDS.includes(this.monster.id) &&
      !KEPHRI_OVERLORD_IDS.includes(this.monster.id) &&
      this.monster.inputs?.toaInvocationLevel
    ) {
      const toaInvocationLevel = Number(this.monster.inputs.toaInvocationLevel);
      return Math.trunc((effectiveDefLevel * (defBonus + 64) * (250 + toaInvocationLevel)) / 250);
    }
    return effectiveDefLevel * (defBonus + 64);
  }

  // ══════════════════════════════
  // MELEE ATTACK ROLL
  // ══════════════════════════════
  getPlayerMaxMeleeAttackRoll() {
    const prayer = this.getCombatPrayers();
    let eff = this.player.skills.atk + this.player.boosts.atk;
    if (prayer.factorAccuracy && prayer.combatStyle === "melee")
      eff = Math.trunc((eff * prayer.factorAccuracy[0]) / prayer.factorAccuracy[1]);
    let sb = 8;
    if (this.player.style.stance === "Accurate") sb += 3;
    else if (this.player.style.stance === "Controlled") sb += 1;
    eff += sb;
    if (this.isWearingMeleeVoid()) eff = Math.trunc((eff * 11) / 10);

    const gearBonus = this.player.offensive[this.player.style.type] || 0;
    let roll = eff * (gearBonus + 64);
    const baseRoll = roll;
    const mattrs = this.monster.attributes || [];

    // Amulet of avarice > Salve > Black mask (non-stacking)
    if (this.wearing("Amulet of avarice") && this.monster.name?.startsWith("Revenant")) {
      const f = this.player.buffs.forinthrySurge ? 27 : 24;
      roll = Math.trunc((roll * f) / 20);
    } else if (
      this.wearing(["Salve amulet (e)", "Salve amulet(ei)", "Salve amulet (ei)"]) &&
      mattrs.includes(MonsterAttribute.UNDEAD)
    )
      roll = Math.trunc((roll * 6) / 5);
    else if (
      this.wearing(["Salve amulet", "Salve amulet(i)", "Salve amulet (i)"]) &&
      mattrs.includes(MonsterAttribute.UNDEAD)
    )
      roll = Math.trunc((roll * 7) / 6);
    else if (this.player.buffs.onSlayerTask && this.isWearingBlackMask()) roll = Math.trunc((roll * 7) / 6);

    if (this.isWearingObsidian() && this.isWearingTzhaarWeapon()) roll += Math.trunc(baseRoll / 10);
    if (this.isRevWeaponBuffApplicable()) roll = Math.trunc((roll * 3) / 2);
    if (mattrs.includes(MonsterAttribute.DEMON) && (this.wearing("Arclight") || this.wearing("Emberlight"))) {
      const [num] = this.demonbaneFactor(70);
      roll = Math.trunc(roll + (roll * num) / 100);
    }
    if (mattrs.includes(MonsterAttribute.DEMON) && this.wearing(["Bone claws", "Burning claws"])) {
      const [num] = this.demonbaneFactor(5);
      roll = Math.trunc(roll + (roll * num) / 100);
    }
    if (mattrs.includes(MonsterAttribute.DRAGON)) {
      if (this.wearing("Dragon hunter lance")) roll = Math.trunc((roll * 6) / 5);
      else if (this.wearing("Dragon hunter wand")) roll = Math.trunc((roll * 7) / 4);
    }
    if (this.wearing("Keris partisan of breaching") && mattrs.includes(MonsterAttribute.KALPHITE)) {
      roll = Math.trunc((roll * 133) / 100);
    }
    if (
      this.wearing("Keris partisan of the sun") &&
      TOMBS_OF_AMASCUT_MONSTER_IDS.includes(this.monster.id) &&
      Number(this.monster.inputs?.monsterCurrentHp ?? this.monster.skills?.hp ?? 0) < Math.trunc(this.monster.skills.hp / 4)
    ) {
      roll = Math.trunc((roll * 5) / 4);
    }
    if (this.wearing(["Blisterwood flail", "Blisterwood sickle"]) && isVampyre(mattrs))
      roll = Math.trunc((roll * 21) / 20);
    if (this.isWearingSilverWeapon() && this.wearing("Efaritay's aid") && isVampyre(mattrs))
      roll = Math.trunc((roll * 23) / 20);
    if (mattrs.includes(MonsterAttribute.GOLEM) && this.wearing("Granite hammer")) roll = Math.trunc((roll * 13) / 10);
    if (this.player.style.type === "crush") {
      let inq = 0;
      if (this.wearing("Inquisitor's great helm")) inq++;
      if (this.wearing("Inquisitor's hauberk")) inq++;
      if (this.wearing("Inquisitor's plateskirt")) inq++;
      if (inq > 0) {
        if (this.wearing("Inquisitor's mace")) inq *= 5;
        else if (inq === 3) inq = 5;
        roll = Math.trunc((roll * (200 + inq)) / 200);
      }
    }
    if (this.opts.usingSpecialAttack) {
      if (this.isWearingGodsword()) roll = Math.trunc(roll * 2);
      else if (this.isWearingFang() || this.wearing("Arkan blade") || this.wearing("Granite hammer"))
        roll = Math.trunc((roll * 3) / 2);
      else if (this.wearing(["Elder maul", "Dragon mace", "Dragon sword", "Dragon scimitar", "Abyssal whip"]))
        roll = Math.trunc((roll * 5) / 4);
      else if (this.wearing("Dragon dagger")) roll = Math.trunc((roll * 23) / 20);
      else if (this.wearing("Abyssal dagger")) roll = Math.trunc((roll * 5) / 4);
      else if (this.wearing("Soulreaper axe")) {
        const stacks = Math.max(0, Math.min(5, this.player.buffs.soulreaperStacks || 0));
        roll = Math.trunc((roll * (100 + 6 * stacks)) / 100);
      } else if (this.wearing("Brine sabre")) roll = Math.trunc(roll * 2);
      else if (this.wearing("Barrelchest anchor")) roll = Math.trunc(roll * 2);
    }
    return roll;
  }

  // ══════════════════════════════
  // MELEE MAX HIT
  // ══════════════════════════════
  getPlayerMaxMeleeHit() {
    const prayer = this.getCombatPrayers();
    const baseLevel = this.player.skills.str + this.player.boosts.str;
    let eff = baseLevel;
    if (prayer.factorStrength && prayer.combatStyle === "melee") {
      if ((this.player.prayers || []).includes("burst_of_strength") && eff <= 20) eff += 1;
      else eff = Math.trunc((eff * prayer.factorStrength[0]) / prayer.factorStrength[1]);
    }
    if (this.wearing("Soulreaper axe") && !this.opts.usingSpecialAttack && this.player.buffs.soulreaperStacks) {
      eff += Math.trunc((baseLevel * 6 * this.player.buffs.soulreaperStacks) / 100);
    }
    let sb = 8;
    if (this.player.style.stance === "Aggressive") sb += 3;
    else if (this.player.style.stance === "Controlled") sb += 1;
    eff += sb;
    if (this.isWearingMeleeVoid()) eff = Math.trunc((eff * 11) / 10);

    const baseMax = Math.trunc((eff * (this.player.bonuses.str + 64) + 320) / 640);
    let maxHit = baseMax;
    let minHit = 0;
    const mattrs = this.monster.attributes || [];

    // Amulet of avarice > Salve > Black mask (non-stacking)
    if (this.wearing("Amulet of avarice") && this.monster.name?.startsWith("Revenant")) {
      const f = this.player.buffs.forinthrySurge ? 27 : 24;
      maxHit = Math.trunc((maxHit * f) / 20);
    } else if (
      this.wearing(["Salve amulet (e)", "Salve amulet(ei)", "Salve amulet (ei)"]) &&
      mattrs.includes(MonsterAttribute.UNDEAD)
    )
      maxHit = Math.trunc((maxHit * 6) / 5);
    else if (
      this.wearing(["Salve amulet", "Salve amulet(i)", "Salve amulet (i)"]) &&
      mattrs.includes(MonsterAttribute.UNDEAD)
    )
      maxHit = Math.trunc((maxHit * 7) / 6);
    else if (this.player.buffs.onSlayerTask && this.isWearingBlackMask()) maxHit = Math.trunc((maxHit * 7) / 6);

    if (mattrs.includes(MonsterAttribute.DEMON) && (this.wearing("Arclight") || this.wearing("Emberlight"))) {
      const [num] = this.demonbaneFactor(70);
      maxHit = Math.trunc(maxHit + (maxHit * num) / 100);
    }
    if (mattrs.includes(MonsterAttribute.DEMON) && this.wearing(["Bone claws", "Burning claws"])) {
      const [num] = this.demonbaneFactor(5);
      maxHit = Math.trunc(maxHit + (maxHit * num) / 100);
    }
    if (this.isWearingObsidian() && this.isWearingTzhaarWeapon()) maxHit += Math.trunc(baseMax / 10);
    if (this.wearing("Dragon hunter lance") && mattrs.includes(MonsterAttribute.DRAGON))
      maxHit = Math.trunc((maxHit * 6) / 5);
    if (this.wearing("Dragon hunter wand") && mattrs.includes(MonsterAttribute.DRAGON))
      maxHit = Math.trunc((maxHit * 7) / 5);
    if (this.isWearingKeris() && mattrs.includes(MonsterAttribute.KALPHITE)) {
      maxHit = Math.trunc((maxHit * (this.wearing("Keris partisan of amascut") ? 115 : 133)) / 100);
    }
    if (mattrs.includes(MonsterAttribute.GOLEM) && this.wearing("Barronite mace"))
      maxHit = Math.trunc((maxHit * 23) / 20);
    if (mattrs.includes(MonsterAttribute.GOLEM) && this.wearing("Granite hammer"))
      maxHit = Math.trunc((maxHit * 13) / 10);
    if (this.isRevWeaponBuffApplicable()) maxHit = Math.trunc((maxHit * 3) / 2);
    if (mattrs.includes(MonsterAttribute.DEMON) && this.wearing(["Silverlight", "Darklight", "Silverlight (dyed)"])) {
      const [num] = this.demonbaneFactor(60);
      maxHit = Math.trunc(maxHit + (maxHit * num) / 100);
    }
    if (mattrs.includes(MonsterAttribute.LEAFY) && this.wearing("Leaf-bladed battleaxe"))
      maxHit = Math.trunc((maxHit * 47) / 40);
    if (this.wearing("Colossal blade")) maxHit += Math.min((this.monster.size || 1) * 2, 10);
    if (this.isWearingRatBoneWeapon() && mattrs.includes(MonsterAttribute.RAT)) maxHit += 10;
    if (this.player.style.type === "crush") {
      let inq = 0;
      if (this.wearing("Inquisitor's great helm")) inq++;
      if (this.wearing("Inquisitor's hauberk")) inq++;
      if (this.wearing("Inquisitor's plateskirt")) inq++;
      if (inq > 0) {
        if (this.wearing("Inquisitor's mace")) inq *= 5;
        else if (inq === 3) inq = 5;
        maxHit = Math.trunc((maxHit * (200 + inq)) / 200);
      }
    }
    if (this.isWearingFang()) {
      const shrink = Math.trunc((maxHit * 3) / 20);
      minHit = shrink;
      if (!this.opts.usingSpecialAttack) {
        maxHit -= shrink;
      }
    }
    if (this.opts.usingSpecialAttack) {
      if (this.isWearingGodsword()) maxHit = Math.trunc((maxHit * 11) / 10);
      if (this.wearing(["Bandos godsword", "Saradomin sword"])) maxHit = Math.trunc((maxHit * 11) / 10);
      else if (this.wearing(["Armadyl godsword", "Dragon sword", "Dragon longsword", "Saradomin's blessed sword"]))
        maxHit = Math.trunc((maxHit * 5) / 4);
      else if (this.wearing(["Dragon mace", "Dragon warhammer", "Arkan blade"])) maxHit = Math.trunc((maxHit * 3) / 2);
      else if (this.wearing("Voidwaker")) {
        minHit = Math.trunc(maxHit / 2);
        maxHit = maxHit + minHit;
      } else if (this.wearing(["Dragon halberd", "Crystal halberd"])) maxHit = Math.trunc((maxHit * 11) / 10);
      else if (this.wearing("Dragon dagger")) maxHit = Math.trunc((maxHit * 23) / 20);
      else if (this.wearing("Abyssal dagger")) maxHit = Math.trunc((maxHit * 17) / 20);
      else if (this.wearing("Abyssal bludgeon")) {
        const miss = Math.max(-(this.player.boosts.prayer || 0), 0);
        maxHit = Math.trunc((maxHit * (100 + miss / 2)) / 100);
      } else if (this.wearing("Barrelchest anchor")) maxHit = Math.trunc((maxHit * 110) / 100);
      else if (this.isWearingBloodMoonSet()) {
        minHit = Math.trunc(maxHit / 4);
        maxHit = maxHit + minHit;
      } else if (this.wearing("Soulreaper axe")) {
        const stacks = Math.max(0, Math.min(5, this.player.buffs.soulreaperStacks || 0));
        maxHit = Math.trunc((maxHit * (100 + 6 * stacks)) / 100);
      }
    }
    if (this.monster.name === "Respiratory system") minHit += Math.trunc(maxHit / 2);
    this._meleeMinHit = minHit;
    this._fangMinMax = this.isWearingFang() ? [minHit, maxHit] : null;
    this._voidwakerMinMax = this.opts.usingSpecialAttack && this.wearing("Voidwaker") ? [minHit, maxHit] : null;
    return maxHit;
  }

  // ══════════════════════════════
  // RANGED ATTACK ROLL
  // ══════════════════════════════
  getPlayerMaxRangedAttackRoll() {
    const prayer = this.getCombatPrayers();
    let eff = this.player.skills.ranged + this.player.boosts.ranged;
    if (prayer.factorAccuracy && prayer.combatStyle === "ranged")
      eff = Math.trunc((eff * prayer.factorAccuracy[0]) / prayer.factorAccuracy[1]);
    let sb = 8;
    if (this.player.style.stance === "Accurate") sb += 3;
    eff += sb;
    if (this.isWearingRangedVoid()) eff = Math.trunc((eff * 11) / 10);

    let roll = eff * (this.player.offensive.ranged + 64);
    const mattrs = this.monster.attributes || [];

    if (this.isWearingCrystalBow()) {
      const cp =
        (this.wearing("Crystal helm") ? 1 : 0) +
        (this.wearing("Crystal legs") ? 2 : 0) +
        (this.wearing("Crystal body") ? 3 : 0);
      if (cp > 0) roll = Math.trunc((roll * (20 + cp)) / 20);
    }

    // Amulet of avarice > Salve > Black mask
    if (this.wearing("Amulet of avarice") && this.monster.name?.startsWith("Revenant")) {
      const f = this.player.buffs.forinthrySurge ? 27 : 24;
      roll = Math.trunc((roll * f) / 20);
    } else if (this.wearing(["Salve amulet(ei)", "Salve amulet (ei)"]) && mattrs.includes(MonsterAttribute.UNDEAD))
      roll = Math.trunc((roll * 6) / 5);
    else if (this.wearing(["Salve amulet(i)", "Salve amulet (i)"]) && mattrs.includes(MonsterAttribute.UNDEAD))
      roll = Math.trunc((roll * 7) / 6);
    else if (this.player.buffs.onSlayerTask && this.isWearingImbuedBlackMask()) roll = Math.trunc((roll * 23) / 20);
    if (this.isRevWeaponBuffApplicable()) roll = Math.trunc((roll * 3) / 2);
    if (this.wearing("Twisted bow")) {
      const cap = mattrs.includes(MonsterAttribute.XERICIAN) ? 350 : 250;
      const tbowMagic = Math.min(cap, Math.max(this.monster.skills.magic, this.monster.offensive?.magic || 0));
      roll = PlayerVsNPCCalc.tbowScaling(roll, tbowMagic, true);
      if (P2_WARDEN_IDS.includes(this.monster.id)) roll = PlayerVsNPCCalc.tbowScaling(roll, tbowMagic, true);
    }
    if (mattrs.includes(MonsterAttribute.DRAGON) && this.wearing("Dragon hunter crossbow"))
      roll = Math.trunc((roll * 13) / 10);
    if (mattrs.includes(MonsterAttribute.DEMON) && this.wearing("Scorching bow")) {
      const [num] = this.demonbaneFactor(30);
      roll = Math.trunc(roll + (roll * num) / 100);
    }
    if (this.opts.usingSpecialAttack) {
      if (this.wearing("Zaryte crossbow") || this.wearing("Webweaver bow") || this.isWearingBlowpipe())
        roll = Math.trunc(roll * 2);
      else if (this.wearing(["Magic shortbow", "Magic shortbow (i)"])) roll = Math.trunc((roll * 10) / 7);
      else if (this.wearing("Rosewood blowpipe")) roll = Math.trunc((roll * 4) / 5);
      else if (this.wearing("Heavy ballista") || this.wearing("Light ballista")) roll = Math.trunc((roll * 5) / 4);
    }
    if (TITAN_BOSS_IDS.includes(this.monster.id) && this.monster.inputs?.phase === "Out of Melee Range")
      roll = Math.trunc(roll * 6);
    // Chinchompa distance accuracy factor
    if (this.player.equipment.weapon?.category === EquipmentCategory.CHINCHOMPA) {
      const distance = Math.min(7, Math.max(1, this.player.buffs?.chinchompaDistance || 4));
      let numerator = 4;
      if (this.player.style.name === "Short fuse") {
        if (distance >= 7) numerator = 2;
        else if (distance >= 4) numerator = 3;
      } else if (this.player.style.name === "Medium fuse") {
        if (distance < 4 || distance >= 7) numerator = 3;
      } else if (this.player.style.name === "Long fuse") {
        if (distance < 4) numerator = 2;
        else if (distance < 7) numerator = 3;
      }
      if (numerator < 4) roll = Math.trunc((roll * numerator) / 4);
    }
    return roll;
  }

  // ══════════════════════════════
  // RANGED MAX HIT
  // ══════════════════════════════
  getPlayerMaxRangedHit() {
    const prayer = this.getCombatPrayers();
    const scalesWithStr = this.wearing(["Eclipse atlatl", "Hunter's spear"]);
    let eff = scalesWithStr
      ? this.player.skills.str + this.player.boosts.str
      : this.player.skills.ranged + this.player.boosts.ranged;

    // Holy water early return
    if (this.wearing("Holy water")) {
      const mattrs = this.monster.attributes || [];
      if (!mattrs.includes(MonsterAttribute.DEMON)) return 0;
      eff += 10;
      const str = 64 + (this.player.equipment.weapon?.bonuses?.ranged_str || 0);
      let maxHit = Math.trunc((eff * str + 320) / 640);
      if (mattrs.includes(MonsterAttribute.DEMON)) {
        const [num] = this.demonbaneFactor(60);
        maxHit = Math.trunc(maxHit + (maxHit * num) / 100);
      }
      if (this.monster.name === "Nezikchened") {
        maxHit += 5;
      }
      return maxHit;
    }

    // MSB/MLB/Seercull/Ogre bow spec early return
    if (
      (this.opts.usingSpecialAttack &&
        this.wearing(["Magic shortbow", "Magic shortbow (i)", "Magic longbow", "Magic comp bow", "Seercull"])) ||
      this.wearing(["Ogre bow", "Comp ogre bow"])
    ) {
      eff += 10;
      const ammoStr = this.player.equipment.ammo?.bonuses?.ranged_str || 0;
      return Math.trunc((eff * (ammoStr + 64) + 320) / 640);
    }

    if (prayer.factorStrength && prayer.combatStyle === "ranged") {
      if ((this.player.prayers || []).includes("sharp_eye") && eff <= 20) eff += 1;
      else eff = Math.trunc((eff * prayer.factorStrength[0]) / prayer.factorStrength[1]);
    }
    let sb = 8;
    if (this.player.style.stance === "Accurate") sb += 3;
    eff += sb;
    if (this.isWearingEliteRangedVoid()) eff = Math.trunc((eff * 9) / 8);
    else if (this.isWearingRangedVoid()) eff = Math.trunc((eff * 11) / 10);

    const bonusStr = scalesWithStr ? this.player.bonuses.str : this.player.bonuses.ranged_str;
    let maxHit = Math.trunc((eff * (bonusStr + 64) + 320) / 640);
    let minHit = 0;
    const mattrs = this.monster.attributes || [];

    if (this.isWearingCrystalBow()) {
      const cp =
        (this.wearing("Crystal helm") ? 1 : 0) +
        (this.wearing("Crystal legs") ? 2 : 0) +
        (this.wearing("Crystal body") ? 3 : 0);
      if (cp > 0) maxHit = Math.trunc((maxHit * (40 + cp)) / 40);
    }

    let needRevWeaponBonus = this.isRevWeaponBuffApplicable();
    let needDragonbane = this.wearing("Dragon hunter crossbow") && mattrs.includes(MonsterAttribute.DRAGON);
    let needDemonbane = this.wearing("Scorching bow") && mattrs.includes(MonsterAttribute.DEMON);

    // Amulet of avarice > Salve > Black mask (with additive ranged bonuses for slayer)
    if (this.wearing("Amulet of avarice") && this.monster.name?.startsWith("Revenant")) {
      const f = this.player.buffs.forinthrySurge ? 27 : 24;
      maxHit = Math.trunc((maxHit * f) / 20);
    } else if (
      (this.wearing(["Salve amulet(ei)", "Salve amulet (ei)"]) ||
        (scalesWithStr && this.wearing("Salve amulet (e)"))) &&
      mattrs.includes(MonsterAttribute.UNDEAD)
    ) {
      maxHit = Math.trunc((maxHit * 6) / 5);
    } else if (
      (this.wearing(["Salve amulet(i)", "Salve amulet (i)"]) || (scalesWithStr && this.wearing("Salve amulet"))) &&
      mattrs.includes(MonsterAttribute.UNDEAD)
    ) {
      maxHit = Math.trunc((maxHit * 7) / 6);
    } else if (scalesWithStr && this.isWearingBlackMask() && this.player.buffs.onSlayerTask) {
      maxHit = Math.trunc((maxHit * 7) / 6);
    } else if (this.isWearingImbuedBlackMask() && this.player.buffs.onSlayerTask) {
      let numerator = 23;
      if (needRevWeaponBonus) {
        needRevWeaponBonus = false;
        numerator += 10;
      }
      if (needDragonbane) {
        needDragonbane = false;
        numerator += 5;
      }
      if (needDemonbane) {
        needDemonbane = false;
        numerator += 6;
      }
      maxHit = Math.trunc((maxHit * numerator) / 20);
    }

    if (this.wearing("Twisted bow")) {
      const cap = mattrs.includes(MonsterAttribute.XERICIAN) ? 350 : 250;
      const tbowMagic = Math.min(cap, Math.max(this.monster.skills.magic, this.monster.offensive?.magic || 0));
      maxHit = PlayerVsNPCCalc.tbowScaling(maxHit, tbowMagic, false);
    }

    // Multiplicative if not combined with slayer helm
    if (needRevWeaponBonus) maxHit = Math.trunc((maxHit * 3) / 2);
    if (needDragonbane) maxHit = Math.trunc((maxHit * 5) / 4);
    if (needDemonbane) {
      const [num] = this.demonbaneFactor(30);
      maxHit = Math.trunc(maxHit + (maxHit * num) / 100);
    }

    if (this.isWearingRatBoneWeapon() && mattrs.includes(MonsterAttribute.RAT)) maxHit += 10;
    if (this.wearing("Tonalztics of ralos")) maxHit = Math.trunc((maxHit * 3) / 4);

    if (this.opts.usingSpecialAttack) {
      if (this.isWearingBlowpipe()) maxHit = Math.trunc((maxHit * 3) / 2);
      else if (this.wearing("Webweaver bow")) {
        const maxReduction = Math.trunc((maxHit * 6) / 10);
        maxHit -= maxReduction;
      } else if (this.wearing(["Heavy ballista", "Light ballista"])) maxHit = Math.trunc((maxHit * 5) / 4);
      else if (this.wearing("Rosewood blowpipe")) maxHit = Math.trunc((maxHit * 11) / 10);
    }
    if (this.opts.usingSpecialAttack && this.wearing("Dark bow")) {
      minHit = this.player.equipment.ammo?.name?.includes("Dragon arrow") ? 8 : 5;
      const dmgFactor = this.player.equipment.ammo?.name?.includes("Dragon arrow") ? 15 : 13;
      maxHit = Math.trunc((maxHit * dmgFactor) / 10);
    }

    if (P2_WARDEN_IDS.includes(this.monster.id)) {
      [minHit, maxHit] = this._applyP2Warden(maxHit);
    }
    if (this.monster.name === "Respiratory system") minHit += Math.trunc(maxHit / 2);

    this._wardenMinMax = P2_WARDEN_IDS.includes(this.monster.id) ? [minHit, maxHit] : null;
    this._rangedMinHit = minHit;
    return maxHit;
  }

  // ══════════════════════════════
  // MAGIC ATTACK ROLL
  // ══════════════════════════════
  getPlayerMaxMagicAttackRoll() {
    const prayer = this.getCombatPrayers();
    let eff = this.player.skills.magic + this.player.boosts.magic;
    if (prayer.factorAccuracy && prayer.combatStyle === "magic")
      eff = Math.trunc((eff * prayer.factorAccuracy[0]) / prayer.factorAccuracy[1]);
    let sb = 9;
    if (this.player.style.stance === "Accurate") sb += 2;
    eff += sb;
    if (this.isWearingMagicVoid()) eff = Math.trunc((eff * 29) / 20);

    let roll = eff * (this.player.offensive.magic + 64);
    const baseRoll = roll;
    const mattrs = this.monster.attributes || [];
    let mb = 0;
    let blackMaskBonus = false;

    if (this.wearing("Amulet of avarice") && this.monster.name?.startsWith("Revenant")) {
      mb += this.player.buffs.forinthrySurge ? 35 : 20;
    } else if (this.wearing(["Salve amulet(ei)", "Salve amulet (ei)"]) && mattrs.includes(MonsterAttribute.UNDEAD))
      mb += 20;
    else if (this.wearing(["Salve amulet(i)", "Salve amulet (i)"]) && mattrs.includes(MonsterAttribute.UNDEAD))
      mb += 15;
    else if (this.player.buffs.onSlayerTask && this.isWearingImbuedBlackMask()) blackMaskBonus = true;
    if (this.wearing("Efaritay's aid") && isVampyre(mattrs) && this.isWearingSilverWeapon()) mb += 15;
    if (this.isWearingSmokeStaff() && this.player.spell?.spellbook === "standard") mb += 10;
    if (mb > 0) roll = Math.trunc((roll * (100 + mb)) / 100);
    // Dragon hunter magic accuracy (DHL/DHCB/DHW when autocasting)
    if (mattrs.includes(MonsterAttribute.DRAGON)) {
      if (this.wearing("Dragon hunter crossbow")) roll = Math.trunc((roll * 13) / 10);
      else if (this.wearing("Dragon hunter lance")) roll = Math.trunc((roll * 6) / 5);
      else if (this.wearing("Dragon hunter wand")) roll = Math.trunc((roll * 7) / 4);
    }
    if (blackMaskBonus) roll = Math.trunc((roll * 23) / 20);
    if (this.player.spell?.name?.includes("Demonbane") && mattrs.includes(MonsterAttribute.DEMON)) {
      let demonbaneAccPct = this.player.buffs.markOfDarknessSpell || this.player.buffs.markOfDarkness ? 40 : 20;
      if (this.wearing("Purging staff")) demonbaneAccPct *= 2;
      const [n] = this.demonbaneFactor(demonbaneAccPct);
      roll = Math.trunc(roll + (roll * n) / 100);
    }
    if (this.isRevWeaponBuffApplicable()) roll = Math.trunc((roll * 3) / 2);
    if (
      this.wearing("Tome of water") &&
      (this.player.spell?.element === "water" ||
        this.player.spell?.name?.includes("Bind") ||
        this.player.spell?.name?.includes("Snare") ||
        this.player.spell?.name?.includes("Entangle"))
    )
      roll = Math.trunc((roll * 6) / 5);
    if (this.opts.usingSpecialAttack) {
      if (this.isWearingAccursedSceptre()) roll = Math.trunc((roll * 3) / 2);
      else if (this.wearing("Volatile nightmare staff")) roll = Math.trunc((roll * 3) / 2);
      else if (this.wearing("Eye of ayak")) roll = Math.trunc(roll * 2);
    }
    if (this.player.spell?.element && this.monster.weakness?.element === this.player.spell.element) {
      roll += Math.trunc((baseRoll * (this.monster.weakness?.severity || 0)) / 100);
    }
    return roll;
  }

  // ══════════════════════════════
  // MAGIC MAX HIT
  // ══════════════════════════════
  getPlayerMaxMagicHit() {
    const wn = this.player.equipment.weapon?.name || "";
    const ml = this.player.skills.magic + this.player.boosts.magic;
    let maxHit = 0;

    if (wn.includes("Trident of the seas")) maxHit = Math.max(1, Math.trunc(ml / 3 - 5));
    else if (wn.includes("Trident of the swamp")) maxHit = Math.max(1, Math.trunc(ml / 3 - 2));
    else if (wn.includes("Sanguinesti staff")) maxHit = Math.max(1, Math.trunc(ml / 3 - 1));
    else if (wn === "Tumeken's shadow") maxHit = Math.max(1, Math.trunc(ml / 3 + 1));
    else if (wn === "Warped sceptre") maxHit = Math.max(1, Math.trunc((8 * ml + 96) / 37));
    else if (wn.includes("Thammaron's sceptre")) maxHit = Math.max(1, Math.trunc(ml / 3 - 8));
    else if (this.wearing("Accursed sceptre") || (this.wearing("Accursed sceptre (a)") && this.opts.usingSpecialAttack))
      maxHit = Math.max(1, Math.trunc(ml / 3 - 6));
    else if (wn.includes("Crystal staff (basic)") || wn.includes("Corrupted staff (basic)")) maxHit = 23;
    else if (wn.includes("Crystal staff (attuned)") || wn.includes("Corrupted staff (attuned)")) maxHit = 31;
    else if (wn.includes("Crystal staff (perfected)") || wn.includes("Corrupted staff (perfected)")) maxHit = 39;
    else if (wn === "Dawnbringer") {
      maxHit = Math.max(1, Math.trunc(ml / 6 - 1));
      if (this.opts.usingSpecialAttack) {
        this._magicMinHit = 75;
        return 150;
      }
    } else if (wn === "Eye of ayak") maxHit = Math.max(1, Math.trunc(ml / 3) - 6);
    else if (wn === "Bone staff") maxHit = Math.max(1, Math.trunc(ml / 3) - 5) + 10;
    else if (wn === "Twinflame staff") maxHit = Math.max(1, Math.trunc(ml / 3 - 2));
    else if (wn === "Purging staff") maxHit = Math.max(1, Math.trunc(ml / 3 - 1));
    else if (this.wearing("Volatile nightmare staff") && this.opts.usingSpecialAttack)
      maxHit = Math.max(1, Math.min(58, 58 * Math.trunc(ml / 99) + 1));
    else if (this.wearing("Eldritch nightmare staff") && this.opts.usingSpecialAttack)
      maxHit = Math.max(1, Math.min(44, 44 * Math.trunc(ml / 99) + 1));
    else if (this.player.spell?.name === "Magic Dart") {
      if (this.wearing("Slayer's staff (e)") && this.player.buffs.onSlayerTask) maxHit = Math.trunc(13 + ml / 6);
      else maxHit = Math.trunc(10 + ml / 10);
    } else if (wn === "Swamp lizard" && this.player.style.type === "magic")
      maxHit = Math.trunc((ml * (56 + 64) + 320) / 640);
    else if (wn === "Orange salamander" && this.player.style.type === "magic")
      maxHit = Math.trunc((ml * (59 + 64) + 320) / 640);
    else if (wn === "Red salamander" && this.player.style.type === "magic")
      maxHit = Math.trunc((ml * (77 + 64) + 320) / 640);
    else if (wn === "Black salamander" && this.player.style.type === "magic")
      maxHit = Math.trunc((ml * (92 + 64) + 320) / 640);
    else if (wn === "Tecu salamander" && this.player.style.type === "magic")
      maxHit = Math.trunc((ml * (104 + 64) + 320) / 640);
    else if (wn === "Starter staff") maxHit = 8;
    else if (this.player.spell) maxHit = this.player.spell.max_hit || 0;

    if (maxHit === 0) {
      this._magicMinHit = 0;
      return 0;
    }

    if (this.opts.usingSpecialAttack && this.wearing("Eye of ayak")) maxHit = Math.trunc((maxHit * 13) / 10);

    if (this.wearing("Chaos gauntlets") && this.player.spell?.name?.includes("Bolt")) maxHit += 3;
    if (this.isChargeSpellApplicable()) maxHit += 10;

    const baseMax = maxHit;
    let dmgBonus = this.player.bonuses.magic_str;
    if (this.isWearingSmokeStaff() && this.player.spell?.spellbook === "standard") dmgBonus += 100;
    const mattrs = this.monster.attributes || [];
    let blackMaskBonus = false;
    if (this.wearing(["Salve amulet(ei)", "Salve amulet (ei)"]) && mattrs.includes(MonsterAttribute.UNDEAD))
      dmgBonus += 200;
    else if (this.wearing(["Salve amulet(i)", "Salve amulet (i)"]) && mattrs.includes(MonsterAttribute.UNDEAD))
      dmgBonus += 150;
    else if (this.wearing("Amulet of avarice") && this.monster.name?.startsWith("Revenant")) {
      dmgBonus += this.player.buffs.forinthrySurge ? 350 : 200;
    } else if (this.player.buffs.onSlayerTask && this.isWearingImbuedBlackMask()) blackMaskBonus = true;
    for (const pk of this.player.prayers || []) {
      if (pk && PRAYER_MAGIC_DMG[pk]) {
        dmgBonus += PRAYER_MAGIC_DMG[pk];
        break;
      }
    }
    maxHit = Math.trunc((maxHit * (1000 + dmgBonus)) / 1000);

    if (blackMaskBonus) maxHit = Math.trunc((maxHit * 23) / 20);

    // Dragon hunter magic bonuses (DHL/DHCB/DHW when autocasting)
    if (mattrs.includes(MonsterAttribute.DRAGON)) {
      if (this.wearing("Dragon hunter lance")) maxHit = Math.trunc((maxHit * 6) / 5);
      else if (this.wearing("Dragon hunter wand")) maxHit = Math.trunc((maxHit * 7) / 5);
      else if (this.wearing("Dragon hunter crossbow")) maxHit = Math.trunc((maxHit * 5) / 4);
    }

    if (this.isRevWeaponBuffApplicable()) maxHit = Math.trunc((maxHit * 3) / 2);
    if (this.opts.usingSpecialAttack && this.isWearingAccursedSceptre()) maxHit = Math.trunc((maxHit * 3) / 2);

    // Spell element weakness bonus (uses base max hit)
    if (this.player.spell?.element && this.monster.weakness?.element === this.player.spell.element) {
      maxHit += Math.trunc((baseMax * (this.monster.weakness?.severity || 0)) / 100);
    }

    // Sunfire runes: set min hit to 10% of max (pre-tome)
    let minHit = 0;
    if (this.player.buffs.usingSunfireRunes || this.player.buffs.sunfireRunes) {
      if (this.player.spell?.element === "fire") {
        minHit = Math.trunc(maxHit / 10);
      }
    }

    // Tomes: 10% post-magic_str multiplicative bonus (requires Charged version)
    if (
      (this.wearing("Tome of fire") &&
        this.player.equipment.shield?.version === "Charged" &&
        this.player.spell?.element === "fire") ||
      (this.wearing("Tome of water") &&
        this.player.equipment.shield?.version === "Charged" &&
        this.player.spell?.element === "water") ||
      (this.wearing("Tome of earth") &&
        this.player.equipment.shield?.version === "Charged" &&
        this.player.spell?.element === "earth")
    ) {
      maxHit = Math.trunc((maxHit * 11) / 10);
    }

    if (P2_WARDEN_IDS.includes(this.monster.id)) {
      [minHit, maxHit] = this._applyP2Warden(maxHit);
    }
    if (this.monster.name === "Respiratory system") minHit += Math.trunc(maxHit / 2);

    this._wardenMinMax = P2_WARDEN_IDS.includes(this.monster.id) ? [minHit, maxHit] : null;
    this._magicMinHit = minHit;
    return maxHit;
  }

  _applyP2Warden(max: number): [number, number] {
    const rd = Math.trunc(this.getNPCDefenceRoll() / 3);
    const ad = Math.max(this.getMaxAttackRoll() - rd, 0);
    const iLerp = (lo: number, hi: number, fLo: number, fHi: number, v: number): number =>
      lo + Math.trunc(((hi - lo) * Math.min(Math.max(v - fLo, 0), fHi - fLo)) / (fHi - fLo));
    const mod = Math.max(Math.min(iLerp(15, 40, 0, 42000, ad), 40), 15);
    return [Math.trunc((max * mod) / 100), Math.trunc((max * (mod + 20)) / 100)];
  }

  // ══════════════════════════════
  // HIT CHANCE + ACCURACY
  // ══════════════════════════════
  getMaxAttackRoll() {
    if (this.isUsingMeleeStyle()) return this.getPlayerMaxMeleeAttackRoll();
    if (this.player.style.type === "ranged") return this.getPlayerMaxRangedAttackRoll();
    return this.getPlayerMaxMagicAttackRoll();
  }

  getMinAndMax() {
    if (this.isUsingMeleeStyle()) {
      const max = this.getPlayerMaxMeleeHit();
      if (this._voidwakerMinMax) return this._voidwakerMinMax;
      if (this._fangMinMax) return this._fangMinMax;
      return [this._meleeMinHit || 0, max];
    }
    if (this.player.style.type === "ranged") {
      const rMax = this.getPlayerMaxRangedHit();
      if (this._wardenMinMax) return this._wardenMinMax;
      return [this._rangedMinHit || 0, rMax];
    }
    const magicMax = this.getPlayerMaxMagicHit();
    if (this._wardenMinMax) return this._wardenMinMax;
    return [this._magicMinHit || 0, magicMax];
  }

  getHitChance() {
    if (this.isImmune()) return 0;
    if (GUARANTEED_ACCURACY_MONSTERS.includes(this.monster.id)) return 1;
    // P2 Wardens always hit
    if (P2_WARDEN_IDS.includes(this.monster.id)) return 1;
    // Doom of Mokhaiotl non-Normal phase
    if (DOOM_OF_MOKHAIOTL_IDS.includes(this.monster.id) && this.monster.inputs?.phase !== "Normal") return 1;
    // Verzik P1 + Dawnbringer
    if (VERZIK_P1_IDS.includes(this.monster.id) && this.wearing("Dawnbringer")) return 1;
    // Giant rat (Scurrius) with bone weapon
    if (this.monster.id === 7223 && this.player.style.stance !== "Manual Cast") return 1;
    // Tormented Demon unshielded or normal phase
    if (this.monster.name === "Tormented Demon" && this.monster.inputs?.phase !== "Shielded") return 1;
    // Eclipse Moon clone + melee
    if (ECLIPSE_MOON_IDS.includes(this.monster.id) && this.monster.version === "Clone" && this.isUsingMeleeStyle())
      return 1;
    // Titan Elemental magic accuracy
    if (TITAN_ELEMENTAL_IDS.includes(this.monster.id) && this.player.style.type === "magic") {
      let accuracy = Math.min(1.0, Math.max(0, this.player.offensive.magic) / 100 + 0.3);
      if (this.isWearingEliteMagicVoid() || this.isWearingMagicVoid()) accuracy = Math.min(1.0, accuracy * 1.45);
      return accuracy;
    }
    // Always-max-hit monsters get 100% accuracy
    const ct = this.isUsingMeleeStyle() ? "melee" : getCombatDamageStyle(this.player.style.type);
    if (ALWAYS_MAX_HIT_MONSTERS[ct]?.includes(this.monster.id)) return 1;

    if (this.opts.usingSpecialAttack && this.wearing(["Voidwaker", "Dawnbringer"])) return 1;
    if (this.opts.usingSpecialAttack && this.wearing(["Seercull", "Magic longbow", "Magic comp bow"])) return 1;
    const atk = this.getMaxAttackRoll(),
      def = this.getNPCDefenceRoll();
    if (this.isWearingFang() && this.player.style.type === "stab") {
      if (TOMBS_OF_AMASCUT_MONSTER_IDS.includes(this.monster.id)) {
        const s = PlayerVsNPCCalc.getNormalAccuracyRoll(atk, def);
        return 1 - (1 - s) * (1 - s);
      }
      return PlayerVsNPCCalc.getFangAccuracyRoll(atk, def);
    }
    if (
      this.wearing("Confliction gauntlets") &&
      this.player.style.type === "magic" &&
      !this.player.equipment.weapon?.isTwoHanded
    ) {
      return PlayerVsNPCCalc.getConflictionGauntletsAccuracyRoll(atk, def);
    }
    return PlayerVsNPCCalc.getNormalAccuracyRoll(atk, def);
  }

  getDisplayHitChance() {
    const hitChance = this.getHitChance();
    if (hitChance === 1.0 || hitChance === 0.0) return hitChance;
    if (this.player.style.type === "magic" && this.wearing("Brimstone ring")) {
      const atk = this.getMaxAttackRoll();
      const def = this.getNPCDefenceRoll();
      const effectHitChance = PlayerVsNPCCalc.getNormalAccuracyRoll(atk, Math.trunc((def * 9) / 10));
      return 0.75 * hitChance + 0.25 * effectHitChance;
    }
    return hitChance;
  }

  static getNormalAccuracyRoll(atk: number, def: number): number {
    if (atk < 0) atk = Math.min(0, atk + 2);
    if (def < 0) def = Math.min(0, def + 2);
    if (atk >= 0 && def >= 0) return atk > def ? 1 - (def + 2) / (2 * (atk + 1)) : atk / (2 * (def + 1));
    if (atk >= 0 && def < 0) return 1 - 1 / (-def + 1) / (atk + 1);
    if (atk < 0 && def >= 0) return 0;
    if (atk < 0 && def < 0) {
      const a = -def,
        d = -atk;
      return a > d ? 1 - (d + 2) / (2 * (a + 1)) : a / (2 * (d + 1));
    }
    return 0;
  }

  static getFangAccuracyRoll(atk: number, def: number): number {
    if (atk < 0) atk = Math.min(0, atk + 2);
    if (def < 0) def = Math.min(0, def + 2);
    if (atk >= 0 && def >= 0)
      return atk > def
        ? 1 - ((def + 2) * (2 * def + 3)) / (atk + 1) / (atk + 1) / 6
        : (atk * (4 * atk + 5)) / 6 / (atk + 1) / (def + 1);
    if (atk >= 0 && def < 0) return 1 - 1 / (-def + 1) / (atk + 1);
    if (atk < 0 && def >= 0) return 0;
    if (atk < 0 && def < 0) {
      const a = -def,
        d = -atk;
      return a < d
        ? (a * (d * 6 - 2 * a + 5)) / 6 / (d + 1) / (d + 1)
        : 1 - ((d + 2) * (2 * d + 3)) / 6 / (d + 1) / (a + 1);
    }
    return 0;
  }

  static getConflictionGauntletsAccuracyRoll(atk: number, def: number): number {
    const s = PlayerVsNPCCalc.getNormalAccuracyRoll(atk, def);
    const d = PlayerVsNPCCalc.getFangAccuracyRoll(atk, def);
    return d / (1 + d - s);
  }

  static tbowScaling(current: number, magic: number, accuracyMode: boolean): number {
    const f = accuracyMode ? 10 : 14,
      b = accuracyMode ? 140 : 250;
    const t2 = Math.trunc((3 * magic - f) / 100);
    const t3 = Math.trunc((Math.trunc((3 * magic) / 10) - 10 * f) ** 2 / 100);
    return Math.trunc((current * (b + t2 - t3)) / 100);
  }

  // ══════════════════════════════
  // IMMUNITY
  // ══════════════════════════════
  isImmune() {
    const id = this.monster.id,
      mattrs = this.monster.attributes || [];
    let st = this.player.style.type;
    if (this.opts.usingSpecialAttack && this.wearing("Voidwaker")) st = "magic";
    if (IMMUNE_TO_MAGIC_DAMAGE_NPC_IDS.includes(id) && st === "magic") return true;
    if (IMMUNE_TO_RANGED_DAMAGE_NPC_IDS.includes(id) && st === "ranged") return true;
    if (IMMUNE_TO_MELEE_DAMAGE_NPC_IDS.includes(id) && this.isUsingMeleeStyle()) {
      if (ZULRAH_IDS.includes(id) && this.player.equipment.weapon?.category === EquipmentCategory.POLEARM) return false;
      return true;
    }
    if (mattrs.includes(MonsterAttribute.FLYING) && this.isUsingMeleeStyle()) {
      if (VESPULA_IDS.includes(id)) return true;
      if (
        this.player.equipment.weapon?.category === EquipmentCategory.POLEARM ||
        this.player.equipment.weapon?.category === EquipmentCategory.SALAMANDER
      )
        return false;
      return true;
    }
    if (
      IMMUNE_TO_NON_SALAMANDER_MELEE_DAMAGE_NPC_IDS.includes(id) &&
      this.isUsingMeleeStyle() &&
      this.player.equipment.weapon?.category !== EquipmentCategory.SALAMANDER
    )
      return true;
    if (mattrs.includes(MonsterAttribute.VAMPYRE_3) && !this.wearingVampyrebane(MonsterAttribute.VAMPYRE_3))
      return true;
    if (
      mattrs.includes(MonsterAttribute.VAMPYRE_2) &&
      !this.wearingVampyrebane(MonsterAttribute.VAMPYRE_2) &&
      !this.wearing("Efaritay's aid") &&
      !this.isWearingSilverWeapon()
    )
      return true;
    if (
      GUARDIAN_IDS.includes(id) &&
      (!this.isUsingMeleeStyle() || this.player.equipment.weapon?.category !== EquipmentCategory.PICKAXE)
    )
      return true;
    if (mattrs.includes(MonsterAttribute.LEAFY) && !this.isWearingLeafBladedWeapon()) return true;
    if (DOOM_OF_MOKHAIOTL_IDS.includes(id) && this.monster.inputs?.phase === "Shielded" && !this.isUsingDemonbane())
      return true;
    if (!mattrs.includes(MonsterAttribute.RAT) && this.isWearingRatBoneWeapon()) return true;
    if (
      this.monster.name === "Fire Warrior of Lesarkus" &&
      (st !== "ranged" || this.player.equipment.ammo?.name !== "Ice arrows")
    )
      return true;
    if (this.monster.name === "Fareed") {
      if (st === "magic" && this.player.spell?.element !== "water") return true;
      if (st === "ranged" && !this.player.equipment.ammo?.name?.includes("arrow")) return true;
    }
    if (ECLIPSE_MOON_IDS.includes(id) && this.monster.version === "Clone" && !this.isUsingMeleeStyle()) return true;
    return false;
  }

  // ══════════════════════════════
  // DISTRIBUTION
  // ══════════════════════════════
  getDistribution() {
    if (this._cachedDist) return this._cachedDist;
    let dist = this._getDistImpl();

    // Brimstone ring: 25% chance of 10% defence reduction, full sub-calc for distribution
    if (this.player.style.type === "magic" && this.wearing("Brimstone ring") && !this.opts.overrideDefenceRoll) {
      const effectChance = 0.25;
      const effectDef = Math.trunc((this.getNPCDefenceRoll() * 9) / 10);
      const subCalc = new PlayerVsNPCCalc(this.player, this.monster, { ...this.opts, overrideDefenceRoll: effectDef });
      const effectDist = subCalc._getDistImpl();

      const zippedDists = [];
      for (let i = 0; i < dist.dists.length; i++) {
        zippedDists.push(
          new HitDistribution([
            ...dist.dists[i].scaleProbability(1 - effectChance).hits,
            ...(effectDist.dists[i] || effectDist.dists[0]).scaleProbability(effectChance).hits,
          ])
        );
      }
      dist = new AttackDistribution(zippedDists).flatten();
    }

    dist = this._applyNpcTransforms(dist);
    this._cachedDist = dist;
    return dist;
  }

  _getDistImpl() {
    const acc = this.getHitChance();
    const [minHit, maxHit] = this.getMinAndMax();
    if (maxHit === 0)
      return new AttackDistribution([new HitDistribution([new WeightedHit(1.0, [Hitsplat.INACCURATE])])]);
    if (ONE_HIT_MONSTERS.includes(this.monster.id))
      return new AttackDistribution([HitDistribution.single(1.0, [new Hitsplat(this.monster.skills.hp)])]);
    if (this.monster.name === "Respiratory system" && this.isUsingDemonbane())
      return new AttackDistribution([HitDistribution.single(acc, [new Hitsplat(this.monster.skills.hp)])]);
    if (P2_WARDEN_IDS.includes(this.monster.id) && this._wardenMinMax)
      return new AttackDistribution([HitDistribution.linear(acc, this._wardenMinMax[0], this._wardenMinMax[1])]);
    let dist = this._getAttackerDist(acc, minHit, maxHit);
    dist = this._applyAttackerTransforms(dist, minHit, maxHit);
    // Always-max-hit monsters (applied AFTER all transforms, uses dist.getMax())
    const ct = this.isUsingMeleeStyle() ? "melee" : getCombatDamageStyle(this.player.style.type);
    if (ALWAYS_MAX_HIT_MONSTERS[ct]?.includes(this.monster.id)) {
      if (
        YAMA_VOID_FLARE_IDS.includes(this.monster.id) &&
        (this.player.buffs.markOfDarknessSpell || this.player.buffs.markOfDarkness) &&
        this.player.spell?.name?.includes("Demonbane")
      ) {
        const demonbanePct = this.wearing("Purging staff") ? 50 : 25;
        const maxDmg =
          maxHit + Math.trunc((Math.trunc((maxHit * demonbanePct) / 100) * this.demonbaneVulnerability()) / 100);
        return new AttackDistribution([HitDistribution.single(1.0, [new Hitsplat(maxDmg)])]);
      }
      return new AttackDistribution([HitDistribution.single(1.0, [new Hitsplat(dist.getMax())])]);
    }
    return dist;
  }

  _getAttackerDist(acc: number, minHit: number, maxHit: number): AttackDistribution {
    const spec = this.opts.usingSpecialAttack;
    const mattrs = this.monster.attributes || [];
    const style = this.player.style.type;
    const standardHitDist = HitDistribution.linear(acc, minHit, maxHit);
    let dist = new AttackDistribution([standardHitDist]);
    this._accurateZeroApplicable = true;

    // Voidwaker spec
    if (spec && this.wearing("Voidwaker") && this._voidwakerMinMax) {
      return new AttackDistribution([HitDistribution.linear(acc, this._voidwakerMinMax[0], this._voidwakerMinMax[1])]);
    }

    // Tonalztics (Charged) double-hit
    if (
      style === "ranged" &&
      this.wearing("Tonalztics of ralos") &&
      this.player.equipment.weapon?.version === "Charged"
    ) {
      if (!spec) {
        dist = new AttackDistribution([standardHitDist, standardHitDist]);
      } else {
        let loweredDefHitAccuracy;
        if (this.opts.baseMonster && this.opts.defenceReductions) {
          const newReductions = {
            ...this.opts.defenceReductions,
            tonalztic: getReductionNumber(this.opts.defenceReductions, "tonalztic") + 1,
          };
          const newMon = applyDefenceReductions(this.opts.baseMonster, newReductions);
          const subCalc = new PlayerVsNPCCalc(this.player, newMon);
          loweredDefHitAccuracy = subCalc.getHitChance();
        } else {
          const rd = Math.trunc((this.getNPCDefenceRoll() * 85) / 100);
          loweredDefHitAccuracy = PlayerVsNPCCalc.getNormalAccuracyRoll(this.getMaxAttackRoll(), rd);
        }
        const loweredDefHitDist = HitDistribution.linear(loweredDefHitAccuracy, minHit, maxHit);
        dist = dist.transform((firstHit: Hitsplat) => {
          const firstHitDist = HitDistribution.single(1.0, [firstHit]);
          const secondHitDist = firstHit.accurate ? loweredDefHitDist : standardHitDist;
          return firstHitDist.zip(secondHitDist);
        });
      }
    }

    // Gadderhammer vs shades
    if (this.isUsingMeleeStyle() && this.wearing("Gadderhammer") && mattrs.includes(MonsterAttribute.SHADE)) {
      dist = new AttackDistribution([
        new HitDistribution([
          ...standardHitDist.scaleProbability(0.95).scaleDamage(5, 4).hits,
          ...standardHitDist.scaleProbability(0.05).scaleDamage(2).hits,
        ]),
      ]);
    }

    // Dark bow - always 2 hits, spec adds flatLimitTransformer
    if (style === "ranged" && this.wearing("Dark bow")) {
      dist = new AttackDistribution([standardHitDist, standardHitDist]);
      if (spec) {
        dist = dist.transform(flatLimitTransformer(48, minHit));
      }
    }

    // Claw specs
    if (spec) {
      if (this.wearing("Dragon claws")) {
        this._accurateZeroApplicable = false;
        dist = dClawDist(acc, maxHit);
      } else if (this.wearing(["Bone claws", "Burning claws"])) {
        this._accurateZeroApplicable = false;
        dist = burningClawSpec(acc, maxHit);
      }
    }

    // Dragon/Crystal halberd — 2nd hit at ¾ attack roll (only if monster size > 1)
    if (spec && this.wearing(["Dragon halberd", "Crystal halberd"]) && (this.monster.size || 1) > 1) {
      const secondHitAttackRoll = Math.trunc((this.getMaxAttackRoll() * 3) / 4);
      const secondHitAcc = PlayerVsNPCCalc.getNormalAccuracyRoll(secondHitAttackRoll, this.getNPCDefenceRoll());
      dist = new AttackDistribution([standardHitDist, HitDistribution.linear(secondHitAcc, minHit, maxHit)]);
    }

    // Simple multi-hit specs
    if (spec) {
      let hitCount = 1;
      if (
        this.wearing(["Dragon dagger", "Dragon knife", "Rosewood blowpipe"]) ||
        this.wearing(["Magic shortbow (i)", "Magic shortbow"])
      )
        hitCount = 2;
      else if (this.wearing("Webweaver bow")) hitCount = 4;
      if (hitCount !== 1) dist = new AttackDistribution(Array(hitCount).fill(standardHitDist));
    }

    // Abyssal dagger spec
    if (spec && this.wearing("Abyssal dagger")) {
      const secondHit = HitDistribution.linear(1.0, minHit, maxHit);
      dist = dist.transform((h: Hitsplat) => new HitDistribution([new WeightedHit(1.0, [h])]).zip(secondHit), {
        transformInaccurate: false,
      });
    }

    // Verac's
    if (this.isUsingMeleeStyle() && this.isWearingVeracs()) {
      dist = new AttackDistribution([
        new HitDistribution([
          ...standardHitDist.scaleProbability(0.75).hits,
          ...HitDistribution.linear(1.0, 1, maxHit + 1).scaleProbability(0.25).hits,
        ]),
      ]);
    }

    // Karil's
    if (style === "ranged" && this.isWearingKarils()) {
      dist = dist.transform(
        (h: Hitsplat) =>
          new HitDistribution([
            new WeightedHit(0.75, [h]),
            new WeightedHit(0.25, [h, new Hitsplat(Math.trunc(h.damage / 2))]),
          ]),
        { transformInaccurate: false }
      );
    }

    // Scythe
    if (this.isUsingMeleeStyle() && this.isWearingScythe()) {
      const hits = [];
      for (let i = 0; i < Math.min(Math.max(this.monster.size || 1, 1), 3); i++) {
        const splatMax = Math.trunc(maxHit / 2 ** i);
        hits.push(HitDistribution.linear(acc, Math.min(minHit, splatMax), splatMax));
      }
      dist = new AttackDistribution(hits);
    }

    // Dual macuahuitl
    if (this.isUsingMeleeStyle() && this.wearing("Dual macuahuitl")) {
      const secondHit = HitDistribution.linear(acc, 0, maxHit - Math.trunc(maxHit / 2));
      const firstHit = new AttackDistribution([HitDistribution.linear(acc, 0, Math.trunc(maxHit / 2))]);
      dist = firstHit.transform((h: Hitsplat) => {
        if (h.accurate) return new HitDistribution([new WeightedHit(1.0, [h])]).zip(secondHit);
        return new HitDistribution([new WeightedHit(1.0, [h, Hitsplat.INACCURATE])]);
      });
    }

    // Two-hit weapons
    if (this.isUsingMeleeStyle() && this.isWearingTwoHitWeapon()) {
      dist = new AttackDistribution([
        HitDistribution.linear(acc, 0, Math.trunc(maxHit / 2)),
        HitDistribution.linear(acc, 0, maxHit - Math.trunc(maxHit / 2)),
      ]);
    }

    // Keris vs kalphites
    if (this.isUsingMeleeStyle() && this.isWearingKeris() && mattrs.includes(MonsterAttribute.KALPHITE)) {
      dist = new AttackDistribution([
        new HitDistribution([
          ...standardHitDist.scaleProbability(50 / 51).hits,
          ...standardHitDist.scaleProbability(1 / 51).scaleDamage(3).hits,
        ]),
      ]);
    }

    // Fang
    if (this._fangMinMax && !spec) {
      dist = new AttackDistribution([HitDistribution.linear(acc, minHit, maxHit)]);
    }

    return dist;
  }

  _applyAttackerTransforms(dist: AttackDistribution, minHit: number, maxHit: number): AttackDistribution {
    const mattrs = this.monster.attributes || [];
    const spec = this.opts.usingSpecialAttack;

    // Guardian pickaxe damage bonus
    if (
      this.isUsingMeleeStyle() &&
      GUARDIAN_IDS.includes(this.monster.id) &&
      this.player.equipment.weapon?.category === EquipmentCategory.PICKAXE
    ) {
      const pickBonuses: Record<string, number> = {
        "Bronze pickaxe": 1,
        "Iron pickaxe": 1,
        "Steel pickaxe": 6,
        "Black pickaxe": 11,
        "Mithril pickaxe": 21,
        "Adamant pickaxe": 31,
        "Rune pickaxe": 41,
        "Gilded pickaxe": 41,
      };
      const pickBonus = pickBonuses[this.player.equipment.weapon.name] || 61;
      const factor = 50 + (this.player.skills.mining || 1) + pickBonus;
      dist = dist.transform(multiplyTransformer(factor, 150));
    }

    // Saradomin sword spec — magic hitsplat 1-16
    if (spec && this.wearing("Saradomin sword")) {
      const magicHit = HitDistribution.linear(1.0, 1, 16);
      dist = dist.transform((h: Hitsplat) => {
        if (h.accurate && !IMMUNE_TO_MAGIC_DAMAGE_NPC_IDS.includes(this.monster.id)) {
          return new HitDistribution([new WeightedHit(1.0, [h])]).zip(magicHit);
        }
        return new HitDistribution([new WeightedHit(1.0, [h, Hitsplat.INACCURATE])]);
      });
    }

    // Granite hammer spec: +5 flat to all hits
    if (spec && this.wearing("Granite hammer")) {
      dist = dist.transform(flatAddTransformer(5), { transformInaccurate: true });
    }

    // Mark of Darkness + Demonbane: per-hit damage transform
    if (
      (this.player.buffs.markOfDarknessSpell || this.player.buffs.markOfDarkness) &&
      this.player.spell?.name?.includes("Demonbane") &&
      mattrs.includes(MonsterAttribute.DEMON)
    ) {
      const demonbanePct = this.wearing("Purging staff") ? 50 : 25;
      const vuln = this.demonbaneVulnerability();
      dist = dist.transform((h: Hitsplat) =>
        HitDistribution.single(1.0, [
          new Hitsplat(h.damage + Math.trunc((Math.trunc((h.damage * demonbanePct) / 100) * vuln) / 100), h.accurate),
        ])
      );
    }

    // Ahrim's set effect (per-hit transform)
    if (this.player.style.type === "magic" && this.isWearingAhrims()) {
      dist = dist.transform(
        (h) =>
          new HitDistribution([
            new WeightedHit(0.75, [h]),
            new WeightedHit(0.25, [new Hitsplat(Math.trunc((h.damage * 13) / 10), h.accurate)]),
          ])
      );
    }

    // Tormented Demon unshielded bonus damage
    if (this.tdUnshieldedBonusApplies()) {
      const bonusDmg = Math.max(0, this.getAttackSpeed() ** 2 - 16);
      dist = dist.transform(flatAddTransformer(bonusDmg), { transformInaccurate: false });
    }

    // Dharok's (scaleDamage transform)
    if (this.isUsingMeleeStyle() && this.isWearingDharok()) {
      const newMax = this.player.skills.hp || 99;
      const curr = (this.player.skills.hp || 99) + (this.player.boosts.hp || 0);
      dist = dist.scaleDamage(10000 + (newMax - curr) * newMax, 10000);
    }

    // Berserker necklace + Tzhaar weapon
    if (this.isUsingMeleeStyle() && this.isWearingBerserkerNecklace() && this.isWearingTzhaarWeapon()) {
      dist = dist.scaleDamage(6, 5);
    }

    // Vampyre weapon scaling (distribution-level damage multipliers)
    if (isVampyre(mattrs)) {
      const efaritay = this.wearing("Efaritay's aid");
      const doEfaritay = (d: AttackDistribution): AttackDistribution => (efaritay ? d.scaleDamage(11, 10) : d);
      if (this.wearing("Blisterwood flail")) {
        dist = doEfaritay(dist);
        dist = dist.scaleDamage(5, 4);
      } else if (this.wearing("Blisterwood sickle")) {
        dist = doEfaritay(dist);
        dist = dist.scaleDamage(23, 20);
      } else if (this.wearing("Ivandis flail")) {
        dist = doEfaritay(dist);
        dist = dist.scaleDamage(6, 5);
      } else if (this.wearing("Rod of ivandis") && !mattrs.includes(MonsterAttribute.VAMPYRE_3)) {
        dist = doEfaritay(dist);
        dist = dist.scaleDamage(11, 10);
      } else if (this.isWearingSilverWeapon() && mattrs.includes(MonsterAttribute.VAMPYRE_1)) {
        dist = doEfaritay(dist);
        dist = dist.scaleDamage(11, 10);
      }
    }

    // Non-ruby bolt effects
    if (
      this.player.style.type === "ranged" &&
      this.player.equipment.weapon?.name?.includes("rossbow") &&
      this.player.equipment.ammo
    ) {
      const name = this.player.equipment.ammo.name || "";
      const ctx = {
        rangedLvl: this.player.skills.ranged + this.player.boosts.ranged,
        maxHit,
        zcb: this.wearing("Zaryte crossbow"),
        spec,
        kandarinDiary: this.player.buffs.kandarinDiary || false,
        monster: this.monster,
      };
      if (name.includes("Opal") && name.includes("(e)")) dist = dist.transform(opalBolts(ctx));
      else if (name.includes("Pearl") && name.includes("(e)")) dist = dist.transform(pearlBolts(ctx));
      else if (name.includes("Diamond") && name.includes("(e)")) dist = dist.transform(diamondBolts(ctx));
      else if (name.includes("Dragonstone") && name.includes("(e)")) dist = dist.transform(dragonstoneBolts(ctx));
      else if (name.includes("Onyx") && name.includes("(e)") && !mattrs.includes(MonsterAttribute.UNDEAD))
        dist = dist.transform(onyxBolts(ctx));
    }

    // Zero-dmg spells: don't raise
    if (this.player.spell && this.player.spell.max_hit === 0) {
      this._accurateZeroApplicable = false;
    }

    // Raise accurate 0-damage hits to 1
    if (this._accurateZeroApplicable) {
      dist = dist.transform((h: Hitsplat) => HitDistribution.single(1.0, [new Hitsplat(Math.max(h.damage, 1))]), {
        transformInaccurate: false,
      });
    }

    // Twinflame staff 100% + 40% split (Bolt/Blast/Wave only)
    if (
      this.player.style.type === "magic" &&
      this.wearing("Twinflame staff") &&
      ["Bolt", "Blast", "Wave"].some((sc) => this.player.spell?.name?.includes(sc))
    ) {
      dist = dist.transform((h: Hitsplat) =>
        HitDistribution.single(1.0, [new Hitsplat(h.damage), new Hitsplat(Math.trunc((h.damage * 4) / 10))])
      );
    }

    // Corp half-damage (BEFORE ruby bolts)
    if (this.monster.name === "Corporeal Beast" && !this.isWearingCorpbaneWeapon()) {
      dist = dist.transform(divisionTransformer(2));
    }

    // Ruby bolts (AFTER corp — ruby proc damage bypasses Corp reduction)
    if (
      this.player.style.type === "ranged" &&
      this.player.equipment.weapon?.name?.includes("rossbow") &&
      this.player.equipment.ammo
    ) {
      const name = this.player.equipment.ammo.name || "";
      const currentHp = (this.player.skills.hp || 10) + (this.player.boosts.hp || 0);
      if (name.includes("Ruby") && name.includes("(e)") && currentHp >= 10) {
        const ctx = {
          rangedLvl: this.player.skills.ranged + this.player.boosts.ranged,
          maxHit,
          zcb: this.wearing("Zaryte crossbow"),
          spec,
          kandarinDiary: this.player.buffs.kandarinDiary || false,
          monster: this.monster,
        };
        dist = dist.transform(rubyBolts(ctx));
      }
    }

    return dist;
  }

  _getBoltContext(maxHit: number) {
    return {
      rangedLvl: this.player.skills.ranged + this.player.boosts.ranged,
      maxHit,
      zcb: this.wearing("Zaryte crossbow"),
      spec: this.opts.usingSpecialAttack,
      kandarinDiary: this.player.buffs.kandarinDiary || false,
      monster: this.monster,
    };
  }

  // ══════════════════════════════
  // NPC TRANSFORMS
  // ══════════════════════════════
  _applyNpcTransforms(dist: AttackDistribution): AttackDistribution {
    if (this.isImmune())
      return new AttackDistribution([new HitDistribution([new WeightedHit(1.0, [Hitsplat.INACCURATE])])]);
    const mattrs = this.monster.attributes || [];
    let st = this.player.style.type;
    if (this.opts.usingSpecialAttack && this.wearing("Voidwaker")) st = "magic";

    if (this.monster.name === "Zulrah") dist = dist.transform(cappedRerollTransformer(50, 5, 45));
    if (this.monster.name === "Fragment of Seren") dist = dist.transform(linearMinTransformer(2, 22));
    if (["Kraken", "Cave kraken"].includes(this.monster.name) && st === "ranged")
      dist = dist.transform(divisionTransformer(7, 1));
    if (VERZIK_P1_IDS.includes(this.monster.id) && !this.wearing("Dawnbringer"))
      dist = dist.transform(linearMinTransformer(this.isUsingMeleeStyle() ? 10 : 3));
    if (TEKTON_IDS.includes(this.monster.id) && st === "magic") dist = dist.transform(divisionTransformer(5, 1));
    if (GLOWING_CRYSTAL_IDS.includes(this.monster.id) && st === "magic") dist = dist.transform(divisionTransformer(3));
    if ((OLM_MELEE_HAND_IDS.includes(this.monster.id) || OLM_HEAD_IDS.includes(this.monster.id)) && st === "magic")
      dist = dist.transform(divisionTransformer(3));
    if (
      (OLM_MAGE_HAND_IDS.includes(this.monster.id) || OLM_MELEE_HAND_IDS.includes(this.monster.id)) &&
      st === "ranged"
    )
      dist = dist.transform(divisionTransformer(3));
    if (ICE_DEMON_IDS.includes(this.monster.id) && this.player.spell?.element !== "fire" && !this.isUsingDemonbane())
      dist = dist.transform(divisionTransformer(3));
    if (this.monster.name === "Slagilith" && this.player.equipment.weapon?.category !== EquipmentCategory.PICKAXE)
      dist = dist.transform(divisionTransformer(3));
    if (NIGHTMARE_TOTEM_IDS.includes(this.monster.id) && st === "magic") dist = dist.transform(multiplyTransformer(2));
    if (["Slash Bash", "Zogre", "Skogre"].includes(this.monster.name)) {
      if (this.player.spell?.name === "Crumble Undead") dist = dist.transform(divisionTransformer(2));
      else if (
        this.player.style.type !== "ranged" ||
        !this.player.equipment.ammo?.name?.includes(" brutal") ||
        this.player.equipment.weapon?.name !== "Comp ogre bow"
      )
        dist = dist.transform(divisionTransformer(4));
    }
    if (BA_ATTACKER_MONSTERS.includes(this.monster.id) && this.player.buffs.baAttackerLevel)
      dist = dist.transform(flatAddTransformer(this.player.buffs.baAttackerLevel), { transformInaccurate: true });
    if (
      this.monster.name === "Tormented Demon" &&
      this.monster.inputs?.phase !== "Unshielded" &&
      !this.isUsingDemonbane() &&
      !this.isUsingAbyssal()
    )
      dist = dist.transform(multiplyTransformer(4, 5, 1));
    if (mattrs.includes(MonsterAttribute.VAMPYRE_2)) {
      if (!this.wearingVampyrebane(MonsterAttribute.VAMPYRE_2) && this.wearing("Efaritay's aid"))
        dist = dist.transform(divisionTransformer(2));
      else if (this.isWearingSilverWeapon()) dist = dist.transform(flatLimitTransformer(10));
    }
    if (HUEYCOATL_TAIL_IDS.includes(this.monster.id)) {
      const crush =
        st === "crush" &&
        this.player.offensive.crush > this.player.offensive.slash &&
        this.player.offensive.crush > this.player.offensive.stab;
      const earth = this.player.spell?.element === "earth";
      dist = dist.transform(linearMinTransformer(crush || earth ? 9 : 4));
      if (crush)
        dist = dist.transform((h: Hitsplat) =>
          h.damage > 0 ? HitDistribution.single(1.0, [h]) : HitDistribution.single(1.0, [new Hitsplat(1)])
        );
    }
    if (HUEYCOATL_PHASE_IDS.includes(this.monster.id) && this.monster.inputs?.phase === "With Pillar")
      dist = dist.transform(multiplyTransformer(13, 10));
    if (ABYSSAL_SIRE_TRANSITION_IDS.includes(this.monster.id) && this.monster.inputs?.phase === "Transition")
      dist = dist.transform(divisionTransformer(2));
    const fa = this.monster.defensive?.flat_armour;
    if (fa && st !== "magic") dist = dist.transform(flatAddTransformer(-fa), { transformInaccurate: false });
    return dist;
  }

  // ══════════════════════════════
  // DoT (Damage over Time)
  // ══════════════════════════════
  isImmuneToNormalBurns() {
    return IMMUNE_TO_BURN_DAMAGE_NPC_IDS.includes(this.monster.id);
  }

  getDoTExpected() {
    if (!this.opts.usingSpecialAttack) return 0;
    if (this.wearing(["Bone claws", "Burning claws"]) && !this.isImmuneToNormalBurns())
      return burningClawDoT(this.getHitChance());
    if (this.wearing("Scorching bow") && !this.isImmuneToNormalBurns())
      return (this.monster.attributes || []).includes(MonsterAttribute.DEMON) ? 5 : 1;
    if (this.wearing("Arkan blade") && !this.isImmuneToNormalBurns()) return 10 * this.getHitChance();
    return 0;
  }

  getDoTMax() {
    if (!this.opts.usingSpecialAttack) return 0;
    if (this.wearing(["Bone claws", "Burning claws"]) && !this.isImmuneToNormalBurns()) return 29;
    if (this.wearing("Scorching bow") && !this.isImmuneToNormalBurns())
      return (this.monster.attributes || []).includes(MonsterAttribute.DEMON) ? 5 : 1;
    if (this.wearing("Arkan blade") && !this.isImmuneToNormalBurns()) return 10;
    return 0;
  }

  // ══════════════════════════════
  // DPS / TTK
  // ══════════════════════════════
  getAttackSpeed() {
    return this.player.attackSpeed ?? calculateAttackSpeed(this.player, this.monster);
  }

  getExpectedAttackSpeed() {
    if (this.isWearingBloodMoonSet()) {
      const a = this.getHitChance();
      const p = this.opts.usingSpecialAttack ? 1 - (1 - a) ** 2 : a / 3 + (a * a * 2) / 9;
      return this.getAttackSpeed() - p;
    }
    if (this.tdUnshieldedBonusApplies()) return this.getAttackSpeed() - 1;
    if (this.opts.usingSpecialAttack && this.wearing("Eye of ayak")) return 5;
    return this.getAttackSpeed();
  }

  getExpectedDamage() {
    return this.getDistribution().getExpectedDamage() + this.getDoTExpected();
  }

  getDpt() {
    return this.getExpectedDamage() / this.getExpectedAttackSpeed();
  }

  getDps() {
    return this.getDpt() / SECONDS_PER_TICK;
  }

  getHtk() {
    const dist = this.getDistribution(),
      hist = dist.asHistogram();
    const hp = Number(this.monster.inputs?.monsterCurrentHp ?? this.monster.skills?.hp ?? 1);
    const mx = Math.min(hp, dist.getMax());
    if (mx === 0) return 0;
    const htk = new Float64Array(hp + 1);
    for (let h = 1; h <= hp; h++) {
      let v = 1.0;
      for (let d = 1; d <= Math.min(h, mx); d++) {
        if (hist[d]) v += hist[d].value * htk[h - d];
      }
      htk[h] = v / (1 - (hist[0]?.value || 0));
    }
    return htk[hp];
  }

  getTtk() {
    return this.getHtk() * this.getExpectedAttackSpeed() * SECONDS_PER_TICK;
  }

  getSpecCost() {
    const weaponName = this.player.equipment.weapon?.name;
    return weaponName ? (WEAPON_SPEC_COSTS as Record<string, number | undefined>)[weaponName] : undefined;
  }
}

// ══════════════════════════════════════════
// UI ENTRY POINT
// ══════════════════════════════════════════
export function calculateDps({
  skills,
  boosts,
  equipment,
  style,
  prayerKeys,
  onSlayerTask,
  monster,
  spell,
  buffs,
  defenceReductions,
}: CalculateDpsInput): DpsResult {
  if (!style || !monster)
    return { dps: 0, maxHit: 0, accuracy: 0, attackSpeed: 4, attackRoll: 0, defenceRoll: 0, htk: 0, ttk: 0, hitDist: [] };
  const resolvedEquipment = equipment || {};
  const totals = aggregateEquipmentBonuses(resolvedEquipment);
  const player: CalcPlayer = {
    skills: {
      atk: skills.atk || 1,
      str: skills.str || 1,
      def: skills.def || 1,
      ranged: skills.ranged || 1,
      magic: skills.magic || 1,
      prayer: skills.prayer || 1,
      hp: skills.hp || 10,
      mining: skills.mining || 1,
    },
    boosts: { atk: 0, str: 0, def: 0, ranged: 0, magic: 0, hp: 0, prayer: 0, ...(boosts || {}) },
    equipment: resolvedEquipment,
    style,
    spell: spell || null,
    prayers: prayerKeys || [],
    buffs: {
      onSlayerTask: onSlayerTask || false,
      inWilderness: false,
      chargeSpell: false,
      markOfDarkness: false,
      sunfireRunes: false,
      soulreaperStacks: 0,
      kandarinDiary: false,
      currentHp: skills.hp || 99,
      baAttackerLevel: 0,
      ...(buffs || {}),
    },
    bonuses: totals.bonuses,
    offensive: totals.offensive,
    defensive: totals.defensive,
    currentPrayer: skills.prayer || 1,
  };
  let mon: CalcMonster = {
    ...monster,
    inputs: { monsterCurrentHp: monster.skills?.hp || 1, ...(monster.inputs || {}) },
    skills: monster.skills || { atk: 1, str: 1, def: 1, magic: 1, ranged: 1, hp: 1 },
    attributes: monster.attributes || [],
    defensive: monster.defensive || {},
  };
  const baseMon = mon;
  mon = applyDefenceReductions(mon, defenceReductions);
  const calc = new PlayerVsNPCCalc(player, mon, { baseMonster: baseMon, defenceReductions: defenceReductions || {} });
  const [minHit, maxHit] = calc.getMinAndMax();
  let htk = 0,
    ttk = 0,
    hitDist: DpsHistogramPoint[] = [],
    specExpected: number | null = null;
  try {
    htk = calc.getHtk();
    ttk = calc.getTtk();
  } catch (e) {
    /* edge cases */
  }
  try {
    hitDist = calc.getDistribution().asHistogram();
  } catch (e) {
    /* edge cases */
  }
  try {
    specExpected = calc.getDistribution().getExpectedDamage();
  } catch (e) {
    /* edge cases */
  }
  let dotExpected = 0,
    dotMax = 0;
  try {
    dotExpected = calc.getDoTExpected();
    dotMax = calc.getDoTMax();
  } catch (e) {
    /* edge cases */
  }
  return {
    dps: Math.round(calc.getDps() * 1000) / 1000,
    maxHit,
    minHit,
    accuracy: Math.round(calc.getDisplayHitChance() * 10000) / 100,
    attackSpeed: Math.round(calc.getExpectedAttackSpeed() * 100) / 100,
    attackRoll: calc.getMaxAttackRoll(),
    defenceRoll: calc.getNPCDefenceRoll(),
    htk: Math.round(htk * 10) / 10,
    ttk: Math.round(ttk * 10) / 10,
    hitDist,
    specExpected: specExpected !== null ? Math.round(specExpected * 10) / 10 : null,
    dotExpected: Math.round(dotExpected * 100) / 100,
    dotMax,
  };
}
