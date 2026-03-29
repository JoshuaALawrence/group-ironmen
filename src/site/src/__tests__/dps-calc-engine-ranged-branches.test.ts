import { describe, expect, it } from "vitest";

import { PlayerVsNPCCalc, type CalcEquipmentPiece, type CalcMonster, type CalcPlayer } from "../dps-calc/dps-calc-engine";
import { EquipmentCategory, MonsterAttribute, P2_WARDEN_IDS, TITAN_BOSS_IDS } from "../dps-calc/dps-calc-constants";

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
    name: "Training bow",
    category: EquipmentCategory.BOW,
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
    weapon: makePiece({
      name: "Rune crossbow",
      category: EquipmentCategory.CROSSBOW,
      speed: 5,
      offensive: { ranged: 100 },
    }),
    ammo: makePiece({
      id: 1001,
      name: "Broad bolts",
      category: EquipmentCategory.NONE,
      bonuses: { ranged_str: 100 },
    }),
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
    style: overrides.style || { name: "Accurate", type: "ranged", stance: "Accurate" },
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

function earlyReturnRangedHit(level: number, boost: number, ammoStr: number): number {
  const eff = level + boost + 10;
  return Math.trunc((eff * (ammoStr + 64) + 320) / 640);
}

function holyWaterHit(level: number, boost: number, weaponStr: number, addFive = false): number {
  const eff = level + boost + 10;
  const str = 64 + weaponStr;
  let maxHit = Math.trunc((eff * str + 320) / 640);
  maxHit = Math.trunc(maxHit + (maxHit * 60) / 100);
  if (addFive) maxHit += 5;
  return maxHit;
}

function mapP2WardenHitRange(maxHit: number, attackRoll: number, defenceRoll: number): [number, number] {
  const reducedDefence = Math.trunc(defenceRoll / 3);
  const attackDelta = Math.max(attackRoll - reducedDefence, 0);
  const iLerp = (lo: number, hi: number, fLo: number, fHi: number, value: number): number =>
    lo + Math.trunc(((hi - lo) * Math.min(Math.max(value - fLo, 0), fHi - fLo)) / (fHi - fLo));
  const modifier = Math.max(Math.min(iLerp(15, 40, 0, 42000, attackDelta), 40), 15);
  return [Math.trunc((maxHit * modifier) / 100), Math.trunc((maxHit * (modifier + 20)) / 100)];
}

describe("dps calc engine ranged branch coverage", () => {
  it("covers crystal armour boosts and elite-void ranged modifiers", () => {
    const crystalWeapon = makePiece({
      name: "Bow of faerdhinen",
      category: EquipmentCategory.BOW,
      speed: 4,
      bonuses: { ranged_str: 90 },
      offensive: { ranged: 128 },
    });
    const plainCrystalCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: crystalWeapon,
          ammo: null,
        },
      }),
      makeMonster()
    );
    const fullCrystalCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: crystalWeapon,
          ammo: null,
          head: makePiece({ name: "Crystal helm" }),
          body: makePiece({ name: "Crystal body" }),
          legs: makePiece({ name: "Crystal legs" }),
        },
      }),
      makeMonster()
    );

    expect(fullCrystalCalc.getPlayerMaxRangedAttackRoll()).toBe(
      Math.trunc((plainCrystalCalc.getPlayerMaxRangedAttackRoll() * 26) / 20)
    );
    expect(fullCrystalCalc.getPlayerMaxRangedHit()).toBe(Math.trunc((plainCrystalCalc.getPlayerMaxRangedHit() * 46) / 40));

    const regularVoidCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          head: makePiece({ name: "Void ranger helm" }),
          body: makePiece({ name: "Void knight top" }),
          legs: makePiece({ name: "Void knight robe" }),
          hands: makePiece({ name: "Void knight gloves" }),
        },
      }),
      makeMonster()
    );
    const eliteVoidCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          head: makePiece({ name: "Void ranger helm" }),
          body: makePiece({ name: "Elite void top" }),
          legs: makePiece({ name: "Elite void robe" }),
          hands: makePiece({ name: "Void knight gloves" }),
        },
      }),
      makeMonster()
    );

    expect(eliteVoidCalc.getPlayerMaxRangedAttackRoll()).toBe(regularVoidCalc.getPlayerMaxRangedAttackRoll());
    expect(eliteVoidCalc.getPlayerMaxRangedHit()).toBeGreaterThan(regularVoidCalc.getPlayerMaxRangedHit());
  });

  it("covers avarice, salve, and imbued-black-mask precedence on ranged rolls and hits", () => {
    const revenantMonster = makeMonster({ name: "Revenant imp" });
    const undeadMonster = makeMonster({ attributes: [MonsterAttribute.UNDEAD] });
    const baseRevenantCalc = new PlayerVsNPCCalc(makePlayer(), revenantMonster);
    const avariceNoHead = new PlayerVsNPCCalc(
      makePlayer({
        equipment: { neck: makePiece({ name: "Amulet of avarice" }) },
        buffs: { onSlayerTask: true },
      }),
      revenantMonster
    );
    const avariceWithMask = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          neck: makePiece({ name: "Amulet of avarice" }),
          head: makePiece({ name: "Black mask (i)" }),
        },
        buffs: { onSlayerTask: true },
      }),
      revenantMonster
    );
    const avariceSurge = new PlayerVsNPCCalc(
      makePlayer({
        equipment: { neck: makePiece({ name: "Amulet of avarice" }) },
        buffs: { onSlayerTask: true, forinthrySurge: true },
      }),
      revenantMonster
    );

    expect(avariceWithMask.getPlayerMaxRangedAttackRoll()).toBe(avariceNoHead.getPlayerMaxRangedAttackRoll());
    expect(avariceWithMask.getPlayerMaxRangedHit()).toBe(avariceNoHead.getPlayerMaxRangedHit());
    expect(avariceNoHead.getPlayerMaxRangedAttackRoll()).toBe(
      Math.trunc((baseRevenantCalc.getPlayerMaxRangedAttackRoll() * 24) / 20)
    );
    expect(avariceNoHead.getPlayerMaxRangedHit()).toBe(Math.trunc((baseRevenantCalc.getPlayerMaxRangedHit() * 24) / 20));
    expect(avariceSurge.getPlayerMaxRangedAttackRoll()).toBe(
      Math.trunc((baseRevenantCalc.getPlayerMaxRangedAttackRoll() * 27) / 20)
    );
    expect(avariceSurge.getPlayerMaxRangedHit()).toBe(Math.trunc((baseRevenantCalc.getPlayerMaxRangedHit() * 27) / 20));

    const baseUndeadCalc = new PlayerVsNPCCalc(makePlayer(), undeadMonster);
    const imbuedMaskCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: { head: makePiece({ name: "Black mask (i)" }) },
        buffs: { onSlayerTask: true },
      }),
      undeadMonster
    );
    const salveEiNoHead = new PlayerVsNPCCalc(
      makePlayer({
        equipment: { neck: makePiece({ name: "Salve amulet (ei)" }) },
        buffs: { onSlayerTask: true },
      }),
      undeadMonster
    );
    const salveEiWithMask = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          neck: makePiece({ name: "Salve amulet (ei)" }),
          head: makePiece({ name: "Black mask (i)" }),
        },
        buffs: { onSlayerTask: true },
      }),
      undeadMonster
    );
    const salveINoHead = new PlayerVsNPCCalc(
      makePlayer({
        equipment: { neck: makePiece({ name: "Salve amulet (i)" }) },
        buffs: { onSlayerTask: true },
      }),
      undeadMonster
    );
    const salveIWithMask = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          neck: makePiece({ name: "Salve amulet (i)" }),
          head: makePiece({ name: "Black mask (i)" }),
        },
        buffs: { onSlayerTask: true },
      }),
      undeadMonster
    );

    expect(imbuedMaskCalc.getPlayerMaxRangedAttackRoll()).toBe(
      Math.trunc((baseUndeadCalc.getPlayerMaxRangedAttackRoll() * 23) / 20)
    );
    expect(imbuedMaskCalc.getPlayerMaxRangedHit()).toBe(Math.trunc((baseUndeadCalc.getPlayerMaxRangedHit() * 23) / 20));
    expect(salveEiWithMask.getPlayerMaxRangedAttackRoll()).toBe(salveEiNoHead.getPlayerMaxRangedAttackRoll());
    expect(salveEiWithMask.getPlayerMaxRangedHit()).toBe(salveEiNoHead.getPlayerMaxRangedHit());
    expect(salveEiNoHead.getPlayerMaxRangedAttackRoll()).toBe(
      Math.trunc((baseUndeadCalc.getPlayerMaxRangedAttackRoll() * 6) / 5)
    );
    expect(salveEiNoHead.getPlayerMaxRangedHit()).toBe(Math.trunc((baseUndeadCalc.getPlayerMaxRangedHit() * 6) / 5));
    expect(salveIWithMask.getPlayerMaxRangedAttackRoll()).toBe(salveINoHead.getPlayerMaxRangedAttackRoll());
    expect(salveIWithMask.getPlayerMaxRangedHit()).toBe(salveINoHead.getPlayerMaxRangedHit());
    expect(salveINoHead.getPlayerMaxRangedAttackRoll()).toBe(
      Math.trunc((baseUndeadCalc.getPlayerMaxRangedAttackRoll() * 7) / 6)
    );
    expect(salveINoHead.getPlayerMaxRangedHit()).toBe(Math.trunc((baseUndeadCalc.getPlayerMaxRangedHit() * 7) / 6));
  });

  it("covers twisted-bow scaling and P2 warden remapping", () => {
    const tbowStats = {
      category: EquipmentCategory.BOW,
      speed: 5,
      bonuses: { ranged_str: 70 },
      offensive: { ranged: 120 },
    };
    const baseCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Practice bow", ...tbowStats }),
          ammo: null,
        },
      }),
      makeMonster({ skills: { magic: 330 }, offensive: { magic: 330 } })
    );
    const tbowCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Twisted bow", ...tbowStats }),
          ammo: null,
        },
      }),
      makeMonster({ skills: { magic: 330 }, offensive: { magic: 330 } })
    );
    const xericianCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Twisted bow", ...tbowStats }),
          ammo: null,
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.XERICIAN], skills: { magic: 330 }, offensive: { magic: 330 } })
    );

    expect(tbowCalc.getPlayerMaxRangedAttackRoll()).toBe(
      PlayerVsNPCCalc.tbowScaling(baseCalc.getPlayerMaxRangedAttackRoll(), 250, true)
    );
    expect(tbowCalc.getPlayerMaxRangedHit()).toBe(PlayerVsNPCCalc.tbowScaling(baseCalc.getPlayerMaxRangedHit(), 250, false));
    expect(xericianCalc.getPlayerMaxRangedAttackRoll()).toBe(
      PlayerVsNPCCalc.tbowScaling(baseCalc.getPlayerMaxRangedAttackRoll(), 330, true)
    );
    expect(xericianCalc.getPlayerMaxRangedHit()).toBe(PlayerVsNPCCalc.tbowScaling(baseCalc.getPlayerMaxRangedHit(), 330, false));

    const wardenMonster = makeMonster({
      id: P2_WARDEN_IDS[0],
      skills: { def: 120, magic: 330 },
      offensive: { magic: 330 },
      defensive: { ranged: 110, light: 110, standard: 110, heavy: 110 },
    });
    const wardenCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Twisted bow", ...tbowStats }),
          ammo: null,
        },
      }),
      wardenMonster
    );
    const singleScaledMaxHit = PlayerVsNPCCalc.tbowScaling(baseCalc.getPlayerMaxRangedHit(), 250, false);
    const expectedMappedRange = mapP2WardenHitRange(
      singleScaledMaxHit,
      wardenCalc.getMaxAttackRoll(),
      wardenCalc.getNPCDefenceRoll()
    );

    expect(wardenCalc.getHitChance()).toBe(1);
    expect(wardenCalc.getMaxAttackRoll()).toBe(
      PlayerVsNPCCalc.tbowScaling(PlayerVsNPCCalc.tbowScaling(baseCalc.getPlayerMaxRangedAttackRoll(), 250, true), 250, true)
    );
    expect(wardenCalc.getMinAndMax()).toEqual(expectedMappedRange);
  });

  it("covers ranged attack-roll branches for dragon, demon, titan, and special attacks", () => {
    const dragonWeapon = makePiece({
      name: "Dragon hunter crossbow",
      category: EquipmentCategory.CROSSBOW,
      speed: 5,
      offensive: { ranged: 95 },
    });
    const plainCrossbow = makePiece({
      name: "Practice crossbow",
      category: EquipmentCategory.CROSSBOW,
      speed: 5,
      offensive: { ranged: 95 },
    });
    const dragonBase = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: plainCrossbow } }),
      makeMonster({ attributes: [MonsterAttribute.DRAGON] })
    );
    const dragonCalc = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: dragonWeapon } }),
      makeMonster({ attributes: [MonsterAttribute.DRAGON] })
    );
    expect(dragonCalc.getPlayerMaxRangedAttackRoll()).toBe(
      Math.trunc((dragonBase.getPlayerMaxRangedAttackRoll() * 13) / 10)
    );

    const scorchingStats = {
      category: EquipmentCategory.BOW,
      speed: 5,
      bonuses: { ranged_str: 60 },
      offensive: { ranged: 105 },
    };
    const demonBase = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Practice bow", ...scorchingStats }),
          ammo: null,
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DEMON] })
    );
    const scorchingCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Scorching bow", ...scorchingStats }),
          ammo: null,
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DEMON] })
    );
    expect(scorchingCalc.getPlayerMaxRangedAttackRoll()).toBe(
      Math.trunc(demonBase.getPlayerMaxRangedAttackRoll() + (demonBase.getPlayerMaxRangedAttackRoll() * 30) / 100)
    );

    const titanBase = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: TITAN_BOSS_IDS[0], inputs: { phase: "In Melee Range", monsterCurrentHp: 250 } })
    );
    const titanOutOfRange = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: TITAN_BOSS_IDS[0], inputs: { phase: "Out of Melee Range", monsterCurrentHp: 250 } })
    );
    expect(titanOutOfRange.getPlayerMaxRangedAttackRoll()).toBe(titanBase.getPlayerMaxRangedAttackRoll() * 6);

    const specCases = [
      {
        label: "Zaryte crossbow",
        weapon: makePiece({ name: "Zaryte crossbow", category: EquipmentCategory.CROSSBOW, speed: 5, offensive: { ranged: 112 } }),
        expected: (value: number) => Math.trunc(value * 2),
      },
      {
        label: "Webweaver bow",
        weapon: makePiece({ name: "Webweaver bow", category: EquipmentCategory.BOW, speed: 4, bonuses: { ranged_str: 70 }, offensive: { ranged: 110 } }),
        expected: (value: number) => Math.trunc(value * 2),
      },
      {
        label: "Toxic blowpipe",
        weapon: makePiece({ name: "Toxic blowpipe", category: EquipmentCategory.THROWN, speed: 3, bonuses: { ranged_str: 55 }, offensive: { ranged: 95 } }),
        expected: (value: number) => Math.trunc(value * 2),
      },
      {
        label: "Magic shortbow",
        weapon: makePiece({ name: "Magic shortbow", category: EquipmentCategory.BOW, speed: 4, offensive: { ranged: 72 } }),
        ammo: makePiece({ id: 2002, name: "Amethyst arrow", bonuses: { ranged_str: 55 } }),
        expected: (value: number) => Math.trunc((value * 10) / 7),
      },
      {
        label: "Rosewood blowpipe",
        weapon: makePiece({ name: "Rosewood blowpipe", category: EquipmentCategory.THROWN, speed: 3, bonuses: { ranged_str: 50 }, offensive: { ranged: 90 } }),
        expected: (value: number) => Math.trunc((value * 4) / 5),
      },
      {
        label: "Heavy ballista",
        weapon: makePiece({ name: "Heavy ballista", category: EquipmentCategory.CROSSBOW, speed: 7, offensive: { ranged: 140 } }),
        ammo: makePiece({ id: 2003, name: "Dragon javelin", bonuses: { ranged_str: 150 } }),
        expected: (value: number) => Math.trunc((value * 5) / 4),
      },
    ];

    for (const specCase of specCases) {
      const normal = new PlayerVsNPCCalc(
        makePlayer({
          equipment: {
            weapon: specCase.weapon,
            ammo: specCase.ammo === undefined ? null : specCase.ammo,
          },
        }),
        makeMonster()
      );
      const special = new PlayerVsNPCCalc(
        makePlayer({
          equipment: {
            weapon: specCase.weapon,
            ammo: specCase.ammo === undefined ? null : specCase.ammo,
          },
        }),
        makeMonster(),
        { usingSpecialAttack: true }
      );

      expect(special.getPlayerMaxRangedAttackRoll(), specCase.label).toBe(specCase.expected(normal.getPlayerMaxRangedAttackRoll()));
    }
  });

  it("covers holy-water and shortbow-ogre early-return ranged max-hit branches", () => {
    const holyWaterWeapon = makePiece({
      name: "Holy water",
      category: EquipmentCategory.THROWN,
      speed: 4,
      bonuses: { ranged_str: 35 },
      offensive: { ranged: 60 },
    });
    const holyWaterPlayer = makePlayer({
      equipment: {
        weapon: holyWaterWeapon,
        ammo: null,
        head: makePiece({ name: "Void ranger helm" }),
        body: makePiece({ name: "Elite void top" }),
        legs: makePiece({ name: "Elite void robe" }),
        hands: makePiece({ name: "Void knight gloves" }),
      },
    });

    expect(new PlayerVsNPCCalc(holyWaterPlayer, makeMonster()).getPlayerMaxRangedHit()).toBe(0);
    expect(new PlayerVsNPCCalc(holyWaterPlayer, makeMonster({ attributes: [MonsterAttribute.DEMON] })).getPlayerMaxRangedHit()).toBe(
      holyWaterHit(holyWaterPlayer.skills.ranged, holyWaterPlayer.boosts.ranged, 35)
    );
    expect(
      new PlayerVsNPCCalc(
        holyWaterPlayer,
        makeMonster({ name: "Nezikchened", attributes: [MonsterAttribute.DEMON] })
      ).getPlayerMaxRangedHit()
    ).toBe(holyWaterHit(holyWaterPlayer.skills.ranged, holyWaterPlayer.boosts.ranged, 35, true));

    const msbSpecPlayer = makePlayer({
      boosts: { ranged: 7 },
      equipment: {
        weapon: makePiece({ name: "Magic shortbow", category: EquipmentCategory.BOW, speed: 4, offensive: { ranged: 75 } }),
        ammo: makePiece({ id: 2100, name: "Rune arrow", bonuses: { ranged_str: 49 } }),
        head: makePiece({ name: "Void ranger helm" }),
        body: makePiece({ name: "Elite void top" }),
        legs: makePiece({ name: "Elite void robe" }),
        hands: makePiece({ name: "Void knight gloves" }),
      },
    });
    expect(new PlayerVsNPCCalc(msbSpecPlayer, makeMonster(), { usingSpecialAttack: true }).getPlayerMaxRangedHit()).toBe(
      earlyReturnRangedHit(msbSpecPlayer.skills.ranged, msbSpecPlayer.boosts.ranged, 49)
    );

    const ogreBowPlayer = makePlayer({
      boosts: { ranged: 4 },
      equipment: {
        weapon: makePiece({ name: "Comp ogre bow", category: EquipmentCategory.BOW, speed: 6, offensive: { ranged: 38 } }),
        ammo: makePiece({ id: 2101, name: "Ogre arrow", bonuses: { ranged_str: 60 } }),
        head: makePiece({ name: "Void ranger helm" }),
        body: makePiece({ name: "Elite void top" }),
        legs: makePiece({ name: "Elite void robe" }),
        hands: makePiece({ name: "Void knight gloves" }),
      },
    });
    expect(new PlayerVsNPCCalc(ogreBowPlayer, makeMonster()).getPlayerMaxRangedHit()).toBe(
      earlyReturnRangedHit(ogreBowPlayer.skills.ranged, ogreBowPlayer.boosts.ranged, 60)
    );
  });

  it("covers imbued-slayer additive combinations for rev, dragon, and demon ranged max hit", () => {
    const slayerHead = makePiece({ name: "Black mask (i)" });

    const revBase = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Practice bow", category: EquipmentCategory.BOW, speed: 4, bonuses: { ranged_str: 75 }, offensive: { ranged: 110 } }),
          ammo: null,
        },
      }),
      makeMonster({ name: "Revenant demon" })
    );
    const revCombo = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({
            name: "Craw's bow",
            version: "Charged",
            category: EquipmentCategory.BOW,
            speed: 4,
            bonuses: { ranged_str: 75 },
            offensive: { ranged: 110 },
          }),
          ammo: null,
          head: slayerHead,
        },
        buffs: { onSlayerTask: true, inWilderness: true },
      }),
      makeMonster({ name: "Revenant demon" })
    );
    const revWrongMultiplicative = Math.trunc((Math.trunc((revBase.getPlayerMaxRangedHit() * 23) / 20) * 3) / 2);
    expect(revCombo.getPlayerMaxRangedHit()).toBe(Math.trunc((revBase.getPlayerMaxRangedHit() * 33) / 20));
    expect(revCombo.getPlayerMaxRangedHit()).not.toBe(revWrongMultiplicative);

    const dragonBase = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Practice crossbow", category: EquipmentCategory.CROSSBOW, speed: 5, offensive: { ranged: 100 } }),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DRAGON] })
    );
    const dragonCombo = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Dragon hunter crossbow", category: EquipmentCategory.CROSSBOW, speed: 5, offensive: { ranged: 100 } }),
          head: slayerHead,
        },
        buffs: { onSlayerTask: true },
      }),
      makeMonster({ attributes: [MonsterAttribute.DRAGON] })
    );
    const dragonWrongMultiplicative = Math.trunc((Math.trunc((dragonBase.getPlayerMaxRangedHit() * 23) / 20) * 5) / 4);
    expect(dragonCombo.getPlayerMaxRangedHit()).toBe(Math.trunc((dragonBase.getPlayerMaxRangedHit() * 28) / 20));
    expect(dragonCombo.getPlayerMaxRangedHit()).not.toBe(dragonWrongMultiplicative);

    const demonBase = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Practice bow", category: EquipmentCategory.BOW, speed: 5, bonuses: { ranged_str: 65 }, offensive: { ranged: 105 } }),
          ammo: null,
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DEMON] })
    );
    const demonCombo = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Scorching bow", category: EquipmentCategory.BOW, speed: 5, bonuses: { ranged_str: 65 }, offensive: { ranged: 105 } }),
          ammo: null,
          head: slayerHead,
        },
        buffs: { onSlayerTask: true },
      }),
      makeMonster({ attributes: [MonsterAttribute.DEMON] })
    );
    const demonWrongMultiplicative = Math.trunc(
      Math.trunc((demonBase.getPlayerMaxRangedHit() * 23) / 20) + (Math.trunc((demonBase.getPlayerMaxRangedHit() * 23) / 20) * 30) / 100
    );
    expect(demonCombo.getPlayerMaxRangedHit()).toBe(Math.trunc((demonBase.getPlayerMaxRangedHit() * 29) / 20));
    expect(demonCombo.getPlayerMaxRangedHit()).not.toBe(demonWrongMultiplicative);
  });

  it("covers all chinchompa fuse-distance accuracy formulas", () => {
    const plainChinCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Practice chinchompa",
            category: EquipmentCategory.CHINCHOMPA,
            speed: 4,
            bonuses: { ranged_str: 80 },
            offensive: { ranged: 120 },
          }),
          ammo: null,
        },
      }),
      makeMonster()
    );
    const baseRoll = plainChinCalc.getPlayerMaxRangedAttackRoll();
    const fuseCases = [
      { style: "Short fuse", distance: 3, numerator: 4 },
      { style: "Short fuse", distance: 4, numerator: 3 },
      { style: "Short fuse", distance: 7, numerator: 2 },
      { style: "Medium fuse", distance: 3, numerator: 3 },
      { style: "Medium fuse", distance: 5, numerator: 4 },
      { style: "Medium fuse", distance: 7, numerator: 3 },
      { style: "Long fuse", distance: 3, numerator: 2 },
      { style: "Long fuse", distance: 5, numerator: 3 },
      { style: "Long fuse", distance: 7, numerator: 4 },
    ];

    for (const fuseCase of fuseCases) {
      const calc = new PlayerVsNPCCalc(
        makePlayer({
          style: { name: fuseCase.style, type: "ranged", stance: "Accurate" },
          buffs: { chinchompaDistance: fuseCase.distance },
          equipment: {
            weapon: makePiece({
              name: "Red chinchompa",
              category: EquipmentCategory.CHINCHOMPA,
              speed: 4,
              bonuses: { ranged_str: 80 },
              offensive: { ranged: 120 },
            }),
            ammo: null,
          },
        }),
        makeMonster()
      );

      expect(calc.getPlayerMaxRangedAttackRoll(), `${fuseCase.style} @ ${fuseCase.distance}`).toBe(
        fuseCase.numerator === 4 ? baseRoll : Math.trunc((baseRoll * fuseCase.numerator) / 4)
      );
    }
  });

  it("covers tonalztics, ranged max-hit special attacks, and dark-bow min-hit logic", () => {
    const tonalPlain = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Practice crossbow", category: EquipmentCategory.CROSSBOW, speed: 6, bonuses: { ranged_str: 120 }, offensive: { ranged: 95 } }),
        },
      }),
      makeMonster()
    );
    const tonalCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Tonalztics of ralos", version: "Charged", category: EquipmentCategory.CROSSBOW, speed: 6, bonuses: { ranged_str: 120 }, offensive: { ranged: 95 } }),
        },
      }),
      makeMonster()
    );
    expect(tonalCalc.getPlayerMaxRangedHit()).toBe(Math.trunc((tonalPlain.getPlayerMaxRangedHit() * 3) / 4));

    const maxHitSpecCases = [
      {
        label: "Toxic blowpipe",
        player: makePlayer({
          equipment: {
            weapon: makePiece({ name: "Toxic blowpipe", category: EquipmentCategory.THROWN, speed: 3, bonuses: { ranged_str: 58 }, offensive: { ranged: 95 } }),
            ammo: null,
          },
        }),
        expected: (value: number) => Math.trunc((value * 3) / 2),
      },
      {
        label: "Webweaver bow",
        player: makePlayer({
          equipment: {
            weapon: makePiece({ name: "Webweaver bow", category: EquipmentCategory.BOW, speed: 4, bonuses: { ranged_str: 80 }, offensive: { ranged: 110 } }),
            ammo: null,
          },
        }),
        expected: (value: number) => value - Math.trunc((value * 6) / 10),
      },
      {
        label: "Heavy ballista",
        player: makePlayer({
          equipment: {
            weapon: makePiece({ name: "Heavy ballista", category: EquipmentCategory.CROSSBOW, speed: 7, offensive: { ranged: 140 } }),
            ammo: makePiece({ id: 2200, name: "Dragon javelin", bonuses: { ranged_str: 150 } }),
          },
        }),
        expected: (value: number) => Math.trunc((value * 5) / 4),
      },
      {
        label: "Rosewood blowpipe",
        player: makePlayer({
          equipment: {
            weapon: makePiece({ name: "Rosewood blowpipe", category: EquipmentCategory.THROWN, speed: 3, bonuses: { ranged_str: 52 }, offensive: { ranged: 90 } }),
            ammo: null,
          },
        }),
        expected: (value: number) => Math.trunc((value * 11) / 10),
      },
    ];

    for (const specCase of maxHitSpecCases) {
      const normal = new PlayerVsNPCCalc(specCase.player, makeMonster());
      const special = new PlayerVsNPCCalc(specCase.player, makeMonster(), { usingSpecialAttack: true });
      expect(special.getPlayerMaxRangedHit(), specCase.label).toBe(specCase.expected(normal.getPlayerMaxRangedHit()));
    }

    const darkBowDragonPlayer = makePlayer({
      equipment: {
        weapon: makePiece({ name: "Dark bow", category: EquipmentCategory.BOW, speed: 9, offensive: { ranged: 95 } }),
        ammo: makePiece({ id: 2201, name: "Dragon arrow", bonuses: { ranged_str: 60 } }),
      },
    });
    const darkBowRunePlayer = makePlayer({
      equipment: {
        weapon: makePiece({ name: "Dark bow", category: EquipmentCategory.BOW, speed: 9, offensive: { ranged: 95 } }),
        ammo: makePiece({ id: 2202, name: "Rune arrow", bonuses: { ranged_str: 49 } }),
      },
    });
    const darkBowDragonNormal = new PlayerVsNPCCalc(darkBowDragonPlayer, makeMonster());
    const darkBowDragonSpec = new PlayerVsNPCCalc(darkBowDragonPlayer, makeMonster(), { usingSpecialAttack: true });
    const darkBowRuneNormal = new PlayerVsNPCCalc(darkBowRunePlayer, makeMonster());
    const darkBowRuneSpec = new PlayerVsNPCCalc(darkBowRunePlayer, makeMonster(), { usingSpecialAttack: true });

    expect(darkBowDragonSpec.getMinAndMax()).toEqual([8, Math.trunc((darkBowDragonNormal.getPlayerMaxRangedHit() * 15) / 10)]);
    expect(darkBowRuneSpec.getMinAndMax()).toEqual([5, Math.trunc((darkBowRuneNormal.getPlayerMaxRangedHit() * 13) / 10)]);
  });
});