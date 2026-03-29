import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  validName: vi.fn(),
  getCachedWiseOldManPlayerBossKc: vi.fn(),
  upsertWiseOldManPlayerBossKc: vi.fn(),
  aggregateSkills: vi.fn(),
  applySkillsRetention: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    get: state.axiosGet,
  },
}));

vi.mock("../logger", () => ({
  default: {
    info: state.loggerInfo,
    error: state.loggerError,
  },
}));

vi.mock("../validators", () => ({
  validName: state.validName,
}));

vi.mock("../db", () => ({
  getCachedWiseOldManPlayerBossKc: state.getCachedWiseOldManPlayerBossKc,
  upsertWiseOldManPlayerBossKc: state.upsertWiseOldManPlayerBossKc,
  aggregateSkills: state.aggregateSkills,
  applySkillsRetention: state.applySkillsRetention,
}));

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
}

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

function summaryByMetric(summary: Array<{ metric: string } & Record<string, unknown>>) {
  return Object.fromEntries(summary.map((entry) => [entry.metric, entry]));
}

describe("external services", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.validName.mockReturnValue(true);
    state.getCachedWiseOldManPlayerBossKc.mockResolvedValue(null);
    state.upsertWiseOldManPlayerBossKc.mockResolvedValue(undefined);
    state.aggregateSkills.mockResolvedValue(undefined);
    state.applySkillsRetention.mockResolvedValue(undefined);
  });

  it("keeps the default GE cache JSON on fetch failure and refreshes it on restart", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval")
      .mockReturnValueOnce(101 as never)
      .mockReturnValueOnce(202 as never);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
    const ext = await import("../external-services");

    expect(ext.getGePricesJson()).toBe("{}");

    state.axiosGet.mockRejectedValueOnce(new Error("wiki down"));
    ext.startGeUpdater();
    await flushPromises();

    expect(ext.getGePricesJson()).toBe("{}");
    expect(state.loggerInfo).toHaveBeenCalledWith("Fetching latest ge prices");
    expect(state.loggerError).toHaveBeenCalledWith("Failed to fetch latest ge prices: wiki down");
    expect(setIntervalSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 14400 * 1000);

    state.axiosGet.mockResolvedValueOnce({
      data: {
        data: {
          1: { high: 120, low: 100 },
          2: { low: 50 },
          3: { high: 25 },
        },
      },
    });
    ext.startGeUpdater();
    await flushPromises();

    expect(clearIntervalSpy).toHaveBeenCalledWith(101);
    expect(setIntervalSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 14400 * 1000);
    expect(ext.getGePricesJson()).toBe('{"1":110,"2":50,"3":25}');

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("runs the skills aggregator and retention paths independently while replacing old intervals", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval")
      .mockReturnValueOnce(301 as never)
      .mockReturnValueOnce(302 as never);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
    const ext = await import("../external-services");

    state.aggregateSkills.mockRejectedValueOnce(new Error("agg failed"));
    state.applySkillsRetention.mockResolvedValueOnce(undefined);
    ext.startSkillsAggregator();
    await flushPromises();

    expect(state.loggerInfo).toHaveBeenCalledWith("Running skill aggregator");
    expect(state.loggerError).toHaveBeenCalledWith("Failed to aggregate skills: agg failed");
    expect(state.applySkillsRetention).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 1800 * 1000);

    state.aggregateSkills.mockResolvedValueOnce(undefined);
    state.applySkillsRetention.mockRejectedValueOnce(new Error("retention failed"));
    ext.startSkillsAggregator();
    await flushPromises();

    expect(clearIntervalSpy).toHaveBeenCalledWith(301);
    expect(state.aggregateSkills).toHaveBeenCalledTimes(2);
    expect(state.applySkillsRetention).toHaveBeenCalledTimes(2);
    expect(state.loggerError).toHaveBeenCalledWith("Failed to apply skills retention: retention failed");
    expect(setIntervalSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 1800 * 1000);

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("rejects invalid names and serves fresh cache hits without calling Jagex", async () => {
    const ext = await import("../external-services");

    state.validName.mockReturnValueOnce(false);
    let res = makeRes();
    await ext.handleGetWiseOldManPlayerBossKc({ params: { playerName: "@@bad" } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Provided player name is not valid");

    const cached = { schemaVersion: 3, bosses: [], summary: [] };
    state.getCachedWiseOldManPlayerBossKc.mockResolvedValueOnce(cached);
    res = makeRes();
    await ext.handleGetWiseOldManPlayerBossKc({ params: { playerName: "Alice" } } as never, res as never);

    expect(state.axiosGet).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.json).toHaveBeenCalledWith(cached);
  });

  it("transforms Jagex activities into boss and summary payloads after retrying reachable fallback branches", async () => {
    const ext = await import("../external-services");

    state.getCachedWiseOldManPlayerBossKc.mockResolvedValueOnce({ schemaVersion: 2 });
    state.axiosGet
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 429, data: {} })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          name: "   ",
          activities: [
            { name: "Clue Scrolls (All)", score: 999, rank: 30 },
            { name: "Clue Scrolls (Easy)", score: 5, rank: 10 },
            { name: "Clue Scrolls (Master)", score: 2, rank: 20 },
            { name: "LMS Rank", score: 7, rank: 44 },
            { name: "PvP Arena Rank", score: 12, rank: 55 },
            { name: "Rifts Closed", score: 8, rank: 66 },
            { name: "Bounty Hunter - Rogue", score: 6, rank: 77 },
            { name: "Soul Wars Zeal", score: -1, rank: 0 },
            { name: "Vorkath", score: 20, rank: 100 },
            { name: "Zulrah", score: 20, rank: 0 },
            { name: "Callisto", score: 20, rank: 90 },
            { name: "Vet'ion", score: 10, rank: -1 },
            { name: "Abyssal Sire", score: 0, rank: 9 },
          ],
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          activities: [
            { name: "League Points", score: 987, rank: 12 },
          ],
        },
      });

    const res = makeRes();
    await ext.handleGetWiseOldManPlayerBossKc({ params: { playerName: "Alice Bob" } } as never, res as never);

    expect(state.axiosGet).toHaveBeenCalledTimes(5);
    expect(state.axiosGet.mock.calls.map(([url]) => url)).toEqual([
      "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json",
      "https://services.runescape.com/m=hiscore_oldschool_ironman/index_lite.json",
      "https://services.runescape.com/m=hiscore_oldschool_hardcore_ironman/index_lite.json",
      "https://services.runescape.com/m=hiscore_oldschool_ultimate/index_lite.json",
      "https://services.runescape.com/m=hiscore_oldschool_seasonal/index_lite.json",
    ]);

    const payload = res.json.mock.calls[0][0];
    const summary = summaryByMetric(payload.summary);

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(payload.schemaVersion).toBe(3);
    expect(payload.playerName).toBe("Alice Bob");
    expect(payload.profileUrl).toBe(
      "https://services.runescape.com/m=hiscore_oldschool_ultimate/index_lite.json?player=Alice%20Bob"
    );
    expect(payload.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(summary.clue_scrolls_all.score).toBe(7);
    expect(summary.clue_scrolls_all.rank).toBe(30);
    expect(summary.league_points.score).toBe(987);
    expect(summary.league_points.rank).toBe(12);
    expect(summary.last_man_standing.score).toBe(7);
    expect(summary.last_man_standing.rank).toBe(44);
    expect(summary.pvp_arena.score).toBe(12);
    expect(summary.pvp_arena.rank).toBe(55);
    expect(summary.guardians_of_the_rift.score).toBe(8);
    expect(summary.bounty_hunter_rogue.score).toBe(6);
    expect(summary.soul_wars_zeal.score).toBeUndefined();
    expect(summary.soul_wars_zeal.rank).toBeUndefined();
    expect(summary.collections_logged.score).toBeUndefined();
    expect(payload.bosses).toEqual([
      { metric: "callisto", name: "Callisto", kills: 20, rank: 90 },
      { metric: "vorkath", name: "Vorkath", kills: 20, rank: 100 },
      { metric: "zulrah", name: "Zulrah", kills: 20 },
      { metric: "vet_ion", name: "Vet'ion", kills: 10 },
    ]);

    expect(state.upsertWiseOldManPlayerBossKc).toHaveBeenCalledTimes(1);
    expect(state.upsertWiseOldManPlayerBossKc.mock.calls[0][0]).toBe("alice bob");
    expect(state.upsertWiseOldManPlayerBossKc.mock.calls[0][1]).toEqual(payload);
    expect(state.upsertWiseOldManPlayerBossKc.mock.calls[0][2]).toBeInstanceOf(Date);
  });

  it("falls back to clue_scrolls_all when tier-specific clue scores are absent", async () => {
    const ext = await import("../external-services");

    state.axiosGet
      .mockResolvedValueOnce({
        status: 200,
        data: {
          name: "  Display Name  ",
          activities: [
            { name: "Clue Scrolls (All)", score: 321, rank: 17 },
          ],
        },
      })
      .mockResolvedValueOnce({ status: 404, data: {} });

    const res = makeRes();
    await ext.handleGetWiseOldManPlayerBossKc({ params: { playerName: "Display Name" } } as never, res as never);

    const payload = res.json.mock.calls[0][0];
    const summary = summaryByMetric(payload.summary);

    expect(payload.playerName).toBe("Display Name");
    expect(payload.profileUrl).toBe(
      "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=Display%20Name"
    );
    expect(summary.clue_scrolls_all.score).toBe(321);
    expect(summary.clue_scrolls_all.rank).toBe(17);
    expect(summary.league_points.score).toBeUndefined();
  });

  it("returns 404 when every primary Jagex endpoint misses", async () => {
    const ext = await import("../external-services");

    state.axiosGet
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 404, data: {} });

    const res = makeRes();
    await ext.handleGetWiseOldManPlayerBossKc({ params: { playerName: "Missing" } } as never, res as never);

    expect(state.axiosGet).toHaveBeenCalledTimes(4);
    expect(state.upsertWiseOldManPlayerBossKc).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith("Player was not found on the OSRS hiscores.");
  });
});