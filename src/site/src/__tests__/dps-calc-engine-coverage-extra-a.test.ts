import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("dps calc engine extra helper coverage A", () => {
  it("caches loaded datasets and resolves duplicate equipment ids from the last loaded entry", async () => {
    const equipmentPayload = [
      { id: 100, name: "Bronze sword", category: "Stab Sword" },
      { id: 100, name: "Bronze sword (p++)", category: "Stab Sword" },
      { id: 101, name: "Iron arrow", category: "Thrown", bonuses: { ranged_str: 10 } },
    ];
    const monsterPayload = [
      { id: 1, name: "Goblin", skills: { atk: 1, str: 1, def: 1, magic: 1, ranged: 1, hp: 5 } },
      { id: 2, name: "Cow", skills: { atk: 8, str: 8, def: 8, magic: 1, ranged: 1, hp: 8 } },
    ];
    const spellPayload = [
      { name: "Wind Strike", spellbook: "standard", max_hit: 2 },
      { name: "Fire Blast", spellbook: "standard", max_hit: 16 },
    ];

    const fetchSpy = vi.fn(async (url: string) => ({
      json: async () => {
        if (url === "/data/equipment.json") return equipmentPayload;
        if (url === "/data/monsters.json") return monsterPayload;
        if (url === "/data/spells.json") return spellPayload;
        throw new Error(`Unexpected URL: ${url}`);
      },
    }));

    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    const engine = await import("../dps-calc/dps-calc-engine");

    expect(engine.getEquipmentById(100)).toBeNull();
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
    expect(engine.getSpells()).toBe(spells);

    expect(engine.getEquipmentById(100)).toBe(equipmentPayload[1]);
    expect(engine.getEquipmentById(101)).toBe(equipmentPayload[2]);
    expect(engine.getEquipmentById(999999)).toBeNull();
    expect(engine.spellByName("Wind Strike")).toBe(spellPayload[0]);
    expect(engine.spellByName("wind strike")).toBeNull();
  });

  it("restarts module-scoped caches after a fresh import", async () => {
    const firstFetch = vi.fn(async () => ({
      json: async () => [{ id: 500, name: "First cache item", category: "Whip" }],
    }));
    vi.stubGlobal("fetch", firstFetch as unknown as typeof fetch);

    const firstEngine = await import("../dps-calc/dps-calc-engine");
    await firstEngine.loadEquipmentData();

    expect(firstFetch).toHaveBeenCalledTimes(1);
    expect(firstEngine.getEquipmentById(500)).toMatchObject({ name: "First cache item" });

    vi.resetModules();

    const secondFetch = vi.fn(async () => ({
      json: async () => [{ id: 500, name: "Second cache item", category: "Whip" }],
    }));
    vi.stubGlobal("fetch", secondFetch as unknown as typeof fetch);

    const secondEngine = await import("../dps-calc/dps-calc-engine");

    expect(secondEngine.getEquipmentById(500)).toBeNull();

    await secondEngine.loadEquipmentData();

    expect(secondFetch).toHaveBeenCalledTimes(1);
    expect(secondEngine.getEquipmentById(500)).toMatchObject({ name: "Second cache item" });
    expect(firstEngine.getEquipmentById(500)).toMatchObject({ name: "First cache item" });
  });

  it("covers exported prayer conflict and potion helpers with exact edge semantics", async () => {
    const engine = await import("../dps-calc/dps-calc-engine");

    const unknownConflicts = engine.getConflictingPrayers("not_a_real_prayer");
    expect(unknownConflicts.size).toBe(Object.keys(engine.PRAYERS).length);
    expect(unknownConflicts.has("piety")).toBe(true);
    expect(unknownConflicts.has("thick_skin")).toBe(true);

    const pietyConflicts = engine.getConflictingPrayers("piety");
    expect(pietyConflicts.size).toBe(Object.keys(engine.PRAYERS).length - 1);
    expect(pietyConflicts.has("piety")).toBe(false);
    expect(pietyConflicts.has("augury")).toBe(true);

    expect(engine.POTIONS.none.calc({ atk: 99, str: 99, def: 99, ranged: 99, magic: 99 })).toEqual({});
    expect(engine.POTIONS.super_combat.calc({ atk: 99, str: 80, def: 70 })).toEqual({ atk: 19, str: 17, def: 15 });
    expect(engine.POTIONS.smelling_salts.calc({ atk: 99, str: 99, def: 99, ranged: 99, magic: 99 })).toEqual({
      atk: 26,
      str: 26,
      def: 26,
      magic: 26,
      ranged: 26,
    });
    expect(engine.POTIONS.imbued_heart.calc({ magic: 94 })).toEqual({ magic: 10 });
    expect(engine.POTIONS.saturated_heart.calc({ magic: 94 })).toEqual({ magic: 13 });
  });

  it("returns exact combat style maps for unasserted exported weapon categories", async () => {
    const engine = await import("../dps-calc/dps-calc-engine");

    expect(engine.getCombatStyles("Banner")).toEqual([
      { name: "Lunge", type: "stab", stance: "Accurate" },
      { name: "Swipe", type: "slash", stance: "Aggressive" },
      { name: "Pound", type: "crush", stance: "Controlled" },
      { name: "Block", type: "stab", stance: "Defensive" },
    ]);

    expect(engine.getCombatStyles("Staff")).toEqual([
      { name: "Bash", type: "crush", stance: "Accurate" },
      { name: "Pound", type: "crush", stance: "Aggressive" },
      { name: "Focus", type: "crush", stance: "Defensive" },
    ]);

    expect(engine.getCombatStyles("Bladed Staff")).toEqual([
      { name: "Jab", type: "stab", stance: "Accurate" },
      { name: "Swipe", type: "slash", stance: "Aggressive" },
      { name: "Fend", type: "crush", stance: "Defensive" },
    ]);

    expect(engine.getCombatStyles("Whip")).toEqual([
      { name: "Flick", type: "slash", stance: "Accurate" },
      { name: "Lash", type: "slash", stance: "Controlled" },
      { name: "Deflect", type: "slash", stance: "Defensive" },
    ]);

    expect(engine.getCombatStyles("Bludgeon")).toEqual([
      { name: "Pound", type: "crush", stance: "Aggressive" },
      { name: "Pummel", type: "crush", stance: "Aggressive" },
      { name: "Smash", type: "crush", stance: "Aggressive" },
    ]);
  });
});