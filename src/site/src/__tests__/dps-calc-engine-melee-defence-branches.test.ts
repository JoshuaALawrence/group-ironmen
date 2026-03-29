import { describe, expect, it } from "vitest";

import { PlayerVsNPCCalc, type CalcEquipmentPiece, type CalcMonster, type CalcPlayer } from "../dps-calc/dps-calc-engine";
import { AKKHA_IDS, MonsterAttribute } from "../dps-calc/dps-calc-constants";

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
    name: "Training piece",
    category: "Slash Sword",
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

function makeWeapon(name = "Training sword", overrides: Partial<CalcEquipmentPiece> = {}): CalcEquipmentPiece {
  return makePiece({
    name,
    category: "Slash Sword",
    speed: 4,
    bonuses: { str: 120, ranged_str: 0, magic_str: 0, prayer: 0 },
    offensive: { stab: 120, slash: 120, crush: 120, ranged: 0, magic: 0 },
    ...overrides,
  });
}

function makeArmour(name: string, overrides: Partial<CalcEquipmentPiece> = {}): CalcEquipmentPiece {
  return makePiece({
    name,
    category: "Armour",
    ...overrides,
  });
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
  const offensive = {
    magic: 100,
    ...(overrides.offensive || {}),
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
    weapon: makeWeapon(),
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

function baseMeleeAttackRoll(calc: PlayerVsNPCCalc, meleeVoid = false): number {
  let effective = calc.player.skills.atk + (calc.player.boosts.atk || 0);
  let stanceBonus = 8;
  if (calc.player.style.stance === "Accurate") stanceBonus += 3;
  else if (calc.player.style.stance === "Controlled") stanceBonus += 1;
  effective += stanceBonus;
  if (meleeVoid) effective = Math.trunc((effective * 11) / 10);
  return effective * ((calc.player.offensive[calc.player.style.type] || 0) + 64);
}

function baseMeleeMaxHit(calc: PlayerVsNPCCalc, meleeVoid = false): number {
  let effective = calc.player.skills.str + (calc.player.boosts.str || 0);
  let stanceBonus = 8;
  if (calc.player.style.stance === "Aggressive") stanceBonus += 3;
  else if (calc.player.style.stance === "Controlled") stanceBonus += 1;
  effective += stanceBonus;
  if (meleeVoid) effective = Math.trunc((effective * 11) / 10);
  return Math.trunc((effective * ((calc.player.bonuses.str || 0) + 64) + 320) / 640);
}

describe("dps calc engine melee and defence branches", () => {
  it("covers npc defence roll style overrides, ranged mixed defence, and TOA scaling", () => {
    const overrideMonster = makeMonster({
      skills: { def: 180, magic: 140, hp: 300 },
      defensive: { stab: 11, slash: 22, crush: 33, ranged: 44, magic: 55, light: 30, standard: 60, heavy: 90 },
    });
    const specCases = [
      {
        weapon: "Armadyl godsword",
        style: { name: "Lunge", type: "stab", stance: "Accurate" },
        expected: (overrideMonster.skills.def + 9) * ((overrideMonster.defensive?.slash || 0) + 64),
      },
      {
        weapon: "Dragon sword",
        style: { name: "Slash", type: "slash", stance: "Aggressive" },
        expected: (overrideMonster.skills.def + 9) * ((overrideMonster.defensive?.stab || 0) + 64),
      },
      {
        weapon: "Voidwaker",
        style: { name: "Slash", type: "slash", stance: "Aggressive" },
        expected: (overrideMonster.skills.magic + 9) * ((overrideMonster.defensive?.magic || 0) + 64),
      },
      {
        weapon: "Dragon mace",
        style: { name: "Slash", type: "slash", stance: "Aggressive" },
        expected: (overrideMonster.skills.def + 9) * ((overrideMonster.defensive?.crush || 0) + 64),
      },
      {
        weapon: "Accursed sceptre (a)",
        style: { name: "Stab", type: "stab", stance: "Accurate" },
        expected: (overrideMonster.skills.magic + 9) * ((overrideMonster.defensive?.magic || 0) + 64),
      },
    ] as const;

    for (const testCase of specCases) {
      const calc = new PlayerVsNPCCalc(
        makePlayer({
          style: testCase.style,
          equipment: {
            weapon: makeWeapon(testCase.weapon),
          },
        }),
        overrideMonster,
        { usingSpecialAttack: true }
      );
      expect(calc.getNPCDefenceRoll(), testCase.weapon).toBe(testCase.expected);
    }

    const mixedMonster = makeMonster({
      skills: { def: 120 },
      defensive: { light: 30, standard: 60, heavy: 90, ranged: 5 },
    });
    const mixedCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Flare", type: "ranged", stance: "Accurate" },
        equipment: {
          weapon: makePiece({
            name: "Swamp lizard",
            category: "Salamander",
            speed: 4,
            bonuses: { ranged_str: 60 },
            offensive: { ranged: 120 },
          }),
        },
      }),
      mixedMonster
    );
    expect(mixedCalc.getNPCDefenceRoll()).toBe((mixedMonster.skills.def + 9) * (Math.trunc((30 + 60 + 90) / 3) + 64));

    const toaMonster = makeMonster({
      id: AKKHA_IDS[0] || 11789,
      skills: { def: 100 },
      defensive: { slash: 80 },
      inputs: { toaInvocationLevel: 300, monsterCurrentHp: 250 },
    });
    const toaCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Slash", type: "slash", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Training sword"),
        },
      }),
      toaMonster
    );
    expect(toaCalc.getNPCDefenceRoll()).toBe(Math.trunc(((toaMonster.skills.def + 9) * (80 + 64) * (250 + 300)) / 250));
  });

  it("covers melee attack-roll branches for void, slayer, salve, avarice, obsidian, wilderness, monster types, inquisitor, and spec weapons", () => {
    const voidCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makeWeapon(),
          head: makeArmour("Void melee helm"),
          body: makeArmour("Void knight top"),
          legs: makeArmour("Void knight robe"),
          hands: makeArmour("Void knight gloves"),
        },
      }),
      makeMonster()
    );
    expect(voidCalc.getPlayerMaxMeleeAttackRoll()).toBe(baseMeleeAttackRoll(voidCalc, true));

    const avariceCalc = new PlayerVsNPCCalc(
      makePlayer({
        buffs: { onSlayerTask: true, forinthrySurge: true },
        equipment: {
          weapon: makeWeapon(),
          head: makeArmour("Black mask (i)"),
          neck: makeArmour("Amulet of avarice"),
        },
      }),
      makeMonster({ name: "Revenant dragon" })
    );
    expect(avariceCalc.getPlayerMaxMeleeAttackRoll()).toBe(Math.trunc((baseMeleeAttackRoll(avariceCalc) * 27) / 20));

    const salveCalc = new PlayerVsNPCCalc(
      makePlayer({
        buffs: { onSlayerTask: true },
        equipment: {
          weapon: makeWeapon(),
          head: makeArmour("Black mask (i)"),
          neck: makeArmour("Salve amulet (e)"),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.UNDEAD] })
    );
    expect(salveCalc.getPlayerMaxMeleeAttackRoll()).toBe(Math.trunc((baseMeleeAttackRoll(salveCalc) * 6) / 5));

    const obsidianCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makeWeapon("Toktz-xil-ek"),
          head: makeArmour("Obsidian helmet"),
          body: makeArmour("Obsidian platebody"),
          legs: makeArmour("Obsidian platelegs"),
        },
      }),
      makeMonster()
    );
    const obsidianBase = baseMeleeAttackRoll(obsidianCalc);
    expect(obsidianCalc.getPlayerMaxMeleeAttackRoll()).toBe(obsidianBase + Math.trunc(obsidianBase / 10));

    const revCalc = new PlayerVsNPCCalc(
      makePlayer({
        buffs: { inWilderness: true },
        equipment: {
          weapon: makeWeapon("Viggora's chainmace", { version: "Charged" }),
        },
      }),
      makeMonster()
    );
    expect(revCalc.getPlayerMaxMeleeAttackRoll()).toBe(Math.trunc((baseMeleeAttackRoll(revCalc) * 3) / 2));

    const arclightCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makeWeapon("Arclight"),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DEMON] })
    );
    expect(arclightCalc.getPlayerMaxMeleeAttackRoll()).toBe(
      Math.trunc(baseMeleeAttackRoll(arclightCalc) + (baseMeleeAttackRoll(arclightCalc) * 70) / 100)
    );

    const clawsCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: {
          weapon: makeWeapon("Burning claws"),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DEMON] })
    );
    expect(clawsCalc.getPlayerMaxMeleeAttackRoll()).toBe(
      Math.trunc(baseMeleeAttackRoll(clawsCalc) + (baseMeleeAttackRoll(clawsCalc) * 5) / 100)
    );

    const lanceCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: { weapon: makeWeapon("Dragon hunter lance") },
      }),
      makeMonster({ attributes: [MonsterAttribute.DRAGON] })
    );
    expect(lanceCalc.getPlayerMaxMeleeAttackRoll()).toBe(Math.trunc((baseMeleeAttackRoll(lanceCalc) * 6) / 5));

    const wandCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: { weapon: makeWeapon("Dragon hunter wand") },
      }),
      makeMonster({ attributes: [MonsterAttribute.DRAGON] })
    );
    expect(wandCalc.getPlayerMaxMeleeAttackRoll()).toBe(Math.trunc((baseMeleeAttackRoll(wandCalc) * 7) / 4));

    const kalphiteCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: { weapon: makeWeapon("Keris partisan of breaching") },
      }),
      makeMonster({ attributes: [MonsterAttribute.KALPHITE] })
    );
    expect(kalphiteCalc.getPlayerMaxMeleeAttackRoll()).toBe(Math.trunc((baseMeleeAttackRoll(kalphiteCalc) * 133) / 100));

    const golemCalc = new PlayerVsNPCCalc(
      makePlayer({
        equipment: { weapon: makeWeapon("Granite hammer") },
      }),
      makeMonster({ attributes: [MonsterAttribute.GOLEM] })
    );
    expect(golemCalc.getPlayerMaxMeleeAttackRoll()).toBe(Math.trunc((baseMeleeAttackRoll(golemCalc) * 13) / 10));

    const inquisitorCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pummel", type: "crush", stance: "Accurate" },
        equipment: {
          weapon: makeWeapon("Inquisitor's mace"),
          head: makeArmour("Inquisitor's great helm"),
          body: makeArmour("Inquisitor's hauberk"),
          legs: makeArmour("Inquisitor's plateskirt"),
        },
      }),
      makeMonster()
    );
    expect(inquisitorCalc.getPlayerMaxMeleeAttackRoll()).toBe(Math.trunc((baseMeleeAttackRoll(inquisitorCalc) * 215) / 200));

    const specCases = [
      { weapon: "Armadyl godsword", expected: (base: number) => Math.trunc(base * 2) },
      { weapon: "Osmumten's fang", expected: (base: number) => Math.trunc((base * 3) / 2) },
      { weapon: "Dragon mace", expected: (base: number) => Math.trunc((base * 5) / 4) },
      { weapon: "Dragon dagger", expected: (base: number) => Math.trunc((base * 23) / 20) },
      { weapon: "Abyssal dagger", expected: (base: number) => Math.trunc((base * 5) / 4) },
      { weapon: "Soulreaper axe", expected: (base: number) => Math.trunc((base * 130) / 100), stacks: 5 },
      { weapon: "Brine sabre", expected: (base: number) => Math.trunc(base * 2) },
      { weapon: "Barrelchest anchor", expected: (base: number) => Math.trunc(base * 2) },
    ] as const;

    for (const testCase of specCases) {
      const calc = new PlayerVsNPCCalc(
        makePlayer({
          buffs: { soulreaperStacks: testCase.stacks || 0 },
          equipment: {
            weapon: makeWeapon(testCase.weapon),
          },
        }),
        makeMonster(),
        { usingSpecialAttack: true }
      );
      expect(calc.getPlayerMaxMeleeAttackRoll(), testCase.weapon).toBe(testCase.expected(baseMeleeAttackRoll(calc)));
    }
  });

  it("covers melee max-hit branches for void, slayer, salve, avarice, monster-type gear, wilderness, inquisitor, and special weapons", () => {
    const voidCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon(),
          head: makeArmour("Void melee helm"),
          body: makeArmour("Void knight top"),
          legs: makeArmour("Void knight robe"),
          hands: makeArmour("Void knight gloves"),
        },
      }),
      makeMonster()
    );
    expect(voidCalc.getPlayerMaxMeleeHit()).toBe(baseMeleeMaxHit(voidCalc, true));

    const avariceCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        buffs: { onSlayerTask: true },
        equipment: {
          weapon: makeWeapon(),
          head: makeArmour("Black mask (i)"),
          neck: makeArmour("Amulet of avarice"),
        },
      }),
      makeMonster({ name: "Revenant knight" })
    );
    expect(avariceCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(avariceCalc) * 24) / 20));

    const salveCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        buffs: { onSlayerTask: true },
        equipment: {
          weapon: makeWeapon(),
          head: makeArmour("Black mask (i)"),
          neck: makeArmour("Salve amulet (i)"),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.UNDEAD] })
    );
    expect(salveCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(salveCalc) * 7) / 6));

    const slayerCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        buffs: { onSlayerTask: true },
        equipment: {
          weapon: makeWeapon(),
          head: makeArmour("Black mask (i)"),
        },
      }),
      makeMonster()
    );
    expect(slayerCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(slayerCalc) * 7) / 6));

    const arclightCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Arclight"),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DEMON] })
    );
    expect(arclightCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc(baseMeleeMaxHit(arclightCalc) + (baseMeleeMaxHit(arclightCalc) * 70) / 100));

    const silverlightCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Silverlight"),
        },
      }),
      makeMonster({ attributes: [MonsterAttribute.DEMON] })
    );
    expect(silverlightCalc.getPlayerMaxMeleeHit()).toBe(
      Math.trunc(baseMeleeMaxHit(silverlightCalc) + (baseMeleeMaxHit(silverlightCalc) * 60) / 100)
    );

    const obsidianCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Toktz-xil-ek"),
          head: makeArmour("Obsidian helmet"),
          body: makeArmour("Obsidian platebody"),
          legs: makeArmour("Obsidian platelegs"),
        },
      }),
      makeMonster()
    );
    const obsidianBase = baseMeleeMaxHit(obsidianCalc);
    expect(obsidianCalc.getPlayerMaxMeleeHit()).toBe(obsidianBase + Math.trunc(obsidianBase / 10));

    const lanceCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        equipment: { weapon: makeWeapon("Dragon hunter lance") },
      }),
      makeMonster({ attributes: [MonsterAttribute.DRAGON] })
    );
    expect(lanceCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(lanceCalc) * 6) / 5));

    const wandCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        equipment: { weapon: makeWeapon("Dragon hunter wand") },
      }),
      makeMonster({ attributes: [MonsterAttribute.DRAGON] })
    );
    expect(wandCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(wandCalc) * 7) / 5));

    const kerisCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Lunge", type: "stab", stance: "Aggressive" },
        equipment: { weapon: makeWeapon("Keris partisan of amascut") },
      }),
      makeMonster({ attributes: [MonsterAttribute.KALPHITE] })
    );
    expect(kerisCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(kerisCalc) * 115) / 100));

    const barroniteCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pound", type: "crush", stance: "Aggressive" },
        equipment: { weapon: makeWeapon("Barronite mace") },
      }),
      makeMonster({ attributes: [MonsterAttribute.GOLEM] })
    );
    expect(barroniteCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(barroniteCalc) * 23) / 20));

    const graniteCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pound", type: "crush", stance: "Aggressive" },
        equipment: { weapon: makeWeapon("Granite hammer") },
      }),
      makeMonster({ attributes: [MonsterAttribute.GOLEM] })
    );
    expect(graniteCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(graniteCalc) * 13) / 10));

    const revCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        buffs: { inWilderness: true },
        equipment: {
          weapon: makeWeapon("Viggora's chainmace", { version: "Charged" }),
        },
      }),
      makeMonster()
    );
    expect(revCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(revCalc) * 3) / 2));

    const inquisitorCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Pound", type: "crush", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Inquisitor's mace"),
          head: makeArmour("Inquisitor's great helm"),
          body: makeArmour("Inquisitor's hauberk"),
          legs: makeArmour("Inquisitor's plateskirt"),
        },
      }),
      makeMonster()
    );
    expect(inquisitorCalc.getPlayerMaxMeleeHit()).toBe(Math.trunc((baseMeleeMaxHit(inquisitorCalc) * 215) / 200));

    const specCases = [
      {
        weapon: "Armadyl godsword",
        expected: (base: number) => Math.trunc((Math.trunc((base * 11) / 10) * 5) / 4),
      },
      { weapon: "Dragon mace", expected: (base: number) => Math.trunc((base * 3) / 2) },
      { weapon: "Dragon halberd", expected: (base: number) => Math.trunc((base * 11) / 10) },
      { weapon: "Dragon dagger", expected: (base: number) => Math.trunc((base * 23) / 20) },
      { weapon: "Abyssal dagger", expected: (base: number) => Math.trunc((base * 17) / 20) },
      {
        weapon: "Abyssal bludgeon",
        expected: (base: number) => Math.trunc((base * 110) / 100),
        boosts: { prayer: -20 },
      },
      { weapon: "Barrelchest anchor", expected: (base: number) => Math.trunc((base * 110) / 100) },
      {
        weapon: "Soulreaper axe",
        expected: (base: number) => Math.trunc((base * 130) / 100),
        stacks: 5,
      },
    ] as const;

    for (const testCase of specCases) {
      const calc = new PlayerVsNPCCalc(
        makePlayer({
          style: { name: "Chop", type: "slash", stance: "Aggressive" },
          boosts: testCase.boosts || {},
          buffs: { soulreaperStacks: testCase.stacks || 0 },
          equipment: {
            weapon: makeWeapon(testCase.weapon),
          },
        }),
        makeMonster(),
        { usingSpecialAttack: true }
      );
      expect(calc.getPlayerMaxMeleeHit(), testCase.weapon).toBe(testCase.expected(baseMeleeMaxHit(calc)));
    }
  });

  it("covers fang min-max behavior, blood-moon special handling, voidwaker special windows, and respiratory-system min-hit logic", () => {
    const fangCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Lunge", type: "stab", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Osmumten's fang"),
        },
      }),
      makeMonster()
    );
    const fangBase = baseMeleeMaxHit(fangCalc);
    const fangShrink = Math.trunc((fangBase * 3) / 20);
    expect(fangCalc.getMinAndMax()).toEqual([fangShrink, fangBase - fangShrink]);

    const fangSpecCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Lunge", type: "stab", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Osmumten's fang"),
        },
      }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    const fangSpecBase = baseMeleeMaxHit(fangSpecCalc);
    const fangSpecShrink = Math.trunc((fangSpecBase * 3) / 20);
    expect(fangSpecCalc.getMinAndMax()).toEqual([fangSpecShrink, fangSpecBase]);

    const bloodMoonCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Dual macuahuitl"),
          head: makeArmour("Blood moon helm"),
          body: makeArmour("Blood moon chestplate"),
          legs: makeArmour("Blood moon tassets"),
        },
      }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    const bloodMoonBase = baseMeleeMaxHit(bloodMoonCalc);
    const bloodMoonMin = Math.trunc(bloodMoonBase / 4);
    expect(bloodMoonCalc.getMinAndMax()).toEqual([bloodMoonMin, bloodMoonBase + bloodMoonMin]);

    const voidwakerCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Voidwaker"),
        },
      }),
      makeMonster(),
      { usingSpecialAttack: true }
    );
    const voidwakerBase = baseMeleeMaxHit(voidwakerCalc);
    const voidwakerMin = Math.trunc(voidwakerBase / 2);
    expect(voidwakerCalc.getMinAndMax()).toEqual([voidwakerMin, voidwakerBase + voidwakerMin]);

    const respiratoryCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Chop", type: "slash", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon(),
        },
      }),
      makeMonster({ name: "Respiratory system" })
    );
    const respiratoryBase = baseMeleeMaxHit(respiratoryCalc);
    expect(respiratoryCalc.getMinAndMax()).toEqual([Math.trunc(respiratoryBase / 2), respiratoryBase]);

    const respiratoryFangCalc = new PlayerVsNPCCalc(
      makePlayer({
        style: { name: "Lunge", type: "stab", stance: "Aggressive" },
        equipment: {
          weapon: makeWeapon("Osmumten's fang"),
        },
      }),
      makeMonster({ name: "Respiratory system" })
    );
    const respiratoryFangBase = baseMeleeMaxHit(respiratoryFangCalc);
    const respiratoryFangShrink = Math.trunc((respiratoryFangBase * 3) / 20);
    const respiratoryFangMax = respiratoryFangBase - respiratoryFangShrink;
    expect(respiratoryFangCalc.getMinAndMax()).toEqual([
      respiratoryFangShrink + Math.trunc(respiratoryFangMax / 2),
      respiratoryFangMax,
    ]);
  });
});