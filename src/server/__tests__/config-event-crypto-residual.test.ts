import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  dotenvConfig: vi.fn(),
  fsReadFileSync: vi.fn(),
  axiosPost: vi.fn(),
  getUpcomingEventsWithWebhooks: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("dotenv", () => {
  const config = state.dotenvConfig;
  return {
    default: { config },
    config,
  };
});

vi.mock("fs", () => ({
  default: { readFileSync: state.fsReadFileSync },
  readFileSync: state.fsReadFileSync,
}));

vi.mock("axios", () => ({
  default: { post: state.axiosPost },
}));

vi.mock("../db", () => ({
  getUpcomingEventsWithWebhooks: state.getUpcomingEventsWithWebhooks,
}));

vi.mock("../logger", () => ({
  default: {
    info: state.loggerInfo,
    error: state.loggerError,
  },
}));

const originalEnv = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

function expectedHash(value: string, salt: string, iterations: number, secret: string): Buffer {
  const hash = crypto.createHash("blake2s256");
  const input = Buffer.from(value, "utf8");

  for (let i = 0; i < iterations; i++) {
    hash.update(input);
  }

  hash.update(Buffer.from(salt, "utf8"));
  hash.update(Buffer.from(secret, "utf8"));
  return hash.digest();
}

function buildEvent(
  overrides: Partial<{
    event_id: number;
    group_id: number;
    title: string;
    description: string | null;
    event_type: string;
    event_time: string;
    event_end_time: string | null;
    created_by: string;
    icon: string;
    group_name: string;
    discord_webhook_url: string;
  }> = {}
) {
  return {
    event_id: 1,
    group_id: 2,
    title: "Raid night",
    description: "Bring supplies",
    event_type: "raid",
    event_time: new Date(Date.now() + 60_000).toISOString(),
    event_end_time: null,
    created_by: "Alice",
    icon: "skull",
    group_name: "Unit",
    discord_webhook_url: "https://discord.example/webhook",
    ...overrides,
  };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  restoreEnv();
  vi.clearAllMocks();
});

afterEach(() => {
  restoreEnv();
  vi.restoreAllMocks();
});

describe("server config residual branches", () => {
  it("uses built-in defaults when env vars are unset or empty", async () => {
    Object.assign(process.env, {
      PG_USER: "",
      PG_PASSWORD: "",
      PG_HOST: "",
      PG_PORT: "",
      PG_DB: "",
      HCAPTCHA_SECRET: "",
      HCAPTCHA_SITEKEY: "",
      BACKEND_SECRET: "",
      PORT: "",
      LOG_LEVEL: "",
    });

    vi.resetModules();
    const { default: config } = await import("../config");

    expect(state.dotenvConfig).toHaveBeenCalledOnce();
    expect(config.pg).toEqual({
      user: "postgres",
      password: "postgres",
      host: "localhost",
      port: 5432,
      database: "postgres",
      max: 16,
    });
    expect(config.hcaptcha).toEqual({
      enabled: false,
      sitekey: "",
      secret: "",
    });
    expect(config.backendSecret).toBe("");
    expect(config.port).toBe(4000);
    expect(config.logLevel).toBe("info");
  });

  it("parses numeric env values and enables hcaptcha when a secret is present", async () => {
    Object.assign(process.env, {
      PG_USER: "ironman",
      PG_PASSWORD: "secret",
      PG_HOST: "db.internal",
      PG_PORT: "6543",
      PG_DB: "group_ironmen",
      HCAPTCHA_SECRET: "captcha-secret",
      HCAPTCHA_SITEKEY: "captcha-sitekey",
      BACKEND_SECRET: "backend-secret",
      PORT: "8123",
      LOG_LEVEL: "debug",
    });

    vi.resetModules();
    const { default: config } = await import("../config");

    expect(config.pg).toEqual({
      user: "ironman",
      password: "secret",
      host: "db.internal",
      port: 6543,
      database: "group_ironmen",
      max: 16,
    });
    expect(config.hcaptcha).toEqual({
      enabled: true,
      sitekey: "captcha-sitekey",
      secret: "captcha-secret",
    });
    expect(config.backendSecret).toBe("backend-secret");
    expect(config.port).toBe(8123);
    expect(config.logLevel).toBe("debug");
  });

  it("surfaces invalid numeric env values as NaN instead of silently falling back", async () => {
    Object.assign(process.env, {
      PG_PORT: "not-a-number",
      PORT: "still-not-a-number",
    });

    vi.resetModules();
    const { default: config } = await import("../config");

    expect(Number.isNaN(config.pg.port)).toBe(true);
    expect(Number.isNaN(config.port)).toBe(true);
  });
});

describe("server crypto residual branches", () => {
  it("falls back to BACKEND_SECRET when the secret file cannot be read", async () => {
    process.env.BACKEND_SECRET = "env-secret";
    state.fsReadFileSync.mockImplementation(() => {
      throw new Error("missing secret file");
    });

    vi.resetModules();
    const cryptoModule = await import("../crypto");

    expect(cryptoModule.hash("value", "salt", 0)).toEqual(
      expectedHash("value", "salt", 0, "env-secret")
    );
    expect(cryptoModule.tokenHash("token", "salt")).toBe(
      expectedHash("token", "salt", 2, "env-secret").toString("hex")
    );
  });

  it("prefers the on-disk secret over BACKEND_SECRET when available", async () => {
    process.env.BACKEND_SECRET = "env-secret";
    state.fsReadFileSync.mockReturnValue("file-secret");

    vi.resetModules();
    const cryptoModule = await import("../crypto");

    expect(cryptoModule.hash("value", "salt", 1)).toEqual(
      expectedHash("value", "salt", 1, "file-secret")
    );
  });
});

describe("event scheduler residual branches", () => {
  it("starts, restarts, and suppresses duplicate notifications while building fallback embeds", async () => {
    let scheduledCallback: (() => Promise<void>) | undefined;

    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void) => {
      scheduledCallback = fn as () => Promise<void>;
      return 321 as never;
    }) as unknown as typeof setInterval);

    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(
      (() => undefined) as typeof clearInterval
    );

    state.getUpcomingEventsWithWebhooks.mockResolvedValue([
      buildEvent({
        event_type: "mystery",
        description: "A".repeat(1100),
        event_end_time: new Date(Date.now() + 120_000).toISOString(),
      }),
    ]);
    state.axiosPost.mockResolvedValue({ status: 204 });

    vi.resetModules();
    const scheduler = await import("../event-scheduler");

    scheduler.stopEventScheduler();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    scheduler.startEventScheduler();

  await flushAsyncWork();

  expect(state.axiosPost).toHaveBeenCalledTimes(1);

    expect(state.loggerInfo).toHaveBeenCalledWith(
      "Starting event Discord notification scheduler (60s interval)"
    );
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

    const [webhookUrl, payload, requestConfig] = state.axiosPost.mock.calls[0] as [
      string,
      {
        username: string;
        content: string;
        embeds: Array<{
          title: string;
          color: number;
          fields: Array<{ name: string; value: string; inline: boolean }>;
          footer: { text: string };
          timestamp: string;
        }>;
      },
      Record<string, unknown>,
    ];

    expect(webhookUrl).toBe("https://discord.example/webhook");
    expect(requestConfig).toEqual({
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });
    expect(payload.username).toBe("Adventure Board");
    expect(payload.content).toBe("📌 **An adventure is starting soon!**");
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].title).toBe("📌  Raid night");
    expect(payload.embeds[0].color).toBe(0xcccccc);
    expect(payload.embeds[0].footer).toEqual({ text: "Unit • Adventure Board" });

    const detailsField = payload.embeds[0].fields.find((field) => field.name === "📋 Details");
    expect(detailsField?.value).toHaveLength(1024);
    expect(detailsField?.value.endsWith("...")).toBe(true);
    expect(payload.embeds[0].fields.some((field) => field.name === "🏁 Ends")).toBe(true);

    await scheduledCallback?.();
    expect(state.axiosPost).toHaveBeenCalledTimes(1);

    scheduler.startEventScheduler();
  await flushAsyncWork();

  expect(state.getUpcomingEventsWithWebhooks).toHaveBeenCalledTimes(3);

    expect(clearIntervalSpy).toHaveBeenCalledWith(321);

    scheduler.stopEventScheduler();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
  });

  it("logs webhook and polling failures without throwing", async () => {
    let scheduledCallback: (() => Promise<void>) | undefined;

    vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void) => {
      scheduledCallback = fn as () => Promise<void>;
      return 777 as never;
    }) as unknown as typeof setInterval);

    vi.spyOn(globalThis, "clearInterval").mockImplementation((() => undefined) as typeof clearInterval);

    state.getUpcomingEventsWithWebhooks
      .mockResolvedValueOnce([
        buildEvent({
          event_id: 9,
          title: "Broken clock",
          description: null,
          event_end_time: null,
          event_type: "skilling",
          event_time: "not-a-date",
        }),
      ])
      .mockRejectedValueOnce(new Error("database offline"));
    state.axiosPost.mockRejectedValueOnce(new Error("webhook down"));

    vi.resetModules();
    const scheduler = await import("../event-scheduler");

    scheduler.startEventScheduler();

    await flushAsyncWork();

    expect(state.loggerError).toHaveBeenCalledWith(
      "Failed to send Discord notification for event 9: webhook down"
    );

    await scheduledCallback?.();

    expect(state.loggerError).toHaveBeenCalledWith("Event scheduler check failed: database offline");

    scheduler.stopEventScheduler();
  });
});