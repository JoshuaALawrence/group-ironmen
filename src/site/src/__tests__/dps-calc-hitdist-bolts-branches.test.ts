import { describe, expect, it } from "vitest";

import {
  HitDistribution,
  Hitsplat,
  cappedRerollTransformer,
  divisionTransformer,
  flatAddTransformer,
  flatLimitTransformer,
  linearMinTransformer,
  multiplyTransformer,
} from "../dps-calc/dps-calc-hitdist";
import {
  diamondBolts,
  dragonstoneBolts,
  onyxBolts,
  opalBolts,
  pearlBolts,
  rubyBolts,
} from "../dps-calc/dps-calc-bolts";
import { MonsterAttribute } from "../dps-calc/dps-calc-constants";

type TestBoltContext = {
  kandarinDiary?: boolean;
  rangedLvl: number;
  zcb?: boolean;
  spec?: boolean;
  maxHit: number;
  monster: {
    id?: number;
    attributes?: Array<string | number>;
    inputs?: { monsterCurrentHp?: number };
    skills?: { hp?: number };
  };
};

function probabilityOf(dist: HitDistribution, damage: number, accurate = true): number {
  return dist
    .flatten()
    .hits.filter((hit) => hit.hitsplats[0]?.damage === damage && hit.hitsplats[0]?.accurate === accurate)
    .reduce((sum, hit) => sum + hit.probability, 0);
}

function totalProbability(dist: HitDistribution): number {
  return dist.flatten().hits.reduce((sum, hit) => sum + hit.probability, 0);
}

function maxDamage(dist: HitDistribution): number {
  return Math.max(...dist.flatten().hits.map((hit) => hit.hitsplats[0]?.damage ?? 0));
}

function baseBoltContext(overrides: Partial<TestBoltContext> = {}): TestBoltContext {
  const monster = {
    id: 1,
    attributes: [],
    inputs: { monsterCurrentHp: 500 },
    skills: { hp: 500 },
    ...(overrides.monster ?? {}),
  };

  return {
    kandarinDiary: false,
    rangedLvl: 99,
    zcb: false,
    spec: false,
    maxHit: 50,
    ...overrides,
    monster,
  };
}

describe("dps calc hitdist transformer branches", () => {
  it("clamps flat limits at both boundaries and can skip inaccurate transforms", () => {
    const low = flatLimitTransformer(7, 2)(new Hitsplat(1));
    const exactBoundary = flatLimitTransformer(7, 2)(new Hitsplat(2));
    const transformed = HitDistribution.single(0.4, [new Hitsplat(9)]).transform(flatLimitTransformer(7, 2), {
      transformInaccurate: false,
    });

    expect(probabilityOf(low, 2)).toBe(1);
    expect(probabilityOf(exactBoundary, 2)).toBe(1);
    expect(probabilityOf(transformed, 7)).toBeCloseTo(0.4, 10);
    expect(probabilityOf(transformed, 0, false)).toBeCloseTo(0.6, 10);
  });

  it("flattens repeated linear minimum outcomes around the cap boundary", () => {
    const transformed = linearMinTransformer(3, 1)(new Hitsplat(2));

    expect(transformed.flatten().size()).toBe(2);
    expect(probabilityOf(transformed, 1)).toBeCloseTo(0.25, 10);
    expect(probabilityOf(transformed, 2)).toBeCloseTo(0.75, 10);
    expect(totalProbability(transformed)).toBeCloseTo(1, 10);
  });

  it("rerolls only hits above the limit and keeps boundary hits unchanged", () => {
    const unchanged = cappedRerollTransformer(3, 4, 2)(new Hitsplat(3, false));
    const rerolled = cappedRerollTransformer(3, 2, 1)(new Hitsplat(8));

    expect(unchanged.hits).toHaveLength(1);
    expect(unchanged.hits[0]?.hitsplats[0]?.damage).toBe(3);
    expect(unchanged.hits[0]?.hitsplats[0]?.accurate).toBe(false);

    expect(probabilityOf(rerolled, 1)).toBeCloseTo(1 / 3, 10);
    expect(probabilityOf(rerolled, 2)).toBeCloseTo(1 / 3, 10);
    expect(probabilityOf(rerolled, 3)).toBeCloseTo(1 / 3, 10);
    expect(totalProbability(rerolled)).toBeCloseTo(1, 10);
  });

  it("applies multiplier, divider, and additive floors without over-raising tiny hits", () => {
    const scaled = multiplyTransformer(3, 2)(new Hitsplat(5));
    const flooredLarge = multiplyTransformer(1, 2, 4)(new Hitsplat(8));
    const flooredSmall = multiplyTransformer(1, 2, 4)(new Hitsplat(3));
    const divided = divisionTransformer(4, 2)(new Hitsplat(7));
    const added = flatAddTransformer(-10, 2)(new Hitsplat(5));

    expect(probabilityOf(scaled, 7)).toBe(1);
    expect(probabilityOf(flooredLarge, 4)).toBe(1);
    expect(probabilityOf(flooredSmall, 3)).toBe(1);
    expect(probabilityOf(divided, 2)).toBe(1);
    expect(probabilityOf(added, 2)).toBe(1);
  });
});

describe("dps calc bolt transform branches", () => {
  it("applies opal kandarin and zcb spec differences", () => {
    const normal = opalBolts(baseBoltContext())(new Hitsplat(10));
    const kandarin = opalBolts(baseBoltContext({ kandarinDiary: true }))(new Hitsplat(10));
    const spec = opalBolts(baseBoltContext({ zcb: true, spec: true }))(new Hitsplat(10));

    expect(probabilityOf(normal, 19)).toBeCloseTo(0.05, 10);
    expect(probabilityOf(normal, 10)).toBeCloseTo(0.95, 10);
    expect(probabilityOf(kandarin, 19)).toBeCloseTo(0.055, 10);
    expect(probabilityOf(spec, 21)).toBe(1);
  });

  it("changes pearl bolt bonus damage for fiery targets and zcb divisors", () => {
    const normal = pearlBolts(baseBoltContext())(new Hitsplat(5));
    const fiery = pearlBolts(baseBoltContext({ monster: { attributes: [MonsterAttribute.FIERY] } }))(new Hitsplat(5));
    const fieryZcb = pearlBolts(baseBoltContext({ zcb: true, monster: { attributes: [MonsterAttribute.FIERY] } }))(new Hitsplat(5));

    expect(probabilityOf(normal, 9)).toBeCloseTo(0.06, 10);
    expect(probabilityOf(fiery, 11)).toBeCloseTo(0.06, 10);
    expect(probabilityOf(fieryZcb, 12)).toBeCloseTo(0.06, 10);
  });

  it("uses diamond proc ranges for normal and zcb spec paths", () => {
    const normal = diamondBolts(baseBoltContext({ maxHit: 50 }))(new Hitsplat(7));
    const kandarin = diamondBolts(baseBoltContext({ kandarinDiary: true, maxHit: 50 }))(new Hitsplat(7));
    const spec = diamondBolts(baseBoltContext({ zcb: true, spec: true, maxHit: 50 }))(new Hitsplat(7));

    expect(maxDamage(normal)).toBe(57);
    expect(probabilityOf(normal, 0)).toBeCloseTo(0.1 / 58, 10);
    expect(probabilityOf(normal, 7)).toBeCloseTo(0.9 + 0.1 / 58, 10);
    expect(probabilityOf(kandarin, 7)).toBeCloseTo(0.89 + 0.11 / 58, 10);
    expect(maxDamage(spec)).toBe(63);
    expect(spec.flatten().size()).toBe(64);
    expect(probabilityOf(spec, 7)).toBeCloseTo(1 / 64, 10);
    expect(totalProbability(spec)).toBeCloseTo(1, 10);
  });

  it("blocks dragonstone effects on immune monsters and on inaccurate hits", () => {
    const fieryImmune = dragonstoneBolts(baseBoltContext({ monster: { attributes: [MonsterAttribute.FIERY] } }))(new Hitsplat(12));
    const dragonImmune = dragonstoneBolts(baseBoltContext({ monster: { attributes: [MonsterAttribute.DRAGON] } }))(new Hitsplat(12));
    const inaccurate = dragonstoneBolts(baseBoltContext())(new Hitsplat(0, false));
    const kandarin = dragonstoneBolts(baseBoltContext({ kandarinDiary: true }))(new Hitsplat(10));
    const spec = dragonstoneBolts(baseBoltContext({ zcb: true, spec: true }))(new Hitsplat(10));

    expect(probabilityOf(fieryImmune, 12)).toBe(1);
    expect(probabilityOf(dragonImmune, 12)).toBe(1);
    expect(probabilityOf(inaccurate, 0, false)).toBe(1);
    expect(probabilityOf(kandarin, 29)).toBeCloseTo(0.066, 10);
    expect(probabilityOf(spec, 32)).toBe(1);
  });

  it("blocks onyx effects for undead and inaccurate hits and widens zcb spec max", () => {
    const undead = onyxBolts(baseBoltContext({ monster: { attributes: [MonsterAttribute.UNDEAD] } }))(new Hitsplat(14));
    const inaccurate = onyxBolts(baseBoltContext())(new Hitsplat(0, false));
    const normal = onyxBolts(baseBoltContext({ maxHit: 50 }))(new Hitsplat(10));
    const spec = onyxBolts(baseBoltContext({ zcb: true, spec: true, maxHit: 50 }))(new Hitsplat(10));

    expect(probabilityOf(undead, 14)).toBe(1);
    expect(probabilityOf(inaccurate, 0, false)).toBe(1);
    expect(maxDamage(normal)).toBe(60);
    expect(probabilityOf(normal, 10)).toBeCloseTo(0.89 + 0.11 / 61, 10);
    expect(maxDamage(spec)).toBe(66);
    expect(spec.flatten().size()).toBe(67);
    expect(probabilityOf(spec, 10)).toBeCloseTo(1 / 67, 10);
  });

  it("enforces ruby hp fallbacks and normal versus zcb caps", () => {
    const capped = rubyBolts(baseBoltContext({ monster: { inputs: { monsterCurrentHp: 1000 }, skills: { hp: 1000 } } }))(new Hitsplat(9));
    const cappedZcb = rubyBolts(baseBoltContext({ zcb: true, monster: { inputs: { monsterCurrentHp: 1000 }, skills: { hp: 1000 } } }))(new Hitsplat(9));
    const kandarin = rubyBolts(baseBoltContext({ kandarinDiary: true, monster: { inputs: undefined, skills: { hp: 400 } } }))(new Hitsplat(9));
    const noHp = rubyBolts(baseBoltContext({ monster: { inputs: undefined, skills: undefined } }))(new Hitsplat(9));
    const spec = rubyBolts(baseBoltContext({ zcb: true, spec: true, monster: { inputs: { monsterCurrentHp: 1000 }, skills: { hp: 1000 } } }))(new Hitsplat(9));

    expect(probabilityOf(capped, 100)).toBeCloseTo(0.06, 10);
    expect(probabilityOf(cappedZcb, 110)).toBeCloseTo(0.06, 10);
    expect(probabilityOf(kandarin, 80)).toBeCloseTo(0.066, 10);
    expect(probabilityOf(noHp, 0)).toBeCloseTo(0.06, 10);
    expect(probabilityOf(spec, 110)).toBe(1);
  });
});