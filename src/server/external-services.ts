import { Request, Response } from 'express';
import axios from 'axios';
import logger from './logger';
import * as db from './db';
import { validName } from './validators';

const JAGEX_HISCORE_USER_AGENT = 'Group Ironmen - Dprk#8740';
const JAGEX_HISCORE_CACHE_TTL_SECONDS = 5 * 60;
const WISE_OLD_MAN_PLAYER_BOSS_KC_SCHEMA_VERSION = 3;

const PRIMARY_JAGEX_HISCORE_ENDPOINTS: [string, string][] = [
  ['normal', 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json'],
  ['ironman', 'https://services.runescape.com/m=hiscore_oldschool_ironman/index_lite.json'],
  ['hardcore_ironman', 'https://services.runescape.com/m=hiscore_oldschool_hardcore_ironman/index_lite.json'],
  ['ultimate_ironman', 'https://services.runescape.com/m=hiscore_oldschool_ultimate/index_lite.json'],
];
const SEASONAL_JAGEX_HISCORE_ENDPOINT: [string, string] = [
  'seasonal',
  'https://services.runescape.com/m=hiscore_oldschool_seasonal/index_lite.json',
];

const WISE_OLD_MAN_CLUE_SCROLL_METRICS = [
  'clue_scrolls_beginner', 'clue_scrolls_easy', 'clue_scrolls_medium',
  'clue_scrolls_hard', 'clue_scrolls_elite', 'clue_scrolls_master',
];

interface ActivitySummarySpec {
  metric: string;
  label: string;
  displayType: string;
}

const WISE_OLD_MAN_ACTIVITY_SUMMARY_SPECS: ActivitySummarySpec[] = [
  { metric: 'clue_scrolls_all', label: 'Clue completions', displayType: 'score' },
  { metric: 'league_points', label: 'League points', displayType: 'score' },
  { metric: 'last_man_standing', label: 'LMS rank', displayType: 'rank' },
  { metric: 'soul_wars_zeal', label: 'Soul Wars zeal', displayType: 'score' },
  { metric: 'guardians_of_the_rift', label: 'Rifts closed', displayType: 'score' },
  { metric: 'colosseum_glory', label: 'Colosseum glory', displayType: 'score' },
  { metric: 'collections_logged', label: 'Collections logged', displayType: 'score' },
  { metric: 'bounty_hunter_rogue', label: 'Bounty Hunter rogue', displayType: 'score' },
  { metric: 'bounty_hunter_hunter', label: 'Bounty Hunter', displayType: 'score' },
  { metric: 'pvp_arena', label: 'PvP Arena rank', displayType: 'rank' },
];

const NON_BOSS_METRICS = new Set([
  'grid_points', 'league_points', 'deadman_points',
  'bounty_hunter_hunter', 'bounty_hunter_rogue',
  'bounty_hunter_legacy_hunter', 'bounty_hunter_legacy_rogue',
  'clue_scrolls_all', 'clue_scrolls_beginner', 'clue_scrolls_easy',
  'clue_scrolls_medium', 'clue_scrolls_hard', 'clue_scrolls_elite',
  'clue_scrolls_master', 'last_man_standing', 'pvp_arena',
  'soul_wars_zeal', 'guardians_of_the_rift', 'colosseum_glory', 'collections_logged',
]);

// ── GE Prices ──

let gePricesJson = '{}';

interface NormalizedActivity {
  metric: string;
  score: number;
  rank: number;
}

interface JagexActivity {
  name: string;
  score: number;
  rank: number;
}

function encodePlayerNameForUrl(playerName: string): string {
  return playerName.replace(/ /g, '%20');
}

function jagexHiscoreProfileUrl(baseUrl: string, playerName: string): string {
  return `${baseUrl}?player=${encodePlayerNameForUrl(playerName)}`;
}

function normalizeMetricName(name: string): string {
  let metric = '';
  let lastWasSeparator = true;

  for (const ch of name) {
    let normalized: string | null;
    if (ch === '&') {
      normalized = 'and';
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      normalized = ch.toLowerCase();
    } else {
      normalized = null;
    }

    if (normalized !== null) {
      if (metric.length > 0 && lastWasSeparator) {
        metric += '_';
      }
      metric += normalized;
      lastWasSeparator = false;
    } else {
      lastWasSeparator = true;
    }
  }

  const remap: Record<string, string> = {
    'lms_rank': 'last_man_standing',
    'pvp_arena_rank': 'pvp_arena',
    'rifts_closed': 'guardians_of_the_rift',
  };
  return remap[metric] || metric;
}

function normalizeJagexActivityMap(activities: JagexActivity[]): Record<string, NormalizedActivity> {
  const result: Record<string, NormalizedActivity> = {};
  for (const activity of activities) {
    const metric = normalizeMetricName(activity.name);
    result[metric] = { metric, score: activity.score, rank: activity.rank };
  }
  return result;
}

function normalizedActivityScore(activity: NormalizedActivity | undefined): number | null {
  if (!activity) return null;
  return activity.score >= 0 ? activity.score : null;
}

function resolveClueCompletionScore(activities: Record<string, NormalizedActivity>): number | null {
  let totalScore = 0;
  let hasTierScore = false;
  for (const metric of WISE_OLD_MAN_CLUE_SCROLL_METRICS) {
    const score = normalizedActivityScore(activities[metric]);
    if (score != null) {
      totalScore += score;
      hasTierScore = true;
    }
  }
  return hasTierScore ? totalScore : normalizedActivityScore(activities['clue_scrolls_all']);
}

function normalizeBossEntries(activities: JagexActivity[]) {
  const entries: Array<{ metric: string; name: string; kills: number; rank?: number }> = [];
  for (const activity of activities) {
    const metric = normalizeMetricName(activity.name);
    if (NON_BOSS_METRICS.has(metric) || activity.score <= 0) continue;
    entries.push({
      metric,
      name: activity.name,
      kills: activity.score,
      rank: activity.rank > 0 ? activity.rank : undefined,
    });
  }
  entries.sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
  return entries;
}

function normalizeActivitySummaryEntries(activities: Record<string, NormalizedActivity>) {
  return WISE_OLD_MAN_ACTIVITY_SUMMARY_SPECS.map((spec) => {
    const activity = activities[spec.metric];
    const score = spec.metric === 'clue_scrolls_all'
      ? resolveClueCompletionScore(activities)
      : normalizedActivityScore(activity);
    const rank = activity && activity.rank > 0 ? activity.rank : undefined;
    return {
      metric: activity ? activity.metric : spec.metric,
      label: spec.label,
      displayType: spec.displayType,
      score: score != null ? score : undefined,
      rank,
    };
  });
}

interface JagexPlayerData {
  name?: string;
  activities?: JagexActivity[];
}

function buildWiseOldManPlayerBossKc(
  player: JagexPlayerData,
  seasonalPlayer: JagexPlayerData | null,
  playerName: string,
  profileUrl: string
) {
  const activities = normalizeJagexActivityMap(player.activities || []);

  if (seasonalPlayer) {
    const slp = (seasonalPlayer.activities || []).find(
      (a) => normalizeMetricName(a.name) === 'league_points'
    );
    if (slp) {
      activities['league_points'] = {
        metric: 'league_points',
        score: slp.score,
        rank: slp.rank,
      };
    }
  }

  const bosses = normalizeBossEntries(player.activities || []);
  const summary = normalizeActivitySummaryEntries(activities);

  return {
    schemaVersion: WISE_OLD_MAN_PLAYER_BOSS_KC_SCHEMA_VERSION,
    playerName: (player.name || '').trim() || playerName,
    updatedAt: new Date().toISOString(),
    profileUrl,
    summary,
    bosses,
  };
}

async function fetchJagexHiscoreResponse(playerName: string): Promise<[JagexPlayerData, string] | null> {
  for (const [, endpointUrl] of PRIMARY_JAGEX_HISCORE_ENDPOINTS) {
    try {
      const res = await axios.get(endpointUrl, {
        params: { player: playerName },
        headers: {
          Accept: 'application/json',
          'User-Agent': JAGEX_HISCORE_USER_AGENT,
        },
        validateStatus: (s) => s < 500,
      });
      if (res.status === 404) continue;
      if (res.status >= 400) continue;
      return [res.data, endpointUrl];
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchSeasonalJagexHiscoreResponse(playerName: string): Promise<JagexPlayerData | null> {
  try {
    const res = await axios.get(SEASONAL_JAGEX_HISCORE_ENDPOINT[1], {
      params: { player: playerName },
      headers: {
        Accept: 'application/json',
        'User-Agent': JAGEX_HISCORE_USER_AGENT,
      },
      validateStatus: (s) => s < 500,
    });
    if (res.status === 404) return null;
    if (res.status >= 400) return null;
    return res.data;
  } catch {
    return null;
  }
}

async function fetchLatestPrices(): Promise<{ data: Record<string, { high?: number; low?: number }> }> {
  const res = await axios.get('https://prices.runescape.wiki/api/v1/osrs/latest', {
    headers: { 'User-Agent': 'Group Ironmen - Dprk#8740' },
  });
  return res.data;
}

async function updateGePrices(): Promise<void> {
  const wikiData = await fetchLatestPrices();
  const gePrices: Record<string, number> = {};
  for (const [itemId, price] of Object.entries(wikiData.data)) {
    let avg = 0;
    if (price.high != null) avg = price.high;
    if (price.low != null) {
      avg = avg > 0 ? Math.floor((avg + price.low) / 2) : price.low;
    }
    gePrices[itemId] = avg;
  }
  gePricesJson = JSON.stringify(gePrices);
}

export function startGeUpdater(): void {
  const update = async () => {
    try {
      logger.info('Fetching latest ge prices');
      await updateGePrices();
    } catch (err) {
      logger.error('Failed to fetch latest ge prices: ' + (err as Error).message);
    }
  };
  update();
  setInterval(update, 14400 * 1000); // 4 hours
}

export function startSkillsAggregator(): void {
  const run = async () => {
    try {
      logger.info('Running skill aggregator');
      await db.aggregateSkills();
    } catch (err) {
      logger.error('Failed to aggregate skills: ' + (err as Error).message);
    }
    try {
      await db.applySkillsRetention();
    } catch (err) {
      logger.error('Failed to apply skills retention: ' + (err as Error).message);
    }
  };
  run();
  setInterval(run, 1800 * 1000); // 30 minutes
}

export async function handleGetWiseOldManPlayerBossKc(req: Request, res: Response): Promise<void> {
  const playerName = (String(req.params.playerName || '')).trim();
  if (!validName(playerName)) {
    res.status(400).send('Provided player name is not valid');
    return;
  }

  const cacheKey = playerName.toLowerCase();
  const cached = await db.getCachedWiseOldManPlayerBossKc(cacheKey);
  if (cached && (cached as Record<string, unknown>).schemaVersion as number >= WISE_OLD_MAN_PLAYER_BOSS_KC_SCHEMA_VERSION) {
    res.set('Cache-Control', 'no-store');
    res.json(cached);
    return;
  }

  const result = await fetchJagexHiscoreResponse(playerName);
  if (!result) {
    res.status(404).send(`${playerName} was not found on the OSRS hiscores.`);
    return;
  }
  const [player, endpointUrl] = result;
  const seasonalPlayer = await fetchSeasonalJagexHiscoreResponse(playerName);

  const playerBossKc = buildWiseOldManPlayerBossKc(
    player,
    seasonalPlayer,
    playerName,
    jagexHiscoreProfileUrl(endpointUrl, playerName)
  );

  const expiresAt = new Date(Date.now() + JAGEX_HISCORE_CACHE_TTL_SECONDS * 1000);
  await db.upsertWiseOldManPlayerBossKc(cacheKey, playerBossKc, expiresAt);

  res.set('Cache-Control', 'no-store');
  res.json(playerBossKc);
}

export function getGePricesJson(): string {
  return gePricesJson;
}
