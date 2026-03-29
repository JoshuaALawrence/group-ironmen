import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  clientRelease: vi.fn(),
  poolConnect: vi.fn(),
  pool: {
    connect: vi.fn(),
  },
}));

vi.mock("pg", () => ({
  Pool: vi.fn(function () {
    return dbState.pool;
  }),
}));

function makeClient() {
  return {
    query: dbState.clientQuery,
    release: dbState.clientRelease,
  };
}

async function loadDb() {
  vi.resetModules();
  return import("../db");
}

describe("database helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BACKEND_SECRET = "unit-test-secret";
    dbState.pool.connect.mockResolvedValue(makeClient() as never);
  });

  it("runs schema migrations when they are missing", async () => {
    const db = await loadDb();
    const migrationCounts = new Map<string, string>([
      ["add_collection_log", "1"],
      ["migrate_collection_log_v2", "0"],
    ]);
    let duplicateRenameAttempts = 0;

    dbState.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT COUNT(*) FROM groupironman.migrations")) {
        return { rows: [{ count: migrationCounts.get(String(params?.[0])) ?? "0" }] };
      }

      if (sql.includes("SELECT a.group_id, a.member_id, a.member_name FROM groupironman.members a")) {
        return {
          rows: [
            { group_id: 1, member_id: 11, member_name: "Alice" },
            { group_id: 1, member_id: 12, member_name: "alice" },
          ],
        };
      }

      if (sql.includes("SELECT member_id, items FROM groupironman.collection_log")) {
        return {
          rows: [
            { member_id: "22", items: [101, 1, 102, 2] },
            { member_id: "22", items: [103, 3] },
          ],
        };
      }

      if (sql.includes("UPDATE groupironman.members SET member_name=$1 WHERE member_id=$2")) {
        duplicateRenameAttempts += 1;
        if (duplicateRenameAttempts === 1) {
          throw new Error("duplicate key");
        }
      }

      return { rows: [] };
    });

    await db.updateSchema();

    expect(dbState.clientRelease).toHaveBeenCalledTimes(1);
    expect(dbState.clientQuery).toHaveBeenCalledWith("CREATE SCHEMA IF NOT EXISTS groupironman");
    expect(dbState.clientQuery).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS groupironman.groups"));
    expect(dbState.clientQuery).toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE groupironman.groups ADD COLUMN IF NOT EXISTS version INTEGER default 1"));
    expect(dbState.clientQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE groupironman.members as a SET collection_log=b.collection_log"), expect.any(Array));
  });

  it("skips migrations that already ran", async () => {
    const db = await loadDb();

    dbState.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT COUNT(*) FROM groupironman.migrations")) {
        return { rows: [{ count: "1" }] };
      }
      return { rows: [] };
    });

    await db.updateSchema();

    expect(dbState.clientRelease).toHaveBeenCalledTimes(1);
    expect(dbState.clientQuery).toHaveBeenCalledWith("CREATE SCHEMA IF NOT EXISTS groupironman");
    expect(dbState.clientQuery).not.toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE groupironman.groups ADD COLUMN IF NOT EXISTS version INTEGER default 1"));
  });

  it("creates groups and looks them up", async () => {
    const db = await loadDb();
    dbState.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO groupironman.groups")) {
        return { rows: [{ group_id: 42 }] };
      }
      if (sql.includes("SELECT group_id FROM groupironman.groups")) {
        return { rows: [{ group_id: 42 }] };
      }
      return { rows: [] };
    });

    await db.createGroup({ name: "Unit", member_names: ["Alice", "Bob"], token: "token" });
    await expect(db.getGroup("Unit", "token")).resolves.toBe(42);

    const insertCalls = dbState.clientQuery.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO groupironman.members"));
    expect(insertCalls.length).toBeGreaterThan(0);
    expect(insertCalls[0][1]).toEqual([42, db.SHARED_MEMBER, "Alice", "Bob"]);

    dbState.clientQuery.mockImplementation(async () => ({ rows: [] }));
    await expect(db.getGroup("Unit", "token")).resolves.toBeNull();
  });

  it("enforces member limits and member operations", async () => {
    const db = await loadDb();

    dbState.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("COUNT(*) FROM groupironman.members")) {
        return { rows: [{ count: String(params?.[0] === 2 ? 5 : 4) }] };
      }
      if (sql.includes("SELECT member_id FROM groupironman.members")) {
        return { rows: [{ member_id: 123 }] };
      }
      if (sql.includes("SELECT COUNT(member_name) FROM groupironman.members")) {
        return { rows: [{ count: "1" }] };
      }
      if (sql.includes("SELECT member_name, discord_id FROM groupironman.members")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    await expect(db.addGroupMember(1, "Charlie")).resolves.toBeUndefined();
    await expect(db.isMemberInGroup(1, "Charlie")).resolves.toBe(true);
    await expect(db.renameGroupMember(1, "Alice", "Alicia")).resolves.toBeUndefined();
    await expect(db.deleteGroupMember(1, "Charlie")).resolves.toBeUndefined();

    await expect(db.addGroupMember(2, "Overflow")).rejects.toMatchObject({ statusCode: 400 });
    expect(dbState.clientQuery).toHaveBeenCalledWith(
      "UPDATE groupironman.members SET member_name=$1 WHERE group_id=$2 AND member_name=$3",
      ["Alicia", 1, "Alice"]
    );
  });

  it("maps group member data and skill periods", async () => {
    const db = await loadDb();

    dbState.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM groupironman.members WHERE group_id=$2")) {
        return {
          rows: [
            {
              member_name: "Alice",
              last_updated: "2024-01-01T00:00:00Z",
              stats: [1, 2],
              coordinates: [3, 4, 5],
              skills: [6, 7],
              quests: [8, 9],
              inventory: [10, 11],
              equipment: [12, 13],
              bank: [14, 15],
              rune_pouch: [16, 17],
              interacting: '{"name":"Goblin"}',
              seed_vault: [18, 19],
              diary_vars: [20, 21],
              collection_log: [22, 23],
            },
            {
              member_name: "Bob",
              last_updated: null,
              interacting: "bad-json",
            },
          ],
        };
      }

      if (sql.includes("FROM groupironman.skills_month")) {
        return {
          rows: [
            { member_name: "Alice", time: "2024-01-01T00:00:00Z", skills: [1, 2] },
            { member_name: "Alice", time: "2024-01-02T00:00:00Z", skills: [3, 4] },
            { member_name: "Bob", time: "2024-01-01T00:00:00Z", skills: [5, 6] },
          ],
        };
      }

      return { rows: [] };
    });

    const members = await db.getGroupData(1, "2024-01-01T00:00:00Z");
    expect(members).toEqual([
      expect.objectContaining({
        name: "Alice",
        stats: [1, 2],
        coordinates: [3, 4, 5],
        interacting: { name: "Goblin" },
        collection_log_v2: [22, 23],
      }),
      expect.objectContaining({ name: "Bob" }),
    ]);

    const skills = await db.getSkillsForPeriod(1, "month");
    expect(skills).toEqual([
      { name: "Alice", skill_data: [
        { time: "2024-01-01T00:00:00Z", data: [1, 2] },
        { time: "2024-01-02T00:00:00Z", data: [3, 4] },
      ] },
      { name: "Bob", skill_data: [{ time: "2024-01-01T00:00:00Z", data: [5, 6] }] },
    ]);
  });

  it("handles aggregation, cache, bulk updates, and bank deposits", async () => {
    const db = await loadDb();
    const directClient = makeClient() as never;
    dbState.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("last_aggregation FROM groupironman.aggregation_info")) {
        return { rows: [{ last_aggregation: "2024-01-01T00:00:00Z" }] };
      }
      if (sql.includes("FROM groupironman.wise_old_man_player_boss_kc_cache")) {
        return { rows: [{ payload: { boss: 99 } }] };
      }
      if (sql.includes("SELECT bank FROM groupironman.members")) {
        return { rows: [{ bank: [100, 1, 200, 2] }] };
      }
      if (sql.includes("UPDATE groupironman.members SET bank=$1, bank_last_update=NOW()")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    await db.aggregateSkills();
    await db.applySkillsRetention();
    await expect(db.getCachedWiseOldManPlayerBossKc("Alice")).resolves.toEqual({ boss: 99 });
    await db.upsertWiseOldManPlayerBossKc("Alice", { boss: 100 }, new Date("2024-02-01T00:00:00Z"));

    await db.executeBulkUpdate(directClient, [
      {
        group_id: 1,
        name: "Alice",
        stats: [1, 2, 3, 4, 5, 6, 7],
        inventory: [1, 2],
        deposited: [300, 4],
      },
    ]);

    await db.executeBulkUpdate(directClient, []);

    await db.depositItems(directClient, 1, "Alice", [100, 3, 400, 5]);
    await db.updateSharedBank(directClient, 1, [500, 6]);

    expect(dbState.clientQuery.mock.calls.some(([sql]) => String(sql).includes("UPDATE groupironman.aggregation_info SET last_aggregation=NOW()"))).toBe(true);
    expect(dbState.clientQuery.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO groupironman.wise_old_man_player_boss_kc_cache"))).toBe(true);
    expect(dbState.clientQuery.mock.calls.some(([sql]) => String(sql).includes("UPDATE groupironman.members as a SET"))).toBe(true);
    expect(dbState.clientQuery.mock.calls.some(([sql, params]) => String(sql).includes("UPDATE groupironman.members SET bank=$1, bank_last_update=NOW() WHERE group_id=$2 AND member_name=$3") && Array.isArray(params) && JSON.stringify(params[0]) === JSON.stringify([100, 4, 200, 2, 400, 5]))).toBe(true);
    expect(dbState.clientQuery.mock.calls.some(([sql, params]) => String(sql).includes("UPDATE groupironman.members SET bank=$1, bank_last_update=NOW() WHERE group_id=$2 AND member_name=$3") && Array.isArray(params) && JSON.stringify(params[0]) === JSON.stringify([500, 6]))).toBe(true);
  });

  it("handles group events and Discord settings", async () => {
    const db = await loadDb();
    dbState.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM groupironman.group_events")) {
        return {
          rows: [
            {
              event_id: 1,
              group_id: 2,
              title: "Raid night",
              description: "Bring supplies",
              event_type: "raid",
              event_time: "2024-01-02T00:00:00Z",
              event_end_time: null,
              created_by: "Alice",
              created_at: "2024-01-01T00:00:00Z",
              icon: "skull",
            },
          ],
        };
      }
      if (sql.includes("INSERT INTO groupironman.group_events")) {
        return {
          rows: [
            {
              event_id: 7,
              group_id: 2,
              title: "Bossing",
              description: "",
              event_type: "boss",
              event_time: "2024-01-03T00:00:00Z",
              event_end_time: null,
              created_by: "Alice",
              created_at: "2024-01-01T00:00:00Z",
              icon: "boss",
            },
          ],
        };
      }
      if (sql.includes("DELETE FROM groupironman.group_events")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("SELECT discord_webhook_url FROM groupironman.groups")) {
        return { rows: [{ discord_webhook_url: "https://discord.example/webhook" }] };
      }
      if (sql.includes("SELECT member_name, discord_id FROM groupironman.members")) {
        return { rows: [{ member_name: "Alice", discord_id: "1" }] };
      }
      if (sql.includes("SELECT e.event_id, e.group_id, e.title")) {
        return {
          rows: [
            {
              event_id: 10,
              group_id: 2,
              title: "Soon",
              description: "Details",
              event_type: "boss",
              event_time: "2024-01-03T00:00:00Z",
              event_end_time: null,
              created_by: "Alice",
              icon: "boss",
              group_name: "Unit",
              discord_webhook_url: "https://discord.example/webhook",
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(db.getGroupEvents(2)).resolves.toHaveLength(1);
    await expect(
      db.createGroupEvent(2, "Bossing", "", "boss", "2024-01-03T00:00:00Z", null, "Alice", "boss")
    ).resolves.toMatchObject({ event_id: 7 });
    await expect(db.deleteGroupEvent(2, 7)).resolves.toBe(true);
    await expect(db.getDiscordSettings(2)).resolves.toEqual({
      webhook_url: "https://discord.example/webhook",
      members: [{ name: "Alice", discord_id: "1" }],
    });
    await expect(db.getUpcomingEventsWithWebhooks("2024-01-01T00:00:00Z", "2024-01-04T00:00:00Z")).resolves.toHaveLength(1);

    await expect(db.createGroupEvent(2, "Bad", "", "bad-type", "2024-01-03T00:00:00Z", null, "Alice", "boss")).rejects.toMatchObject({
      statusCode: 400,
    });

    await db.updateDiscordSettings(2, null, [{ name: "Alice", discord_id: "123" }]);
    expect(dbState.clientQuery).toHaveBeenCalledWith("UPDATE groupironman.members SET discord_id=$1 WHERE group_id=$2 AND member_name=$3", ["123", 2, "Alice"]);
  });
});