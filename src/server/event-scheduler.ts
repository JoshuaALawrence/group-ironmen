import axios from 'axios';
import * as db from './db';
import logger from './logger';

const EVENT_TYPE_INFO: Record<string, { label: string; color: number; emoji: string }> = {
  boss: { label: 'Boss', color: 0xff981f, emoji: '⚔️' },
  skilling: { label: 'Skilling', color: 0x0dc10d, emoji: '⛏️' },
  minigame: { label: 'Minigame', color: 0x00c8ff, emoji: '🎮' },
  quest: { label: 'Quest', color: 0xffff00, emoji: '📜' },
  raid: { label: 'Raid', color: 0xff4444, emoji: '🏴' },
  pking: { label: 'PK Trip', color: 0xff00ff, emoji: '💀' },
  other: { label: 'Other', color: 0xcccccc, emoji: '📌' },
};

const POLL_INTERVAL_MS = 60000;
const POLL_WINDOW_MS = 5 * 60000;

/** Track event_ids we've already sent and the event timestamp they belong to. */
const notifiedEvents = new Map<number, number>();

/** Clean up entries for events that have already started. */
function pruneNotifiedEvents(nowMs: number): void {
  for (const [eventId, eventTimeMs] of notifiedEvents) {
    if (eventTimeMs < nowMs) {
      notifiedEvents.delete(eventId);
    }
  }
}

function formatDiscordTimestamp(iso: string): string {
  const unix = Math.floor(new Date(iso).getTime() / 1000);
  return `<t:${unix}:f>`;
}

function formatRelativeTimestamp(iso: string): string {
  const unix = Math.floor(new Date(iso).getTime() / 1000);
  return `<t:${unix}:R>`;
}

function buildEmbed(event: db.UpcomingEventWithWebhook): Record<string, unknown> {
  const typeInfo = EVENT_TYPE_INFO[event.event_type] || EVENT_TYPE_INFO.other;

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: '📅 When', value: `${formatDiscordTimestamp(event.event_time)} (${formatRelativeTimestamp(event.event_time)})`, inline: true },
    { name: '🏷️ Type', value: `${typeInfo.emoji} ${typeInfo.label}`, inline: true },
  ];

  if (event.event_end_time) {
    fields.push({
      name: '🏁 Ends',
      value: formatDiscordTimestamp(event.event_end_time),
      inline: true,
    });
  }

  if (event.description) {
    fields.push({
      name: '📋 Details',
      value: event.description.length > 1024 ? event.description.slice(0, 1021) + '...' : event.description,
      inline: false,
    });
  }

  fields.push({
    name: '👤 Posted by',
    value: event.created_by,
    inline: true,
  });

  return {
    title: `${typeInfo.emoji}  ${event.title}`,
    color: typeInfo.color,
    fields,
    footer: {
      text: `${event.group_name} • Adventure Board`,
    },
    timestamp: event.event_time,
  };
}

async function sendWebhookNotification(event: db.UpcomingEventWithWebhook): Promise<void> {
  const embed = buildEmbed(event);
  const typeInfo = EVENT_TYPE_INFO[event.event_type] || EVENT_TYPE_INFO.other;

  try {
    await axios.post(event.discord_webhook_url, {
      username: 'Adventure Board',
      content: `${typeInfo.emoji} **An adventure is starting soon!**`,
      embeds: [embed],
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    logger.info(`Discord notification sent for event ${event.event_id} (${event.title}) in group ${event.group_name}`);
  } catch (err) {
    logger.error(`Failed to send Discord notification for event ${event.event_id}: ${(err as Error).message}`);
  }
}

/**
 * Check for events starting in the next polling window and send Discord notifications.
 * Called on a regular interval (every 60s). We look for events whose start time falls
 * within the next 5 minutes that haven't been notified yet.
 */
async function checkAndNotify(): Promise<void> {
  try {
    const nowMs = Date.now();
    const windowEndMs = nowMs + POLL_WINDOW_MS;

    const events = await db.getUpcomingEventsWithWebhooks(
      new Date(nowMs).toISOString(),
      new Date(windowEndMs).toISOString()
    );

    for (const event of events) {
      if (notifiedEvents.has(event.event_id)) continue;
      const eventTimeMs = Date.parse(event.event_time);
      notifiedEvents.set(event.event_id, Number.isNaN(eventTimeMs) ? windowEndMs : eventTimeMs);
      await sendWebhookNotification(event);
    }

    pruneNotifiedEvents(nowMs);
  } catch (err) {
    logger.error('Event scheduler check failed: ' + (err as Error).message);
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | undefined;

export function stopEventScheduler(): void {
  if (!schedulerInterval) return;
  clearInterval(schedulerInterval);
  schedulerInterval = undefined;
}

export function startEventScheduler(): void {
  logger.info('Starting event Discord notification scheduler (60s interval)');
  stopEventScheduler();
  checkAndNotify();
  schedulerInterval = setInterval(checkAndNotify, POLL_INTERVAL_MS);
}
