import { describe, expect, it } from "vitest";

import { PlayerVsNPCCalc, type CalcEquipmentPiece, type CalcMonster, type CalcPlayer } from "../dps-calc/dps-calc-engine";
import {
  ABYSSAL_SIRE_TRANSITION_IDS,
  BA_ATTACKER_MONSTERS,
  EquipmentCategory,
  GLOWING_CRYSTAL_IDS,
  HUEYCOATL_PHASE_IDS,
  IMMUNE_TO_MAGIC_DAMAGE_NPC_IDS,
  ICE_DEMON_IDS,
  MonsterAttribute,
  NIGHTMARE_TOTEM_IDS,
  OLM_HEAD_IDS,
  OLM_MAGE_HAND_IDS,
  TEKTON_IDS,
  VERZIK_P1_IDS,
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

function makeCrossbowPlayer(ammoName = "Broad bolts") {
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

function makeMagicPlayer(spellName = "Fire Wave", element = "fire") {
  return makePlayer({
    style: { name: "Cast", type: "magic", stance: "Accurate" },
    spell: { name: spellName, element, max_hit: 30 },
    equipment: {
      weapon: makePiece({
        name: "Mystic smoke staff",
        category: EquipmentCategory.STAFF,
        speed: 5,
        bonuses: { magic_str: 20 },
        offensive: { magic: 110 },
      }),
      head: null,
      body: null,
      legs: null,
      neck: null,
    },
  });
}

function expectedDamage(calc: PlayerVsNPCCalc): number {
  return calc.getDistribution().getExpectedDamage();
}

describe("dps calc engine transform sweep", () => {
  it("covers encounter-specific NPC transform branches", () => {
    const baseMagic = new PlayerVsNPCCalc(makeMagicPlayer(), makeMonster());
    const tektonMagic = new PlayerVsNPCCalc(makeMagicPlayer(), makeMonster({ id: TEKTON_IDS[0], name: "Tekton" }));
    const glowingCrystal = new PlayerVsNPCCalc(
      makeMagicPlayer(),
      makeMonster({ id: GLOWING_CRYSTAL_IDS[0], name: "Glowing crystal" })
    );
    const olmHeadMagic = new PlayerVsNPCCalc(
      makeMagicPlayer(),
      makeMonster({ id: OLM_HEAD_IDS[0], name: "Great Olm" })
    );
    const nightmareTotem = new PlayerVsNPCCalc(
      makeMagicPlayer(),
      makeMonster({ id: NIGHTMARE_TOTEM_IDS[0], name: "Nightmare totem" })
    );

    expect(expectedDamage(tektonMagic)).toBeLessThan(expectedDamage(baseMagic));
    expect(expectedDamage(glowingCrystal)).toBeLessThan(expectedDamage(baseMagic));
    expect(expectedDamage(olmHeadMagic)).toBeLessThan(expectedDamage(baseMagic));
    expect(expectedDamage(nightmareTotem)).toBeGreaterThan(expectedDamage(baseMagic));

    const baseRanged = new PlayerVsNPCCalc(makeCrossbowPlayer(), makeMonster());
    const krakenRanged = new PlayerVsNPCCalc(makeCrossbowPlayer(), makeMonster({ name: "Kraken" }));
    const olmMageHand = new PlayerVsNPCCalc(
      makeCrossbowPlayer(),
      makeMonster({ id: OLM_MAGE_HAND_IDS[0], name: "Great Olm" })
    );
    const baAttacker = new PlayerVsNPCCalc(
      makeCrossbowPlayer(undefined),
      makeMonster({ id: BA_ATTACKER_MONSTERS[0], name: "Penance Ranger" })
    );
    baAttacker.player.buffs.baAttackerLevel = 2;

    expect(expectedDamage(krakenRanged)).toBeLessThan(expectedDamage(baseRanged));
    expect(expectedDamage(olmMageHand)).toBeLessThan(expectedDamage(baseRanged));
    expect(expectedDamage(baAttacker)).toBeGreaterThan(expectedDamage(baseRanged));

    const iceDemonWind = new PlayerVsNPCCalc(
      makeMagicPlayer("Wind Blast", "air"),
      makeMonster({ id: ICE_DEMON_IDS[0], name: "Ice demon" })
    );
    const iceDemonFire = new PlayerVsNPCCalc(
      makeMagicPlayer("Fire Blast", "fire"),
      makeMonster({ id: ICE_DEMON_IDS[0], name: "Ice demon" })
    );
    expect(expectedDamage(iceDemonWind)).toBeLessThan(expectedDamage(iceDemonFire));

    const slagilithSword = new PlayerVsNPCCalc(makePlayer(), makeMonster({ name: "Slagilith" }));
    const slagilithPickaxe = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Rune pickaxe", category: EquipmentCategory.PICKAXE, bonuses: { str: 80 }, offensive: { crush: 90 } }),
        },
        style: { name: "Smash", type: "crush", stance: "Aggressive" },
      }),
      makeMonster({ name: "Slagilith" })
    );
    expect(expectedDamage(slagilithSword)).toBeLessThan(expectedDamage(slagilithPickaxe));

    const zogreCrumble = new PlayerVsNPCCalc(
      makeMagicPlayer("Crumble Undead", "earth"),
      makeMonster({ name: "Zogre" })
    );
    const zogreWrongSetup = new PlayerVsNPCCalc(
      makeCrossbowPlayer("Broad bolts"),
      makeMonster({ name: "Zogre" })
    );
    expect(expectedDamage(zogreCrumble)).toBeGreaterThan(expectedDamage(zogreWrongSetup));

    const tormentedShielded = new PlayerVsNPCCalc(
      makeCrossbowPlayer(),
      makeMonster({ name: "Tormented Demon", attributes: [MonsterAttribute.DEMON], inputs: { phase: "Shielded", monsterCurrentHp: 300 } })
    );
    const tormentedOpen = new PlayerVsNPCCalc(
      makeCrossbowPlayer(),
      makeMonster({ name: "Tormented Demon", attributes: [MonsterAttribute.DEMON], inputs: { phase: "Unshielded", monsterCurrentHp: 300 } })
    );
    expect(expectedDamage(tormentedShielded)).toBeLessThan(expectedDamage(tormentedOpen));

    const vampyreSilverAid = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Silver sickle", category: EquipmentCategory.SLASH_SWORD, bonuses: { str: 140 }, offensive: { slash: 120 } }),
          neck: makePiece({ id: 2001, name: "Efaritay's aid" }),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.VAMPYRE_2] })
    );
    const vampyreSilver = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: makePiece({ name: "Silver sickle", category: EquipmentCategory.SLASH_SWORD, bonuses: { str: 140 }, offensive: { slash: 120 } }) } }),
      makeMonster({ attributes: [MonsterAttribute.VAMPYRE_2] })
    );
    expect(expectedDamage(vampyreSilverAid)).not.toBeCloseTo(expectedDamage(vampyreSilver), 10);
    expect(vampyreSilver.getDistribution().getMax()).toBeLessThanOrEqual(10);

    const pillarCalc = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: HUEYCOATL_PHASE_IDS[0], name: "Hueycoatl", inputs: { phase: "With Pillar", monsterCurrentHp: 300 } })
    );
    expect(expectedDamage(pillarCalc)).toBeGreaterThan(expectedDamage(new PlayerVsNPCCalc(makePlayer(), makeMonster({ id: HUEYCOATL_PHASE_IDS[0], name: "Hueycoatl" }))));

    const sireTransition = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: ABYSSAL_SIRE_TRANSITION_IDS[0], name: "Abyssal sire", inputs: { phase: "Transition", monsterCurrentHp: 300 } })
    );
    expect(expectedDamage(sireTransition)).toBeLessThan(expectedDamage(new PlayerVsNPCCalc(makePlayer(), makeMonster({ id: ABYSSAL_SIRE_TRANSITION_IDS[0], name: "Abyssal sire" }))));

    const flatArmour = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ defensive: { stab: 60, slash: 60, crush: 60, ranged: 60, magic: 60, light: 60, standard: 60, heavy: 60, flat_armour: 8 } })
    );
    expect(expectedDamage(flatArmour)).toBeLessThan(expectedDamage(new PlayerVsNPCCalc(makePlayer(), makeMonster())));

    const verzikNormal = new PlayerVsNPCCalc(
      makePlayer(),
      makeMonster({ id: VERZIK_P1_IDS[0], name: "Verzik Vitur" })
    );
    const verzikDawnbringer = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: makePiece({ name: "Dawnbringer", category: EquipmentCategory.STAFF, offensive: { magic: 100 } }) }, style: { name: "Cast", type: "magic", stance: "Accurate" }, spell: { name: "Charge", element: "fire", max_hit: 20 } }),
      makeMonster({ id: VERZIK_P1_IDS[0], name: "Verzik Vitur" })
    );
    expect(expectedDamage(verzikNormal)).toBeLessThan(expectedDamage(verzikDawnbringer));
  });

  it("covers attacker transform branches for specs and set effects", () => {
    const baseMelee = new PlayerVsNPCCalc(makePlayer(), makeMonster({ attributes: [MonsterAttribute.SHADE] }));
    const gadderhammer = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: makePiece({ name: "Gadderhammer", category: EquipmentCategory.BLUNT, bonuses: { str: 160 }, offensive: { crush: 120 } }) }, style: { name: "Pound", type: "crush", stance: "Aggressive" } }),
      makeMonster({ attributes: [MonsterAttribute.SHADE] })
    );
    expect(expectedDamage(gadderhammer)).toBeGreaterThan(expectedDamage(baseMelee));

    const abyssalDaggerSpec = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: makePiece({ name: "Abyssal dagger", category: EquipmentCategory.DAGGER, bonuses: { str: 110 }, offensive: { stab: 110 } }) }, style: { name: "Stab", type: "stab", stance: "Aggressive" } }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    expect(abyssalDaggerSpec.getDistribution().zipped.hits.some((hit) => hit.hitsplats.length === 2)).toBe(true);

    const veracs = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Verac's flail", category: EquipmentCategory.BLUNT, bonuses: { str: 110 }, offensive: { crush: 105 } }),
          head: makePiece({ id: 3001, name: "Verac's helm" }),
          body: makePiece({ id: 3002, name: "Verac's brassard" }),
          legs: makePiece({ id: 3003, name: "Verac's plateskirt" }),
        },
        style: { name: "Pound", type: "crush", stance: "Aggressive" },
      }),
      makeMonster()
    );
    expect(expectedDamage(veracs)).toBeGreaterThan(expectedDamage(new PlayerVsNPCCalc(makePlayer(), makeMonster())));

    const karils = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({ name: "Karil's crossbow", category: EquipmentCategory.CROSSBOW, offensive: { ranged: 100 } }),
          ammo: makePiece({ id: 3004, name: "Bolt rack", bonuses: { ranged_str: 55 } }),
          head: makePiece({ id: 3005, name: "Karil's coif" }),
          body: makePiece({ id: 3006, name: "Karil's leathertop" }),
          legs: makePiece({ id: 3007, name: "Karil's leatherskirt" }),
          neck: makePiece({ id: 3008, name: "Amulet of the damned" }),
        },
      }),
      makeMonster()
    );
    expect(karils.getDistribution().zipped.hits.some((hit) => hit.hitsplats.length === 2)).toBe(true);

    const saraSpec = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: makePiece({ name: "Saradomin sword", category: EquipmentCategory.SLASH_SWORD, bonuses: { str: 125 }, offensive: { slash: 110 } }) } }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    const saraImmune = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: makePiece({ name: "Saradomin sword", category: EquipmentCategory.SLASH_SWORD, bonuses: { str: 125 }, offensive: { slash: 110 } }) } }),
      makeMonster({ id: IMMUNE_TO_MAGIC_DAMAGE_NPC_IDS[0], name: "Dusk" }),
      { usingSpecialAttack: true, overrideDefenceRoll: 0 }
    );
    expect(
      saraSpec.getDistribution().zipped.hits.some((hit) => hit.hitsplats[1]?.accurate && hit.hitsplats[1]?.damage > 0)
    ).toBe(true);
    expect(
      saraImmune.getDistribution().zipped.hits.some((hit) => hit.hitsplats[1]?.accurate && hit.hitsplats[1]?.damage > 0)
    ).toBe(false);

    const graniteNormal = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: makePiece({ name: "Granite hammer", category: EquipmentCategory.BLUNT, bonuses: { str: 100 }, offensive: { crush: 105 } }) }, style: { name: "Pound", type: "crush", stance: "Aggressive" } }),
      makeMonster()
    );
    const graniteSpec = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: makePiece({ name: "Granite hammer", category: EquipmentCategory.BLUNT, bonuses: { str: 100 }, offensive: { crush: 105 } }) }, style: { name: "Pound", type: "crush", stance: "Aggressive" } }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    expect(graniteSpec.getDistribution().getMax()).toBe(graniteNormal.getDistribution().getMax() + 5);

    const ahrimsBase = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Cast", type: "magic", stance: "Accurate" },
        spell: { name: "Fire Wave", element: "fire", max_hit: 25 },
        equipment: {
          weapon: makePiece({ name: "Ahrim's staff", category: EquipmentCategory.STAFF, offensive: { magic: 105 }, bonuses: { magic_str: 10 } }),
          head: makePiece({ id: 3010, name: "Ahrim's hood" }),
          body: makePiece({ id: 3011, name: "Ahrim's robetop" }),
          legs: makePiece({ id: 3012, name: "Ahrim's robeskirt" }),
          neck: makePiece({ id: 3013, name: "Amulet of fury" }),
        },
      }),
      makeMonster()
    );
    const ahrims = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Cast", type: "magic", stance: "Accurate" },
        spell: { name: "Fire Wave", element: "fire", max_hit: 25 },
        equipment: {
          weapon: makePiece({ name: "Ahrim's staff", category: EquipmentCategory.STAFF, offensive: { magic: 105 }, bonuses: { magic_str: 10 } }),
          head: makePiece({ id: 3010, name: "Ahrim's hood" }),
          body: makePiece({ id: 3011, name: "Ahrim's robetop" }),
          legs: makePiece({ id: 3012, name: "Ahrim's robeskirt" }),
          neck: makePiece({ id: 3013, name: "Amulet of the damned" }),
        },
      }),
      makeMonster()
    );
    expect(expectedDamage(ahrims)).toBeGreaterThan(expectedDamage(ahrimsBase));

    const dharokFull = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Dharok's greataxe", category: EquipmentCategory.TWO_HANDED_SWORD, bonuses: { str: 180 }, offensive: { slash: 140 } }),
          head: makePiece({ id: 3014, name: "Dharok's helm" }),
          body: makePiece({ id: 3015, name: "Dharok's platebody" }),
          legs: makePiece({ id: 3016, name: "Dharok's platelegs" }),
        },
        boosts: { hp: 0 },
        skills: { hp: 99 },
      }),
      makeMonster()
    );
    const dharokLow = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Dharok's greataxe", category: EquipmentCategory.TWO_HANDED_SWORD, bonuses: { str: 180 }, offensive: { slash: 140 } }),
          head: makePiece({ id: 3014, name: "Dharok's helm" }),
          body: makePiece({ id: 3015, name: "Dharok's platebody" }),
          legs: makePiece({ id: 3016, name: "Dharok's platelegs" }),
        },
        boosts: { hp: -98 },
        skills: { hp: 99 },
      }),
      makeMonster()
    );
    expect(expectedDamage(dharokLow)).toBeGreaterThan(expectedDamage(dharokFull));

    const tzhaarBase = new PlayerVsNPCCalc(
      makePlayer({ equipment: { weapon: makePiece({ name: "Toktz-xil-ak", category: EquipmentCategory.SLASH_SWORD, bonuses: { str: 105 }, offensive: { slash: 110 } }) } }),
      makeMonster()
    );
    const tzhaarNecklace = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makePiece({ name: "Toktz-xil-ak", category: EquipmentCategory.SLASH_SWORD, bonuses: { str: 105 }, offensive: { slash: 110 } }),
          neck: makePiece({ id: 3017, name: "Berserker necklace" }),
        },
      }),
      makeMonster()
    );
    expect(expectedDamage(tzhaarNecklace)).toBeGreaterThan(expectedDamage(tzhaarBase));
  });
});