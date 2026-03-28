import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import config from './config';
import * as db from './db';
import logger from './logger';
import { validName, validateMemberPropLength } from './validators';
import { COLLECTION_LOG_DATA } from './collection-log';
import * as externalServices from './external-services';
import authMiddleware from './auth-middleware';

const SHARED_MEMBER = db.SHARED_MEMBER;

// ── Unauthed router (/api) ──

export const unauthedRouter = express.Router();

unauthedRouter.post('/create-group', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};

    // captcha
    if (config.hcaptcha.enabled) {
      const captchaResponse = body.captcha_response || '';
      const verifyRes = await axios.post(
        'https://hcaptcha.com/siteverify',
        new URLSearchParams({ response: captchaResponse, secret: config.hcaptcha.secret }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      if (!verifyRes.data.success) {
        res.status(400).send('Captcha response verification failed');
        return;
      }
    }

    const memberNames: unknown[] = body.member_names || [];
    if (memberNames.length > 5) {
      res.status(400).send('Too many member names provided');
      return;
    }

    const name = (body.name || '').trim();
    if (!validName(name)) {
      res.status(400).send('Provided group name is not valid');
      return;
    }

    const filteredMembers = (memberNames as string[]).filter(
      (n) => typeof n === 'string' && n.trim().length > 0
    );
    for (const mn of filteredMembers) {
      if (!validName(mn)) {
        res.status(400).send('Provided member name is not valid');
        return;
      }
    }

    const token = uuidv4();
    const createGroupData: db.CreateGroupData = {
      name,
      member_names: filteredMembers,
      token,
    };

    await db.createGroup(createGroupData);
    res.status(201).json({ name, member_names: filteredMembers, token });
  } catch (err) {
    logger.error('Error creating group: ' + (err as Error).message);
    res.status(500).send('');
  }
});

unauthedRouter.get('/ge-prices', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Type', 'application/json');
  res.send(externalServices.getGePricesJson());
});

unauthedRouter.get('/captcha-enabled', (_req: Request, res: Response) => {
  res.json({ enabled: config.hcaptcha.enabled, sitekey: config.hcaptcha.sitekey });
});

unauthedRouter.get('/collection-log-info', (_req: Request, res: Response) => {
  res.set('Content-Type', 'application/json');
  res.send(COLLECTION_LOG_DATA);
});

unauthedRouter.get(
  '/wise-old-man/players/:playerName/boss-kc',
  async (req: Request, res: Response) => {
    try {
      await externalServices.handleGetWiseOldManPlayerBossKc(req, res);
    } catch (err) {
      logger.error('Error fetching WOM boss kc: ' + (err as Error).message);
      res.status(500).send('');
    }
  }
);

const OSRS_NEWS_RSS_URL = 'https://secure.runescape.com/m=news/latest_news.rss?oldschool=true';
let cachedNews: string | null = null;
let newsRefreshInterval: ReturnType<typeof setInterval> | undefined;

function decodeXmlEntities(str: string): string {
  const entities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&apos;': "'",
    '&quot;': '"',
    '&#39;': "'",
    '&amp;': '&',
  };
  return str.replace(/&(?:lt|gt|apos|quot|amp|#39);/g, (m) => entities[m] ?? m);
}

async function refreshOsrsNews(): Promise<void> {
  try {
    const rssRes = await axios.get(OSRS_NEWS_RSS_URL, { timeout: 10000, responseType: 'text' });
    const xml = rssRes.data as string;
    const items: Array<{
      title: string;
      description: string;
      link: string;
      category: string;
      pubDate: string;
      imageUrl: string;
    }> = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const tag = (name: string) => {
        const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
        return m ? decodeXmlEntities(m[1].trim()) : '';
      };
      const encMatch = block.match(/enclosure[^>]+url="([^"]+)"/);
      items.push({
        title: tag('title'),
        description: tag('description'),
        link: tag('link'),
        category: tag('category'),
        pubDate: tag('pubDate'),
        imageUrl: encMatch ? encMatch[1] : '',
      });
    }

    cachedNews = JSON.stringify(items);
    logger.info('OSRS news cache refreshed');
  } catch (err) {
    logger.error('Error refreshing OSRS news: ' + (err as Error).message);
  }
}

export function startOsrsNewsRefresher(): void {
  logger.info('Starting OSRS news refresher (1h interval)');
  refreshOsrsNews();
  if (newsRefreshInterval) clearInterval(newsRefreshInterval);
  newsRefreshInterval = setInterval(refreshOsrsNews, 60 * 60 * 1000);
}

unauthedRouter.get('/osrs-news', (_req: Request, res: Response) => {
  if (!cachedNews) {
    res.status(503).send('News not yet available');
    return;
  }
  res.set('Content-Type', 'application/json');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(cachedNews);
});

// ── OSRS YouTube videos ──

const OSRS_YT_RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC0j1MpbiTFHYrUjOTwifW_w';
let cachedYtVideos: string | null = null;
let ytRefreshInterval: ReturnType<typeof setInterval> | undefined;

async function refreshOsrsYtVideos(): Promise<void> {
  try {
    const rssRes = await axios.get(OSRS_YT_RSS_URL, { timeout: 10000, responseType: 'text' });
    const xml = rssRes.data as string;
    const videos: Array<{ videoId: string; title: string; thumbnail: string; published: string }> = [];

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null && videos.length < 3) {
      const block = match[1];
      const vidIdMatch = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = block.match(/<title>([^<]+)<\/title>/);
      const pubMatch = block.match(/<published>([^<]+)<\/published>/);
      if (vidIdMatch && titleMatch) {
        const title = decodeXmlEntities(titleMatch[1].trim());
        if (title.toLowerCase().includes('livestream')) continue;
        const videoId = vidIdMatch[1].trim();
        videos.push({
          videoId,
          title,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          published: pubMatch ? pubMatch[1].trim() : '',
        });
      }
    }

    cachedYtVideos = JSON.stringify(videos);
    logger.info('OSRS YouTube cache refreshed');
  } catch (err) {
    logger.error('Error refreshing OSRS YouTube feed: ' + (err as Error).message);
  }
}

export function startOsrsYtRefresher(): void {
  logger.info('Starting OSRS YouTube refresher (1h interval)');
  refreshOsrsYtVideos();
  if (ytRefreshInterval) clearInterval(ytRefreshInterval);
  ytRefreshInterval = setInterval(refreshOsrsYtVideos, 60 * 60 * 1000);
}

unauthedRouter.get('/osrs-youtube', (_req: Request, res: Response) => {
  if (!cachedYtVideos) {
    res.status(503).send('YouTube data not yet available');
    return;
  }
  res.set('Content-Type', 'application/json');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(cachedYtVideos);
});

// ── OSRS Twitch stream status ──

const TWITCH_VOD_RSS_URL = 'https://twitchrss.appspot.com/vod/oldschoolrs';
let cachedTwitchStream: string | null = null;
let twitchRefreshInterval: ReturnType<typeof setInterval> | undefined;

async function refreshTwitchStream(): Promise<void> {
  try {
    // Check live status by scraping the Twitch page for "isLiveBroadcast"
    let live = false;
    try {
      const pageRes = await axios.get('https://twitch.tv/oldschoolrs', { timeout: 10000, responseType: 'text' });
      live = (pageRes.data as string).includes('isLiveBroadcast');
    } catch { /* assume offline */ }

    // Fetch recent VODs from RSS
    const rssRes = await axios.get(TWITCH_VOD_RSS_URL, { timeout: 10000, responseType: 'text' });
    const xml = rssRes.data as string;

    let vodTitle = '';
    let vodThumbnail = '';
    let vodLink = '';

    const itemRegex = /<item>([\s\S]*?)<\/item>/;
    const firstItem = itemRegex.exec(xml);
    if (firstItem) {
      const block = firstItem[1];
      const titleMatch = block.match(/<title>([^<]+)<\/title>/);
      const linkMatch = block.match(/<link>([^<]+)<\/link>/);
      const descMatch = block.match(/<description>([\s\S]*?)<\/description>/);

      vodTitle = titleMatch ? decodeXmlEntities(titleMatch[1].trim()) : '';
      vodLink = linkMatch ? linkMatch[1].trim() : '';

      if (descMatch) {
        const imgMatch = descMatch[1].match(/src=(?:"|&quot;)([^"&]+)(?:"|&quot;)/);
        if (imgMatch) vodThumbnail = decodeXmlEntities(imgMatch[1]);
      }
    }

    cachedTwitchStream = JSON.stringify({
      live,
      title: vodTitle,
      thumbnail: live
        ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_oldschoolrs-440x248.jpg?_=${Date.now()}`
        : vodThumbnail,
      link: live ? 'https://www.twitch.tv/oldschoolrs' : vodLink,
    });
    logger.info('Twitch stream cache refreshed');
  } catch (err) {
    logger.error('Error refreshing Twitch stream: ' + (err as Error).message);
  }
}

export function startTwitchRefresher(): void {
  logger.info('Starting Twitch stream refresher (2m interval)');
  refreshTwitchStream();
  if (twitchRefreshInterval) clearInterval(twitchRefreshInterval);
  twitchRefreshInterval = setInterval(refreshTwitchStream, 2 * 60 * 1000);
}

unauthedRouter.get('/osrs-twitch', (_req: Request, res: Response) => {
  if (!cachedTwitchStream) {
    res.status(503).send('Twitch data not yet available');
    return;
  }
  res.set('Content-Type', 'application/json');
  res.set('Cache-Control', 'public, max-age=60');
  res.send(cachedTwitchStream);
});

// ── Authed router (/api/group/:group_name) ──

export const authedRouter = express.Router({ mergeParams: true });
authedRouter.use(authMiddleware);

authedRouter.post('/add-group-member', async (req: Request, res: Response) => {
  try {
    const memberName = req.body && req.body.name;
    if (memberName === SHARED_MEMBER) {
      res.status(400).send(`Member name ${SHARED_MEMBER} not allowed`);
      return;
    }
    if (!validName(memberName)) {
      res.status(400).send('Provided member name is not valid');
      return;
    }
    await db.addGroupMember((req as any).groupId, memberName);
    req.app.locals.notifier.notifyGroup((req as any).groupId);
    res.status(201).end();
  } catch (err) {
    if ((err as any).statusCode) {
      res.type('text/plain').status((err as any).statusCode).send((err as Error).message);
      return;
    }
    logger.error('Error adding group member: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.delete('/delete-group-member', async (req: Request, res: Response) => {
  try {
    const memberName = req.body && req.body.name;
    if (memberName === SHARED_MEMBER) {
      res.status(400).send(`Member name ${SHARED_MEMBER} not allowed`);
      return;
    }
    await db.deleteGroupMember((req as any).groupId, memberName);
    req.app.locals.notifier.notifyGroup((req as any).groupId);
    res.status(200).end();
  } catch (err) {
    logger.error('Error deleting group member: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.put('/rename-group-member', async (req: Request, res: Response) => {
  try {
    const { original_name, new_name } = req.body || {};
    if (original_name === SHARED_MEMBER || new_name === SHARED_MEMBER) {
      res.status(400).send(`Member name ${SHARED_MEMBER} not allowed`);
      return;
    }
    if (!validName(new_name)) {
      res.status(400).send('Provided member name is not valid');
      return;
    }
    await db.renameGroupMember((req as any).groupId, original_name, new_name);
    req.app.locals.notifier.notifyGroup((req as any).groupId);
    res.status(200).end();
  } catch (err) {
    logger.error('Error renaming group member: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.post('/update-group-member', async (req: Request, res: Response) => {
  try {
    const member = req.body || {};
    const inGroup = await db.isMemberInGroup((req as any).groupId, member.name);
    if (!inGroup) {
      res.status(401).send('Player is not a member of this group');
      return;
    }

    validateMemberPropLength('stats', member.stats, 7, 7);
    validateMemberPropLength('coordinates', member.coordinates, 3, 4);
    validateMemberPropLength('skills', member.skills, 23, 24);
    validateMemberPropLength('quests', member.quests, 0, 220);
    validateMemberPropLength('inventory', member.inventory, 56, 56);
    validateMemberPropLength('equipment', member.equipment, 28, 28);
    validateMemberPropLength('bank', member.bank, 0, 3000);
    validateMemberPropLength('shared_bank', member.shared_bank, 0, 1000);
    validateMemberPropLength('rune_pouch', member.rune_pouch, 6, 8);
    validateMemberPropLength('seed_vault', member.seed_vault, 0, 500);
    validateMemberPropLength('deposited', member.deposited, 0, 200);
    validateMemberPropLength('diary_vars', member.diary_vars, 0, 62);
    validateMemberPropLength('collection_log_v2', member.collection_log_v2, 0, 4000);

    member.group_id = (req as any).groupId;
    logger.info(
      `Queueing group update group_id=${(req as any).groupId} member=${member.name}`
    );
    req.app.locals.batcher.enqueue(member);
    res.status(200).end();
  } catch (err) {
    if ((err as any).statusCode) {
      res.type('text/plain').status((err as any).statusCode).send((err as Error).message);
      return;
    }
    logger.error('Error updating group member: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.get('/get-group-data', async (req: Request, res: Response) => {
  try {
    const fromTime = req.query.from_time as string;
    const groupMembers = await db.getGroupData((req as any).groupId, fromTime);
    res.json(groupMembers);
  } catch (err) {
    logger.error('Error getting group data: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.get('/group-events', (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  res.write(': connected\n\n');

  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);

  const sub = req.app.locals.notifier.subscribe((req as any).groupId);
  const unsub = sub.on(() => {
    res.write('data: update\n\n');
  });

  req.on('close', () => {
    clearInterval(keepAlive);
    unsub();
  });
});

authedRouter.get('/get-skill-data', async (req: Request, res: Response) => {
  try {
    const periodParam = req.query.period as string;
    let period: string;
    switch (periodParam) {
      case 'Day': period = 'day'; break;
      case 'Week': period = 'month'; break;
      case 'Month': period = 'month'; break;
      case 'Year': period = 'year'; break;
      default: period = 'day';
    }
    const data = await db.getSkillsForPeriod((req as any).groupId, period);
    res.json(data);
  } catch (err) {
    logger.error('Error getting skill data: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.get('/am-i-logged-in', (_req: Request, res: Response) => {
  res.status(200).end();
});

authedRouter.get('/am-i-in-group', async (req: Request, res: Response) => {
  try {
    const memberName = req.query.member_name as string;
    const inGroup = await db.isMemberInGroup((req as any).groupId, memberName);
    if (!inGroup) {
      res.status(401).send('Player is not a member of this group');
      return;
    }
    res.status(200).end();
  } catch (err) {
    logger.error('Error checking group membership: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.get('/collection-log', (_req: Request, res: Response) => {
  res.json({});
});

// ── Group events (calendar) ──

authedRouter.get('/events', async (req: Request, res: Response) => {
  try {
    const events = await db.getGroupEvents((req as any).groupId);
    res.json(events);
  } catch (err) {
    logger.error('Error getting group events: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.post('/events', async (req: Request, res: Response) => {
  try {
    const { title, description, event_type, event_time, event_end_time, created_by, icon } = req.body || {};
    if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 100) {
      res.status(400).send('Title is required and must be 100 characters or less');
      return;
    }
    if (description && (typeof description !== 'string' || description.length > 500)) {
      res.status(400).send('Description must be 500 characters or less');
      return;
    }
    if (!event_time || typeof event_time !== 'string') {
      res.status(400).send('Event time is required');
      return;
    }
    const parsedTime = new Date(event_time);
    if (isNaN(parsedTime.getTime())) {
      res.status(400).send('Invalid event time');
      return;
    }
    if (!created_by || typeof created_by !== 'string' || created_by.trim().length === 0) {
      res.status(400).send('Created by is required');
      return;
    }

    let parsedEndTime: Date | null = null;
    if (event_end_time && typeof event_end_time === 'string') {
      parsedEndTime = new Date(event_end_time);
      if (isNaN(parsedEndTime.getTime())) {
        res.status(400).send('Invalid event end time');
        return;
      }
    }

    const safeIcon = (typeof icon === 'string' && /^[a-z]{1,10}:[a-zA-Z0-9_().-]{1,80}$/.test(icon)) ? icon : '';

    const event = await db.createGroupEvent(
      (req as any).groupId,
      title.trim(),
      (description || '').trim(),
      event_type || 'boss',
      parsedTime.toISOString(),
      parsedEndTime ? parsedEndTime.toISOString() : null,
      created_by.trim(),
      safeIcon
    );
    res.status(201).json(event);
  } catch (err) {
    if ((err as any).statusCode) {
      res.type('text/plain').status((err as any).statusCode).send((err as Error).message);
      return;
    }
    logger.error('Error creating group event: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.delete('/events/:event_id', async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.event_id as string, 10);
    if (isNaN(eventId)) {
      res.status(400).send('Invalid event ID');
      return;
    }
    const deleted = await db.deleteGroupEvent((req as any).groupId, eventId);
    if (!deleted) {
      res.status(404).send('Event not found');
      return;
    }
    res.status(200).end();
  } catch (err) {
    logger.error('Error deleting group event: ' + (err as Error).message);
    res.status(500).send('');
  }
});

// ── Discord settings ──

authedRouter.get('/discord-settings', async (req: Request, res: Response) => {
  try {
    const settings = await db.getDiscordSettings((req as any).groupId);
    // Mask sensitive values — only reveal whether they are set
    res.json({
      has_webhook: settings.webhook_url.length > 0,
      members: settings.members.map((m) => ({
        name: m.name,
        has_discord_id: m.discord_id.length > 0,
      })),
    });
  } catch (err) {
    logger.error('Error getting discord settings: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.put('/discord-settings', async (req: Request, res: Response) => {
  try {
    const { webhook_url, members } = req.body || {};

    let safeWebhookUrl: string | null = null;
    if (typeof webhook_url === 'string' && webhook_url.trim().length > 0) {
      const trimmed = webhook_url.trim();
      if (trimmed.length > 200) {
        res.status(400).send('Webhook URL must be 200 characters or less');
        return;
      }
      if (!/^https:\/\/discord\.com\/api\/webhooks\//.test(trimmed) &&
          !/^https:\/\/discordapp\.com\/api\/webhooks\//.test(trimmed)) {
        res.status(400).send('Invalid Discord webhook URL');
        return;
      }
      safeWebhookUrl = trimmed;
    }

    const memberDiscordIds: { name: string; discord_id: string }[] = [];
    if (Array.isArray(members)) {
      for (const m of members) {
        if (!m || typeof m.name !== 'string') continue;
        // Only include members where a discord_id was actually provided
        if (typeof m.discord_id === 'string' && m.discord_id.trim().length > 0) {
          const id = m.discord_id.trim();
          if (!/^\d{1,20}$/.test(id)) {
            res.status(400).send('Invalid Discord ID provided');
            return;
          }
          memberDiscordIds.push({ name: m.name, discord_id: id });
        }
      }
    }

    await db.updateDiscordSettings((req as any).groupId, safeWebhookUrl, memberDiscordIds);
    res.status(200).end();
  } catch (err) {
    logger.error('Error updating discord settings: ' + (err as Error).message);
    res.status(500).send('');
  }
});

// ── Item request via Discord webhook ──

authedRouter.post('/request-item', async (req: Request, res: Response) => {
  try {
    const { item_name, quantity, requested_by, member_quantities } = req.body || {};

    if (typeof item_name !== 'string' || item_name.trim().length === 0 || item_name.length > 100) {
      res.status(400).send('Invalid item name');
      return;
    }
    if (typeof quantity !== 'number' || quantity < 1 || quantity > 2147483647) {
      res.status(400).send('Invalid quantity');
      return;
    }
    if (typeof requested_by !== 'string' || requested_by.trim().length === 0 || requested_by.length > 50) {
      res.status(400).send('Invalid requester name');
      return;
    }

    const settings = await db.getDiscordSettings((req as any).groupId);
    if (!settings.webhook_url) {
      res.status(400).send('No Discord webhook configured for this group');
      return;
    }

    // Build mentions for members who have the item (excluding the requester)
    const mentions: string[] = [];
    const holdersInfo: string[] = [];
    if (member_quantities && typeof member_quantities === 'object') {
      for (const member of settings.members) {
        if (member.name === requested_by) continue;
        const qty = member_quantities[member.name];
        if (typeof qty === 'number' && qty > 0 && member.discord_id) {
          mentions.push(`<@${member.discord_id}>`);
          holdersInfo.push(`${member.name}: ${qty.toLocaleString()}`);
        } else if (typeof qty === 'number' && qty > 0) {
          holdersInfo.push(`${member.name}: ${qty.toLocaleString()}`);
        }
      }
    }

    const mentionStr = mentions.length > 0 ? mentions.join(' ') + ' ' : '';

    const embed = {
      title: `📦 Item Request`,
      color: 0xff981f,
      fields: [
        { name: 'Item', value: item_name, inline: true },
        { name: 'Quantity', value: quantity.toLocaleString(), inline: true },
        { name: 'Requested by', value: requested_by, inline: true },
      ],
      footer: {
        text: 'Group Ironmen • Item Request',
      },
    };

    if (holdersInfo.length > 0) {
      embed.fields.push({
        name: 'Current holders',
        value: holdersInfo.join('\n'),
        inline: false,
      });
    }

    await axios.post(settings.webhook_url, {
      username: 'Group Ironmen',
      content: `${mentionStr}**${requested_by}** is requesting **${quantity.toLocaleString()}x ${item_name}**`,
      embeds: [embed],
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    res.status(200).end();
  } catch (err) {
    logger.error('Error sending item request: ' + (err as Error).message);
    res.status(500).send('');
  }
});
