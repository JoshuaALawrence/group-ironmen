import { EventEmitter } from 'events';

export class GroupEventNotifier {
  private _emitter: EventEmitter;

  constructor() {
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(0);
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
