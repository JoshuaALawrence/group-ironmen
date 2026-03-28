type IntervalCallback = () => void | Promise<void>;

class Utility {
  tagRegexp: RegExp;

  constructor() {
    this.tagRegexp = /<[^>]*>/gi;
  }

  callOnInterval(fn: IntervalCallback, interval: number, callImmediate = true): number {
    if (callImmediate) {
      void fn();
    }

    // This will space the calls by at least the interval time from the
    // end of the last call. This allows async methods to do their thing
    // without being called again while the previous one is still working.
    let nextCall = Date.now() + interval;
    return window.setInterval(async () => {
      const now = Date.now();
      if (now >= nextCall && document.visibilityState === "visible") {
        nextCall = Number.POSITIVE_INFINITY;

        try {
          await fn();
        } catch (error) {
          console.error(error);
        }

        nextCall = Date.now() + interval;
      }
    }, Math.max(interval / 10, 10));
  }

  formatShortQuantity(quantity: number): number | string {
    if (quantity >= 1000000000) {
      const billions = quantity / 1000000000;
      return (Math.floor(billions * 10) / 10).toFixed(1) + "B";
    }

    if (quantity >= 1000000) {
      return Math.floor(quantity / 1000000) + "M";
    }

    if (quantity >= 1000) {
      return Math.floor(quantity / 1000) + "K";
    }

    return quantity;
  }

  formatVeryShortQuantity(quantity: number): number | string {
    if (quantity >= 1000 && quantity < 100000) {
      return Math.floor(quantity / 1000) + "K";
    }

    return this.formatShortQuantity(quantity);
  }

  removeArticles(value: string): string {
    const articles = ["a", "the", "an"];
    const words = value.split(" ");
    if (words.length <= 1) {
      return value;
    }

    if (articles.includes(words[0].toLowerCase())) {
      return words.splice(1).join(" ");
    }

    return value;
  }

  timeSinceLastUpdate(lastUpdated: string | number | Date): number {
    const lastUpdatedDate = new Date(lastUpdated);
    const now = new Date();
    return now.getTime() - lastUpdatedDate.getTime();
  }

  throttle(fn: () => void, interval: number): () => void {
    let pause = false;

    return () => {
      if (pause) {
        return;
      }

      pause = true;

      window.setTimeout(() => {
        fn();
        pause = false;
      }, interval);
    };
  }

  setsEqual<T>(a: Set<T> | null | undefined, b: Set<T> | null | undefined): boolean {
    if (!a || !b) {
      return false;
    }

    return a.size === b.size && [...a].every((value) => b.has(value));
  }

  isBitSet(value: number, offset: number): boolean {
    const mask = 1 << offset;
    return (value & mask) !== 0;
  }

  average(values: number[]): number {
    let sum = 0;
    for (let index = 0; index < values.length; ++index) {
      sum += values[index];
    }

    return sum / values.length;
  }

  removeTags(value?: string | null): string | undefined {
    return value?.replace(this.tagRegexp, "");
  }
}

const utility = new Utility();

export { utility };