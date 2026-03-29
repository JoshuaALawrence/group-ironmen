import { describe, expect, it } from "vitest";

import { PlayerVsNPCCalc, type CalcEquipmentPiece, type CalcMonster, type CalcPlayer } from "../dps-calc/dps-calc-engine";
import { MonsterAttribute } from "../dps-calc/dps-calc-constants";

function makePiece(name = "Training sword", overrides: Partial<CalcEquipmentPiece> = {}): CalcEquipmentPiece {
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
    name,
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
    hp: 200,
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

function makeCalc(
  playerOverrides: Partial<CalcPlayer> = {},
  monsterOverrides: Partial<CalcMonster> = {}
): PlayerVsNPCCalc {
  return new PlayerVsNPCCalc(makePlayer(playerOverrides), makeMonster(monsterOverrides));
}

describe("PlayerVsNPCCalc wearing helpers", () => {
  it("covers direct wearing checks and void set variants", () => {
    const eliteRangedVoidCalc = makeCalc({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece("Crystal bow", { category: "Bow" }),
        head: makePiece("Void ranger helm (or)"),
        body: makePiece("Elite void top (or)"),
        legs: makePiece("Elite void robe"),
        hands: makePiece("Void knight gloves"),
        neck: makePiece("Berserker necklace (or)"),
      },
    });

    expect(eliteRangedVoidCalc.wearing("Crystal bow")).toBe(true);
    expect(eliteRangedVoidCalc.wearing(["Rune crossbow", "Crystal bow"])).toBe(true);
    expect(eliteRangedVoidCalc.wearingAll(["Crystal bow", "Void knight gloves", "Elite void top (or)"])).toBe(true);
    expect(eliteRangedVoidCalc.wearingAll(["Crystal bow", "Missing item"])).toBe(false);
    expect(eliteRangedVoidCalc.isWearingVoidRobes()).toBe(true);
    expect(eliteRangedVoidCalc.isWearingEliteVoidRobes()).toBe(true);
    expect(eliteRangedVoidCalc.isWearingEliteRangedVoid()).toBe(true);
    expect(eliteRangedVoidCalc.isWearingRangedVoid()).toBe(true);
    expect(eliteRangedVoidCalc.isWearingMagicVoid()).toBe(false);
    expect(eliteRangedVoidCalc.isWearingMeleeVoid()).toBe(false);
    expect(eliteRangedVoidCalc.isWearingBerserkerNecklace()).toBe(true);
    expect(eliteRangedVoidCalc.isWearingCrystalBow()).toBe(true);

    const meleeVoidCalc = makeCalc({
      equipment: {
        head: makePiece("Void melee helm"),
        body: makePiece("Void knight top"),
        legs: makePiece("Void knight robe"),
        hands: makePiece("Void knight gloves"),
      },
    });
    expect(meleeVoidCalc.isWearingMeleeVoid()).toBe(true);
    expect(meleeVoidCalc.isWearingEliteVoidRobes()).toBe(false);

    const eliteMageVoidCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      equipment: {
        head: makePiece("Void mage helm (or)"),
        body: makePiece("Elite void top"),
        legs: makePiece("Elite void robe (or)"),
        hands: makePiece("Void knight gloves"),
      },
      spell: { name: "Fire Wave", spellbook: "standard", element: "fire", max_hit: 20 },
    });
    expect(eliteMageVoidCalc.isWearingMagicVoid()).toBe(true);
    expect(eliteMageVoidCalc.isWearingEliteMagicVoid()).toBe(true);
  });

  it("covers direct name-matching helpers across single items", () => {
    const plainMaskCalc = makeCalc({
      equipment: { head: makePiece("Black mask") },
    });
    expect(plainMaskCalc.isWearingBlackMask()).toBe(true);
    expect(plainMaskCalc.isWearingImbuedBlackMask()).toBe(false);

    const imbuedHelmCalc = makeCalc({
      equipment: { head: makePiece("Slayer helmet (i)") },
    });
    expect(imbuedHelmCalc.isWearingBlackMask()).toBe(true);
    expect(imbuedHelmCalc.isWearingImbuedBlackMask()).toBe(true);

    const simpleCases = [
      {
        label: "smoke staff",
        calc: makeCalc({ equipment: { weapon: makePiece("Twinflame staff", { category: "Staff" }) } }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingSmokeStaff(),
      },
      {
        label: "tzhaar weapon",
        calc: makeCalc({ equipment: { weapon: makePiece("Toktz-xil-ak") } }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingTzhaarWeapon(),
      },
      {
        label: "fang",
        calc: makeCalc({ equipment: { weapon: makePiece("Osmumten's fang (or)") } }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingFang(),
      },
      {
        label: "accursed sceptre",
        calc: makeCalc({
          style: { name: "Cast", type: "magic", stance: "Autocast" },
          spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
          equipment: { weapon: makePiece("Accursed sceptre (a)", { category: "Staff" }) },
        }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingAccursedSceptre(),
      },
      {
        label: "blowpipe",
        calc: makeCalc({
          style: { name: "Accurate", type: "ranged", stance: "Accurate" },
          equipment: { weapon: makePiece("Blazing blowpipe") },
        }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingBlowpipe(),
      },
      {
        label: "godsword",
        calc: makeCalc({ equipment: { weapon: makePiece("Bandos godsword") } }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingGodsword(),
      },
      {
        label: "scythe",
        calc: makeCalc({ equipment: { weapon: makePiece("Holy scythe of vitur") } }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingScythe(),
      },
      {
        label: "keris",
        calc: makeCalc({ equipment: { weapon: makePiece("Keris partisan of the sun") } }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingKeris(),
      },
      {
        label: "two-hit weapon",
        calc: makeCalc({ equipment: { weapon: makePiece("Earthbound tecpatl") } }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingTwoHitWeapon(),
      },
      {
        label: "rat-bone weapon",
        calc: makeCalc({
          style: { name: "Cast", type: "magic", stance: "Autocast" },
          spell: { name: "Crumble Undead", spellbook: "standard", element: "earth", max_hit: 15 },
          equipment: { weapon: makePiece("Bone staff", { category: "Staff" }) },
        }),
        check: (calc: PlayerVsNPCCalc) => calc.isWearingRatBoneWeapon(),
      },
    ];

    for (const testCase of simpleCases) {
      expect(testCase.check(testCase.calc), testCase.label).toBe(true);
    }

    expect(makeCalc({ equipment: { weapon: makePiece("Bow of faerdhinen (c)", { category: "Bow" }) } }).isWearingCrystalBow()).toBe(
      true
    );
  });

  it("covers set-completion helpers for obsidian, barrows, and blood moon", () => {
    const obsidianCalc = makeCalc({
      equipment: {
        head: makePiece("Obsidian helmet"),
        body: makePiece("Obsidian platebody"),
        legs: makePiece("Obsidian platelegs"),
      },
    });
    expect(obsidianCalc.isWearingObsidian()).toBe(true);

    const incompleteObsidianCalc = makeCalc({
      equipment: {
        head: makePiece("Obsidian helmet"),
        body: makePiece("Obsidian platebody"),
      },
    });
    expect(incompleteObsidianCalc.isWearingObsidian()).toBe(false);

    const dharokCalc = makeCalc({
      equipment: {
        weapon: makePiece("Dharok's greataxe"),
        head: makePiece("Dharok's helm"),
        body: makePiece("Dharok's platebody"),
        legs: makePiece("Dharok's platelegs"),
      },
    });
    expect(dharokCalc.isWearingDharok()).toBe(true);

    const veracsCalc = makeCalc({
      equipment: {
        weapon: makePiece("Verac's flail"),
        head: makePiece("Verac's helm"),
        body: makePiece("Verac's brassard"),
        legs: makePiece("Verac's plateskirt"),
      },
    });
    expect(veracsCalc.isWearingVeracs()).toBe(true);

    const karilsCalc = makeCalc({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece("Karil's crossbow", { category: "Crossbow" }),
        head: makePiece("Karil's coif"),
        body: makePiece("Karil's leathertop"),
        legs: makePiece("Karil's leatherskirt"),
        neck: makePiece("Amulet of the damned"),
      },
    });
    expect(karilsCalc.isWearingKarils()).toBe(true);

    const ahrimsCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Fire Wave", spellbook: "standard", element: "fire", max_hit: 20 },
      equipment: {
        weapon: makePiece("Ahrim's staff", { category: "Staff" }),
        head: makePiece("Ahrim's hood"),
        body: makePiece("Ahrim's robetop"),
        legs: makePiece("Ahrim's robeskirt"),
        neck: makePiece("Amulet of the damned"),
      },
    });
    expect(ahrimsCalc.isWearingAhrims()).toBe(true);

    const bloodMoonCalc = makeCalc({
      equipment: {
        weapon: makePiece("Dual macuahuitl"),
        head: makePiece("Blood moon helm"),
        body: makePiece("Blood moon chestplate"),
        legs: makePiece("Blood moon tassets"),
      },
    });
    expect(bloodMoonCalc.isWearingBloodMoonSet()).toBe(true);
  });

  it("covers silver, vampyrebane, leaf-bladed, and corpbane branches", () => {
    const silverBoltsCalc = makeCalc({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece("Rune crossbow", { category: "Crossbow" }),
        ammo: makePiece("Silver bolts", { bonuses: { ranged_str: 80 } }),
      },
    });
    expect(silverBoltsCalc.isWearingSilverWeapon()).toBe(true);

    const silverMeleeCalc = makeCalc({
      style: { name: "Slash", type: "slash", stance: "Aggressive" },
      equipment: { weapon: makePiece("Wolfbane") },
    });
    expect(silverMeleeCalc.isWearingSilverWeapon()).toBe(true);

    const nonMeleeSilverCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
      equipment: { weapon: makePiece("Silverlight") },
    });
    expect(nonMeleeSilverCalc.isWearingSilverWeapon()).toBe(false);

    const vampyreTierTwoCalc = makeCalc({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece("Rod of ivandis"),
      },
    });
    expect(vampyreTierTwoCalc.wearingVampyrebane(MonsterAttribute.VAMPYRE_2)).toBe(true);

    const vampyreMeleeCalc = makeCalc({
      style: { name: "Slash", type: "slash", stance: "Aggressive" },
      equipment: {
        weapon: makePiece("Ivandis flail"),
      },
    });
    expect(vampyreMeleeCalc.wearingVampyrebane("tier-1")).toBe(true);
    expect(vampyreMeleeCalc.wearingVampyrebane(MonsterAttribute.VAMPYRE_2)).toBe(true);

    const leafBladeMeleeCalc = makeCalc({
      style: { name: "Slash", type: "slash", stance: "Aggressive" },
      equipment: { weapon: makePiece("Leaf-bladed sword") },
    });
    expect(leafBladeMeleeCalc.isWearingLeafBladedWeapon()).toBe(true);

    const magicDartCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Manual Cast" },
      spell: { name: "Magic Dart", spellbook: "standard", element: "magic", max_hit: 20 },
      equipment: { weapon: makePiece("Slayer's staff", { category: "Staff" }) },
    });
    expect(magicDartCalc.isWearingLeafBladedWeapon()).toBe(true);

    const broadAmmoCalc = makeCalc({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: {
        weapon: makePiece("Rune crossbow", { category: "Crossbow" }),
        ammo: makePiece("Broad bolts", { bonuses: { ranged_str: 80 } }),
      },
    });
    expect(broadAmmoCalc.isWearingLeafBladedWeapon()).toBe(true);

    const noLeafBladeCalc = makeCalc();
    expect(noLeafBladeCalc.isWearingLeafBladedWeapon()).toBe(false);

    const noWeaponCorpbaneCalc = makeCalc({
      equipment: { weapon: null },
    });
    expect(noWeaponCorpbaneCalc.isWearingCorpbaneWeapon()).toBe(false);

    const fangCorpbaneCalc = makeCalc({
      style: { name: "Stab", type: "stab", stance: "Accurate" },
      equipment: { weapon: makePiece("Osmumten's fang") },
    });
    expect(fangCorpbaneCalc.isWearingCorpbaneWeapon()).toBe(true);

    const fangSlashCalc = makeCalc({
      style: { name: "Lunge", type: "slash", stance: "Controlled" },
      equipment: { weapon: makePiece("Osmumten's fang") },
    });
    expect(fangSlashCalc.isWearingCorpbaneWeapon()).toBe(false);

    const halberdCalc = makeCalc({
      style: { name: "Jab", type: "stab", stance: "Accurate" },
      equipment: { weapon: makePiece("Dragon halberd") },
    });
    expect(halberdCalc.isWearingCorpbaneWeapon()).toBe(true);

    const blueMoonSpearCalc = makeCalc({
      style: { name: "Lunge", type: "stab", stance: "Accurate" },
      equipment: { weapon: makePiece("Blue moon spear") },
    });
    expect(blueMoonSpearCalc.isWearingCorpbaneWeapon()).toBe(false);

    const magicCorpbaneCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Fire Wave", spellbook: "standard", element: "fire", max_hit: 20 },
      equipment: { weapon: makePiece("Trident of the seas", { category: "Staff" }) },
    });
    expect(magicCorpbaneCalc.isWearingCorpbaneWeapon()).toBe(true);
  });

  it("covers revenant, charge-spell, demonbane, abyssal, and tormented demon helpers", () => {
    const nonWildRevCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
      equipment: { weapon: makePiece("Accursed sceptre", { category: "Staff", version: "Charged" }) },
    });
    expect(nonWildRevCalc.isRevWeaponBuffApplicable()).toBe(false);

    const magicRevCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
      buffs: { inWilderness: true },
      equipment: { weapon: makePiece("Accursed sceptre (a)", { category: "Staff", version: "Charged" }) },
    });
    expect(magicRevCalc.isRevWeaponBuffApplicable()).toBe(true);

    const rangedRevCalc = makeCalc({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      buffs: { inWilderness: true },
      equipment: { weapon: makePiece("Craw's bow", { category: "Bow", version: "Charged" }) },
    });
    expect(rangedRevCalc.isRevWeaponBuffApplicable()).toBe(true);

    const meleeRevCalc = makeCalc({
      style: { name: "Pound", type: "crush", stance: "Aggressive" },
      buffs: { inWilderness: true },
      equipment: { weapon: makePiece("Viggora's chainmace", { version: "Charged" }) },
    });
    expect(meleeRevCalc.isRevWeaponBuffApplicable()).toBe(true);

    const noChargeBuffCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Saradomin Strike", spellbook: "standard", element: "fire", max_hit: 20 },
      equipment: { cape: makePiece("Saradomin cape") },
    });
    expect(noChargeBuffCalc.isChargeSpellApplicable()).toBe(false);

    const saradominChargeCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Saradomin Strike", spellbook: "standard", element: "fire", max_hit: 20 },
      buffs: { chargeSpell: true },
      equipment: { cape: makePiece("Saradomin cape") },
    });
    expect(saradominChargeCalc.isChargeSpellApplicable()).toBe(true);

    const guthixChargeCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Claws of Guthix", spellbook: "standard", element: "fire", max_hit: 20 },
      buffs: { chargeSpell: true },
      equipment: { cape: makePiece("Imbued guthix cape") },
    });
    expect(guthixChargeCalc.isChargeSpellApplicable()).toBe(true);

    const zamorakChargeCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Flames of Zamorak", spellbook: "standard", element: "fire", max_hit: 20 },
      buffs: { chargeSpell: true },
      equipment: { cape: makePiece("Zamorak max cape") },
    });
    expect(zamorakChargeCalc.isChargeSpellApplicable()).toBe(true);

    const unknownChargeCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Fire Wave", spellbook: "standard", element: "fire", max_hit: 20 },
      buffs: { chargeSpell: true },
      equipment: { cape: makePiece("Saradomin cape") },
    });
    expect(unknownChargeCalc.isChargeSpellApplicable()).toBe(false);

    const magicDemonbaneCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Superior Demonbane", spellbook: "arceuus", element: "fire", max_hit: 23 },
      equipment: { weapon: makePiece("Staff of the dead", { category: "Staff" }) },
    });
    expect(magicDemonbaneCalc.isUsingDemonbane()).toBe(true);

    const rangedDemonbaneCalc = makeCalc({
      style: { name: "Accurate", type: "ranged", stance: "Accurate" },
      equipment: { weapon: makePiece("Scorching bow", { category: "Bow" }) },
    });
    expect(rangedDemonbaneCalc.isUsingDemonbane()).toBe(true);

    const meleeDemonbaneCalc = makeCalc({
      style: { name: "Slash", type: "slash", stance: "Aggressive" },
      equipment: { weapon: makePiece("Arclight") },
    });
    expect(meleeDemonbaneCalc.isUsingDemonbane()).toBe(true);

    const abyssalMeleeCalc = makeCalc({
      style: { name: "Slash", type: "slash", stance: "Accurate" },
      equipment: { weapon: makePiece("Abyssal whip") },
    });
    expect(abyssalMeleeCalc.isUsingAbyssal()).toBe(true);

    const abyssalMagicCalc = makeCalc({
      style: { name: "Cast", type: "magic", stance: "Autocast" },
      spell: { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 },
      equipment: { weapon: makePiece("Abyssal whip") },
    });
    expect(abyssalMagicCalc.isUsingAbyssal()).toBe(false);

    const wrongMonsterCalc = makeCalc({
      style: { name: "Pound", type: "crush", stance: "Aggressive" },
    });
    expect(wrongMonsterCalc.tdUnshieldedBonusApplies()).toBe(false);

    const magicTdCalc = makeCalc(
      {
        style: { name: "Cast", type: "magic", stance: "Autocast" },
        spell: { name: "Fire Wave", spellbook: "standard", element: "fire", max_hit: 20 },
      },
      { name: "Tormented Demon", inputs: { phase: "Unshielded", monsterCurrentHp: 200 } }
    );
    expect(magicTdCalc.tdUnshieldedBonusApplies()).toBe(true);

    const heavyRangedTdCalc = makeCalc(
      {
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: { weapon: makePiece("Rune crossbow", { category: "Crossbow" }) },
      },
      { name: "Tormented Demon", inputs: { phase: "Unshielded", monsterCurrentHp: 200 } }
    );
    expect(heavyRangedTdCalc.tdUnshieldedBonusApplies()).toBe(true);

    const standardRangedTdCalc = makeCalc(
      {
        style: { name: "Accurate", type: "ranged", stance: "Accurate" },
        equipment: { weapon: makePiece("Magic shortbow", { category: "Bow" }) },
      },
      { name: "Tormented Demon", inputs: { phase: "Unshielded", monsterCurrentHp: 200 } }
    );
    expect(standardRangedTdCalc.tdUnshieldedBonusApplies()).toBe(false);

    const crushTdCalc = makeCalc(
      {
        style: { name: "Pound", type: "crush", stance: "Aggressive" },
      },
      { name: "Tormented Demon", inputs: { phase: "Unshielded", monsterCurrentHp: 200 } }
    );
    expect(crushTdCalc.tdUnshieldedBonusApplies()).toBe(true);

    const stabTdCalc = makeCalc(
      {
        style: { name: "Stab", type: "stab", stance: "Accurate" },
      },
      { name: "Tormented Demon", inputs: { phase: "Unshielded", monsterCurrentHp: 200 } }
    );
    expect(stabTdCalc.tdUnshieldedBonusApplies()).toBe(false);
  });

  it("merges combat prayers by slot and ignores unknown prayer keys", () => {
    const noPrayerCalc = makeCalc();
    expect(noPrayerCalc.getCombatPrayers()).toEqual({
      factorAccuracy: null,
      factorStrength: null,
      factorDefence: null,
      combatStyle: null,
    });

    const stackedCalc = makeCalc({
      prayers: ["burst_of_strength", "clarity_of_thought", "steel_skin"],
    });
    expect(stackedCalc.getCombatPrayers()).toEqual({
      factorAccuracy: [105, 100],
      factorStrength: [105, 100],
      factorDefence: [115, 100],
      combatStyle: "melee",
    });

    const precedenceCalc = makeCalc({
      prayers: ["burst_of_strength", "superhuman_strength", "unknown_prayer"],
    });
    expect(precedenceCalc.getCombatPrayers()).toEqual({
      factorAccuracy: null,
      factorStrength: [110, 100],
      factorDefence: null,
      combatStyle: "melee",
    });
  });
});