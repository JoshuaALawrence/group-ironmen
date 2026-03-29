import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRAYERS,
  POTIONS,
  aggregateEquipmentBonuses,
  applyDefenceReductions,
  calculateDps,
  getCombatStyles,
  getEquipmentById,
  getConflictingPrayers,
  getSpells,
  loadMonsterData,
  loadSpellData,
  spellByName,
} from "../dps-calc/dps-calc-engine";

describe("dps calc engine", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        json: async () => {
          if (url.includes("monsters")) {
            return [{ id: 1, name: "Goblin", skills: { atk: 1, str: 1, def: 1, magic: 1, ranged: 1, hp: 5 } }];
          }

          return [{ name: "Air Strike", spellbook: "standard", max_hit: 1 }];
        },
      })) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exposes prayer, potion, and combat-style helpers", () => {
    expect(PRAYERS.piety.name).toBe("Piety");
    expect(POTIONS.overload_plus.name).toBe("Overload (+)");
    expect(getConflictingPrayers("burst_of_strength")).not.toContain("thick_skin");
    expect(getConflictingPrayers("burst_of_strength")).not.toContain("clarity_of_thought");
    expect(getConflictingPrayers("piety")).toContain("rigour");
    expect(getCombatStyles("Bow")).toHaveLength(3);
    expect(getCombatStyles(undefined)).toHaveLength(3);
  });

  it("aggregates equipment bonuses and applies defence reductions", () => {
    const equipment = {
      weapon: {
        id: 100,
        name: "Bronze dagger",
        category: "Dagger",
        speed: 4,
        bonuses: { str: 2, ranged_str: 0, magic_str: 0, prayer: 0 },
        offensive: { stab: 4, slash: 0, crush: 0, magic: 0, ranged: 0 },
        defensive: { stab: 1, slash: 1, crush: 0, magic: 0, ranged: 0 },
      },
      helmet: null,
    };

    expect(aggregateEquipmentBonuses(equipment).bonuses.str).toBe(2);
    expect(aggregateEquipmentBonuses(equipment).offensive.stab).toBe(4);

    const reduced = applyDefenceReductions(
      {
        id: 11778,
        name: "Baba",
        skills: { atk: 200, str: 200, def: 200, magic: 200, ranged: 200, hp: 500 },
        defensive: { magic: 20 },
        attributes: [],
      },
      { vulnerability: true, dwh: 1, seercull: 1, bgs: 10 }
    );

    expect(reduced.skills.def).toBeGreaterThanOrEqual(60);
    expect(reduced.skills.magic).toBeGreaterThanOrEqual(0);
  });

  it("loads monster and spell data and runs a dps calculation", async () => {
    await loadMonsterData();
    await loadSpellData();

    expect(getEquipmentById(100)).toBeNull();
    expect(getSpells()).toEqual([expect.objectContaining({ name: "Air Strike" })]);
    expect(spellByName("Air Strike")).toEqual(expect.objectContaining({ name: "Air Strike" }));

    const result = calculateDps({
      skills: { atk: 1, str: 1, def: 1, ranged: 1, magic: 1, prayer: 1, hp: 10, mining: 1 },
      boosts: {},
      equipment: {
        weapon: {
          id: 100,
          name: "Bronze dagger",
          category: "Dagger",
          speed: 4,
          bonuses: {},
          offensive: { stab: 4, slash: 0, crush: 0, magic: 0, ranged: 0 },
          defensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
        },
      },
      style: { type: "stab", stance: "Accurate" },
      prayerKeys: [],
      onSlayerTask: false,
      monster: {
        id: 1,
        name: "Goblin",
        skills: { atk: 1, str: 1, def: 1, magic: 1, ranged: 1, hp: 5 },
      },
      spell: null,
      buffs: {},
    });

    expect(result.attackSpeed).toBeGreaterThan(0);
    expect(result.maxHit).toBeGreaterThanOrEqual(result.minHit);
    expect(result.hitDist.length).toBeGreaterThan(0);
  });
});