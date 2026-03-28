import { Pool, PoolClient } from 'pg';
import config from './config';
import { tokenHash } from './crypto';

export const SHARED_MEMBER = '@SHARED';
const CURRENT_GROUP_VERSION = 2;

export const pool = new Pool(config.pg);

export function getClient(): Promise<PoolClient> {
  return pool.connect();
}

// ── Schema / Migrations ──

async function hasMigrationRun(client: PoolClient, name: string): Promise<boolean> {
  const res = await client.query(
    'SELECT COUNT(*) FROM groupironman.migrations WHERE name=$1',
    [name]
  );
  return parseInt(res.rows[0].count, 10) > 0;
}

async function commitMigration(client: PoolClient, name: string): Promise<void> {
  await client.query(
    'INSERT INTO groupironman.migrations (name, date) VALUES($1, NOW())',
    [name]
  );
}

export async function updateSchema(): Promise<void> {
  const client = await getClient();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS groupironman');

    await client.query(`
CREATE TABLE IF NOT EXISTS groupironman.groups(
    group_id BIGSERIAL UNIQUE,
    group_name TEXT NOT NULL,
    group_token_hash CHAR(64) NOT NULL,
    PRIMARY KEY (group_name, group_token_hash)
)`);

    await client.query(`
CREATE TABLE IF NOT EXISTS groupironman.migrations (
    name TEXT,
    date TIMESTAMPTZ
)`);

    // migration: add_groups_version_column
    if (!(await hasMigrationRun(client, 'add_groups_version_column'))) {
      await client.query('BEGIN');
      await client.query(
        'ALTER TABLE groupironman.groups ADD COLUMN IF NOT EXISTS version INTEGER default 1'
      );
      await commitMigration(client, 'add_groups_version_column');
      await client.query('COMMIT');
    }

    // migration: create_members_table
    if (!(await hasMigrationRun(client, 'create_members_table'))) {
      await client.query('BEGIN');
      await client.query(`
CREATE TABLE IF NOT EXISTS groupironman.members (
  member_id BIGSERIAL PRIMARY KEY,
  group_id BIGSERIAL REFERENCES groupironman.groups(group_id),
  member_name TEXT NOT NULL,

  stats_last_update TIMESTAMPTZ,
  stats INTEGER[7],

  coordinates_last_update TIMESTAMPTZ,
  coordinates INTEGER[3],

  skills_last_update TIMESTAMPTZ,
  skills INTEGER[24],

  quests_last_update TIMESTAMPTZ,
  quests bytea,

  inventory_last_update TIMESTAMPTZ,
  inventory INTEGER[56],

  equipment_last_update TIMESTAMPTZ,
  equipment INTEGER[28],

  rune_pouch_last_update TIMESTAMPTZ,
  rune_pouch INTEGER[8],

  bank_last_update TIMESTAMPTZ,
  bank INTEGER[],

  seed_vault_last_update TIMESTAMPTZ,
  seed_vault INTEGER[],

  interacting_last_update TIMESTAMPTZ,
  interacting TEXT
)`);
      await client.query(`
CREATE UNIQUE INDEX IF NOT EXISTS members_groupid_name_idx ON groupironman.members (group_id, member_name)
`);
      await commitMigration(client, 'create_members_table');
      await client.query('COMMIT');
    }

    // migration: add_diary_vars
    if (!(await hasMigrationRun(client, 'add_diary_vars'))) {
      await client.query('BEGIN');
      await client.query(`
ALTER TABLE groupironman.members
ADD COLUMN IF NOT EXISTS diary_vars_last_update TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS diary_vars INTEGER[62]
`);
      await commitMigration(client, 'add_diary_vars');
      await client.query('COMMIT');
    }

    // migration: add_skill_periods
    if (!(await hasMigrationRun(client, 'add_skill_periods'))) {
      await client.query('BEGIN');
      for (const period of ['day', 'month', 'year']) {
        await client.query(`
CREATE TABLE IF NOT EXISTS groupironman.skills_${period} (
    member_id BIGSERIAL REFERENCES groupironman.members(member_id),
    time TIMESTAMPTZ,
    skills INTEGER[24],
    PRIMARY KEY (member_id, time)
)`);
      }
      await client.query(`
CREATE TABLE IF NOT EXISTS groupironman.aggregation_info (
    type TEXT PRIMARY KEY,
    last_aggregation TIMESTAMPTZ NOT NULL DEFAULT TIMESTAMP WITH TIME ZONE 'epoch'
)`);
      await client.query(`
INSERT INTO groupironman.aggregation_info (type) VALUES ('skills')
ON CONFLICT (type) DO NOTHING
`);
      await commitMigration(client, 'add_skill_periods');
      await client.query('COMMIT');
    }

    // migration: member_name_citext
    if (!(await hasMigrationRun(client, 'member_name_citext'))) {
      await client.query('BEGIN');

      const dupRes = await client.query(`
SELECT a.group_id, a.member_id, a.member_name FROM groupironman.members a
INNER JOIN (
  SELECT group_id, lower(member_name) as member_name, COUNT(*) FROM groupironman.members
  GROUP BY group_id, lower(member_name)
  HAVING COUNT(*) > 1
) b
ON a.group_id=b.group_id AND lower(a.member_name)=lower(b.member_name)
ORDER BY GREATEST(
  stats_last_update,
  coordinates_last_update,
  skills_last_update,
  quests_last_update,
  inventory_last_update,
  equipment_last_update,
  bank_last_update,
  rune_pouch_last_update,
  interacting_last_update,
  seed_vault_last_update,
  diary_vars_last_update
) ASC
`);

      const encountered = new Set<string>();
      const { v4: uuidv4 } = await import('uuid');
      for (const row of dupRes.rows) {
        const key = `${row.group_id}::${row.member_name.toLowerCase()}`;
        if (!encountered.has(key)) {
          encountered.add(key);
        } else {
          for (let t = 0; t < 4; t++) {
            const newName = uuidv4().split('-')[0];
            try {
              await client.query(
                'UPDATE groupironman.members SET member_name=$1 WHERE member_id=$2',
                [newName, row.member_id]
              );
              break;
            } catch {
              // retry with different name
            }
          }
        }
      }

      await client.query(
        'CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public'
      ).catch(() => {});
      await client.query(
        'ALTER TABLE groupironman.members ALTER COLUMN member_name TYPE citext'
      );
      await commitMigration(client, 'member_name_citext');
      await client.query('COMMIT');
    }

    // migration: add_collection_log_member_column
    if (!(await hasMigrationRun(client, 'add_collection_log_member_column'))) {
      await client.query('BEGIN');
      await client.query(`
ALTER TABLE groupironman.members
ADD COLUMN IF NOT EXISTS collection_log_last_update TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS collection_log INTEGER[]
`);
      await commitMigration(client, 'add_collection_log_member_column');
      await client.query('COMMIT');
    }

    // migration: add_wise_old_man_player_boss_kc_cache
    if (!(await hasMigrationRun(client, 'add_wise_old_man_player_boss_kc_cache'))) {
      await client.query('BEGIN');
      await client.query(`
CREATE TABLE IF NOT EXISTS groupironman.wise_old_man_player_boss_kc_cache (
  player_name TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
)`);
      await client.query(`
CREATE INDEX IF NOT EXISTS wise_old_man_player_boss_kc_cache_expires_at_idx
ON groupironman.wise_old_man_player_boss_kc_cache (expires_at)
`);
      await commitMigration(client, 'add_wise_old_man_player_boss_kc_cache');
      await client.query('COMMIT');
    }

    // migration: migrate_collection_log_v2 (only if add_collection_log ran before)
    if (
      !(await hasMigrationRun(client, 'migrate_collection_log_v2')) &&
      (await hasMigrationRun(client, 'add_collection_log'))
    ) {
      await client.query('BEGIN');
      const rows = (await client.query(
        'SELECT member_id, items FROM groupironman.collection_log WHERE cardinality(items) > 0'
      )).rows;

      const memberData: Record<string, number[]> = {};
      for (const row of rows) {
        const mid = row.member_id as string;
        if (!memberData[mid]) {
          memberData[mid] = [...row.items];
        } else {
          memberData[mid].push(...row.items);
        }
      }

      const entries = Object.entries(memberData);
      const chunkSize = 100;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const placeholders: string[] = [];
        const params: (string | number[])[] = [];
        chunk.forEach(([memberId, items], idx) => {
          placeholders.push(`($${idx * 2 + 1}::BIGINT, $${idx * 2 + 2}::INTEGER[])`);
          params.push(memberId, items);
        });
        await client.query(`
UPDATE groupironman.members as a SET collection_log=b.collection_log, collection_log_last_update='epoch'::timestamptz + INTERVAL '5 days'
FROM (VALUES ${placeholders.join(', ')}) AS b(member_id, collection_log)
WHERE a.member_id=b.member_id
`, params);
      }

      await commitMigration(client, 'migrate_collection_log_v2');
      await client.query('COMMIT');
    }

    // migration: update_timestamp_triggers
    if (!(await hasMigrationRun(client, 'update_timestamp_triggers'))) {
      await client.query('BEGIN');

      const names = [
        'stats', 'coordinates', 'skills', 'quests', 'inventory', 'equipment',
        'bank', 'rune_pouch', 'interacting', 'seed_vault', 'diary_vars', 'collection_log'
      ];

      for (const name of names) {
        await client.query(`
CREATE OR REPLACE FUNCTION groupironman.update_${name}_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.${name}_last_update = now();
    RETURN NEW;
END;
$$ language 'plpgsql'
`);
        await client.query(`
DO
$$BEGIN
  CREATE TRIGGER set_${name}_timestamp
  BEFORE UPDATE ON groupironman.members
  FOR EACH ROW
  WHEN (OLD.${name} IS DISTINCT FROM NEW.${name})
  EXECUTE FUNCTION groupironman.update_${name}_timestamp();
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;$$
`);
      }

      await commitMigration(client, 'update_timestamp_triggers');
      await client.query('COMMIT');
    }
  } finally {
    client.release();
  }
}

// ── Group operations ──

export interface CreateGroupData {
  name: string;
  member_names: string[];
  token: string;
}

export async function createGroup(createGroupData: CreateGroupData): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const hashedToken = tokenHash(createGroupData.token, createGroupData.name);

    const groupRes = await client.query(
      'INSERT INTO groupironman.groups (group_name, group_token_hash, version) VALUES($1, $2, $3) RETURNING group_id',
      [createGroupData.name, hashedToken, CURRENT_GROUP_VERSION]
    );
    const groupId = groupRes.rows[0].group_id;

    await client.query(
      'INSERT INTO groupironman.members (group_id, member_name) VALUES($1, $2)',
      [groupId, SHARED_MEMBER]
    );

    for (const memberName of createGroupData.member_names) {
      await client.query(
        'INSERT INTO groupironman.members (group_id, member_name) VALUES($1, $2)',
        [groupId, memberName]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getGroup(groupName: string, token: string): Promise<number | null> {
  const client = await getClient();
  try {
    const hashedToken = tokenHash(token, groupName);
    const res = await client.query(
      'SELECT group_id FROM groupironman.groups WHERE group_token_hash=$1 AND group_name=$2',
      [hashedToken, groupName]
    );
    if (res.rows.length === 0) {
      return null;
    }
    return res.rows[0].group_id;
  } finally {
    client.release();
  }
}

export async function addGroupMember(groupId: number, memberName: string): Promise<void> {
  const client = await getClient();
  try {
    const countRes = await client.query(
      'SELECT COUNT(*) FROM groupironman.members WHERE group_id=$1 AND member_name!=$2',
      [groupId, SHARED_MEMBER]
    );
    const count = parseInt(countRes.rows[0].count, 10);
    if (count >= 5) {
      const err = Object.assign(
        new Error('Group has already reached the maximum amount of players'),
        { statusCode: 400 }
      );
      throw err;
    }
    await client.query(
      'INSERT INTO groupironman.members (group_id, member_name) VALUES($1, $2)',
      [groupId, memberName]
    );
  } finally {
    client.release();
  }
}

export async function deleteGroupMember(groupId: number, memberName: string): Promise<void> {
  const client = await getClient();
  try {
    // get member_id
    const midRes = await client.query(
      'SELECT member_id FROM groupironman.members WHERE group_id=$1 AND member_name=$2',
      [groupId, memberName]
    );
    if (midRes.rows.length === 0) return;
    const memberId = midRes.rows[0].member_id;

    await client.query('BEGIN');
    for (const period of ['day', 'month', 'year']) {
      await client.query(
        `DELETE FROM groupironman.skills_${period} WHERE member_id=$1`,
        [memberId]
      );
    }
    // delete collection log data
    await client.query(
      'DELETE FROM groupironman.collection_log WHERE member_id=$1',
      [memberId]
    ).catch(() => {});
    await client.query(
      'DELETE FROM groupironman.collection_log_new WHERE member_id=$1',
      [memberId]
    ).catch(() => {});

    await client.query(
      'DELETE FROM groupironman.members WHERE group_id=$1 AND member_name=$2',
      [groupId, memberName]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function renameGroupMember(
  groupId: number,
  originalName: string,
  newName: string
): Promise<void> {
  const client = await getClient();
  try {
    await client.query(
      'UPDATE groupironman.members SET member_name=$1 WHERE group_id=$2 AND member_name=$3',
      [newName, groupId, originalName]
    );
  } finally {
    client.release();
  }
}

export async function isMemberInGroup(groupId: number, memberName: string): Promise<boolean> {
  const client = await getClient();
  try {
    const res = await client.query(
      'SELECT COUNT(member_name) FROM groupironman.members WHERE group_id=$1 AND member_name=$2',
      [groupId, memberName]
    );
    return parseInt(res.rows[0].count, 10) > 0;
  } finally {
    client.release();
  }
}

export interface GroupMemberData {
  name: string;
  last_updated?: string;
  stats?: number[];
  coordinates?: number[];
  skills?: number[];
  quests?: number[];
  inventory?: number[];
  equipment?: number[];
  bank?: number[];
  rune_pouch?: number[];
  interacting?: unknown;
  seed_vault?: number[];
  diary_vars?: number[];
  collection_log_v2?: number[];
}

export async function getGroupData(groupId: number, fromTime: string): Promise<GroupMemberData[]> {
  const client = await getClient();
  try {
    const res = await client.query(
      `
SELECT member_name,
GREATEST(stats_last_update, coordinates_last_update, skills_last_update,
quests_last_update, inventory_last_update, equipment_last_update, bank_last_update,
rune_pouch_last_update, interacting_last_update, seed_vault_last_update, diary_vars_last_update,
collection_log_last_update) as last_updated,
CASE WHEN stats_last_update >= $1::TIMESTAMPTZ THEN stats ELSE NULL END as stats,
CASE WHEN coordinates_last_update >= $1::TIMESTAMPTZ THEN coordinates ELSE NULL END as coordinates,
CASE WHEN skills_last_update >= $1::TIMESTAMPTZ THEN skills ELSE NULL END as skills,
CASE WHEN quests_last_update >= $1::TIMESTAMPTZ THEN quests ELSE NULL END as quests,
CASE WHEN inventory_last_update >= $1::TIMESTAMPTZ THEN inventory ELSE NULL END as inventory,
CASE WHEN equipment_last_update >= $1::TIMESTAMPTZ THEN equipment ELSE NULL END as equipment,
CASE WHEN bank_last_update >= $1::TIMESTAMPTZ THEN bank ELSE NULL END as bank,
CASE WHEN rune_pouch_last_update >= $1::TIMESTAMPTZ THEN rune_pouch ELSE NULL END as rune_pouch,
CASE WHEN interacting_last_update >= $1::TIMESTAMPTZ THEN interacting ELSE NULL END as interacting,
CASE WHEN seed_vault_last_update >= $1::TIMESTAMPTZ THEN seed_vault ELSE NULL END as seed_vault,
CASE WHEN diary_vars_last_update >= $1::TIMESTAMPTZ THEN diary_vars ELSE NULL END as diary_vars,
CASE WHEN collection_log_last_update > $1::TIMESTAMPTZ THEN collection_log ELSE NULL END as collection_log
FROM groupironman.members WHERE group_id=$2
`,
      [fromTime, groupId]
    );

    return res.rows.map((row) => {
      const member: GroupMemberData = {
        name: row.member_name,
        last_updated: row.last_updated || undefined,
      };
      if (row.stats) member.stats = row.stats;
      if (row.coordinates) member.coordinates = row.coordinates;
      if (row.skills) member.skills = row.skills;
      if (row.quests) member.quests = [...row.quests];
      if (row.inventory) member.inventory = row.inventory;
      if (row.equipment) member.equipment = row.equipment;
      if (row.bank) member.bank = row.bank;
      if (row.rune_pouch) member.rune_pouch = row.rune_pouch;
      if (row.interacting) {
        try {
          member.interacting = JSON.parse(row.interacting);
        } catch { /* skip */ }
      }
      if (row.seed_vault) member.seed_vault = row.seed_vault;
      if (row.diary_vars) member.diary_vars = row.diary_vars;
      if (row.collection_log) member.collection_log_v2 = row.collection_log;
      return member;
    });
  } finally {
    client.release();
  }
}

// ── Skills aggregation ──

async function getLastSkillsAggregation(client: PoolClient): Promise<string> {
  const res = await client.query(
    "SELECT last_aggregation FROM groupironman.aggregation_info WHERE type='skills'"
  );
  return res.rows[0].last_aggregation;
}

export async function aggregateSkills(): Promise<void> {
  const client = await getClient();
  try {
    const lastAgg = await getLastSkillsAggregation(client);
    await client.query('BEGIN');
    await client.query(
      "UPDATE groupironman.aggregation_info SET last_aggregation=NOW() WHERE type='skills'"
    );

    const periodMap: Record<string, string> = { day: 'hour', month: 'day', year: 'month' };
    for (const [period, truncUnit] of Object.entries(periodMap)) {
      await client.query(
        `
INSERT INTO groupironman.skills_${period} (member_id, time, skills)
SELECT member_id, date_trunc('${truncUnit}', skills_last_update), skills FROM groupironman.members
WHERE skills_last_update IS NOT NULL AND skills IS NOT NULL AND skills_last_update >= $1
ON CONFLICT (member_id, time)
DO UPDATE SET skills=excluded.skills
`,
        [lastAgg]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function applySkillsRetention(): Promise<void> {
  const client = await getClient();
  try {
    const lastAgg = await getLastSkillsAggregation(client);
    await client.query('BEGIN');

    const retentionMap: Record<string, string> = { day: '1 day', month: '1 month', year: '1 year' };
    for (const [period, interval] of Object.entries(retentionMap)) {
      await client.query(`
DELETE FROM groupironman.skills_${period}
WHERE time < ($1::timestamptz - interval '${interval}') AND (member_id, time) NOT IN (
  SELECT member_id, max(time) FROM groupironman.skills_${period} WHERE time < ($1::timestamptz - interval '${interval}') GROUP BY member_id
)
`, [lastAgg]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export interface SkillPeriodMember {
  name: string;
  skill_data: Array<{ time: string; data: number[] }>;
}

export async function getSkillsForPeriod(groupId: number, period: string): Promise<SkillPeriodMember[]> {
  const tableName = `skills_${period}`;
  const client = await getClient();
  try {
    const res = await client.query(
      `
SELECT member_name, time, s.skills
FROM groupironman.${tableName} s
INNER JOIN groupironman.members m ON m.member_id=s.member_id
WHERE m.group_id=$1
`,
      [groupId]
    );

    const memberData: Record<string, SkillPeriodMember> = {};
    for (const row of res.rows) {
      const name: string = row.member_name;
      if (!memberData[name]) {
        memberData[name] = { name, skill_data: [] };
      }
      memberData[name].skill_data.push({
        time: row.time,
        data: row.skills,
      });
    }
    return Object.values(memberData);
  } finally {
    client.release();
  }
}

// ── WOM boss kc cache ──

export async function getCachedWiseOldManPlayerBossKc(playerName: string): Promise<Record<string, unknown> | null> {
  const client = await getClient();
  try {
    const res = await client.query(
      `SELECT payload FROM groupironman.wise_old_man_player_boss_kc_cache
       WHERE player_name=$1 AND expires_at > NOW()`,
      [playerName]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].payload;
  } finally {
    client.release();
  }
}

export async function upsertWiseOldManPlayerBossKc(
  playerName: string,
  payload: unknown,
  expiresAt: Date
): Promise<void> {
  const client = await getClient();
  try {
    await client.query(
      `
INSERT INTO groupironman.wise_old_man_player_boss_kc_cache (player_name, payload, fetched_at, expires_at)
VALUES ($1, $2, NOW(), $3)
ON CONFLICT (player_name)
DO UPDATE SET payload=EXCLUDED.payload, fetched_at=EXCLUDED.fetched_at, expires_at=EXCLUDED.expires_at
`,
      [playerName, JSON.stringify(payload), expiresAt]
    );
  } finally {
    client.release();
  }
}

// ── Bulk update (used by batcher) ──

export interface MemberUpdateData {
  group_id: number;
  name: string;
  stats?: number[] | null;
  coordinates?: number[] | null;
  skills?: number[] | null;
  quests?: number[] | null;
  inventory?: number[] | null;
  equipment?: number[] | null;
  bank?: number[] | null;
  rune_pouch?: number[] | null;
  interacting?: unknown;
  seed_vault?: number[] | null;
  diary_vars?: number[] | null;
  collection_log_v2?: number[] | null;
  deposited?: number[];
  shared_bank?: number[];
  last_updated?: string;
}

export async function executeBulkUpdate(client: PoolClient, members: MemberUpdateData[]): Promise<void> {
  if (members.length === 0) return;

  const fieldCount = 14;
  const placeholders: string[] = [];
  const params: unknown[] = [];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const offset = i * fieldCount;
    placeholders.push(
      `($${offset + 1}::BIGINT,$${offset + 2}::TEXT,$${offset + 3}::INT4[],$${offset + 4}::INT4[],$${offset + 5}::INT4[],$${offset + 6}::BYTEA,$${offset + 7}::INT4[],$${offset + 8}::INT4[],$${offset + 9}::INT4[],$${offset + 10}::INT4[],$${offset + 11}::TEXT,$${offset + 12}::INT4[],$${offset + 13}::INT4[],$${offset + 14}::INT4[])`
    );
    params.push(
      m.group_id,
      m.name,
      m.stats || null,
      m.coordinates || null,
      m.skills || null,
      m.quests ? Buffer.from(m.quests) : null,
      m.inventory || null,
      m.equipment || null,
      m.bank || null,
      m.rune_pouch || null,
      m.interacting ? JSON.stringify(m.interacting) : null,
      m.seed_vault || null,
      m.diary_vars || null,
      m.collection_log_v2 || null
    );
  }

  const sql = `
UPDATE groupironman.members as a SET
  stats = COALESCE(b.stats, a.stats),
    stats_last_update = CASE WHEN b.stats IS NOT NULL THEN NOW() ELSE a.stats_last_update END,
  coordinates = COALESCE(b.coordinates, a.coordinates),
    coordinates_last_update = CASE WHEN b.coordinates IS NOT NULL THEN NOW() ELSE a.coordinates_last_update END,
  skills = COALESCE(b.skills, a.skills),
    skills_last_update = CASE WHEN b.skills IS NOT NULL THEN NOW() ELSE a.skills_last_update END,
  quests = COALESCE(b.quests, a.quests),
    quests_last_update = CASE WHEN b.quests IS NOT NULL THEN NOW() ELSE a.quests_last_update END,
  inventory = COALESCE(b.inventory, a.inventory),
    inventory_last_update = CASE WHEN b.inventory IS NOT NULL THEN NOW() ELSE a.inventory_last_update END,
  equipment = COALESCE(b.equipment, a.equipment),
    equipment_last_update = CASE WHEN b.equipment IS NOT NULL THEN NOW() ELSE a.equipment_last_update END,
  bank = COALESCE(b.bank, a.bank),
    bank_last_update = CASE WHEN b.bank IS NOT NULL THEN NOW() ELSE a.bank_last_update END,
  rune_pouch = COALESCE(b.rune_pouch, a.rune_pouch),
    rune_pouch_last_update = CASE WHEN b.rune_pouch IS NOT NULL THEN NOW() ELSE a.rune_pouch_last_update END,
  interacting = COALESCE(b.interacting, a.interacting),
    interacting_last_update = CASE WHEN b.interacting IS NOT NULL THEN NOW() ELSE a.interacting_last_update END,
  seed_vault = COALESCE(b.seed_vault, a.seed_vault),
    seed_vault_last_update = CASE WHEN b.seed_vault IS NOT NULL THEN NOW() ELSE a.seed_vault_last_update END,
  diary_vars = COALESCE(b.diary_vars, a.diary_vars),
    diary_vars_last_update = CASE WHEN b.diary_vars IS NOT NULL THEN NOW() ELSE a.diary_vars_last_update END,
  collection_log = COALESCE(b.collection_log, a.collection_log),
    collection_log_last_update = CASE WHEN b.collection_log IS NOT NULL THEN NOW() ELSE a.collection_log_last_update END
FROM (VALUES ${placeholders.join(',')}) AS b(
  group_id,
  member_name,
  stats,
  coordinates,
  skills,
  quests,
  inventory,
  equipment,
  bank,
  rune_pouch,
  interacting,
  seed_vault,
  diary_vars,
  collection_log
)
WHERE a.group_id=b.group_id AND a.member_name=b.member_name::citext
`;

  await client.query(sql, params);
}

export async function depositItems(
  client: PoolClient,
  groupId: number,
  memberName: string,
  deposited: number[]
): Promise<void> {
  if (!deposited || deposited.length === 0) return;

  const bankRes = await client.query(
    'SELECT bank FROM groupironman.members WHERE group_id=$1 AND member_name=$2',
    [groupId, memberName]
  );
  if (bankRes.rows.length === 0) return;
  const bank: number[] = bankRes.rows[0].bank;
  if (!bank) return;

  const depositedMap: Record<number, number> = {};
  for (let i = 0; i < deposited.length; i += 2) {
    depositedMap[deposited[i]] = deposited[i + 1];
  }

  for (let i = 0; i < bank.length; i += 2) {
    const itemId = bank[i];
    if (depositedMap[itemId] !== undefined) {
      bank[i + 1] += depositedMap[itemId];
      delete depositedMap[itemId];
    }
  }

  for (const [id, quantity] of Object.entries(depositedMap)) {
    const itemId = parseInt(id, 10);
    if (itemId === 0 || quantity <= 0) continue;
    bank.push(itemId);
    bank.push(quantity);
  }

  await client.query(
    'UPDATE groupironman.members SET bank=$1, bank_last_update=NOW() WHERE group_id=$2 AND member_name=$3',
    [bank, groupId, memberName]
  );
}

export async function updateSharedBank(
  client: PoolClient,
  groupId: number,
  sharedBank: number[]
): Promise<void> {
  await client.query(
    'UPDATE groupironman.members SET bank=$1, bank_last_update=NOW() WHERE group_id=$2 AND member_name=$3',
    [sharedBank, groupId, SHARED_MEMBER]
  );
}
