import { describe, expect, it, vi } from "vitest";

import { GroupEventNotifier } from "../notifier";

describe("GroupEventNotifier", () => {
  it("tracks listener counts and supports unsubscribe closures", () => {
    const notifier = new GroupEventNotifier();
    const groupHandler = vi.fn();
    const otherHandler = vi.fn();

    const unsubscribeGroup = notifier.subscribe(1).on(groupHandler);
    const unsubscribeOther = notifier.subscribe(2).on(otherHandler);

    expect(notifier.activeListenerCount(1)).toBe(1);
    expect(notifier.activeListenerCount()).toBe(2);

    notifier.notifyGroup(1);
    notifier.notifyGroup(2);
    expect(groupHandler).toHaveBeenCalledTimes(1);
    expect(otherHandler).toHaveBeenCalledTimes(1);

    unsubscribeGroup();
    expect(notifier.activeListenerCount(1)).toBe(0);
    expect(notifier.activeListenerCount()).toBe(1);

    unsubscribeOther();
    expect(notifier.activeListenerCount()).toBe(0);
  });
});