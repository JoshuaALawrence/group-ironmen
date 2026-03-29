import { describe, expect, it } from "vitest";

import {
  PlayerVsNPCCalc,
  calculateDps,
  type CalcEquipmentPiece,
  type CalcMonster,
  type CalcPlayer,
} from "../dps-calc/dps-calc-engine";
import { ONE_HIT_MONSTERS, TITAN_ELEMENTAL_IDS } from "../dps-calc/dps-calc-constants";

const MAGIC_STYLE = { name: "Cast", type: "magic", stance: "Accurate" } as const;

function makePiece(overrides: Partial<CalcEquipmentPiece> = {}): CalcEquipmentPiece {
  const bonuses = {
    str: 0,
    ranged_str: 0,
    magic_str: 0,
    prayer: 0,
    ...(overrides.bonuses || {}),
  };
  const offensive = {
    stab: 0,
    slash: 0,
    crush: 0,
    ranged: 0,
    magic: 0,
    ...(overrides.offensive || {}),
  };
  const defensive = {
    stab: 0,
    slash: 0,
    crush: 0,
    ranged: 0,
    magic: 0,
    ...(overrides.defensive || {}),
  };

  return {
    id: 1000,
    name: "Training weapon",
    category: "Staff",
    speed: 5,
    bonuses,
    offensive,
    defensive,
    ...overrides,
    bonuses,
    offensive,
    defensive,
  };
}

function makeMonster(overrides: Partial<CalcMonster> = {}): CalcMonster {
  const skills = {
    atk: 100,
    str: 100,
    def: 100,
    magic: 100,
    ranged: 100,
    hp: 250,
    ...(overrides.skills || {}),
  };
  const offensive = {
    magic: 100,
    ...(overrides.offensive || {}),
  };
  const defensive = {
    stab: 50,
    slash: 50,
    crush: 50,
    ranged: 50,
    magic: 50,
    light: 50,
    standard: 50,
    heavy: 50,
    ...(overrides.defensive || {}),
  };
  const inputs = {
    monsterCurrentHp: skills.hp,
    ...(overrides.inputs || {}),
  };

  return {
    id: 9001,
    name: "Training Dummy",
    version: null,
    size: 1,
    attributes: overrides.attributes || [],
    skills,
    inputs,
    offensive,
    defensive,
    weakness: overrides.weakness,
    ...overrides,
    attributes: overrides.attributes || [],
    skills,
    inputs,
    offensive,
    defensive,
  };
}

function makePlayer(overrides: Partial<CalcPlayer> = {}): CalcPlayer {
  const skills = {
    atk: 99,
    str: 99,
    def: 99,
    ranged: 99,
    magic: 99,
    prayer: 99,
    hp: 99,
    mining: 99,
    ...(overrides.skills || {}),
  };
  const boosts = {
    atk: 0,
    str: 0,
    def: 0,
    ranged: 0,
    magic: 0,
    prayer: 0,
    hp: 0,
    ...(overrides.boosts || {}),
  };
  const equipment = {
    weapon: makePiece({
      name: "Training staff",
      category: "Staff",
      speed: 5,
      bonuses: { magic_str: 0 },
      offensive: { magic: 20 },
    }),
    ammo: null,
    head: null,
    body: null,
    legs: null,
    hands: null,
    cape: null,
    shield: null,
    neck: null,
    ring: null,
    ...(overrides.equipment || {}),
  };
  const buffs = {
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
    currentHp: skills.hp,
    baAttackerLevel: 0,
    chinchompaDistance: 4,
    ...(overrides.buffs || {}),
  };

  return {
    skills,
    boosts,
    equipment,
    style: overrides.style || MAGIC_STYLE,
    spell: overrides.spell === undefined ? null : overrides.spell,
    prayers: overrides.prayers || [],
    buffs,
    bonuses: overrides.bonuses || {},
    offensive: overrides.offensive || {},
    defensive: overrides.defensive || {},
    currentPrayer: overrides.currentPrayer ?? skills.prayer,
    attackSpeed: overrides.attackSpeed,
  };
}

function runCalculation(player: CalcPlayer, monster: CalcMonster) {
  return calculateDps({
    skills: player.skills,
    boosts: player.boosts,
    equipment: player.equipment,
    style: player.style,
    prayerKeys: player.prayers,
    onSlayerTask: player.buffs.onSlayerTask,
    monster,
    spell: player.spell,
    buffs: player.buffs,
  });
}

describe("dps calc engine extra monster coverage", () => {
  it("covers calculateDps one-hit monsters returning a guaranteed kill distribution", () => {
    const monsterHp = 37;
    const player = makePlayer({
      skills: { atk: 1, str: 1, def: 1, ranged: 1, magic: 1, prayer: 1, hp: 10, mining: 1 },
      equipment: {
        weapon: makePiece({
          name: "Bronze dagger",
          category: "Dagger",
          speed: 4,
          bonuses: { str: 0 },
          offensive: { stab: 1 },
        }),
      },
      style: { name: "Stab", type: "stab", stance: "Accurate" },
    });
    const monster = makeMonster({
      id: ONE_HIT_MONSTERS[1] || 8584,
      name: "One-hit dummy",
      skills: { atk: 200, str: 200, def: 500, magic: 500, ranged: 500, hp: monsterHp },
      defensive: { stab: 400, slash: 400, crush: 400, ranged: 400, magic: 400, light: 400, standard: 400, heavy: 400 },
    });

    const result = runCalculation(player, monster);

    expect(result.accuracy).toBeLessThan(10);
    expect(result.hitDist).toHaveLength(monsterHp + 1);
    expect(result.hitDist[0]?.value).toBe(0);
    expect(result.hitDist[monsterHp]).toEqual({ name: monsterHp.toString(), value: 1 });
    expect(result.hitDist.slice(1, monsterHp).every((point) => point.value === 0)).toBe(true);
    expect(result.specExpected).toBe(monsterHp);
    expect(result.htk).toBe(1);
    expect(result.ttk).toBe(2.4);
  });

  it("covers respiratory-system demonbane distribution overriding normal min/max damage", () => {
    const monsterHp = 45;
    const player = makePlayer({
      skills: { magic: 75 },
      style: MAGIC_STYLE,
      spell: { name: "Superior Demonbane", spellbook: "arceuus", element: "fire", max_hit: 23 },
      equipment: {
        weapon: makePiece({
          name: "Purging staff",
          category: "Staff",
          speed: 5,
          bonuses: { magic_str: 0 },
          offensive: { magic: 12 },
        }),
      },
    });
    const monster = makeMonster({
      name: "Respiratory system",
      skills: { atk: 100, str: 100, def: 200, magic: 220, ranged: 100, hp: monsterHp },
      defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 240, light: 0, standard: 0, heavy: 0 },
    });
    const directCalc = new PlayerVsNPCCalc(player, monster);
    const result = runCalculation(player, monster);

    expect(directCalc.getHitChance()).toBeGreaterThan(0);
    expect(directCalc.getHitChance()).toBeLessThan(1);
    expect(directCalc.getMinAndMax()[1]).toBeLessThan(monsterHp);
    expect(result.maxHit).toBeLessThan(monsterHp);
    expect(result.hitDist).toHaveLength(monsterHp + 1);
    expect(result.hitDist[0]?.value).toBeCloseTo(1 - directCalc.getHitChance(), 10);
    expect(result.hitDist[monsterHp]?.value).toBeCloseTo(directCalc.getHitChance(), 10);
    expect(result.hitDist.slice(1, monsterHp).every((point) => point.value === 0)).toBe(true);
    expect(result.specExpected).toBe(Math.round(monsterHp * directCalc.getHitChance() * 10) / 10);
    expect(result.htk).toBeGreaterThan(1);
  });

  it("covers titan-elemental magic accuracy with and without elite void in calculateDps", () => {
    const titan = makeMonster({
      id: TITAN_ELEMENTAL_IDS[0] || 14150,
      name: "Titan elemental",
      skills: { atk: 100, str: 100, def: 300, magic: 300, ranged: 100, hp: 120 },
      defensive: { stab: 200, slash: 200, crush: 200, ranged: 200, magic: 200, light: 200, standard: 200, heavy: 200 },
    });
    const plainPlayer = makePlayer({
      skills: { magic: 70 },
      style: MAGIC_STYLE,
      spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
      equipment: {
        weapon: makePiece({
          name: "Training staff",
          category: "Staff",
          speed: 5,
          bonuses: { magic_str: 0 },
          offensive: { magic: 20 },
        }),
      },
    });
    const eliteVoidPlayer = makePlayer({
      ...plainPlayer,
      equipment: {
        ...plainPlayer.equipment,
        head: makePiece({ name: "Void mage helm" }),
        body: makePiece({ name: "Elite void top" }),
        legs: makePiece({ name: "Elite void robe" }),
        hands: makePiece({ name: "Void knight gloves" }),
      },
    });

    const plainCalc = new PlayerVsNPCCalc(plainPlayer, titan);
    const voidCalc = new PlayerVsNPCCalc(eliteVoidPlayer, titan);
    const plainResult = runCalculation(plainPlayer, titan);
    const voidResult = runCalculation(eliteVoidPlayer, titan);

    expect(plainCalc.getHitChance()).toBe(0.5);
    expect(voidCalc.getHitChance()).toBe(0.725);
    expect(plainResult.accuracy).toBe(50);
    expect(voidResult.accuracy).toBe(72.5);
    expect(voidResult.specExpected).toBe(plainResult.specExpected);
    expect(voidResult.hitDist).toEqual(plainResult.hitDist);
    expect(voidResult.dps).toBe(plainResult.dps);
  });
});