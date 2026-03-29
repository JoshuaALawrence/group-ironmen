import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aggregateEquipmentBonuses,
  applyDefenceReductions,
  getCombatStyles,
  getConflictingPrayers,
  type CalcEquipmentPiece,
  type CalcMonster,
} from "../dps-calc/dps-calc-engine";
import {
  AKKHA_IDS,
  ARAXXOR_IDS,
  HUEYCOATL_IDS,
  KEPHRI_SHIELDED_IDS,
  KEPHRI_UNSHIELDED_IDS,
  NEX_IDS,
  NIGHTMARE_IDS,
  P3_WARDEN_IDS,
  SOTETSEG_IDS,
  TOA_OBELISK_IDS,
  VARDORVIS_IDS,
  VERZIK_IDS,
  YAMA_IDS,
  ZEBAK_IDS,
} from "../dps-calc/dps-calc-constants";

function makePiece(overrides: Partial<CalcEquipmentPiece> = {}): CalcEquipmentPiece {
  return {
    id: 1000,
    name: "Training item",
    bonuses: {},
    offensive: {},
    defensive: {},
    ...overrides,
  };
}

function makeMonster(overrides: Partial<CalcMonster> = {}): CalcMonster {
  return {
    id: 9999,
    name: "Training dummy",
    attributes: [],
    skills: { atk: 100, str: 100, def: 100, magic: 100, ranged: 100, hp: 200 },
    defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("dps calc engine helper and reduction coverage", () => {
  it("loads equipment, monsters, and spells once and resolves lookups across cache states", async () => {
    const fetchSpy = vi.fn(async (url: string) => ({
      json: async () => {
        if (url === "/data/equipment.json") {
          return [
            { id: 4151, name: "Abyssal whip", category: "Whip" },
            { id: 12934, name: "Dragon dart", category: "Thrown", bonuses: { ranged_str: 35 } },
          ];
        }
        if (url === "/data/monsters.json") {
          return [{ id: 1, name: "Goblin", skills: { atk: 1, str: 1, def: 1, magic: 1, ranged: 1, hp: 5 } }];
        }
        return [
          { name: "Wind Strike", spellbook: "standard", max_hit: 2 },
          { name: "Ice Burst", spellbook: "ancient", max_hit: 22 },
        ];
      },
    }));
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    const engine = await import("../dps-calc/dps-calc-engine");

    expect(engine.getEquipmentById(4151)).toBeNull();
    expect(engine.getSpells()).toEqual([]);
    expect(engine.spellByName("Wind Strike")).toBeNull();

    const equipment = await engine.loadEquipmentData();
    const equipmentAgain = await engine.loadEquipmentData();
    const monsters = await engine.loadMonsterData();
    const monstersAgain = await engine.loadMonsterData();
    const spells = await engine.loadSpellData();
    const spellsAgain = await engine.loadSpellData();

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
      "/data/equipment.json",
      "/data/monsters.json",
      "/data/spells.json",
    ]);

    expect(equipmentAgain).toBe(equipment);
    expect(monstersAgain).toBe(monsters);
    expect(spellsAgain).toBe(spells);

    expect(engine.getEquipmentById(4151)).toMatchObject({ name: "Abyssal whip", category: "Whip" });
    expect(engine.getEquipmentById(999999)).toBeNull();
    expect(engine.getSpells()).toEqual(spells);
    expect(engine.spellByName("Wind Strike")).toMatchObject({ spellbook: "standard", max_hit: 2 });
    expect(engine.spellByName("Missing Spell")).toBeNull();
  });

  it("keeps alternate prayer representatives inside the correct conflict families", () => {
    const armConflicts = getConflictingPrayers("superhuman_strength");
    expect(armConflicts.has("ultimate_strength")).toBe(true);
    expect(armConflicts.has("improved_reflexes")).toBe(false);
    expect(armConflicts.has("steel_skin")).toBe(false);
    expect(armConflicts.has("piety")).toBe(true);

    const brainConflicts = getConflictingPrayers("incredible_reflexes");
    expect(brainConflicts.has("clarity_of_thought")).toBe(true);
    expect(brainConflicts.has("superhuman_strength")).toBe(false);
    expect(brainConflicts.has("rock_skin")).toBe(false);
    expect(brainConflicts.has("rigour")).toBe(true);

    const skinConflicts = getConflictingPrayers("steel_skin");
    expect(skinConflicts.has("rock_skin")).toBe(true);
    expect(skinConflicts.has("burst_of_strength")).toBe(false);
    expect(skinConflicts.has("improved_reflexes")).toBe(false);
    expect(skinConflicts.has("augury")).toBe(true);

    const magicConflicts = getConflictingPrayers("augury");
    expect(magicConflicts.has("mystic_vigour")).toBe(true);
    expect(magicConflicts.has("thick_skin")).toBe(true);
    expect(magicConflicts.has("sharp_eye")).toBe(true);
  });

  it("covers uncovered combat-style categories with stable exact style maps", () => {
    const categoryCases = [
      [
        "2h Sword",
        [
          { name: "Chop", type: "slash", stance: "Accurate" },
          { name: "Slash", type: "slash", stance: "Aggressive" },
          { name: "Smash", type: "crush", stance: "Aggressive" },
          { name: "Block", type: "slash", stance: "Defensive" },
        ],
      ],
      [
        "Axe",
        [
          { name: "Chop", type: "slash", stance: "Accurate" },
          { name: "Hack", type: "slash", stance: "Aggressive" },
          { name: "Smash", type: "crush", stance: "Aggressive" },
          { name: "Block", type: "slash", stance: "Defensive" },
        ],
      ],
      [
        "Blunt",
        [
          { name: "Pound", type: "crush", stance: "Accurate" },
          { name: "Pummel", type: "crush", stance: "Aggressive" },
          { name: "Block", type: "crush", stance: "Defensive" },
        ],
      ],
      [
        "Polestaff",
        [
          { name: "Pound", type: "crush", stance: "Accurate" },
          { name: "Pummel", type: "crush", stance: "Aggressive" },
          { name: "Block", type: "crush", stance: "Defensive" },
        ],
      ],
      [
        "Crossbow",
        [
          { name: "Accurate", type: "ranged", stance: "Accurate" },
          { name: "Rapid", type: "ranged", stance: "Rapid" },
          { name: "Longrange", type: "ranged", stance: "Longrange" },
        ],
      ],
      [
        "Thrown",
        [
          { name: "Accurate", type: "ranged", stance: "Accurate" },
          { name: "Rapid", type: "ranged", stance: "Rapid" },
          { name: "Longrange", type: "ranged", stance: "Longrange" },
        ],
      ],
      [
        "Chinchompas",
        [
          { name: "Short fuse", type: "ranged", stance: "Accurate" },
          { name: "Medium fuse", type: "ranged", stance: "Rapid" },
          { name: "Long fuse", type: "ranged", stance: "Longrange" },
        ],
      ],
      [
        "Claw",
        [
          { name: "Chop", type: "slash", stance: "Accurate" },
          { name: "Slash", type: "slash", stance: "Aggressive" },
          { name: "Lunge", type: "stab", stance: "Controlled" },
          { name: "Block", type: "slash", stance: "Defensive" },
        ],
      ],
      [
        "Dagger",
        [
          { name: "Stab", type: "stab", stance: "Accurate" },
          { name: "Lunge", type: "stab", stance: "Aggressive" },
          { name: "Slash", type: "slash", stance: "Aggressive" },
          { name: "Block", type: "stab", stance: "Defensive" },
        ],
      ],
      [
        "Partisan",
        [
          { name: "Stab", type: "stab", stance: "Accurate" },
          { name: "Lunge", type: "stab", stance: "Aggressive" },
          { name: "Pound", type: "crush", stance: "Aggressive" },
          { name: "Block", type: "stab", stance: "Defensive" },
        ],
      ],
      [
        "Pickaxe",
        [
          { name: "Spike", type: "stab", stance: "Accurate" },
          { name: "Impale", type: "stab", stance: "Aggressive" },
          { name: "Smash", type: "crush", stance: "Aggressive" },
          { name: "Block", type: "stab", stance: "Defensive" },
        ],
      ],
      [
        "Polearm",
        [
          { name: "Jab", type: "stab", stance: "Controlled" },
          { name: "Swipe", type: "slash", stance: "Aggressive" },
          { name: "Fend", type: "stab", stance: "Defensive" },
        ],
      ],
      [
        "Powered Staff",
        [
          { name: "Accurate", type: "magic", stance: "Accurate" },
          { name: "Longrange", type: "magic", stance: "Longrange" },
        ],
      ],
      [
        "Powered Wand",
        [
          { name: "Accurate", type: "magic", stance: "Accurate" },
          { name: "Longrange", type: "magic", stance: "Longrange" },
        ],
      ],
      [
        "Scythe",
        [
          { name: "Reap", type: "slash", stance: "Accurate" },
          { name: "Chop", type: "slash", stance: "Aggressive" },
          { name: "Jab", type: "crush", stance: "Aggressive" },
          { name: "Block", type: "slash", stance: "Defensive" },
        ],
      ],
      [
        "Slash Sword",
        [
          { name: "Chop", type: "slash", stance: "Accurate" },
          { name: "Slash", type: "slash", stance: "Aggressive" },
          { name: "Lunge", type: "stab", stance: "Controlled" },
          { name: "Block", type: "slash", stance: "Defensive" },
        ],
      ],
      [
        "Spear",
        [
          { name: "Lunge", type: "stab", stance: "Controlled" },
          { name: "Swipe", type: "slash", stance: "Controlled" },
          { name: "Pound", type: "crush", stance: "Controlled" },
          { name: "Block", type: "stab", stance: "Defensive" },
        ],
      ],
      [
        "Spiked",
        [
          { name: "Pound", type: "crush", stance: "Accurate" },
          { name: "Pummel", type: "crush", stance: "Aggressive" },
          { name: "Spike", type: "stab", stance: "Controlled" },
          { name: "Block", type: "crush", stance: "Defensive" },
        ],
      ],
      [
        "Stab Sword",
        [
          { name: "Stab", type: "stab", stance: "Accurate" },
          { name: "Lunge", type: "stab", stance: "Aggressive" },
          { name: "Slash", type: "slash", stance: "Aggressive" },
          { name: "Block", type: "stab", stance: "Defensive" },
        ],
      ],
      [
        "Staff",
        [
          { name: "Bash", type: "crush", stance: "Accurate" },
          { name: "Pound", type: "crush", stance: "Aggressive" },
          { name: "Focus", type: "crush", stance: "Defensive" },
        ],
      ],
      [
        "Bladed Staff",
        [
          { name: "Jab", type: "stab", stance: "Accurate" },
          { name: "Swipe", type: "slash", stance: "Aggressive" },
          { name: "Fend", type: "crush", stance: "Defensive" },
        ],
      ],
      [
        "Whip",
        [
          { name: "Flick", type: "slash", stance: "Accurate" },
          { name: "Lash", type: "slash", stance: "Controlled" },
          { name: "Deflect", type: "slash", stance: "Defensive" },
        ],
      ],
      [
        "Bludgeon",
        [
          { name: "Pound", type: "crush", stance: "Aggressive" },
          { name: "Pummel", type: "crush", stance: "Aggressive" },
          { name: "Smash", type: "crush", stance: "Aggressive" },
        ],
      ],
      [
        "Banner",
        [
          { name: "Lunge", type: "stab", stance: "Accurate" },
          { name: "Swipe", type: "slash", stance: "Aggressive" },
          { name: "Pound", type: "crush", stance: "Controlled" },
          { name: "Block", type: "stab", stance: "Defensive" },
        ],
      ],
    ] as const;

    for (const [category, expected] of categoryCases) {
      expect(getCombatStyles(category)).toEqual(expected);
    }
  });

  it("applies defence floors for special boss ids and covers boolean plus fallback reductions", () => {
    const earlyMonster = makeMonster();
    expect(applyDefenceReductions(earlyMonster, undefined)).toBe(earlyMonster);

    const floorCases = [
      { id: VERZIK_IDS[0], baseDef: 173, expectedDef: 173 },
      { id: VARDORVIS_IDS[0], baseDef: 181, expectedDef: 181 },
      { id: SOTETSEG_IDS[0], baseDef: 101, expectedDef: 100 },
      { id: NIGHTMARE_IDS[0], baseDef: 121, expectedDef: 120 },
      { id: AKKHA_IDS[0], baseDef: 71, expectedDef: 70 },
      { id: KEPHRI_SHIELDED_IDS[0], baseDef: 61, expectedDef: 60 },
      { id: KEPHRI_UNSHIELDED_IDS[0], baseDef: 61, expectedDef: 60 },
      { id: ZEBAK_IDS[0], baseDef: 51, expectedDef: 50 },
      { id: P3_WARDEN_IDS[0], baseDef: 121, expectedDef: 120 },
      { id: TOA_OBELISK_IDS[0], baseDef: 61, expectedDef: 60 },
      { id: NEX_IDS[0], baseDef: 251, expectedDef: 250 },
      { id: ARAXXOR_IDS[0], baseDef: 91, expectedDef: 90 },
      { id: HUEYCOATL_IDS[0], baseDef: 121, expectedDef: 120 },
      { id: YAMA_IDS[0], baseDef: 146, expectedDef: 145 },
    ];

    for (const { id, baseDef, expectedDef } of floorCases) {
      const reduced = applyDefenceReductions(
        makeMonster({
          id,
          skills: { atk: 100, str: 100, def: baseDef, magic: 80, ranged: 100, hp: 250 },
          defensive: { magic: 25 },
        }),
        { dwh: 1 }
      );

      expect(reduced.skills.def).toBe(expectedDef);
    }

    const accursedWins = applyDefenceReductions(
      makeMonster({
        skills: { atk: 20, str: 20, def: 20, magic: 20, ranged: 20, hp: 40 },
      }),
      { accursed: true, vulnerability: true }
    );
    expect(accursedWins.skills.def).toBe(17);
    expect(accursedWins.skills.magic).toBe(17);

    const fallbackReduction = applyDefenceReductions(
      makeMonster({
        attributes: undefined as unknown as Array<string | number>,
        skills: { atk: 20, str: 20, def: 20, magic: 10, ranged: 20, hp: 40 },
        defensive: { magic: 8 },
      }),
      { elderMaul: true, arclight: 1, emberlight: 1, seercull: 4, ayak: 50 }
    );
    expect(fallbackReduction.skills).toMatchObject({ atk: 16, str: 16, def: 9, magic: 6 });
    expect(fallbackReduction.defensive.magic).toBe(0);
  });

  it("aggregates sparse equipment maps without counting missing stats or null slots", () => {
    const totals = aggregateEquipmentBonuses({
      weapon: makePiece({
        id: 2001,
        name: "Prayer dagger",
        bonuses: { str: 4, prayer: 2 },
        offensive: { stab: 7 },
        defensive: { slash: 1 },
      }),
      body: makePiece({
        id: 2002,
        name: "Archer body",
        bonuses: { ranged_str: 9 },
        offensive: { ranged: 12 },
        defensive: { ranged: 6, magic: 3 },
      }),
      cape: makePiece({ id: 2003, name: "Plain cape" }),
      shield: null,
    });

    expect(totals).toEqual({
      bonuses: { str: 4, ranged_str: 9, magic_str: 0, prayer: 2 },
      offensive: { stab: 7, slash: 0, crush: 0, magic: 0, ranged: 12 },
      defensive: { stab: 0, slash: 1, crush: 0, magic: 3, ranged: 6 },
    });
  });
});