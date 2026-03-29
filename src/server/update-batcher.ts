import * as db from './db';
import type { MemberUpdateData } from './db';
import logger from './logger';
import type { GroupEventNotifier } from './notifier';

const BATCH_SIZE = 5000;
const CHUNK_SIZE = 50;
const BATCH_TIMEOUT_MS = 50;
const QUEUE_HIGH_WATER_MARK = BATCH_SIZE * 2;

function mergeGroupMemberUpdates(target: MemberUpdateData, incoming: MemberUpdateData): void {
  const fields = [
    'stats', 'coordinates', 'skills', 'quests', 'inventory', 'equipment',
    'bank', 'shared_bank', 'rune_pouch', 'interacting', 'seed_vault',
    'deposited', 'diary_vars', 'collection_log_v2', 'last_updated'
  ] as const;
  for (const field of fields) {
    if ((incoming as any)[field] != null) {
      (target as any)[field] = (incoming as any)[field];
    }
  }
}

// Matches Rust process_chunk: one connection, bulk update → notify → deposit/shared_bank
async function processChunk(chunk: MemberUpdateData[], notifier: GroupEventNotifier): Promise<void> {
  const client = await db.getClient();
  try {
    if (logger.isLevelEnabled('info')) {
      for (const m of chunk) {
        logger.info(
          `Persisting queued group update group_id=${m.group_id || 0} member=${m.name}`
        );
      }
    }

    await db.executeBulkUpdate(client, chunk);

    // Notify affected groups (before deposited/shared_bank, matching Rust)
    const groupIds = new Set<number>();
    for (const member of chunk) {
      if (member.group_id) {
        groupIds.add(member.group_id);
      }
    }
    if (logger.isLevelEnabled('info')) {
      logger.info(
        `Persisted group update chunk members=${chunk.length} group_count=${groupIds.size}`
      );
    }
    for (const gid of groupIds) {
      notifier.notifyGroup(gid);
    }

    // Handle deposited items and shared bank after notification
    for (const m of chunk) {
      if (m.deposited && m.deposited.length > 0 && m.group_id) {
        try {
          await db.depositItems(client, m.group_id, m.name, m.deposited);
        } catch (e) {
          logger.error('Error depositing items: ' + (e as Error).message);
        }
      }
      if (m.shared_bank && m.group_id) {
        try {
          await db.updateSharedBank(client, m.group_id, m.shared_bank);
        } catch (e) {
          logger.error('Error updating shared bank: ' + (e as Error).message);
        }
      }
    }
  } catch (err) {
    logger.error('Error executing bulk update: ' + (err as Error).message);
  } finally {
    client.release();
  }
}

export class UpdateBatcher {
  private notifier: GroupEventNotifier;
  private _queue: MemberUpdateData[];
  private _timer: ReturnType<typeof setTimeout> | null;
  private _processing: boolean;
  private _queuePressureWarningActive: boolean;

  constructor(notifier: GroupEventNotifier) {
    this.notifier = notifier;
    this._queue = [];
    this._timer = null;
    this._processing = false;
    this._queuePressureWarningActive = false;
  }

  enqueue(member: MemberUpdateData): void {
    this._queue.push(member);

    if (this._queue.length >= QUEUE_HIGH_WATER_MARK && !this._queuePressureWarningActive) {
      this._queuePressureWarningActive = true;
      logger.warn(
        `Update batch queue pressure queue_length=${this._queue.length} high_water_mark=${QUEUE_HIGH_WATER_MARK}`
      );
    }

    if (this._queue.length >= BATCH_SIZE) {
      this._flush();
    } else if (!this._timer) {
      this._timer = setTimeout(() => this._flush(), BATCH_TIMEOUT_MS);
    }
  }

  private async _flush(): Promise<void> {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    if (this._queue.length === 0) return;

    const buffer = this._queue.splice(0, BATCH_SIZE);
    if (this._queue.length < QUEUE_HIGH_WATER_MARK) {
      this._queuePressureWarningActive = false;
    }

    // Merge duplicate member updates
    const mergedByKey = new Map<string, MemberUpdateData>();
    const keyOrder: string[] = [];
    for (const item of buffer) {
      if (!item.group_id) continue;
      const key = `${item.group_id}::${item.name}`;
      if (mergedByKey.has(key)) {
        mergeGroupMemberUpdates(mergedByKey.get(key)!, item);
      } else {
        keyOrder.push(key);
        mergedByKey.set(key, item);
      }
    }

    const merged = keyOrder.map((k) => mergedByKey.get(k)!);

    // Process chunks concurrently (matching Rust tokio::spawn + join_all)
    const tasks: Promise<void>[] = [];
    for (let i = 0; i < merged.length; i += CHUNK_SIZE) {
      const chunk = merged.slice(i, i + CHUNK_SIZE);
      tasks.push(processChunk(chunk, this.notifier));
    }
    await Promise.all(tasks);
  }
}
