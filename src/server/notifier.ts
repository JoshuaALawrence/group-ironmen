import { EventEmitter } from 'events';

export class GroupEventNotifier {
  private _emitter: EventEmitter;

  constructor() {
    this._emitter = new EventEmitter();
  }

  activeListenerCount(groupId?: number): number {
    if (typeof groupId === 'number') {
      return this._emitter.listenerCount(`group:${groupId}`);
    }

    return this._emitter.eventNames().reduce((count, eventName) => {
      return count + this._emitter.listenerCount(eventName);
    }, 0);
  }

  subscribe(groupId: number): { on: (cb: () => void) => () => void } {
    const key = `group:${groupId}`;
    return {
      on: (cb: () => void) => {
        this._emitter.on(key, cb);
        return () => { this._emitter.removeListener(key, cb); };
      },
    };
  }

  notifyGroup(groupId: number): void {
    this._emitter.emit(`group:${groupId}`);
  }
}
