import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BaseElement } from "../base-element/base-element";
import { pubsub } from "../data/pubsub";
import { PlayerStats } from "../player-stats/player-stats";

type StatBarTestElement = HTMLElement & {
  update: ReturnType<typeof vi.fn>;
};

function resetPubSub(): void {
  pubsub.subscribers.clear();
  pubsub.mostRecentPublish.clear();
}

function installRenderStub(): void {
  vi.spyOn(PlayerStats.prototype, "render").mockImplementation(function (this: PlayerStats) {
    this.innerHTML = `
      <span class="player-stats__world"></span>
      <stat-bar class="player-stats__hitpoints-bar"></stat-bar>
      <stat-bar class="player-stats__prayer-bar"></stat-bar>
      <stat-bar class="player-stats__energy-bar"></stat-bar>
      <div class="player-stats__hitpoints-numbers">${this.hitpoints.current} / ${this.hitpoints.max}</div>
      <div class="player-stats__prayer-numbers">${this.prayer.current} / ${this.prayer.max}</div>
    `;

    (this.querySelector(".player-stats__hitpoints-bar") as StatBarTestElement).update = vi.fn();
    (this.querySelector(".player-stats__prayer-bar") as StatBarTestElement).update = vi.fn();
    (this.querySelector(".player-stats__energy-bar") as StatBarTestElement).update = vi.fn();
  });
}

function createConnectedStats(playerName = "zara"): PlayerStats {
  const stats = new PlayerStats();
  stats.setAttribute("player-name", playerName);
  document.body.appendChild(stats);
  return stats;
}

describe("player-stats", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    resetPubSub();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    resetPubSub();
    vi.restoreAllMocks();
  });

  it("initializes constructor defaults", () => {
    const stats = new PlayerStats();

    expect(stats.hitpoints).toEqual({ current: 1, max: 1 });
    expect(stats.prayer).toEqual({ current: 1, max: 1 });
    expect(stats.energy).toEqual({ current: 1, max: 1 });
    expect(stats.world).toBe(301);
    expect(stats.playerName).toBeNull();
    expect(stats.worldEl).toBeNull();
    expect(stats.hitpointsBar).toBeNull();
    expect(stats.prayerBar).toBeNull();
    expect(stats.energyBar).toBeNull();
  });

  it("connects, subscribes to pubsub events, and disconnects cleanly", () => {
    installRenderStub();
    const baseConnected = vi.spyOn(BaseElement.prototype, "connectedCallback");
    const baseDisconnected = vi.spyOn(BaseElement.prototype, "disconnectedCallback");

    const stats = createConnectedStats("alice");

    expect(baseConnected).toHaveBeenCalledTimes(1);
    expect(stats.playerName).toBe("alice");
    expect(stats.worldEl).toBeInstanceOf(HTMLElement);
    expect(stats.hitpointsBar).toBeTruthy();
    expect(stats.prayerBar).toBeTruthy();
    expect(stats.energyBar).toBeTruthy();
    expect(pubsub.anyoneListening("stats:alice")).toBe(true);
    expect(pubsub.anyoneListening("inactive:alice")).toBe(true);
    expect(pubsub.anyoneListening("active:alice")).toBe(true);

    const updatedSpy = vi.spyOn(stats, "handleUpdatedStats");
    const inactiveSpy = vi.spyOn(stats, "handleWentInactive");
    const activeSpy = vi.spyOn(stats, "handleWentActive");

    const payload = {
      hitpoints: { current: 70, max: 99 },
      prayer: { current: 50, max: 99 },
      energy: { current: 8000, max: 10000 },
      world: 302,
    };
    const inactiveMember = { inactive: true, lastUpdated: new Date("2026-03-28T12:00:00.000Z") };
    const activeMember = { stats: payload };

    pubsub.publish(`stats:${stats.playerName}`, payload, inactiveMember);
    pubsub.publish(`inactive:${stats.playerName}`, true, { lastUpdated: inactiveMember.lastUpdated });
    pubsub.publish(`active:${stats.playerName}`, undefined, activeMember);

    expect(updatedSpy).toHaveBeenCalledWith(payload, inactiveMember);
    expect(inactiveSpy).toHaveBeenCalledWith(true, { lastUpdated: inactiveMember.lastUpdated });
    expect(activeSpy).toHaveBeenCalledWith(undefined, activeMember);

    stats.disconnectedCallback();

    expect(baseDisconnected).toHaveBeenCalledTimes(1);
    expect(pubsub.anyoneListening("stats:alice")).toBe(false);
    expect(pubsub.anyoneListening("inactive:alice")).toBe(false);
    expect(pubsub.anyoneListening("active:alice")).toBe(false);

    updatedSpy.mockClear();
    inactiveSpy.mockClear();
    activeSpy.mockClear();

    pubsub.publish(`stats:${stats.playerName}`, payload, inactiveMember);
    pubsub.publish(`inactive:${stats.playerName}`, true, { lastUpdated: inactiveMember.lastUpdated });
    pubsub.publish(`active:${stats.playerName}`, undefined, activeMember);

    expect(updatedSpy).not.toHaveBeenCalled();
    expect(inactiveSpy).not.toHaveBeenCalled();
    expect(activeSpy).not.toHaveBeenCalled();
  });

  it("delegates handle methods to stat and world updates", () => {
    const stats = new PlayerStats();
    const payload = {
      hitpoints: { current: 60, max: 99 },
      prayer: { current: 44, max: 99 },
      energy: { current: 7000, max: 10000 },
      world: 330,
    };
    const lastUpdated = new Date("2026-03-28T08:30:00.000Z");

    const updateStatBars = vi.spyOn(stats, "updateStatBars").mockImplementation(() => undefined);
    const updateWorld = vi.spyOn(stats, "updateWorld").mockImplementation(() => undefined);

    stats.handleUpdatedStats(payload, { inactive: true, lastUpdated });
    expect(updateStatBars).toHaveBeenCalledWith(payload);
    expect(updateWorld).toHaveBeenCalledWith(330, true, lastUpdated);

    updateWorld.mockClear();
    stats.handleWentInactive(true, { lastUpdated });
    expect(updateWorld).toHaveBeenCalledWith(undefined, true, lastUpdated);

    updateWorld.mockClear();
    stats.world = 320;
    updateWorld.mockImplementation(() => {
      expect(stats.world).toBeUndefined();
    });
    stats.handleWentActive(undefined, { stats: payload });
    expect(updateWorld).toHaveBeenCalledWith(330, false);
  });

  it("handles inactive and active world transitions and ignores no-op updates", () => {
    const stats = new PlayerStats();

    stats.updateWorld(320, false);
    expect(stats.world).toBe(301);

    stats.worldEl = document.createElement("span");

    const lastUpdated = new Date("2026-03-28T10:15:00.000Z");
    const locale = Intl?.DateTimeFormat()?.resolvedOptions()?.locale || undefined;
    stats.updateWorld(undefined, true, lastUpdated);
    expect(stats.worldEl.innerText).toBe(lastUpdated.toLocaleString(locale));
    expect(stats.classList.contains("player-stats__inactive")).toBe(true);

    stats.updateWorld(undefined, true);
    expect(stats.worldEl.innerText).toBe("Offline");
    expect(stats.classList.contains("player-stats__inactive")).toBe(true);

    stats.updateWorld(302, false);
    expect(stats.world).toBe(302);
    expect(stats.worldEl.innerText).toBe("W302");
    expect(stats.classList.contains("player-stats__inactive")).toBe(false);

    stats.worldEl.innerText = "unchanged";
    stats.updateWorld(302, false);
    expect(stats.worldEl.innerText).toBe("unchanged");
  });

  it("returns early when updateStatBars receives incomplete stats and updates bars on animation frame", () => {
    installRenderStub();
    const stats = createConnectedStats();
    const hitpointsBar = stats.hitpointsBar as StatBarTestElement;
    const prayerBar = stats.prayerBar as StatBarTestElement;
    const energyBar = stats.energyBar as StatBarTestElement;
    const raf = vi.spyOn(window, "requestAnimationFrame");

    stats.updateStatBars({
      hitpoints: { current: 70, max: 99 },
      prayer: { current: 50, max: 99 },
      world: 302,
    });

    expect(raf).not.toHaveBeenCalled();
    expect(hitpointsBar.update).not.toHaveBeenCalled();
    expect(prayerBar.update).not.toHaveBeenCalled();
    expect(energyBar.update).not.toHaveBeenCalled();

    raf.mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    stats.updateStatBars({
      hitpoints: { current: 70, max: 99 },
      prayer: { current: 50, max: 99 },
      energy: { current: 8000, max: 10000 },
      world: 302,
    });

    expect((stats.querySelector(".player-stats__hitpoints-numbers") as HTMLElement).innerText).toBe("70 / 99");
    expect((stats.querySelector(".player-stats__prayer-numbers") as HTMLElement).innerText).toBe("50 / 99");
    expect(hitpointsBar.update).toHaveBeenCalledWith(70 / 99);
    expect(prayerBar.update).toHaveBeenCalledWith(50 / 99);
    expect(energyBar.update).toHaveBeenCalledWith(0.8);
  });

  it("updates text only when values change and no-ops when markup is missing or unchanged", () => {
    const stats = new PlayerStats();
    const hitpointsNumbers = document.createElement("div");
    hitpointsNumbers.className = "player-stats__hitpoints-numbers";
    hitpointsNumbers.innerText = "existing";
    stats.appendChild(hitpointsNumbers);

    stats.updateText({ current: 1, max: 1 }, "hitpoints");
    expect(hitpointsNumbers.innerText).toBe("existing");
    expect(stats.hitpoints).toEqual({ current: 1, max: 1 });

    stats.updateText({ current: 5, max: 10 }, "hitpoints");
    expect(hitpointsNumbers.innerText).toBe("5 / 10");
    expect(stats.hitpoints).toEqual({ current: 5, max: 10 });

    stats.updateText({ current: 9, max: 9 }, "energy");
    expect(stats.energy).toEqual({ current: 1, max: 1 });
  });
});