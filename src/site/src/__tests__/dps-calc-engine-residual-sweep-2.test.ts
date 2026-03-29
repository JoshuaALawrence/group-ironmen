import { describe, expect, it } from "vitest";

import { PlayerVsNPCCalc, type CalcEquipmentPiece, type CalcMonster, type CalcPlayer } from "../dps-calc/dps-calc-engine";
import {
  EquipmentCategory,
  GUARDIAN_IDS,
  IMMUNE_TO_NON_SALAMANDER_MELEE_DAMAGE_NPC_IDS,
  MonsterAttribute,
  VESPULA_IDS,
} from "../dps-calc/dps-calc-constants";

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
    name: "Training item",
    category: EquipmentCategory.NONE,
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
    atk: 90,
    str: 90,
    def: 90,
    magic: 90,
    ranged: 90,
    hp: 300,
    ...(overrides.skills || {}),
  };
  const offensive = {
    magic: 90,
    ...(overrides.offensive || {}),
  };
  const defensive = {
    stab: 60,
    slash: 60,
    crush: 60,
    ranged: 60,
    magic: 60,
    light: 60,
    standard: 60,
    heavy: 60,
    ...(overrides.defensive || {}),
  };
  const inputs = {
    monsterCurrentHp: skills.hp,
    ...(overrides.inputs || {}),
  };

  return {
    id: 9001,
    name: "Training dummy",
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
      name: "Abyssal whip",
      category: EquipmentCategory.WHIP,
      speed: 4,
      bonuses: { str: 120 },
      offensive: { slash: 110 },
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
    style: overrides.style || { name: "Slash", type: "slash", stance: "Aggressive" },
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

function makeCrossbowPlayer(ammoName: string) {
  return makePlayer({
    style: { name: "Accurate", type: "ranged", stance: "Accurate" },
    equipment: {
      weapon: makePiece({
        name: "Rune crossbow",
        category: EquipmentCategory.CROSSBOW,
        speed: 5,
        offensive: { ranged: 120 },
      }),
      ammo: makePiece({
        id: 1001,
        name: ammoName,
        bonuses: { ranged_str: 122 },
      }),
    },
  });
}

describe("dps calc engine residual sweep 2", () => {
  it("covers residual immunity exceptions for flying melee, salamanders, Fire Warrior, and Fareed", () => {
    const flyingMonster = makeMonster({ attributes: [MonsterAttribute.FLYING] });
    const polearmPlayer = makePlayer({
      style: { name: "Jab", type: "stab", stance: "Controlled" },
      equipment: {
        weapon: makePiece({
          name: "Crystal halberd",
          category: EquipmentCategory.POLEARM,
          speed: 7,
          bonuses: { str: 180 },
          offensive: { stab: 150, slash: 130 },
        }),
      },
    });
    const salamanderPlayer = makePlayer({
      style: { name: "Scorch", type: "slash", stance: "Aggressive" },
      equipment: {
        weapon: makePiece({
          name: "Black salamander",
          category: EquipmentCategory.SALAMANDER,
          speed: 4,
          bonuses: { str: 80 },
          offensive: { slash: 70, ranged: 70, magic: 70 },
        }),
      },
    });

    expect(new PlayerVsNPCCalc(makePlayer(), flyingMonster).isImmune()).toBe(true);
    expect(new PlayerVsNPCCalc(polearmPlayer, flyingMonster).isImmune()).toBe(false);
    expect(new PlayerVsNPCCalc(salamanderPlayer, flyingMonster).isImmune()).toBe(false);
    expect(
      new PlayerVsNPCCalc(polearmPlayer, makeMonster({ id: VESPULA_IDS[0], name: "Vespula", attributes: [MonsterAttribute.FLYING] })).isImmune()
    ).toBe(true);

    const salamanderOnlyMonster = makeMonster({
      id: IMMUNE_TO_NON_SALAMANDER_MELEE_DAMAGE_NPC_IDS[0],
      name: "Salamander-proof dummy",
    });
    expect(new PlayerVsNPCCalc(makePlayer(), salamanderOnlyMonster).isImmune()).toBe(true);
    expect(new PlayerVsNPCCalc(salamanderPlayer, salamanderOnlyMonster).isImmune()).toBe(false);

    const iceArrowPlayer = makePlayer({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece({ name: "Magic shortbow", category: EquipmentCategory.BOW, speed: 4, offensive: { ranged: 90 } }),
        ammo: makePiece({ id: 1002, name: "Ice arrows", bonuses: { ranged_str: 60 } }),
      },
    });
    const runeArrowPlayer = makePlayer({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece({ name: "Magic shortbow", category: EquipmentCategory.BOW, speed: 4, offensive: { ranged: 90 } }),
        ammo: makePiece({ id: 1003, name: "Rune arrow", bonuses: { ranged_str: 49 } }),
      },
    });
    const fireWarrior = makeMonster({ name: "Fire Warrior of Lesarkus" });

    expect(new PlayerVsNPCCalc(iceArrowPlayer, fireWarrior).isImmune()).toBe(false);
    expect(new PlayerVsNPCCalc(runeArrowPlayer, fireWarrior).isImmune()).toBe(true);

    const waterSpellPlayer = makePlayer({
      style: { name: "Cast", type: "magic", stance: "Accurate" },
      spell: { name: "Water Bolt", spellbook: "standard", element: "water", max_hit: 12 },
      equipment: {
        weapon: makePiece({ name: "Mystic water staff", category: EquipmentCategory.STAFF, offensive: { magic: 80 } }),
      },
    });
    const fireSpellPlayer = makePlayer({
      style: { name: "Cast", type: "magic", stance: "Accurate" },
      spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
      equipment: {
        weapon: makePiece({ name: "Mystic fire staff", category: EquipmentCategory.STAFF, offensive: { magic: 80 } }),
      },
    });
    const knifePlayer = makePlayer({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece({ name: "Rune knife", category: EquipmentCategory.THROWN, speed: 3, bonuses: { ranged_str: 40 }, offensive: { ranged: 80 } }),
      },
    });
    const fareed = makeMonster({ name: "Fareed" });

    expect(new PlayerVsNPCCalc(waterSpellPlayer, fareed).isImmune()).toBe(false);
    expect(new PlayerVsNPCCalc(fireSpellPlayer, fareed).isImmune()).toBe(true);
    expect(new PlayerVsNPCCalc(runeArrowPlayer, fareed).isImmune()).toBe(false);
    expect(new PlayerVsNPCCalc(knifePlayer, fareed).isImmune()).toBe(true);
  });

  it("covers webweaver multi-hit specs and guardian default pickaxe bonus wiring", () => {
    const webweaverSpec = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Webweaver bow",
            category: EquipmentCategory.BOW,
            speed: 4,
            bonuses: { ranged_str: 80 },
            offensive: { ranged: 110 },
          }),
        },
      }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    expect(webweaverSpec.getDistribution().dists).toHaveLength(4);

    const runeGuardian = new PlayerVsNPCCalc(
      makePlayer({
        skills: { mining: 99 },
        style: { name: "Spike", type: "stab", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Rune pickaxe",
            category: EquipmentCategory.PICKAXE,
            speed: 5,
            bonuses: { str: 110 },
            offensive: { stab: 110, crush: 110 },
          }),
        },
      }),
      makeMonster({ id: GUARDIAN_IDS[0], name: "Guardian" })
    );
    const dragonGuardian = new PlayerVsNPCCalc(
      makePlayer({
        skills: { mining: 99 },
        style: { name: "Spike", type: "stab", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Dragon pickaxe",
            category: EquipmentCategory.PICKAXE,
            speed: 5,
            bonuses: { str: 110 },
            offensive: { stab: 110, crush: 110 },
          }),
        },
      }),
      makeMonster({ id: GUARDIAN_IDS[0], name: "Guardian" })
    );

    expect(dragonGuardian.getDistribution().getExpectedDamage()).toBeGreaterThan(runeGuardian.getDistribution().getExpectedDamage());
  });

  it("covers alternate vampyre attacker transforms for blisterwood sickles and silver bolts", () => {
    const vampyre3 = makeMonster({ name: "Vyrewatch sentinel", attributes: [MonsterAttribute.VAMPYRE_3] });
    const sickleBase = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({
            name: "Blisterwood sickle",
            category: EquipmentCategory.SLASH_SWORD,
            speed: 4,
            bonuses: { str: 120 },
            offensive: { slash: 115 },
          }),
        },
      }),
      vampyre3
    );
    const sickleAid = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({
            name: "Blisterwood sickle",
            category: EquipmentCategory.SLASH_SWORD,
            speed: 4,
            bonuses: { str: 120 },
            offensive: { slash: 115 },
          }),
          neck: makePiece({ id: 2001, name: "Efaritay's aid" }),
        },
      }),
      vampyre3
    );

    expect(sickleBase.isImmune()).toBe(false);
    expect(sickleAid.getDistribution().getExpectedDamage()).toBeGreaterThan(sickleBase.getDistribution().getExpectedDamage());

    const vampyre1 = makeMonster({ name: "Young vampyre", attributes: [MonsterAttribute.VAMPYRE_1] });
    const broadBolts = new PlayerVsNPCCalc(makeCrossbowPlayer("Broad bolts"), vampyre1);
    const silverBolts = new PlayerVsNPCCalc(makeCrossbowPlayer("Silver bolts"), vampyre1);

    expect(silverBolts.isImmune()).toBe(false);
    expect(silverBolts.getDistribution().getExpectedDamage()).toBeGreaterThan(broadBolts.getDistribution().getExpectedDamage());
  });

  it("covers residual bolt transforms plus the zogre brutal-ammo escape hatch", () => {
    const lowDefMonster = makeMonster({
      defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0, light: 0, standard: 0, heavy: 0 },
    });

    const pearlCalc = new PlayerVsNPCCalc(
      makeCrossbowPlayer("Pearl bolts (e)"),
      makeMonster({ ...lowDefMonster, attributes: [MonsterAttribute.FIERY] })
    );
    const diamondCalc = new PlayerVsNPCCalc(makeCrossbowPlayer("Diamond bolts (e)"), lowDefMonster);
    const dragonstoneCalc = new PlayerVsNPCCalc(makeCrossbowPlayer("Dragonstone bolts (e)"), lowDefMonster);
    const dragonstoneDragon = new PlayerVsNPCCalc(
      makeCrossbowPlayer("Dragonstone bolts (e)"),
      makeMonster({ ...lowDefMonster, attributes: [MonsterAttribute.DRAGON] })
    );
    const onyxCalc = new PlayerVsNPCCalc(makeCrossbowPlayer("Onyx bolts (e)"), lowDefMonster);
    const onyxUndead = new PlayerVsNPCCalc(
      makeCrossbowPlayer("Onyx bolts (e)"),
      makeMonster({ ...lowDefMonster, attributes: [MonsterAttribute.UNDEAD] })
    );

    expect(pearlCalc.getDistribution().singleHitsplat.getMax()).toBeGreaterThan(pearlCalc.getPlayerMaxRangedHit());
    expect(diamondCalc.getDistribution().singleHitsplat.getMax()).toBeGreaterThan(diamondCalc.getPlayerMaxRangedHit());
    expect(dragonstoneCalc.getDistribution().singleHitsplat.getMax()).toBeGreaterThan(dragonstoneCalc.getPlayerMaxRangedHit());
    expect(dragonstoneDragon.getDistribution().singleHitsplat.getMax()).toBe(dragonstoneDragon.getPlayerMaxRangedHit());
    expect(onyxCalc.getDistribution().singleHitsplat.getMax()).toBeGreaterThan(onyxCalc.getPlayerMaxRangedHit());
    expect(onyxUndead.getDistribution().singleHitsplat.getMax()).toBe(onyxUndead.getPlayerMaxRangedHit());

    const compOgreBow = makePlayer({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece({ name: "Comp ogre bow", category: EquipmentCategory.BOW, speed: 6, offensive: { ranged: 70 } }),
        ammo: makePiece({ id: 3001, name: "Bronze brutal", bonuses: { ranged_str: 95 } }),
      },
    });
    const wrongAmmo = makePlayer({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece({ name: "Comp ogre bow", category: EquipmentCategory.BOW, speed: 6, offensive: { ranged: 70 } }),
        ammo: makePiece({ id: 3002, name: "Bronze arrow", bonuses: { ranged_str: 95 } }),
      },
    });

    const zogreProper = new PlayerVsNPCCalc(compOgreBow, makeMonster({ name: "Zogre" }));
    const zogreWrong = new PlayerVsNPCCalc(wrongAmmo, makeMonster({ name: "Zogre" }));

    expect(zogreProper.getDistribution().getExpectedDamage()).toBeGreaterThan(zogreWrong.getDistribution().getExpectedDamage());
  });
});