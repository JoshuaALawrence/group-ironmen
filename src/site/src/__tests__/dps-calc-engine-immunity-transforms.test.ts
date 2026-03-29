import { describe, expect, it } from "vitest";

import { PlayerVsNPCCalc, calculateDps, type CalcEquipmentPiece, type CalcMonster, type CalcPlayer } from "../dps-calc/dps-calc-engine";
import {
  DOOM_OF_MOKHAIOTL_IDS,
  EquipmentCategory,
  FRAGMENT_OF_SEREN_IDS,
  GUARANTEED_ACCURACY_MONSTERS,
  GUARDIAN_IDS,
  HUEYCOATL_PHASE_IDS,
  HUEYCOATL_TAIL_IDS,
  IMMUNE_TO_BURN_DAMAGE_NPC_IDS,
  MonsterAttribute,
  ZULRAH_IDS,
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

function makeCrossbowSetup(ammoName: string) {
  return makePlayer({
    style: { name: "Accurate", type: "ranged", stance: "Accurate" },
    equipment: {
      weapon: makePiece({
        name: "Rune crossbow",
        category: EquipmentCategory.CROSSBOW,
        speed: 5,
        bonuses: { ranged_str: 0 },
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

function accurateSums(calc: PlayerVsNPCCalc) {
  return calc
    .getDistribution()
    .singleHitsplat.hits.filter((hit) => hit.anyAccurate())
    .map((hit) => hit.getSum());
}

describe("dps calc engine immunity and transform branches", () => {
  it("covers immunity exceptions and guaranteed-accuracy cases", () => {
    const guaranteedCalc = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: GUARANTEED_ACCURACY_MONSTERS[0], name: "Guaranteed dummy" })
    );
    expect(guaranteedCalc.isImmune()).toBe(false);
    expect(guaranteedCalc.getHitChance()).toBe(1);

    const doomShielded = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: DOOM_OF_MOKHAIOTL_IDS[0], name: "Doom of Mokhaiotl", inputs: { phase: "Shielded", monsterCurrentHp: 300 } })
    );
    expect(doomShielded.isImmune()).toBe(true);
    expect(doomShielded.getHitChance()).toBe(0);

    const doomOpen = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: DOOM_OF_MOKHAIOTL_IDS[0], name: "Doom of Mokhaiotl", inputs: { phase: "Enraged", monsterCurrentHp: 300 } })
    );
    expect(doomOpen.isImmune()).toBe(false);
    expect(doomOpen.getHitChance()).toBe(1);

    const zulrahWhip = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: ZULRAH_IDS[0], name: "Zulrah" })
    );
    expect(zulrahWhip.isImmune()).toBe(true);

    const zulrahPolearm = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Jab", type: "stab", stance: "Controlled" },
        equipment: {
          weapon: makePiece({
            name: "Crystal halberd",
            category: EquipmentCategory.POLEARM,
            speed: 7,
            bonuses: { str: 180 },
            offensive: { stab: 160, slash: 140 },
          }),
        },
      }),
      makeMonster({ id: ZULRAH_IDS[0], name: "Zulrah", defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 } })
    );
    expect(zulrahPolearm.isImmune()).toBe(false);

    const guardianRanged = new PlayerVsNPCCalc(
      makeCrossbowSetup("Broad bolts"),
      makeMonster({ id: GUARDIAN_IDS[0], name: "Guardian" })
    );
    expect(guardianRanged.isImmune()).toBe(true);

    const guardianPickaxe = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Spike", type: "stab", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Rune pickaxe",
            category: EquipmentCategory.PICKAXE,
            speed: 5,
            bonuses: { str: 110 },
            offensive: { stab: 100, crush: 100 },
          }),
        },
      }),
      makeMonster({ id: GUARDIAN_IDS[0], name: "Guardian" })
    );
    expect(guardianPickaxe.isImmune()).toBe(false);

    const vampyrePlain = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ name: "Vyrewatch", attributes: [MonsterAttribute.VAMPYRE_3] })
    );
    expect(vampyrePlain.isImmune()).toBe(true);

    const vampyreBlisterwood = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pummel", type: "crush", stance: "Aggressive" },
        equipment: {
          weapon: makePiece({
            name: "Blisterwood flail",
            category: EquipmentCategory.BLUNT,
            bonuses: { str: 120 },
            offensive: { crush: 130 },
          }),
        },
      }),
      makeMonster({ name: "Vyrewatch", attributes: [MonsterAttribute.VAMPYRE_3] })
    );
    expect(vampyreBlisterwood.isImmune()).toBe(false);
  });

  it("covers brimstone display-hit chance and guaranteed-accuracy dps output", () => {
    const player = makePlayer({
      style: { name: "Cast", type: "magic", stance: "Accurate" },
      spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
      equipment: {
        weapon: makePiece({
          name: "Smoke battlestaff",
          category: EquipmentCategory.STAFF,
          bonuses: { magic_str: 80 },
          offensive: { magic: 90 },
        }),
        ring: makePiece({ name: "Brimstone ring" }),
      },
    });
    const monster = makeMonster({ defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 180 } });
    const calc = new PlayerVsNPCCalc(player, monster);
    const raw = calc.getHitChance();
    const atk = calc.getMaxAttackRoll();
    const def = calc.getNPCDefenceRoll();
    const reduced = PlayerVsNPCCalc.getNormalAccuracyRoll(atk, Math.trunc((def * 9) / 10));

    expect(raw).toBeGreaterThan(0);
    expect(raw).toBeLessThan(1);
    expect(calc.getDisplayHitChance()).toBeCloseTo(0.75 * raw + 0.25 * reduced, 10);
    expect(calc.getDisplayHitChance()).toBeGreaterThan(raw);

    const guaranteed = calculateDps({
      skills: makePlayer().skills,
      equipment: makePlayer().equipment,
      style: makePlayer().style,
      prayerKeys: [],
      onSlayerTask: false,
      monster: makeMonster({ id: GUARANTEED_ACCURACY_MONSTERS[0], name: "Guaranteed dummy", defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 } }),
      spell: null,
      buffs: {},
    });

    expect(guaranteed.accuracy).toBe(100);
    expect(guaranteed.dps).toBeGreaterThan(0);
    expect(guaranteed.htk).toBeGreaterThan(0);
    expect(guaranteed.ttk).toBeGreaterThan(0);
    expect(guaranteed.specExpected).toBeGreaterThan(0);
    expect(guaranteed.hitDist.length).toBeGreaterThan(0);
  });

  it("covers multi-hit attacker distribution branches", () => {
    const toughMonster = makeMonster({ defensive: { stab: 180, slash: 180, crush: 180, ranged: 180, magic: 180 } });

    const dragonClawCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({
            name: "Dragon claws",
            category: EquipmentCategory.CLAW,
            bonuses: { str: 140 },
            offensive: { slash: 140 },
          }),
        },
      }),
      toughMonster,
      { usingSpecialAttack: true }
    );
    expect(dragonClawCalc.getDistribution().dists[0]?.hits.some((hit) => hit.hitsplats.length === 4)).toBe(true);

    const halberdCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Jab", type: "stab", stance: "Controlled" },
        equipment: {
          weapon: makePiece({
            name: "Dragon halberd",
            category: EquipmentCategory.POLEARM,
            speed: 7,
            bonuses: { str: 180 },
            offensive: { stab: 170, slash: 140 },
          }),
        },
      }),
      makeMonster({ size: 2 }),
      { usingSpecialAttack: true }
    );
    expect(halberdCalc.getDistribution().dists).toHaveLength(2);

    const veracsCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pound", type: "crush", stance: "Aggressive" },
        equipment: {
          weapon: makePiece({
            name: "Verac's flail",
            category: EquipmentCategory.BLUNT,
            bonuses: { str: 130 },
            offensive: { crush: 140 },
          }),
          head: makePiece({ name: "Verac's helm" }),
          body: makePiece({ name: "Verac's brassard" }),
          legs: makePiece({ name: "Verac's plateskirt" }),
        },
      }),
      makeMonster()
    );
    expect(veracsCalc.getDistribution().singleHitsplat.hits.some((hit) => hit.getSum() === veracsCalc.getPlayerMaxMeleeHit() + 1)).toBe(true);

    const karilsCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Karil's crossbow",
            category: EquipmentCategory.CROSSBOW,
            speed: 4,
            bonuses: { ranged_str: 100 },
            offensive: { ranged: 120 },
          }),
          head: makePiece({ name: "Karil's coif" }),
          body: makePiece({ name: "Karil's leathertop" }),
          legs: makePiece({ name: "Karil's leatherskirt" }),
          neck: makePiece({ name: "Amulet of the damned" }),
        },
      }),
      toughMonster
    );
    expect(karilsCalc.getDistribution().dists[0]?.hits.some((hit) => hit.hitsplats.length === 2)).toBe(true);

    const scytheCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({
            name: "Scythe of vitur",
            category: EquipmentCategory.SCYTHE,
            bonuses: { str: 190 },
            offensive: { slash: 170 },
          }),
        },
      }),
      makeMonster({ size: 3 })
    );
    const scytheMax = scytheCalc.getPlayerMaxMeleeHit();
    expect(scytheCalc.getDistribution().dists).toHaveLength(3);
    expect(scytheCalc.getDistribution().dists.map((dist) => dist.getMax())).toEqual([
      scytheMax,
      Math.trunc(scytheMax / 2),
      Math.trunc(scytheMax / 4),
    ]);

    const macuahuitlCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({
            name: "Dual macuahuitl",
            category: EquipmentCategory.SLASH_SWORD,
            bonuses: { str: 160 },
            offensive: { slash: 150 },
          }),
        },
      }),
      toughMonster
    );
    const macuahuitlHits = macuahuitlCalc.getDistribution().dists[0]?.hits || [];
    expect(macuahuitlHits.some((hit) => hit.hitsplats.length === 2)).toBe(true);
    expect(macuahuitlHits.some((hit) => hit.hitsplats.length === 2 && !hit.hitsplats[0]?.accurate && !hit.hitsplats[1]?.accurate)).toBe(true);

    const twoHitCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pummel", type: "crush", stance: "Aggressive" },
        equipment: {
          weapon: makePiece({
            name: "Torag's hammers",
            category: EquipmentCategory.BLUNT,
            bonuses: { str: 160 },
            offensive: { crush: 150 },
          }),
        },
      }),
      makeMonster()
    );
    expect(twoHitCalc.getDistribution().dists).toHaveLength(2);
  });

  it("covers guardian, tormented demon, vampyre, bolt, and corp attacker transforms", () => {
    const pickaxePlayer = makePlayer({
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
    });
    const guardianCalc = new PlayerVsNPCCalc(pickaxePlayer, makeMonster({ id: GUARDIAN_IDS[0], name: "Guardian" }));
    const normalCalc = new PlayerVsNPCCalc(pickaxePlayer, makeMonster());
    expect(guardianCalc.getDistribution().getExpectedDamage()).toBeGreaterThan(normalCalc.getDistribution().getExpectedDamage());

    const tormentedCalc = new PlayerVsNPCCalc(
      makeCrossbowSetup("Broad bolts"),
      makeMonster({ name: "Tormented Demon", inputs: { phase: "Unshielded", monsterCurrentHp: 300 } })
    );
    const normalDemonCalc = new PlayerVsNPCCalc(makeCrossbowSetup("Broad bolts"), makeMonster());
    expect(tormentedCalc.getExpectedAttackSpeed()).toBe(tormentedCalc.getAttackSpeed() - 1);
    expect(tormentedCalc.getDistribution().getExpectedDamage()).toBeGreaterThan(normalDemonCalc.getDistribution().getExpectedDamage());

    const vampyreBase = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pummel", type: "crush", stance: "Aggressive" },
        equipment: {
          weapon: makePiece({
            name: "Blisterwood flail",
            category: EquipmentCategory.BLUNT,
            bonuses: { str: 120 },
            offensive: { crush: 130 },
          }),
        },
      }),
      makeMonster({ name: "Vyrewatch", attributes: [MonsterAttribute.VAMPYRE_3] })
    );
    const vampyreAid = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pummel", type: "crush", stance: "Aggressive" },
        equipment: {
          weapon: makePiece({
            name: "Blisterwood flail",
            category: EquipmentCategory.BLUNT,
            bonuses: { str: 120 },
            offensive: { crush: 130 },
          }),
          neck: makePiece({ name: "Efaritay's aid" }),
        },
      }),
      makeMonster({ name: "Vyrewatch", attributes: [MonsterAttribute.VAMPYRE_3] })
    );
    expect(vampyreAid.getDistribution().getExpectedDamage()).toBeGreaterThan(vampyreBase.getDistribution().getExpectedDamage());

    const opalCalc = new PlayerVsNPCCalc(
      makeCrossbowSetup("Opal bolts (e)"),
      makeMonster({ defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 } })
    );
    expect(opalCalc.getDistribution().singleHitsplat.getMax()).toBeGreaterThan(opalCalc.getPlayerMaxRangedHit());

    const corpBroad = new PlayerVsNPCCalc(makeCrossbowSetup("Broad bolts"), makeMonster({ name: "Corporeal Beast" }));
    const corpRuby = new PlayerVsNPCCalc(makeCrossbowSetup("Ruby bolts (e)"), makeMonster({ name: "Corporeal Beast", skills: { atk: 90, str: 90, def: 90, magic: 90, ranged: 90, hp: 800 }, inputs: { monsterCurrentHp: 800 } }));
    expect(corpBroad.getDistribution().singleHitsplat.getMax()).toBeLessThanOrEqual(Math.trunc(corpBroad.getPlayerMaxRangedHit() / 2));
    expect(corpRuby.getDistribution().singleHitsplat.getMax()).toBeGreaterThan(corpBroad.getDistribution().singleHitsplat.getMax());
  });

  it("covers zulrah, seren, hueycoatl, and vampyre npc transforms", () => {
    const zulrahCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Jab", type: "stab", stance: "Controlled" },
        equipment: {
          weapon: makePiece({
            name: "Crystal halberd",
            category: EquipmentCategory.POLEARM,
            speed: 7,
            bonuses: { str: 260 },
            offensive: { stab: 220, slash: 180 },
          }),
        },
      }),
      makeMonster({ id: ZULRAH_IDS[0], name: "Zulrah", defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 } })
    );
    expect(zulrahCalc.isImmune()).toBe(false);
    expect(zulrahCalc.getDistribution().singleHitsplat.getMax()).toBe(50);

    const serenCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Cast", type: "magic", stance: "Accurate" },
        skills: { magic: 99 },
        equipment: {
          weapon: makePiece({
            name: "Dawnbringer",
            category: EquipmentCategory.STAFF,
            offensive: { magic: 80 },
          }),
        },
      }),
      makeMonster({ id: FRAGMENT_OF_SEREN_IDS[0], name: "Fragment of Seren", defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 } }),
      { usingSpecialAttack: true }
    );
    const serenAccurate = accurateSums(serenCalc);
    expect(Math.min(...serenAccurate)).toBeGreaterThanOrEqual(22);
    expect(Math.max(...serenAccurate)).toBeLessThanOrEqual(24);

    const hueyTailCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pummel", type: "crush", stance: "Aggressive" },
        equipment: {
          weapon: makePiece({
            name: "Elder maul",
            category: EquipmentCategory.BLUNT,
            speed: 6,
            bonuses: { str: 220 },
            offensive: { stab: 10, slash: 20, crush: 200 },
          }),
        },
      }),
      makeMonster({ id: HUEYCOATL_TAIL_IDS[0], name: "Hueycoatl tail" })
    );
    expect(hueyTailCalc.getDistribution().singleHitsplat.getMin()).toBe(1);
    expect(hueyTailCalc.getDistribution().asHistogram()[0]?.value || 0).toBe(0);

    const hueyBase = new PlayerVsNPCCalc(makePlayer(), makeMonster({ id: HUEYCOATL_PHASE_IDS[0], name: "Hueycoatl" }));
    const hueyPillar = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: HUEYCOATL_PHASE_IDS[0], name: "Hueycoatl", inputs: { phase: "With Pillar", monsterCurrentHp: 300 } })
    );
    expect(hueyPillar.getDistribution().getExpectedDamage()).toBeGreaterThan(hueyBase.getDistribution().getExpectedDamage());

    const silverVampyre = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Rune crossbow",
            category: EquipmentCategory.CROSSBOW,
            speed: 5,
            offensive: { ranged: 120 },
          }),
          ammo: makePiece({
            name: "Silver bolts",
            bonuses: { ranged_str: 110 },
          }),
        },
      }),
      makeMonster({ name: "Vyrewatch sentinel", attributes: [MonsterAttribute.VAMPYRE_2] })
    );
    expect(silverVampyre.isImmune()).toBe(false);
    expect(silverVampyre.getDistribution().singleHitsplat.getMax()).toBe(10);
  });

  it("covers expected attack speed and dps/ttk branches", () => {
    const bloodMoonPlayer = makePlayer({
      equipment: {
        weapon: makePiece({
          name: "Dual macuahuitl",
          category: EquipmentCategory.SLASH_SWORD,
          bonuses: { str: 150 },
          offensive: { slash: 140 },
        }),
        head: makePiece({ name: "Blood moon helm" }),
        body: makePiece({ name: "Blood moon chestplate" }),
        legs: makePiece({ name: "Blood moon tassets" }),
      },
    });
    const bloodMoonNormal = new PlayerVsNPCCalc(bloodMoonPlayer, makeMonster());
    const bloodMoonSpec = new PlayerVsNPCCalc(bloodMoonPlayer, makeMonster(), { usingSpecialAttack: true });
    const normalAccuracy = bloodMoonNormal.getHitChance();
    const specAccuracy = bloodMoonSpec.getHitChance();

    expect(bloodMoonNormal.getExpectedAttackSpeed()).toBeCloseTo(
      bloodMoonNormal.getAttackSpeed() - (normalAccuracy / 3 + (normalAccuracy * normalAccuracy * 2) / 9),
      10
    );
    expect(bloodMoonSpec.getExpectedAttackSpeed()).toBeCloseTo(
      bloodMoonSpec.getAttackSpeed() - (1 - (1 - specAccuracy) ** 2),
      10
    );

    const tdCalc = new PlayerVsNPCCalc(
      makeCrossbowSetup("Broad bolts"),
      makeMonster({ name: "Tormented Demon", inputs: { phase: "Unshielded", monsterCurrentHp: 300 } })
    );
    expect(tdCalc.getExpectedAttackSpeed()).toBe(tdCalc.getAttackSpeed() - 1);
    expect(tdCalc.getDps()).toBeCloseTo(tdCalc.getExpectedDamage() / tdCalc.getExpectedAttackSpeed() / 0.6, 10);
    expect(tdCalc.getTtk()).toBeCloseTo(tdCalc.getHtk() * tdCalc.getExpectedAttackSpeed() * 0.6, 10);

    const eyeSpec = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Focus", type: "magic", stance: "Accurate" },
        spell: { name: "Fire Wave", spellbook: "standard", element: "fire", max_hit: 20 },
        equipment: {
          weapon: makePiece({
            name: "Eye of ayak",
            category: EquipmentCategory.STAFF,
            speed: 7,
            offensive: { magic: 40 },
          }),
        },
      }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    expect(eyeSpec.getExpectedAttackSpeed()).toBe(5);
  });

  it("covers burn dot branches and spec-cost lookup", () => {
    const burnImmuneId = IMMUNE_TO_BURN_DAMAGE_NPC_IDS[0];

    const burningClawsImmune = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({
            name: "Burning claws",
            category: EquipmentCategory.CLAW,
            bonuses: { str: 140 },
            offensive: { slash: 140 },
          }),
        },
      }),
      makeMonster({ id: burnImmuneId, name: "Burn-immune dummy" }),
      { usingSpecialAttack: true }
    );
    expect(burningClawsImmune.getDoTExpected()).toBe(0);
    expect(burningClawsImmune.getDoTMax()).toBe(0);

    const scorchingDemon = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Scorching bow",
            category: EquipmentCategory.BOW,
            speed: 5,
            offensive: { ranged: 120 },
          }),
          ammo: makePiece({ name: "Dragon arrow", bonuses: { ranged_str: 100 } }),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DEMON] }),
      { usingSpecialAttack: true }
    );
    expect(scorchingDemon.getDoTExpected()).toBe(5);
    expect(scorchingDemon.getDoTMax()).toBe(5);

    const scorchingNormal = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Scorching bow",
            category: EquipmentCategory.BOW,
            speed: 5,
            offensive: { ranged: 120 },
          }),
          ammo: makePiece({ name: "Dragon arrow", bonuses: { ranged_str: 100 } }),
        },
      }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    expect(scorchingNormal.getDoTExpected()).toBe(1);
    expect(scorchingNormal.getDoTMax()).toBe(1);

    const arkanCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Slash", type: "slash", stance: "Aggressive" },
        equipment: {
          weapon: makePiece({
            name: "Arkan blade",
            category: EquipmentCategory.SLASH_SWORD,
            bonuses: { str: 160 },
            offensive: { slash: 150 },
          }),
        },
      }),
      makeMonster({ id: GUARANTEED_ACCURACY_MONSTERS[0], name: "Guaranteed dummy" }),
      { usingSpecialAttack: true }
    );
    expect(arkanCalc.getHitChance()).toBe(1);
    expect(arkanCalc.getDoTExpected()).toBe(10);
    expect(arkanCalc.getDoTMax()).toBe(10);

    const arkanImmune = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({
            name: "Arkan blade",
            category: EquipmentCategory.SLASH_SWORD,
            bonuses: { str: 160 },
            offensive: { slash: 150 },
          }),
        },
      }),
      makeMonster({ id: burnImmuneId, name: "Burn-immune dummy" }),
      { usingSpecialAttack: true }
    );
    expect(arkanImmune.getDoTExpected()).toBe(0);
    expect(arkanImmune.getDoTMax()).toBe(0);

    expect(scorchingDemon.getSpecCost()).toBe(25);
    expect(arkanCalc.getSpecCost()).toBe(30);
    expect(new PlayerVsNPCCalc(makePlayer({ equipment: { weapon: makePiece({ name: "Training sword" }) } }), makeMonster()).getSpecCost()).toBeUndefined();
  });
});