const WISE_OLD_MAN_API_BASE_URL = "/api/wise-old-man";
const JAGEX_HISCORE_PLAYER_BASE_URL = "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json";

async function parseWiseOldManError(response: Response, playerName: string) {
  try {
    const text = await response.text();
    if (text.trim().length > 0) {
      return text;
    }
  } catch {}

  if (response.status === 404) {
    return `${playerName} was not found on the OSRS hiscores.`;
  }

  if (response.status === 429) {
    return "OSRS hiscore rate limit reached. Please try again in a minute.";
  }

  return `OSRS hiscore request failed with status ${response.status}.`;
}

class WiseOldMan {
  playerProfileUrl(playerName: string) {
    return `${JAGEX_HISCORE_PLAYER_BASE_URL}?player=${encodeURIComponent(playerName)}`;
  }

  async getPlayerBossKc(playerName: string) {
    const normalizedPlayerName = playerName?.trim();
    if (!normalizedPlayerName) {
      throw new Error("A player name is required.");
    }

    const response = await fetch(
      `${WISE_OLD_MAN_API_BASE_URL}/players/${encodeURIComponent(normalizedPlayerName)}/boss-kc`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(await parseWiseOldManError(response, normalizedPlayerName));
    }

    return response.json();
  }
}

const wiseOldMan = new WiseOldMan();

export { WiseOldMan, wiseOldMan };
