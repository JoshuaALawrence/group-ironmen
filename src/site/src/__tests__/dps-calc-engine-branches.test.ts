import { describe, expect, it } from "vitest";

import {
  PlayerVsNPCCalc,
  aggregateEquipmentBonuses,
  applyDefenceReductions,
  calculateDps,
  getCombatStyles,
  getConflictingPrayers,
  type CalcEquipmentPiece,
  type CalcMonster,
  type CalcPlayer,
} from "../dps-calc/dps-calc-engine";
import {
  BABA_IDS,
  ECLIPSE_MOON_IDS,
  MonsterAttribute,
} from "../dps-calc/dps-calc-constants";

function makePiece(overrides: Partial<CalcEquipmentPiece> = {}): CalcEquipmentPiece {
  return {
    id: 1000,
    name: "Training sword",
    category: "Stab Sword",
    speed: 4,
    bonuses: { str: 80, ranged_str: 0, magic_str: 0, prayer: 0 },
    offensive: { stab: 80, slash: 60, crush: 10, ranged: 0, magic: 0 },
    defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
    ...overrides,
  };
}

function makeMonster(partial: Partial<CalcMonster> = {}): CalcMonster {
  return {
    id: 9001,
    name: "Training Dummy",
    version: null,
    size: 1,
    attributes: [],
    skills: { atk: 100, str: 100, def: 100, magic: 100, ranged: 100, hp: 200 },
    inputs: { monsterCurrentHp: 200 },
    offensive: { magic: 100 },
    defensive: { stab: 50, slash: 50, crush: 50, ranged: 50, magic: 50, light: 50, standard: 50, heavy: 50 },
    ...partial,
  };
}

function makePlayer(partial: Partial<CalcPlayer> = {}): CalcPlayer {
  const baseEquipment: Record<string, CalcEquipmentPiece | null> = {
    weapon: makePiece(),
    ammo: null,
    head: null,
    body: null,
    legs: null,
    hands: null,
    cape: null,
    shield: null,
    neck: null,
    ring: null,
  };

  return {
    skills: { atk: 99, str: 99, def: 99, ranged: 99, magic: 99, prayer: 99, hp: 99, mining: 99, ...partial.skills },
    boosts: { atk: 0, str: 0, def: 0, ranged: 0, magic: 0, prayer: 0, hp: 0, ...partial.boosts },
    equipment: { ...baseEquipment, ...partial.equipment },
    style: partial.style || { name: "Stab", type: "stab", stance: "Accurate" },
    spell: partial.spell || null,
    prayers: partial.prayers || [],
    buffs: {
      onSlayerTask: false,
      inWilderness: false,
      forinthrySurge: false,
      chargeSpell: false,
      markOfDarkness: false,
      markOfDarknessSpell: false,
      usingSunfireRunes: false,
      sunfireRunes: false,
      soulreaperStacks: 0,
      kandarinDiary: false,
      currentHp: 99,
      baAttackerLevel: 0,
      chinchompaDistance: 4,
      ...partial.buffs,
    },
    bonuses: partial.bonuses || {},
    offensive: partial.offensive || {},
    defensive: partial.defensive || {},
    currentPrayer: partial.currentPrayer || 99,
    attackSpeed: partial.attackSpeed,
  };
}

describe("dps calc engine branch coverage", () => {
  it("covers helper branches, defence reductions, and pure accuracy helpers", () => {
    const brainConflicts = getConflictingPrayers("clarity_of_thought");
    expect(brainConflicts.has("improved_reflexes")).toBe(true);
    expect(brainConflicts.has("burst_of_strength")).toBe(false);
    expect(brainConflicts.has("steel_skin")).toBe(false);

    const skinConflicts = getConflictingPrayers("rock_skin");
    expect(skinConflicts.has("steel_skin")).toBe(true);
    expect(skinConflicts.has("ultimate_strength")).toBe(false);
    expect(skinConflicts.has("clarity_of_thought")).toBe(false);

    const soloConflicts = getConflictingPrayers("rigour");
    expect(soloConflicts.has("piety")).toBe(true);
    expect(soloConflicts.has("thick_skin")).toBe(true);

    expect(getCombatStyles("Salamander").map((style) => style.type)).toEqual(["slash", "ranged", "magic"]);
    expect(getCombatStyles("Bulwark")).toEqual([
      { name: "Pummel", type: "crush", stance: "Accurate" },
      { name: "Block", type: "crush", stance: "Defensive" },
    ]);
    expect(getCombatStyles("Unknown weapon").map((style) => style.name)).toEqual(["Punch", "Kick", "Block"]);

    const totals = aggregateEquipmentBonuses({
      weapon: makePiece(),
      cape: makePiece({
        id: 1001,
        name: "Prayer cape",
        bonuses: { str: 5, ranged_str: 0, magic_str: 0, prayer: 4 },
        offensive: { stab: 2, slash: 0, crush: 0, ranged: 0, magic: 0 },
        defensive: { stab: 1, slash: 1, crush: 1, ranged: 1, magic: 1 },
      }),
      shield: null,
    });
    expect(totals.bonuses).toMatchObject({ str: 85, prayer: 4 });
    expect(totals.offensive).toMatchObject({ stab: 82, slash: 60 });

    const flooredReduction = applyDefenceReductions(
      makeMonster({
        id: BABA_IDS[0] || 11778,
        attributes: [MonsterAttribute.DEMON],
        skills: { atk: 200, str: 200, def: 200, magic: 200, ranged: 200, hp: 300 },
        defensive: { stab: 50, slash: 50, crush: 50, ranged: 50, magic: 25 },
      }),
      {
        accursed: true,
        vulnerability: true,
        elderMaul: 1,
        dwh: 1,
        arclight: 2,
        emberlight: 1,
        tonalztic: 2,
        seercull: 999,
        ayak: 40,
      }
    );
    expect(flooredReduction.skills.def).toBe(60);
    expect(flooredReduction.skills.magic).toBe(0);
    expect(flooredReduction.skills.atk).toBeLessThan(200);
    expect(flooredReduction.skills.str).toBeLessThan(200);
    expect(flooredReduction.defensive.magic).toBe(0);

    const bgsSpillover = applyDefenceReductions(
      makeMonster({
        skills: { atk: 8, str: 9, def: 10, magic: 7, ranged: 6, hp: 30 },
      }),
      { bgs: 30 }
    );
    expect(bgsSpillover.skills).toMatchObject({ def: 0, str: 0, atk: 0, magic: 4, ranged: 6 });

    expect(PlayerVsNPCCalc.getNormalAccuracyRoll(-5, 10)).toBe(0);
    expect(PlayerVsNPCCalc.getNormalAccuracyRoll(10, -5)).toBeGreaterThan(0.9);
    const normal = PlayerVsNPCCalc.getNormalAccuracyRoll(80, 90);
    const fang = PlayerVsNPCCalc.getFangAccuracyRoll(80, 90);
    const confliction = PlayerVsNPCCalc.getConflictionGauntletsAccuracyRoll(80, 90);
    expect(fang).toBeGreaterThan(normal);
    expect(confliction).toBeGreaterThan(normal);
    expect(confliction).toBeLessThan(1);
    expect(PlayerVsNPCCalc.tbowScaling(100, 250, true)).not.toBe(PlayerVsNPCCalc.tbowScaling(100, 250, false));
  });

  it("covers calculateDps edge returns plus melee prayer, fang, and clone hit-chance branches", () => {
    const emptyResult = calculateDps({
      skills: {},
      style: null,
      monster: null,
    });
    expect(emptyResult).toMatchObject({
      dps: 0,
      maxHit: 0,
      accuracy: 0,
      attackSpeed: 4,
      attackRoll: 0,
      defenceRoll: 0,
      htk: 0,
      ttk: 0,
      hitDist: [],
    });

    const burstPlayer = makePlayer({
      skills: { atk: 15, str: 15, def: 15, ranged: 15, magic: 15, prayer: 15, hp: 15, mining: 1 },
      prayers: ["burst_of_strength", "clarity_of_thought", "steel_skin"],
      style: { name: "Stab", type: "stab", stance: "Aggressive" },
      equipment: {
        weapon: makePiece({
          name: "Bronze sword",
          category: "Stab Sword",
          bonuses: { str: 700, ranged_str: 0, magic_str: 0, prayer: 0 },
          offensive: { stab: 50, slash: 0, crush: 0, ranged: 0, magic: 0 },
        }),
      },
    });
    const burstCalc = new PlayerVsNPCCalc(burstPlayer, makeMonster());
    const noPrayerCalc = new PlayerVsNPCCalc(makePlayer({ ...burstPlayer, prayers: [] }), makeMonster());

    expect(burstCalc.getCombatPrayers()).toMatchObject({
      factorAccuracy: [105, 100],
      factorStrength: [105, 100],
      factorDefence: [115, 100],
      combatStyle: "melee",
    });
    expect(burstCalc.getPlayerMaxMeleeHit()).toBeGreaterThan(noPrayerCalc.getPlayerMaxMeleeHit());

    const fangCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({
            name: "Osmumten's fang",
            category: "Stab Sword",
            bonuses: { str: 110, ranged_str: 0, magic_str: 0, prayer: 0 },
            offensive: { stab: 130, slash: 0, crush: 0, ranged: 0, magic: 0 },
          }),
        },
        style: { name: "Stab", type: "stab", stance: "Accurate" },
      }),
      makeMonster({
        skills: { atk: 120, str: 120, def: 180, magic: 120, ranged: 120, hp: 200 },
        defensive: { stab: 120, slash: 80, crush: 80, ranged: 80, magic: 80, light: 80, standard: 80, heavy: 80 },
      })
    );
    const [fangMin, fangMax] = fangCalc.getMinAndMax();
    expect(fangMin).toBeGreaterThan(0);
    expect(fangMax).toBeGreaterThan(fangMin);
    expect(fangCalc.getHitChance()).toBeCloseTo(
      PlayerVsNPCCalc.getFangAccuracyRoll(fangCalc.getMaxAttackRoll(), fangCalc.getNPCDefenceRoll()),
      10
    );

    const cloneMonster = makeMonster({ id: ECLIPSE_MOON_IDS[0] || 1, version: "Clone" });
    expect(new PlayerVsNPCCalc(makePlayer(), cloneMonster).getHitChance()).toBe(1);
    expect(
      new PlayerVsNPCCalc(
        makePlayer({
          style: { name: "Accurate", type: "ranged", stance: "Accurate" },
          equipment: {
            weapon: makePiece({
              name: "Rune crossbow",
              category: "Crossbow",
              bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
              offensive: { stab: 0, slash: 0, crush: 0, ranged: 90, magic: 0 },
            }),
            ammo: makePiece({
              id: 1002,
              name: "Broad bolts",
              bonuses: { str: 0, ranged_str: 100, magic_str: 0, prayer: 0 },
              offensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
            }),
          },
        }),
        cloneMonster
      ).getHitChance()
    ).toBe(0);
  });

  it("covers ranged holy-water, dark-bow, and bone-weapon branches", () => {
    const holyWaterPlayer = makePlayer({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece({
          name: "Holy water",
          category: "Thrown",
          bonuses: { str: 0, ranged_str: 35, magic_str: 0, prayer: 0 },
          offensive: { stab: 0, slash: 0, crush: 0, ranged: 60, magic: 0 },
        }),
      },
    });
    expect(new PlayerVsNPCCalc(holyWaterPlayer, makeMonster()).getPlayerMaxRangedHit()).toBe(0);

    const demonHolyWaterMax = new PlayerVsNPCCalc(
      holyWaterPlayer,
      makeMonster({ attributes: [MonsterAttribute.DEMON] })
    ).getPlayerMaxRangedHit();
    const nezikchenedHolyWaterMax = new PlayerVsNPCCalc(
      holyWaterPlayer,
      makeMonster({ name: "Nezikchened", attributes: [MonsterAttribute.DEMON] })
    ).getPlayerMaxRangedHit();
    expect(demonHolyWaterMax).toBeGreaterThan(0);
    expect(nezikchenedHolyWaterMax).toBe(demonHolyWaterMax + 5);

    const darkBowPlayer = makePlayer({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece({
          name: "Dark bow",
          category: "Bow",
          speed: 9,
          bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
          offensive: { stab: 0, slash: 0, crush: 0, ranged: 95, magic: 0 },
        }),
        ammo: makePiece({
          id: 1003,
          name: "Dragon arrow",
          bonuses: { str: 0, ranged_str: 60, magic_str: 0, prayer: 0 },
          offensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
        }),
      },
    });
    const normalDarkBowCalc = new PlayerVsNPCCalc(darkBowPlayer, makeMonster());
    const specialDarkBowCalc = new PlayerVsNPCCalc(darkBowPlayer, makeMonster(), { usingSpecialAttack: true });
    const [darkBowMin, darkBowMax] = specialDarkBowCalc.getMinAndMax();
    expect(darkBowMin).toBe(8);
    expect(darkBowMax).toBeGreaterThan(normalDarkBowCalc.getPlayerMaxRangedHit());

    const boneWeaponCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Bone shortbow",
            category: "Bow",
            bonuses: { str: 0, ranged_str: 40, magic_str: 0, prayer: 0 },
            offensive: { stab: 0, slash: 0, crush: 0, ranged: 60, magic: 0 },
          }),
          ammo: makePiece({
            id: 1004,
            name: "Bronze arrow",
            bonuses: { str: 0, ranged_str: 7, magic_str: 0, prayer: 0 },
            offensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
          }),
        },
      }),
      makeMonster({ id: 7223, attributes: [MonsterAttribute.RAT] })
    );
    expect(boneWeaponCalc.getHitChance()).toBe(1);
  });

  it("covers magic max-hit modifiers and display hit chance calculations", () => {
    const fireBoltPlayer = makePlayer({
      skills: { atk: 70, str: 70, def: 70, ranged: 70, magic: 70, prayer: 70, hp: 70, mining: 1 },
      style: { name: "Cast", type: "magic", stance: "Accurate" },
      spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
      equipment: {
        weapon: makePiece({
          name: "Smoke battlestaff",
          category: "Staff",
          bonuses: { str: 0, ranged_str: 0, magic_str: 100, prayer: 0 },
          offensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 35 },
        }),
        shield: makePiece({
          id: 1005,
          name: "Tome of fire",
          version: "Charged",
          bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
          offensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
        }),
        hands: makePiece({
          id: 1006,
          name: "Chaos gauntlets",
          bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
          offensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
        }),
        ring: makePiece({
          id: 1007,
          name: "Brimstone ring",
          bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
          offensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
        }),
      },
      buffs: { usingSunfireRunes: true, sunfireRunes: true },
    });

    const weakMonster = makeMonster({
      defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 140, light: 0, standard: 0, heavy: 0 },
      weakness: { element: "fire", severity: 50 },
    });
    const plainMonster = makeMonster({
      defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 140, light: 0, standard: 0, heavy: 0 },
    });

    const weakCalc = new PlayerVsNPCCalc(fireBoltPlayer, weakMonster);
    const plainCalc = new PlayerVsNPCCalc(fireBoltPlayer, plainMonster);
    const maxHit = weakCalc.getPlayerMaxMagicHit();
    const [minHit, maxFromRange] = weakCalc.getMinAndMax();
    expect(minHit).toBeGreaterThan(0);
    expect(maxFromRange).toBe(maxHit);
    expect(maxHit).toBeGreaterThan(plainCalc.getPlayerMaxMagicHit());

    const rawHitChance = weakCalc.getHitChance();
    const displayHitChance = weakCalc.getDisplayHitChance();
    expect(rawHitChance).toBeGreaterThan(0);
    expect(rawHitChance).toBeLessThan(1);
    expect(displayHitChance).toBeGreaterThan(rawHitChance);
    expect(displayHitChance).toBeLessThan(1);
  });
});