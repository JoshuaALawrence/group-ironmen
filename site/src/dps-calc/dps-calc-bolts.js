/**
 * Bolt effect transformers - 1:1 port from osrs-dps-calc bolts.ts
 */
import { Hitsplat, WeightedHit, HitDistribution } from "./dps-calc-hitdist.js";
import { MonsterAttribute } from "./dps-calc-constants.js";

const INFINITE_HEALTH_MONSTERS = []; // populated if needed

function kandarinFactor(ctx) {
  return ctx.kandarinDiary ? 1.1 : 1.0;
}

function bonusDamageTransform(ctx, chance, bonusDmg, accurateOnly) {
  return (h) => {
    if (h.accurate && ctx.zcb && ctx.spec) {
      return HitDistribution.single(1.0, [new Hitsplat(h.damage + bonusDmg)]);
    }
    if (!h.accurate && accurateOnly) {
      return new HitDistribution([new WeightedHit(1.0, [h])]);
    }
    return new HitDistribution([
      new WeightedHit(chance, [new Hitsplat(h.damage + bonusDmg, h.accurate)]),
      new WeightedHit(1 - chance, [new Hitsplat(h.damage, h.accurate)]),
    ]);
  };
}

export function opalBolts(ctx) {
  const chance = 0.05 * kandarinFactor(ctx);
  const bonusDmg = Math.trunc(ctx.rangedLvl / (ctx.zcb ? 9 : 10));
  return bonusDamageTransform(ctx, chance, bonusDmg, false);
}

export function pearlBolts(ctx) {
  const chance = 0.06 * kandarinFactor(ctx);
  const attrs = ctx.monster.attributes || [];
  const divisor = attrs.includes(MonsterAttribute.FIERY) ? 15 : 20;
  const bonusDmg = Math.trunc(ctx.rangedLvl / (ctx.zcb ? divisor - 2 : divisor));
  return bonusDamageTransform(ctx, chance, bonusDmg, false);
}

export function diamondBolts(ctx) {
  const chance = 0.1 * kandarinFactor(ctx);
  const effectMax = Math.trunc((ctx.maxHit * (ctx.zcb ? 126 : 115)) / 100);
  const effectDist = HitDistribution.linear(1.0, 0, effectMax);
  return (h) => {
    if (h.accurate && ctx.zcb && ctx.spec) {
      return effectDist;
    }
    return new HitDistribution([
      ...effectDist.scaleProbability(chance).hits,
      new WeightedHit(1 - chance, [new Hitsplat(h.damage, h.accurate)]),
    ]);
  };
}

export function dragonstoneBolts(ctx) {
  const attrs = ctx.monster.attributes || [];
  if (attrs.includes(MonsterAttribute.FIERY) || attrs.includes(MonsterAttribute.DRAGON)) {
    return (h) => new HitDistribution([new WeightedHit(1.0, [h])]);
  }
  const chance = 0.06 * kandarinFactor(ctx);
  const bonusDmg = Math.trunc((ctx.rangedLvl * 2) / (ctx.zcb ? 9 : 10));
  return bonusDamageTransform(ctx, chance, bonusDmg, true);
}

export function onyxBolts(ctx) {
  const attrs = ctx.monster.attributes || [];
  if (attrs.includes(MonsterAttribute.UNDEAD)) {
    return (h) => new HitDistribution([new WeightedHit(1.0, [h])]);
  }
  const chance = 0.11 * kandarinFactor(ctx);
  const effectMax = Math.trunc((ctx.maxHit * (ctx.zcb ? 132 : 120)) / 100);
  const effectDist = HitDistribution.linear(1.0, 0, effectMax);
  return (h) => {
    if (!h.accurate) {
      return new HitDistribution([new WeightedHit(1.0, [h])]);
    }
    if (ctx.zcb && ctx.spec) {
      return effectDist;
    }
    return new HitDistribution([
      ...effectDist.scaleProbability(chance).hits,
      new WeightedHit(1 - chance, [new Hitsplat(h.damage, h.accurate)]),
    ]);
  };
}

export function rubyBolts(ctx) {
  const chance = 0.06 * kandarinFactor(ctx);
  let cap;
  if (INFINITE_HEALTH_MONSTERS.includes(ctx.monster.id)) {
    cap = ctx.zcb ? 66 : 60;
  } else {
    cap = ctx.zcb ? 110 : 100;
  }
  const monHp = ctx.monster.inputs?.monsterCurrentHp || ctx.monster.skills?.hp || 1;
  const effectDmg = Math.trunc((monHp * (ctx.zcb ? 22 : 20)) / 100);
  const effectHit = HitDistribution.single(1.0, [new Hitsplat(Math.min(cap, effectDmg))]);
  return (h) => {
    if (h.accurate && ctx.zcb && ctx.spec) {
      return effectHit;
    }
    return new HitDistribution([
      ...effectHit.scaleProbability(chance).hits,
      new WeightedHit(1 - chance, [new Hitsplat(h.damage, h.accurate)]),
    ]);
  };
}
