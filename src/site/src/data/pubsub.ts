type EventArgs = unknown[];
type Subscriber = (...args: EventArgs) => void;

class PubSub {
  subscribers: Map<string, Set<Subscriber>>;
  mostRecentPublish: Map<string, EventArgs>;

  constructor() {
    this.subscribers = new Map();
    this.mostRecentPublish = new Map();
  }

  subscribe(dataName: string, subscriber: Subscriber, receiveMostRecent = true): void {
    if (!this.subscribers.has(dataName)) {
      this.subscribers.set(dataName, new Set());
    }

    this.subscribers.get(dataName)?.add(subscriber);
    if (receiveMostRecent && this.mostRecentPublish.has(dataName)) {
      const mostRecentArgs = this.mostRecentPublish.get(dataName);
      if (mostRecentArgs) {
        subscriber(...mostRecentArgs);
      }
    }
  }

  unsubscribe(dataName: string, subscriber: Subscriber): void {
    if (!this.subscribers.has(dataName)) {
      return;
    }

    this.subscribers.get(dataName)?.delete(subscriber);
  }

  publish(dataName: string, ...args: EventArgs): void {
    this.mostRecentPublish.set(dataName, args);
    if (!this.subscribers.has(dataName)) {
      return;
    }

    for (const subscriber of this.subscribers.get(dataName) ?? []) {
      subscriber(...args);
    }
  }

  unpublishAll(): void {
    this.mostRecentPublish.clear();
  }

  unpublish(dataName: string): void {
    this.mostRecentPublish.delete(dataName);
  }

  getMostRecent(dataName: string): EventArgs | undefined {
    return this.mostRecentPublish.get(dataName);
  }

  anyoneListening(dataName: string): boolean {
    return this.subscribers.has(dataName) && (this.subscribers.get(dataName)?.size ?? 0) > 0;
  }

  waitUntilNextEvent(event: string, receiveMostRecent = true): Promise<void> {
    return new Promise((resolve) => {
      const subscriber = () => {
        this.unsubscribe(event, subscriber);
        resolve();
      };

      this.subscribe(event, subscriber, receiveMostRecent);
    });
  }

  waitForAllEvents(...events: string[]): Promise<void[]> {
    const waits: Array<Promise<void>> = [];
    for (const event of events) {
      waits.push(this.waitUntilNextEvent(event));
    }

    return Promise.all(waits);
  }
}

const pubsub = new PubSub();

export { pubsub };