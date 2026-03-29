import { describe, expect, it } from "vitest";

import {
  AttackDistribution,
  HitDistribution,
  Hitsplat,
  WeightedHit,
  multiplyTransformer,
} from "../dps-calc/dps-calc-hitdist";
import {
  diamondBolts,
  dragonstoneBolts,
  onyxBolts,
  opalBolts,
  rubyBolts,
} from "../dps-calc/dps-calc-bolts";
import { burningClawDoT, burningClawSpec, dClawDist } from "../dps-calc/dps-calc-claws";
import { PlayerVsNPCCalc, type CalcMonster, type CalcPlayer } from "../dps-calc/dps-calc-engine";
import { MonsterAttribute } from "../dps-calc/dps-calc-constants";

function sumProbability(hits: WeightedHit[]): number {
  return hits.reduce((acc, h) => acc + h.probability, 0);
}

function baseMonster(partial: Partial<CalcMonster> = {}): CalcMonster {
  return {
    id: 9001,
    name: "Training Dummy",
    skills: { atk: 1, str: 1, def: 1, magic: 1, ranged: 1, hp: 300 },
    defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
    offensive: { magic: 1 },
    attributes: [],
    inputs: { monsterCurrentHp: 300 },
    ...partial,
  };
}

function basePlayer(partial: Partial<CalcPlayer> = {}): CalcPlayer {
  return {
    skills: { atk: 99, str: 99, def: 99, ranged: 99, magic: 99, prayer: 99, hp: 99, mining: 99 },
    boosts: { atk: 0, str: 0, def: 0, ranged: 0, magic: 0, prayer: 0, hp: 0 },
    equipment: {
      weapon: {
        id: 2001,
        name: "Dragon claws",
        category: "Claw",
        speed: 4,
        bonuses: { str: 120, ranged_str: 0, magic_str: 0 },
        offensive: { stab: 0, slash: 120, crush: 0, ranged: 0, magic: 0 },
        defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
      },
      ammo: null,
    },
    style: { type: "slash", stance: "Aggressive" },
    spell: null,
    prayers: [],
    buffs: {
      onSlayerTask: false,
      inWilderness: false,
      chargeSpell: false,
      markOfDarkness: false,
      sunfireRunes: false,
      soulreaperStacks: 0,
      kandarinDiary: false,
      currentHp: 99,
      baAttackerLevel: 0,
    },
    bonuses: {},
    offensive: {},
    defensive: {},
    ...partial,
  };
}

describe("dps calc hitdist/bolts/claws heavy", () => {
  it("keeps inaccurate hits unchanged when transformInaccurate is false", () => {
    const dist = HitDistribution.single(0.5, [new Hitsplat(5)]);
    const transformed = dist.transform(multiplyTransformer(2), { transformInaccurate: false }).flatten();
    const inaccurate = transformed.hits.find((h) => !h.hitsplats[0]?.accurate);
    const accurate = transformed.hits.find((h) => h.hitsplats[0]?.accurate);

    expect(accurate?.hitsplats[0]?.damage).toBe(10);
    expect(inaccurate?.hitsplats[0]?.damage).toBe(0);
    expect(sumProbability(transformed.hits)).toBeCloseTo(1, 10);
  });

  it("zips attack distributions and emits a stable histogram", () => {
    const a = HitDistribution.linear(1, 0, 2);
    const b = HitDistribution.single(1, [new Hitsplat(1)]);
    const attack = new AttackDistribution([a, b]);
    const histogram = attack.asHistogram();
    const total = histogram.reduce((acc, row) => acc + row.value, 0);

    expect(attack.singleHitsplat.getMin()).toBe(1);
    expect(attack.singleHitsplat.getMax()).toBe(3);
    expect(total).toBeCloseTo(1, 10);
  });

  it("applies deterministic bolt special paths", () => {
    const baseCtx = {
      kandarinDiary: false,
      rangedLvl: 99,
      zcb: false,
      spec: false,
      maxHit: 50,
      monster: { id: 1, attributes: [], inputs: { monsterCurrentHp: 1000 }, skills: { hp: 1000 } },
    };

    const opalSpec = opalBolts({ ...baseCtx, zcb: true, spec: true })(new Hitsplat(10, true));
    expect(opalSpec.hits).toHaveLength(1);
    expect(opalSpec.hits[0]?.hitsplats[0]?.damage).toBe(21);

    const diamondSpec = diamondBolts({ ...baseCtx, zcb: true, spec: true })(new Hitsplat(8, true));
    const maxDiamond = Math.max(...diamondSpec.hits.filter((h) => h.probability > 0).map((h) => h.getSum()));
    expect(maxDiamond).toBe(Math.trunc((baseCtx.maxHit * 126) / 100));

    const dragonImmune = dragonstoneBolts({
      ...baseCtx,
      monster: { ...baseCtx.monster, attributes: [MonsterAttribute.FIERY] },
    })(new Hitsplat(12, true));
    expect(dragonImmune.hits).toHaveLength(1);
    expect(dragonImmune.hits[0]?.hitsplats[0]?.damage).toBe(12);

    const onyxUndead = onyxBolts({
      ...baseCtx,
      monster: { ...baseCtx.monster, attributes: [MonsterAttribute.UNDEAD] },
    })(new Hitsplat(14, true));
    expect(onyxUndead.hits).toHaveLength(1);
    expect(onyxUndead.hits[0]?.hitsplats[0]?.damage).toBe(14);

    const ruby = rubyBolts(baseCtx)(new Hitsplat(9, true));
    const rubyMax = Math.max(...ruby.hits.map((h) => h.getSum()));
    expect(rubyMax).toBe(100);
  });

  it("produces normalized claw distributions and monotonic burning DoT", () => {
    const dclaw = dClawDist(0.55, 40).dists[0];
    const bclaw = burningClawSpec(0.55, 40).dists[0];

    expect(sumProbability(dclaw.hits)).toBeCloseTo(1, 10);
    expect(sumProbability(bclaw.hits)).toBeCloseTo(1, 10);
    expect(dclaw.hits.some((h) => h.hitsplats.some((s) => !s.accurate))).toBe(true);
    expect(burningClawDoT(0)).toBe(0);
    expect(burningClawDoT(0.5)).toBeGreaterThan(0);
    expect(burningClawDoT(1)).toBeLessThan(burningClawDoT(0.5));
  });
});

describe("dps calc engine integration for claw/bolt paths", () => {
  it("uses dragon claw spec distribution and has no claw burn DoT", () => {
    const calc = new PlayerVsNPCCalc(basePlayer(), baseMonster(), { usingSpecialAttack: true });
    const dist = calc.getDistribution();

    expect(dist.dists).toHaveLength(1);
    expect(dist.dists[0]?.hits.some((h) => h.hitsplats.length === 4)).toBe(true);
    expect(calc.getDoTExpected()).toBe(0);
    expect(calc.getDoTMax()).toBe(0);
  });

  it("uses burning claws DoT model for expected burn damage", () => {
    const calc = new PlayerVsNPCCalc(
      basePlayer({
        equipment: {
          weapon: {
            id: 2002,
            name: "Burning claws",
            category: "Claw",
            speed: 4,
            bonuses: { str: 100, ranged_str: 0, magic_str: 0 },
            offensive: { stab: 0, slash: 100, crush: 0, ranged: 0, magic: 0 },
            defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
          },
          ammo: null,
        },
      }),
      baseMonster(),
      { usingSpecialAttack: true }
    );

    expect(calc.getDoTExpected()).toBeCloseTo(burningClawDoT(calc.getHitChance()), 10);
    expect(calc.getDoTMax()).toBe(29);
  });

  it("applies ruby bolt proc path in distribution", () => {
    const calc = new PlayerVsNPCCalc(
      basePlayer({
        equipment: {
          weapon: {
            id: 3001,
            name: "Rune crossbow",
            category: "Crossbow",
            speed: 5,
            bonuses: { str: 0, ranged_str: 0, magic_str: 0 },
            offensive: { stab: 0, slash: 0, crush: 0, ranged: 100, magic: 0 },
            defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
          },
          ammo: {
            id: 3002,
            name: "Ruby bolts (e)",
            bonuses: { ranged_str: 122 },
            offensive: {},
            defensive: {},
          },
        },
        style: { type: "ranged", stance: "Accurate" },
      }),
      baseMonster({ skills: { atk: 1, str: 1, def: 1, magic: 1, ranged: 1, hp: 500 }, inputs: { monsterCurrentHp: 500 } }),
      { usingSpecialAttack: false }
    );

    const normalMax = calc.getPlayerMaxRangedHit();
    const single = calc.getDistribution().singleHitsplat;
    expect(single.hits.some((h) => h.getSum() > normalMax)).toBe(true);
  });
});