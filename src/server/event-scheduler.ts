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

/** Track which event_ids we've already sent so we don't double-notify. */
const notifiedEvents = new Set<number>();

/** Clean up old entries periodically so the set doesn't grow forever. */
function pruneNotifiedEvents(): void {
  if (notifiedEvents.size > 10000) {
    notifiedEvents.clear();
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
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

    const events = await db.getUpcomingEventsWithWebhooks(
      now.toISOString(),
      fiveMinutesFromNow.toISOString()
    );

    for (const event of events) {
      if (notifiedEvents.has(event.event_id)) continue;
      notifiedEvents.add(event.event_id);
      await sendWebhookNotification(event);
    }

    pruneNotifiedEvents();
  } catch (err) {
    logger.error('Event scheduler check failed: ' + (err as Error).message);
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | undefined;

export function startEventScheduler(): void {
  logger.info('Starting event Discord notification scheduler (60s interval)');
  checkAndNotify();
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = setInterval(checkAndNotify, 60000);
}
