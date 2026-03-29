import { describe, expect, it } from "vitest";

import { PlayerVsNPCCalc, calculateDps, type CalcEquipmentPiece, type CalcMonster, type CalcPlayer } from "../dps-calc/dps-calc-engine";
import { EquipmentCategory, MonsterAttribute } from "../dps-calc/dps-calc-constants";

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
    name: "Training sword",
    category: "Stab Sword",
    speed: 4,
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
    style: overrides.style || { name: "Stab", type: "stab", stance: "Accurate" },
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

describe("dps calc engine residual branches", () => {
  it("covers attack-speed calculation branches for rapid, cast stances, and bone-weapon rat overrides", () => {
    const rapidCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Rapid", type: "ranged", stance: "Rapid" },
        equipment: {
          weapon: makePiece({
            name: "Maple shortbow",
            category: "Bow",
            speed: 5,
            bonuses: { ranged_str: 40 },
            offensive: { ranged: 80 },
          }),
        },
      }),
      makeMonster()
    );
    expect(rapidCalc.getAttackSpeed()).toBe(4);

    const harmonisedCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Autocast", type: "magic", stance: "Autocast" },
        spell: { name: "Fire Wave", spellbook: "standard", element: "fire", max_hit: 20 },
        equipment: {
          weapon: makePiece({
            name: "Harmonised nightmare staff",
            category: "Staff",
            speed: 7,
            bonuses: { magic_str: 20 },
            offensive: { magic: 30 },
          }),
        },
      }),
      makeMonster()
    );
    expect(harmonisedCalc.getAttackSpeed()).toBe(4);

    const twinflameCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Autocast", type: "magic", stance: "Autocast" },
        spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
        equipment: {
          weapon: makePiece({
            name: "Twinflame staff",
            category: "Staff",
            speed: 4,
            bonuses: { magic_str: 10 },
            offensive: { magic: 25 },
          }),
        },
      }),
      makeMonster()
    );
    expect(twinflameCalc.getAttackSpeed()).toBe(6);

    const ratBoneCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Bone shortbow",
            category: "Bow",
            speed: 4,
            bonuses: { ranged_str: 50 },
            offensive: { ranged: 70 },
          }),
        },
      }),
      makeMonster({ id: 7223, name: "Giant rat" })
    );
    expect(ratBoneCalc.getAttackSpeed()).toBe(1);

    const manualCastRatCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Manual Cast", type: "magic", stance: "Manual Cast" },
        spell: { name: "Fire Strike", spellbook: "standard", element: "fire", max_hit: 8 },
        equipment: {
          weapon: makePiece({
            name: "Bone staff",
            category: "Staff",
            speed: 7,
            bonuses: { magic_str: 10 },
            offensive: { magic: 25 },
          }),
        },
      }),
      makeMonster({ id: 7223, name: "Giant rat" })
    );
    expect(manualCastRatCalc.getAttackSpeed()).toBe(5);
  });

  it("covers expected-attack-speed branches for blood moon, tormented demon, and Eye of ayak specials", () => {
    const bloodMoonPlayer = makePlayer({
      style: { name: "Chop", type: "slash", stance: "Aggressive" },
      equipment: {
        weapon: makePiece({
          name: "Dual macuahuitl",
          category: "Slash Sword",
          speed: 4,
          bonuses: { str: 110 },
          offensive: { slash: 95 },
        }),
        head: makePiece({ name: "Blood moon helm" }),
        body: makePiece({ name: "Blood moon chestplate" }),
        legs: makePiece({ name: "Blood moon tassets" }),
      },
    });
    const bloodMoonMonster = makeMonster({ defensive: { slash: 120, stab: 120, crush: 120, ranged: 80, magic: 80 } });
    const bloodMoonCalc = new PlayerVsNPCCalc(bloodMoonPlayer, bloodMoonMonster);
    const bloodMoonSpecCalc = new PlayerVsNPCCalc(bloodMoonPlayer, bloodMoonMonster, { usingSpecialAttack: true });
    const regularAccuracy = bloodMoonCalc.getHitChance();
    const specialAccuracy = bloodMoonSpecCalc.getHitChance();

    expect(bloodMoonCalc.getExpectedAttackSpeed()).toBeCloseTo(
      bloodMoonCalc.getAttackSpeed() - (regularAccuracy / 3 + (regularAccuracy * regularAccuracy * 2) / 9),
      10
    );
    expect(bloodMoonSpecCalc.getExpectedAttackSpeed()).toBeCloseTo(
      bloodMoonSpecCalc.getAttackSpeed() - (1 - (1 - specialAccuracy) ** 2),
      10
    );

    const tdCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Rune crossbow",
            category: "Crossbow",
            speed: 5,
            bonuses: { ranged_str: 0 },
            offensive: { ranged: 95 },
          }),
          ammo: makePiece({ name: "Broad bolts", bonuses: { ranged_str: 100 } }),
        },
      }),
      makeMonster({ name: "Tormented Demon", inputs: { phase: "Unshielded", monsterCurrentHp: 250 } })
    );
    expect(tdCalc.getExpectedAttackSpeed()).toBe(tdCalc.getAttackSpeed() - 1);

    const eyePlayer = makePlayer({
      style: { name: "Focus", type: "magic", stance: "Accurate" },
      skills: { magic: 99 },
      equipment: {
        weapon: makePiece({
          name: "Eye of ayak",
          category: "Staff",
          speed: 7,
          bonuses: { magic_str: 0 },
          offensive: { magic: 35 },
        }),
      },
    });
    const eyeNormal = new PlayerVsNPCCalc(eyePlayer, makeMonster());
    const eyeSpec = new PlayerVsNPCCalc(eyePlayer, makeMonster(), { usingSpecialAttack: true });
    expect(eyeNormal.getAttackSpeed()).toBe(7);
    expect(eyeSpec.getExpectedAttackSpeed()).toBe(5);
    expect(eyeSpec.getPlayerMaxMagicHit()).toBe(Math.trunc((eyeNormal.getPlayerMaxMagicHit() * 13) / 10));
  });

  it("covers ranged special-case and style-dependent formulas for magic shortbow, hunter spear, and chinchompas", () => {
    const msbSpecCalc = new PlayerVsNPCCalc(
      makePlayer({
        skills: { ranged: 80 },
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Magic shortbow (i)",
            category: "Bow",
            speed: 4,
            offensive: { ranged: 75 },
          }),
          ammo: makePiece({ name: "Amethyst arrow", bonuses: { ranged_str: 60 } }),
        },
      }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    expect(msbSpecCalc.getPlayerMaxRangedHit()).toBe(17);

    const hunterSpearHighStr = new PlayerVsNPCCalc(
      makePlayer({
        skills: { str: 99, ranged: 50 },
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Hunter's spear",
            category: "Thrown",
            speed: 4,
            bonuses: { str: 85 },
            offensive: { ranged: 90 },
          }),
        },
      }),
      makeMonster()
    );
    const hunterSpearHighRanged = new PlayerVsNPCCalc(
      makePlayer({
        skills: { str: 50, ranged: 99 },
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Hunter's spear",
            category: "Thrown",
            speed: 4,
            bonuses: { str: 85 },
            offensive: { ranged: 90 },
          }),
        },
      }),
      makeMonster()
    );
    expect(hunterSpearHighStr.getPlayerMaxRangedHit()).toBeGreaterThan(hunterSpearHighRanged.getPlayerMaxRangedHit());

    const chinchompaNear = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Short fuse", type: "ranged", stance: "Accurate" },
        buffs: { chinchompaDistance: 3 },
        equipment: {
          weapon: makePiece({
            name: "Red chinchompa",
            category: EquipmentCategory.CHINCHOMPA,
            speed: 4,
            bonuses: { ranged_str: 80 },
            offensive: { ranged: 120 },
          }),
        },
      }),
      makeMonster()
    );
    const chinchompaFar = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Short fuse", type: "ranged", stance: "Accurate" },
        buffs: { chinchompaDistance: 7 },
        equipment: {
          weapon: makePiece({
            name: "Red chinchompa",
            category: EquipmentCategory.CHINCHOMPA,
            speed: 4,
            bonuses: { ranged_str: 80 },
            offensive: { ranged: 120 },
          }),
        },
      }),
      makeMonster()
    );
    const chinchompaMedium = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Medium fuse", type: "ranged", stance: "Accurate" },
        buffs: { chinchompaDistance: 7 },
        equipment: {
          weapon: makePiece({
            name: "Red chinchompa",
            category: EquipmentCategory.CHINCHOMPA,
            speed: 4,
            bonuses: { ranged_str: 80 },
            offensive: { ranged: 120 },
          }),
        },
      }),
      makeMonster()
    );

    expect(chinchompaNear.getMaxAttackRoll()).toBe(20240);
    expect(chinchompaFar.getMaxAttackRoll()).toBe(10120);
    expect(chinchompaMedium.getMaxAttackRoll()).toBe(15180);
  });

  it("covers spell-specific magic modifiers for Magic Dart, Charge, and water tomes", () => {
    const magicDartTaskCalc = new PlayerVsNPCCalc(
      makePlayer({
        skills: { magic: 80 },
        style: { name: "Autocast", type: "magic", stance: "Autocast" },
        spell: { name: "Magic Dart", spellbook: "standard", max_hit: 0 },
        buffs: { onSlayerTask: true },
        equipment: {
          weapon: makePiece({ name: "Slayer's staff (e)", category: "Staff", offensive: { magic: 40 } }),
        },
      }),
      makeMonster()
    );
    const magicDartPlainCalc = new PlayerVsNPCCalc(
      makePlayer({
        skills: { magic: 80 },
        style: { name: "Autocast", type: "magic", stance: "Autocast" },
        spell: { name: "Magic Dart", spellbook: "standard", max_hit: 0 },
        equipment: {
          weapon: makePiece({ name: "Slayer's staff (e)", category: "Staff", offensive: { magic: 40 } }),
        },
      }),
      makeMonster()
    );
    expect(magicDartTaskCalc.getPlayerMaxMagicHit()).toBe(26);
    expect(magicDartPlainCalc.getPlayerMaxMagicHit()).toBe(18);

    const chargeCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Cast", type: "magic", stance: "Accurate" },
        spell: { name: "Saradomin Strike", spellbook: "standard", max_hit: 20 },
        buffs: { chargeSpell: true },
        equipment: {
          weapon: makePiece({ name: "Saradomin staff", category: "Staff", offensive: { magic: 25 } }),
          cape: makePiece({ name: "Saradomin cape" }),
        },
      }),
      makeMonster()
    );
    expect(chargeCalc.getPlayerMaxMagicHit()).toBe(30);

    const plainWaterCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Cast", type: "magic", stance: "Accurate" },
        spell: { name: "Water Bolt", spellbook: "standard", element: "water", max_hit: 12 },
        equipment: {
          weapon: makePiece({ name: "Mystic water staff", category: "Staff", offensive: { magic: 20 } }),
        },
      }),
      makeMonster()
    );
    const chargedWaterCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Cast", type: "magic", stance: "Accurate" },
        spell: { name: "Water Bolt", spellbook: "standard", element: "water", max_hit: 12 },
        equipment: {
          weapon: makePiece({ name: "Mystic water staff", category: "Staff", offensive: { magic: 20 } }),
          shield: makePiece({ name: "Tome of water", version: "Charged" }),
        },
      }),
      makeMonster()
    );
    expect(plainWaterCalc.getPlayerMaxMagicHit()).toBe(12);
    expect(chargedWaterCalc.getPlayerMaxMagicHit()).toBe(13);
  });

  it("covers magic monster exceptions and special min/max branches for dragon hunter wand and Dawnbringer", () => {
    const wandPlainCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Cast", type: "magic", stance: "Accurate" },
        spell: { name: "Water Surge", spellbook: "standard", element: "water", max_hit: 24 },
        equipment: {
          weapon: makePiece({ name: "Dragon hunter wand", category: "Staff", offensive: { magic: 35 } }),
        },
      }),
      makeMonster()
    );
    const wandDragonCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Cast", type: "magic", stance: "Accurate" },
        spell: { name: "Water Surge", spellbook: "standard", element: "water", max_hit: 24 },
        equipment: {
          weapon: makePiece({ name: "Dragon hunter wand", category: "Staff", offensive: { magic: 35 } }),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DRAGON] })
    );
    expect(wandPlainCalc.getPlayerMaxMagicHit()).toBe(24);
    expect(wandDragonCalc.getPlayerMaxMagicHit()).toBe(33);

    const dawnbringerSpecCalc = new PlayerVsNPCCalc(
      makePlayer({
        skills: { magic: 99 },
        style: { name: "Cast", type: "magic", stance: "Accurate" },
        equipment: {
          weapon: makePiece({ name: "Dawnbringer", category: "Staff", offensive: { magic: 30 } }),
        },
      }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    expect(dawnbringerSpecCalc.getMinAndMax()).toEqual([75, 150]);
  });

  it("covers calculateDps display-accuracy rounding and respiratory min/max output mapping", () => {
    const equipment = {
      weapon: makePiece({
        name: "Smoke battlestaff",
        category: "Staff",
        bonuses: { magic_str: 0 },
        offensive: { magic: 35 },
      }),
      ring: makePiece({ name: "Brimstone ring" }),
    };
    const style = { name: "Cast", type: "magic", stance: "Accurate" };
    const spell = { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 };
    const monster = makeMonster({
      name: "Respiratory system",
      defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 140, light: 0, standard: 0, heavy: 0 },
    });
    const directCalc = new PlayerVsNPCCalc(
      makePlayer({
        skills: { magic: 75 },
        style,
        spell,
        equipment,
      }),
      monster
    );
    const [minHit, maxHit] = directCalc.getMinAndMax();
    const result = calculateDps({
      skills: { atk: 75, str: 75, def: 75, ranged: 75, magic: 75, prayer: 75, hp: 75, mining: 1 },
      equipment,
      style,
      prayerKeys: [],
      onSlayerTask: false,
      monster,
      spell,
      buffs: {},
    });

    expect(directCalc.getDisplayHitChance()).toBeGreaterThan(directCalc.getHitChance());
    expect(result.accuracy).toBe(Math.round(directCalc.getDisplayHitChance() * 10000) / 100);
    expect(result.minHit).toBe(minHit);
    expect(result.maxHit).toBe(maxHit);
    expect(result.minHit).toBe(Math.trunc(result.maxHit / 2));
  });
});