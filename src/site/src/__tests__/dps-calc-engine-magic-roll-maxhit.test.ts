import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayerVsNPCCalc, type CalcEquipmentPiece, type CalcMonster, type CalcPlayer } from "../dps-calc/dps-calc-engine";
import { MonsterAttribute, P2_WARDEN_IDS } from "../dps-calc/dps-calc-constants";

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
    name: "Training item",
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
    weapon: makePiece({ name: "Training staff", category: "Staff", offensive: { magic: 30 } }),
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

function makeCalc(playerOverrides: Partial<CalcPlayer> = {}, monsterOverrides: Partial<CalcMonster> = {}, opts = {}) {
  return new PlayerVsNPCCalc(makePlayer(playerOverrides), makeMonster(monsterOverrides), opts);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dps calc engine magic attack-roll and max-hit branches", () => {
  it("covers void and priority magic attack-roll bonuses for avarice, salve, and imbued black mask", () => {
    const fireBolt = { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 };

    const baseRoll = makeCalc({ spell: fireBolt }).getPlayerMaxMagicAttackRoll();
    expect(baseRoll).toBe(10340);

    const voidRoll = makeCalc({
      spell: fireBolt,
      equipment: {
        weapon: makePiece({ name: "Training staff", category: "Staff", offensive: { magic: 30 } }),
        head: makePiece({ name: "Void mage helm" }),
        body: makePiece({ name: "Void knight top" }),
        legs: makePiece({ name: "Void knight robe" }),
        hands: makePiece({ name: "Void knight gloves" }),
      },
    }).getPlayerMaxMagicAttackRoll();
    expect(voidRoll).toBe(14946);

    const revenantMonster = { name: "Revenant knight" };
    expect(
      makeCalc({ spell: fireBolt, equipment: { neck: makePiece({ name: "Amulet of avarice" }) } }, revenantMonster)
        .getPlayerMaxMagicAttackRoll()
    ).toBe(12408);
    expect(
      makeCalc(
        {
          spell: fireBolt,
          equipment: { neck: makePiece({ name: "Amulet of avarice" }) },
          buffs: { forinthrySurge: true },
        },
        revenantMonster
      ).getPlayerMaxMagicAttackRoll()
    ).toBe(13959);

    const undeadMonster = { attributes: [MonsterAttribute.UNDEAD] };
    expect(
      makeCalc({ spell: fireBolt, equipment: { neck: makePiece({ name: "Salve amulet(ei)" }) } }, undeadMonster)
        .getPlayerMaxMagicAttackRoll()
    ).toBe(12408);
    expect(
      makeCalc({ spell: fireBolt, equipment: { neck: makePiece({ name: "Salve amulet(i)" }) } }, undeadMonster)
        .getPlayerMaxMagicAttackRoll()
    ).toBe(11891);

    expect(
      makeCalc({
        spell: fireBolt,
        equipment: { head: makePiece({ name: "Black mask (i)" }) },
        buffs: { onSlayerTask: true },
      }).getPlayerMaxMagicAttackRoll()
    ).toBe(11891);
  });

  it("covers smoke, efaritay, dragon hunter, revenant, tome, special-attack, and weakness attack-roll branches", () => {
    const fireBolt = { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 };
    const entangle = { name: "Entangle", spellbook: "standard", max_hit: 5 };

    expect(
      makeCalc({
        spell: fireBolt,
        equipment: { weapon: makePiece({ name: "Smoke battlestaff", category: "Staff", offensive: { magic: 30 } }) },
      }).getPlayerMaxMagicAttackRoll()
    ).toBe(11374);

    const efaritayCalc = makeCalc(
      {
        spell: fireBolt,
        equipment: { neck: makePiece({ name: "Efaritay's aid" }) },
      },
      { attributes: [MonsterAttribute.VAMPYRE_1] }
    );
    vi.spyOn(efaritayCalc, "isWearingSilverWeapon").mockReturnValue(true);
    expect(efaritayCalc.getPlayerMaxMagicAttackRoll()).toBe(11891);

    expect(
      makeCalc(
        {
          spell: fireBolt,
          equipment: {
            weapon: makePiece({ name: "Dragon hunter wand", category: "Staff", offensive: { magic: 30 } }),
          },
        },
        { attributes: [MonsterAttribute.DRAGON] }
      ).getPlayerMaxMagicAttackRoll()
    ).toBe(18095);

    const thammaronPlain = makeCalc({
      spell: fireBolt,
      equipment: {
        weapon: makePiece({ name: "Thammaron's sceptre", category: "Staff", offensive: { magic: 30 } }),
      },
    }).getPlayerMaxMagicAttackRoll();
    const thammaronRev = makeCalc({
      spell: fireBolt,
      equipment: {
        weapon: makePiece({
          name: "Thammaron's sceptre",
          category: "Staff",
          version: "Charged",
          offensive: { magic: 30 },
        }),
      },
      buffs: { inWilderness: true },
    }).getPlayerMaxMagicAttackRoll();
    expect(thammaronRev).toBe(Math.trunc((thammaronPlain * 3) / 2));

    const entanglePlain = makeCalc({ spell: entangle }).getPlayerMaxMagicAttackRoll();
    const entangleTome = makeCalc({
      spell: entangle,
      equipment: { shield: makePiece({ name: "Tome of water" }) },
    }).getPlayerMaxMagicAttackRoll();
    expect(entangleTome).toBe(Math.trunc((entanglePlain * 6) / 5));

    const ayakNormal = makeCalc({
      spell: fireBolt,
      equipment: { weapon: makePiece({ name: "Eye of ayak", category: "Staff", offensive: { magic: 30 } }) },
    }).getPlayerMaxMagicAttackRoll();
    const ayakSpec = makeCalc(
      {
        spell: fireBolt,
        equipment: { weapon: makePiece({ name: "Eye of ayak", category: "Staff", offensive: { magic: 30 } }) },
      },
      {},
      { usingSpecialAttack: true }
    ).getPlayerMaxMagicAttackRoll();
    expect(ayakSpec).toBe(ayakNormal * 2);

    expect(
      makeCalc(
        { spell: fireBolt },
        {
          weakness: { element: "fire", severity: 50 },
        }
      ).getPlayerMaxMagicAttackRoll()
    ).toBe(15510);
  });

  it("covers weapon-specific magic max-hit formulas and charge-spell applicability", () => {
    expect(
      makeCalc({
        equipment: { weapon: makePiece({ name: "Warped sceptre", category: "Staff", offensive: { magic: 30 } }) },
      }).getPlayerMaxMagicHit()
    ).toBe(24);
    expect(
      makeCalc({
        equipment: {
          weapon: makePiece({ name: "Crystal staff (perfected)", category: "Staff", offensive: { magic: 30 } }),
        },
      }).getPlayerMaxMagicHit()
    ).toBe(39);
    expect(
      makeCalc({
        equipment: { weapon: makePiece({ name: "Bone staff", category: "Staff", offensive: { magic: 30 } }) },
      }).getPlayerMaxMagicHit()
    ).toBe(38);
    expect(
      makeCalc({
        equipment: { weapon: makePiece({ name: "Purging staff", category: "Staff", offensive: { magic: 30 } }) },
      }).getPlayerMaxMagicHit()
    ).toBe(32);
    expect(
      makeCalc(
        {
          equipment: {
            weapon: makePiece({ name: "Volatile nightmare staff", category: "Staff", offensive: { magic: 30 } }),
          },
        },
        {},
        { usingSpecialAttack: true }
      ).getPlayerMaxMagicHit()
    ).toBe(58);
    expect(
      makeCalc(
        {
          equipment: {
            weapon: makePiece({ name: "Eldritch nightmare staff", category: "Staff", offensive: { magic: 30 } }),
          },
        },
        {},
        { usingSpecialAttack: true }
      ).getPlayerMaxMagicHit()
    ).toBe(44);
    expect(
      makeCalc({
        equipment: { weapon: makePiece({ name: "Black salamander", category: "Salamander", offensive: { magic: 30 } }) },
      }).getPlayerMaxMagicHit()
    ).toBe(Math.trunc((99 * (92 + 64) + 320) / 640));
    expect(
      makeCalc({
        equipment: { weapon: makePiece({ name: "Starter staff", category: "Staff", offensive: { magic: 30 } }) },
      }).getPlayerMaxMagicHit()
    ).toBe(8);

    const saradominStrike = { name: "Saradomin Strike", spellbook: "standard", max_hit: 20 };
    expect(
      makeCalc({
        spell: saradominStrike,
        equipment: { weapon: makePiece({ name: "Saradomin staff", category: "Staff", offensive: { magic: 30 } }) },
        buffs: { chargeSpell: true },
      }).getPlayerMaxMagicHit()
    ).toBe(20);
    expect(
      makeCalc({
        spell: saradominStrike,
        equipment: {
          weapon: makePiece({ name: "Saradomin staff", category: "Staff", offensive: { magic: 30 } }),
          cape: makePiece({ name: "Saradomin cape" }),
        },
        buffs: { chargeSpell: true },
      }).getPlayerMaxMagicHit()
    ).toBe(30);
    expect(
      makeCalc({
        spell: saradominStrike,
        equipment: {
          weapon: makePiece({ name: "Saradomin staff", category: "Staff", offensive: { magic: 30 } }),
          cape: makePiece({ name: "Zamorak cape" }),
        },
        buffs: { chargeSpell: true },
      }).getPlayerMaxMagicHit()
    ).toBe(20);
  });

  it("covers magic max-hit modifiers for smoke, amulets, black mask, rev, eye, chaos gauntlets, prayer, dragon hunter, and weakness", () => {
    const fireBlast = { name: "Fire Blast", spellbook: "standard", element: "fire", max_hit: 20 };
    const fireBolt = { name: "Fire Bolt", spellbook: "standard", element: "fire", max_hit: 12 };
    const hugeSpell = { name: "Fire Surge", spellbook: "standard", element: "fire", max_hit: 100 };

    expect(
      makeCalc({
        spell: fireBlast,
        equipment: { weapon: makePiece({ name: "Smoke battlestaff", category: "Staff", offensive: { magic: 30 } }) },
      }).getPlayerMaxMagicHit()
    ).toBe(22);

    const undeadMonster = { attributes: [MonsterAttribute.UNDEAD] };
    expect(
      makeCalc({ spell: fireBlast, equipment: { neck: makePiece({ name: "Salve amulet(ei)" }) } }, undeadMonster)
        .getPlayerMaxMagicHit()
    ).toBe(24);
    expect(
      makeCalc({ spell: fireBlast, equipment: { neck: makePiece({ name: "Salve amulet(i)" }) } }, undeadMonster)
        .getPlayerMaxMagicHit()
    ).toBe(23);
    expect(
      makeCalc({
        spell: fireBlast,
        equipment: { head: makePiece({ name: "Black mask (i)" }) },
        buffs: { onSlayerTask: true },
      }).getPlayerMaxMagicHit()
    ).toBe(23);

    const revenantMonster = { name: "Revenant dragon" };
    expect(
      makeCalc({ spell: fireBlast, equipment: { neck: makePiece({ name: "Amulet of avarice" }) } }, revenantMonster)
        .getPlayerMaxMagicHit()
    ).toBe(24);
    expect(
      makeCalc(
        {
          spell: fireBlast,
          equipment: { neck: makePiece({ name: "Amulet of avarice" }) },
          buffs: { forinthrySurge: true },
        },
        revenantMonster
      ).getPlayerMaxMagicHit()
    ).toBe(27);

    const thammaronPlain = makeCalc({
      spell: fireBlast,
      equipment: {
        weapon: makePiece({ name: "Thammaron's sceptre", category: "Staff", offensive: { magic: 30 } }),
      },
    }).getPlayerMaxMagicHit();
    const thammaronRev = makeCalc({
      spell: fireBlast,
      equipment: {
        weapon: makePiece({
          name: "Thammaron's sceptre",
          category: "Staff",
          version: "Charged",
          offensive: { magic: 30 },
        }),
      },
      buffs: { inWilderness: true },
    }).getPlayerMaxMagicHit();
    expect(thammaronPlain).toBe(25);
    expect(thammaronRev).toBe(37);

    expect(
      makeCalc(
        {
          spell: fireBlast,
          equipment: {
            weapon: makePiece({ name: "Dragon hunter wand", category: "Staff", offensive: { magic: 30 } }),
          },
        },
        { attributes: [MonsterAttribute.DRAGON] }
      ).getPlayerMaxMagicHit()
    ).toBe(28);

    expect(
      makeCalc({
        spell: fireBolt,
        equipment: {
          hands: makePiece({ name: "Chaos gauntlets" }),
        },
      }).getPlayerMaxMagicHit()
    ).toBe(15);

    expect(
      makeCalc({
        equipment: { weapon: makePiece({ name: "Eye of ayak", category: "Staff", offensive: { magic: 30 } }) },
      }).getPlayerMaxMagicHit()
    ).toBe(27);
    expect(
      makeCalc(
        {
          equipment: { weapon: makePiece({ name: "Eye of ayak", category: "Staff", offensive: { magic: 30 } }) },
        },
        {},
        { usingSpecialAttack: true }
      ).getPlayerMaxMagicHit()
    ).toBe(35);

    expect(makeCalc({ spell: hugeSpell, prayers: ["augury"] }).getPlayerMaxMagicHit()).toBe(104);
    expect(makeCalc({ spell: hugeSpell, prayers: ["steel_skin", "mystic_might", "augury"] }).getPlayerMaxMagicHit()).toBe(102);

    expect(
      makeCalc(
        {
          spell: fireBlast,
        },
        { weakness: { element: "fire", severity: 50 } }
      ).getPlayerMaxMagicHit()
    ).toBe(30);
  });

  it("covers sunfire min-hit, charged tomes, p2 warden min-max, respiratory min-hit, and accursed special max-hit", () => {
    const fireBlast = { name: "Fire Blast", spellbook: "standard", element: "fire", max_hit: 20 };
    const waterBlast = { name: "Water Blast", spellbook: "standard", element: "water", max_hit: 20 };
    const earthBlast = { name: "Earth Blast", spellbook: "standard", element: "earth", max_hit: 20 };

    const sunfireCalc = makeCalc({
      spell: fireBlast,
      buffs: { usingSunfireRunes: true },
      equipment: {
        shield: makePiece({ name: "Tome of fire", version: "Charged" }),
      },
    });
    expect(sunfireCalc.getMinAndMax()).toEqual([2, 22]);

    expect(
      makeCalc({
        spell: waterBlast,
        equipment: { shield: makePiece({ name: "Tome of water", version: "Charged" }) },
      }).getPlayerMaxMagicHit()
    ).toBe(22);
    expect(
      makeCalc({
        spell: earthBlast,
        equipment: { shield: makePiece({ name: "Tome of earth", version: "Charged" }) },
      }).getPlayerMaxMagicHit()
    ).toBe(22);

    const p2Calc = makeCalc({ spell: fireBlast }, { id: P2_WARDEN_IDS[0] });
    expect(p2Calc.getMinAndMax()).toEqual([3, 7]);
    expect(p2Calc.getHitChance()).toBe(1);

    expect(makeCalc({ spell: fireBlast }, { name: "Respiratory system" }).getMinAndMax()).toEqual([10, 20]);

    expect(
      makeCalc({
        equipment: {
          weapon: makePiece({ name: "Accursed sceptre", category: "Staff", offensive: { magic: 30 } }),
        },
      }).getPlayerMaxMagicHit()
    ).toBe(27);
    expect(
      makeCalc(
        {
          equipment: {
            weapon: makePiece({ name: "Accursed sceptre", category: "Staff", offensive: { magic: 30 } }),
          },
        },
        {},
        { usingSpecialAttack: true }
      ).getPlayerMaxMagicHit()
    ).toBe(40);
  });
});