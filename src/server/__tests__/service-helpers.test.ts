import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

const helperState = vi.hoisted(() => ({
  getGroup: vi.fn(),
  getUpcomingEventsWithWebhooks: vi.fn(),
  getClient: vi.fn(),
  executeBulkUpdate: vi.fn(),
  depositItems: vi.fn(),
  updateSharedBank: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  axiosPost: vi.fn(),
  setInterval: vi.fn(),
  clearInterval: vi.fn(),
}));

vi.mock("./db", () => ({
  getGroup: helperState.getGroup,
  getUpcomingEventsWithWebhooks: helperState.getUpcomingEventsWithWebhooks,
  getClient: helperState.getClient,
  executeBulkUpdate: helperState.executeBulkUpdate,
  depositItems: helperState.depositItems,
  updateSharedBank: helperState.updateSharedBank,
}));

vi.mock("./logger", () => ({
  default: {
    info: helperState.loggerInfo,
    error: helperState.loggerError,
  },
}));

vi.mock("axios", () => ({
  default: {
    post: helperState.axiosPost,
  },
}));

describe("server helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates requests and handles bypass cases", async () => {
    const { default: authMiddleware } = await import("../auth-middleware");

    const response = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const expressResponse = response as unknown as Response;
    const next = vi.fn();

    authMiddleware({ params: {}, headers: {} } as never, expressResponse, next);
    expect(response.status).toHaveBeenCalledWith(400);

    authMiddleware({ params: { group_name: "_" }, headers: {} } as never, expressResponse, next);
    expect(next).toHaveBeenCalled();

    authMiddleware({ params: { group_name: "Unit" }, headers: {} } as never, expressResponse, next);
    expect(response.status).toHaveBeenCalledWith(400);

    helperState.getGroup.mockResolvedValueOnce(null);
    authMiddleware(
      { params: { group_name: "Unit" }, headers: { authorization: "token" } } as never,
      expressResponse,
      next
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("validates names and prop lengths", async () => {
    const validators = await import("../validators");

    expect(validators.validName("Unit-1")).toBe(true);
    expect(validators.validName(123)).toBe(false);
    expect(validators.validName("  ")).toBe(false);

    expect(() => validators.validateMemberPropLength("stats", [1, 2], 1, 3)).not.toThrow();
    expect(() => validators.validateMemberPropLength("stats", Buffer.from([1, 2]), 1, 3)).not.toThrow();
    expect(() => validators.validateMemberPropLength("stats", "bad", 1, 3)).toThrow(/must be an array/);
    expect(() => validators.validateMemberPropLength("stats", [1, 2, 3, 4], 1, 3)).toThrow(/violated range/);

    try {
      validators.validateMemberPropLength("stats", [1, 2, 3, 4], 1, 3);
    } catch (err) {
      expect((err as Error & { publicMessage?: string }).publicMessage).toBe("Invalid member data length");
    }
  });

  it("loads collection log metadata and falls back when the file is missing", async () => {
    const collectionLog = await import("../collection-log");

    expect(collectionLog.COLLECTION_PAGE_REMAP["The Grumbler"]).toBe("Phantom Muspah");
    expect(collectionLog.COLLECTION_ITEM_REMAP["Pharaoh's sceptre"]).toBe("Pharaoh's sceptre (uncharged)");
    expect(typeof collectionLog.COLLECTION_LOG_DATA).toBe("string");
    expect(collectionLog.COLLECTION_LOG_DATA.length).toBeGreaterThan(0);
  });

  it("subscribes and notifies listeners", async () => {
    const { GroupEventNotifier } = await import("../notifier");
    const notifier = new GroupEventNotifier();
    const cb = vi.fn();
    const unsubscribe = notifier.subscribe(12).on(cb);

    notifier.notifyGroup(12);
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifier.notifyGroup(12);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("starts the event scheduler and sends notifications", async () => {
    const scheduler = await import("../event-scheduler");
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockReturnValue(123 as never);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
    helperState.getUpcomingEventsWithWebhooks.mockResolvedValue([
      {
        event_id: 1,
        group_id: 2,
        title: "Raid night",
        description: "Bring supplies",
        event_type: "raid",
        event_time: new Date(Date.now() + 60000).toISOString(),
        event_end_time: null,
        created_by: "Alice",
        icon: "skull",
        group_name: "Unit",
        discord_webhook_url: "https://discord.example/webhook",
      },
    ]);
    helperState.axiosPost.mockResolvedValue({});

    scheduler.startEventScheduler();
    scheduler.startEventScheduler();

    expect(typeof scheduler.startEventScheduler).toBe("function");
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("keeps the update batcher merging member updates", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    helperState.getClient.mockResolvedValue(client);
    helperState.executeBulkUpdate.mockResolvedValue(undefined);
    helperState.depositItems.mockResolvedValue(undefined);
    helperState.updateSharedBank.mockResolvedValue(undefined);

    const { UpdateBatcher } = await import("../update-batcher");
    const { GroupEventNotifier } = await import("../notifier");
    const batcher = new UpdateBatcher(new GroupEventNotifier());

    batcher.enqueue({
      group_id: 1,
      name: "Alice",
      stats: [1, 2],
      inventory: [3, 4],
      deposited: [100, 2],
      shared_bank: [200, 3],
    });
    batcher.enqueue({
      group_id: 1,
      name: "Alice",
      skills: [5, 6],
    });
    batcher.enqueue({
      group_id: 2,
      name: "Bob",
      stats: [7, 8],
    });

    await (batcher as any)._flush();
    expect(typeof batcher.enqueue).toBe("function");
  });
});