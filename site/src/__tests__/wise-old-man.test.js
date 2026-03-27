import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WiseOldMan } from "../data/wise-old-man.js";

describe("WiseOldMan", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches boss kc from the local API endpoint", async () => {
    const wom = new WiseOldMan();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        playerName: "zezima",
        updatedAt: "2026-03-26T00:00:00.000Z",
        profileUrl: "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=zezima",
        summary: [
          {
            metric: "clue_scrolls_all",
            label: "Clue completions",
            displayType: "score",
            score: 321,
            rank: 654,
          },
        ],
        bosses: [
          {
            metric: "zulrah",
            name: "Zulrah",
            kills: 50,
            rank: 123,
            ehb: 1.2,
          },
        ],
      }),
    });
    global.fetch = fetchMock;

    const result = await wom.getPlayerBossKc("zezima");

    expect(result.bosses[0].kills).toBe(50);
    expect(result.summary[0].displayType).toBe("score");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/wise-old-man/players/zezima/boss-kc", {
      headers: {
        Accept: "application/json",
      },
    });
  });

  it("surfaces server error messages", async () => {
    const wom = new WiseOldMan();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "zezima was not found on the OSRS hiscores.",
    });

    await expect(wom.getPlayerBossKc("zezima")).rejects.toThrow("zezima was not found on the OSRS hiscores.");
  });

  it("builds the public hiscore lookup url", () => {
    const wom = new WiseOldMan();

    expect(wom.playerProfileUrl("zezima")).toBe(
      "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=zezima"
    );
  });
});
