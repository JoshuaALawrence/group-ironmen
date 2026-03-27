/**
 * Hit Distribution System - 1:1 port from osrs-dps-calc HitDist.ts
 * Handles probabilistic hit distribution calculations for DPS.
 */

export class Hitsplat {
  constructor(damage, accurate = true) {
    this.damage = damage;
    this.accurate = accurate;
  }

  transform(t, opts = DEFAULT_TRANSFORM_OPTS) {
    if (!this.accurate && !opts.transformInaccurate) {
      return new HitDistribution([new WeightedHit(1.0, [this])]);
    }
    return t(this);
  }
}

Hitsplat.INACCURATE = new Hitsplat(0, false);

export const DEFAULT_TRANSFORM_OPTS = { transformInaccurate: true };

export class WeightedHit {
  constructor(probability, hitsplats) {
    this.probability = probability;
    this.hitsplats = hitsplats;
    this._sum = undefined;
  }

  scale(factor) {
    return new WeightedHit(this.probability * factor, [...this.hitsplats]);
  }

  zip(other) {
    return new WeightedHit(this.probability * other.probability, [...this.hitsplats, ...other.hitsplats]);
  }

  shift() {
    return [new WeightedHit(this.probability, [this.hitsplats[0]]), new WeightedHit(1.0, this.hitsplats.slice(1))];
  }

  transform(t, opts = DEFAULT_TRANSFORM_OPTS) {
    if (this.hitsplats.length === 1) {
      return this.hitsplats[0].transform(t, opts).scaleProbability(this.probability);
    }
    const [head, tail] = this.shift();
    return head.transform(t, opts).zip(tail.transform(t, opts));
  }

  anyAccurate() {
    return this.hitsplats.some((h) => h.accurate);
  }

  getSum() {
    if (this._sum === undefined) {
      this._sum = this.hitsplats.reduce((acc, h) => acc + h.damage, 0);
    }
    return this._sum;
  }

  getExpectedValue() {
    return this.probability * this.getSum();
  }

  getHash() {
    let acc = 0;
    for (const hitsplat of this.hitsplats) {
      acc <<= 8;
      acc |= hitsplat.damage;
      acc <<= 1;
      acc |= hitsplat.accurate ? 1 : 0;
    }
    return acc;
  }
}

export class HitDistribution {
  constructor(hits) {
    this.hits = hits;
  }

  addHit(w) {
    this.hits.push(w);
  }

  zip(other) {
    const result = [];
    for (const a of this.hits) {
      for (const b of other.hits) {
        result.push(a.zip(b));
      }
    }
    return new HitDistribution(result);
  }

  transform(t, opts = DEFAULT_TRANSFORM_OPTS) {
    const d = new HitDistribution([]);
    for (const h of this.hits) {
      for (const transformed of h.transform(t, opts).hits) {
        d.addHit(transformed);
      }
    }
    return d.flatten();
  }

  scaleProbability(factor) {
    return new HitDistribution(this.hits.map((h) => h.scale(factor)));
  }

  scaleDamage(factor, divisor = 1) {
    return new HitDistribution(
      this.hits.map(
        (h) =>
          new WeightedHit(
            h.probability,
            h.hitsplats.map((s) => new Hitsplat(Math.trunc((s.damage * factor) / divisor), s.accurate))
          )
      )
    );
  }

  flatten() {
    const acc = new Map();
    const hitLists = new Map();
    for (const hit of this.hits) {
      const hash = hit.getHash();
      const prev = acc.get(hash);
      if (prev === undefined) {
        acc.set(hash, hit.probability);
        hitLists.set(hash, hit.hitsplats);
      } else {
        acc.set(hash, prev + hit.probability);
      }
    }
    const d = new HitDistribution([]);
    for (const [hash, prob] of acc.entries()) {
      if (prob > 0) {
        d.addHit(new WeightedHit(prob, hitLists.get(hash)));
      }
    }
    return d;
  }

  cumulative() {
    const d = new HitDistribution([]);
    const acc = new Map();
    for (const hit of this.hits) {
      const key = hit.anyAccurate() ? hit.getSum() : ~hit.getSum();
      const prev = acc.get(key);
      if (prev === undefined) {
        acc.set(key, hit.probability);
      } else {
        acc.set(key, prev + hit.probability);
      }
    }
    for (const [key, prob] of acc.entries()) {
      const accurate = key >= 0;
      const dmg = accurate ? key : ~key;
      if (prob > 0) {
        d.addHit(new WeightedHit(prob, [new Hitsplat(dmg, accurate)]));
      }
    }
    return d;
  }

  expectedHit() {
    return this.hits.reduce((s, h) => s + h.getExpectedValue(), 0);
  }

  size() {
    return this.hits.length;
  }

  getMin() {
    let m = Infinity;
    for (const h of this.hits) {
      m = Math.min(m, h.getSum());
    }
    return m;
  }

  getMax() {
    let m = -Infinity;
    for (const h of this.hits) {
      m = Math.max(m, h.getSum());
    }
    return m;
  }

  withProbabilisticDelays(delayProvider) {
    const hits = [];
    this.hits.forEach((wh) => {
      const delays = delayProvider(wh);
      delays.forEach(([probability, delay]) =>
        hits.push([new WeightedHit(wh.probability * probability, [new Hitsplat(wh.getSum(), wh.anyAccurate())]), delay])
      );
    });

    const acc = new Map();
    for (const [wh, delay] of hits) {
      const key = (wh.getSum() & 0xffffff) | (delay << 24);
      const prev = acc.get(key);
      if (prev === undefined) {
        acc.set(key, wh.probability);
      } else {
        acc.set(key, prev + wh.probability);
      }
    }

    const d = [];
    for (const [key, prob] of acc.entries()) {
      const delay = (key & 0x8f000000) >> 24;
      const dmg = key & 0xffffff;
      d.push([new WeightedHit(prob, [new Hitsplat(dmg, true)]), delay]);
    }
    return d;
  }

  static linear(accuracy, minimum, maximum) {
    const d = new HitDistribution([]);
    const hitProb = accuracy / (maximum - minimum + 1);
    for (let i = minimum; i <= maximum; i++) {
      d.addHit(new WeightedHit(hitProb, [new Hitsplat(i)]));
    }
    d.addHit(new WeightedHit(1 - accuracy, [Hitsplat.INACCURATE]));
    return d;
  }

  static single(accuracy, hitsplats) {
    const d = new HitDistribution([new WeightedHit(accuracy, hitsplats)]);
    if (accuracy !== 1.0) {
      d.addHit(new WeightedHit(1 - accuracy, [Hitsplat.INACCURATE]));
    }
    return d;
  }
}

export class AttackDistribution {
  constructor(dists) {
    this.dists = dists;
    this._zipped = undefined;
    this._singleHitsplat = undefined;
  }

  get zipped() {
    if (!this._zipped) {
      this._zipped = this.dists.reduce((prev, curr) => prev.zip(curr));
    }
    return this._zipped;
  }

  get singleHitsplat() {
    if (!this._singleHitsplat) {
      this._singleHitsplat = this.zipped.cumulative();
    }
    return this._singleHitsplat;
  }

  addDist(d) {
    this.dists.push(d);
  }

  transform(t, opts = DEFAULT_TRANSFORM_OPTS) {
    return this._map((d) => d.transform(t, opts));
  }

  flatten() {
    return this._map((d) => d.flatten());
  }

  scaleProbability(factor) {
    return this._map((d) => d.scaleProbability(factor));
  }

  scaleDamage(factor, divisor = 1) {
    return this._map((d) => d.scaleDamage(factor, divisor));
  }

  getMin() {
    return this.dists.reduce((s, d) => s + d.getMin(), 0) || 0;
  }

  getMax() {
    return this.dists.reduce((s, d) => s + d.getMax(), 0) || 0;
  }

  getExpectedDamage() {
    return this.dists.reduce((s, d) => s + d.expectedHit(), 0) || 0;
  }

  asHistogram() {
    const dist = this.singleHitsplat;
    const hitMap = new Map();
    dist.hits.forEach((h) => {
      hitMap.set(h.getSum(), (hitMap.get(h.getSum()) || 0) + h.probability);
    });
    const ret = [];
    const maxVal = dist.getMax();
    for (let i = 0; i <= maxVal; i++) {
      const prob = hitMap.get(i);
      ret.push({ name: i.toString(), value: prob === undefined ? 0 : prob });
    }
    return ret;
  }

  _map(m) {
    return new AttackDistribution(this.dists.map(m));
  }
}

// ── Hit Transformers ──

export function flatLimitTransformer(maximum, minimum = 0) {
  return (h) =>
    new HitDistribution([
      new WeightedHit(1.0, [new Hitsplat(Math.max(minimum, Math.min(h.damage, maximum)), h.accurate)]),
    ]);
}

export function linearMinTransformer(maximum, offset = 0) {
  return (h) => {
    const d = new HitDistribution([]);
    const prob = 1.0 / (maximum + 1);
    for (let i = 0; i <= maximum; i++) {
      d.addHit(new WeightedHit(prob, [new Hitsplat(Math.min(h.damage, i + offset), h.accurate)]));
    }
    return d.flatten();
  };
}

export function cappedRerollTransformer(limit, rollMax, offset = 0) {
  return (h) => {
    if (h.damage <= limit) {
      return new HitDistribution([new WeightedHit(1.0, [h])]);
    }
    const d = new HitDistribution([]);
    const prob = 1.0 / (rollMax + 1);
    for (let i = 0; i <= rollMax; i++) {
      d.addHit(new WeightedHit(prob, [new Hitsplat(h.damage > limit ? i + offset : h.damage, h.accurate)]));
    }
    return d.flatten();
  };
}

export function multiplyTransformer(numerator, divisor = 1, minimum = 0) {
  return (h) => {
    let dmg = Math.trunc((numerator * h.damage) / divisor);
    if (minimum !== 0) {
      if (h.damage >= minimum) {
        dmg = Math.max(minimum, dmg);
      } else {
        dmg = Math.max(h.damage, dmg);
      }
    }
    return new HitDistribution([new WeightedHit(1.0, [new Hitsplat(dmg, h.accurate)])]);
  };
}

export function divisionTransformer(divisor, minimum = 0) {
  return multiplyTransformer(1, divisor, minimum);
}

export function flatAddTransformer(addend, minimum = 0) {
  return (h) =>
    new HitDistribution([new WeightedHit(1.0, [new Hitsplat(Math.max(minimum, h.damage + addend), h.accurate)])]);
}
