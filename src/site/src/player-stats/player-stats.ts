import { BaseElement } from "../base-element/base-element";

type StatValue = {
  current: number;
  max: number;
};

type PlayerStatsPayload = {
  hitpoints?: StatValue;
  prayer?: StatValue;
  energy?: StatValue;
  world: number;
};

type StatBarElement = HTMLElement & {
  update: (value: number) => void;
};

export class PlayerStats extends BaseElement {
  hitpoints: StatValue;
  prayer: StatValue;
  energy: StatValue;
  world: number | undefined;
  playerName: string | null;
  worldEl: HTMLElement | null;
  hitpointsBar: StatBarElement | null;
  prayerBar: StatBarElement | null;
  energyBar: StatBarElement | null;

  constructor() {
    super();
    this.hitpoints = { current: 1, max: 1 };
    this.prayer = { current: 1, max: 1 };
    this.energy = { current: 1, max: 1 };
    this.world = 301;
    this.playerName = null;
    this.worldEl = null;
    this.hitpointsBar = null;
    this.prayerBar = null;
    this.energyBar = null;
  }

  html(): string {
    return `{{player-stats.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.render();
    this.worldEl = this.querySelector<HTMLElement>(".player-stats__world");

    this.hitpointsBar = this.querySelector<StatBarElement>(".player-stats__hitpoints-bar");
    this.prayerBar = this.querySelector<StatBarElement>(".player-stats__prayer-bar");
    this.energyBar = this.querySelector<StatBarElement>(".player-stats__energy-bar");

    this.subscribe(`stats:${this.playerName}`, (stats, member) =>
      this.handleUpdatedStats(stats as PlayerStatsPayload, member as { inactive: boolean; lastUpdated?: Date })
    );
    this.subscribe(`inactive:${this.playerName}`, (inactive, member) =>
      this.handleWentInactive(inactive as boolean, member as { lastUpdated?: Date })
    );
    this.subscribe(`active:${this.playerName}`, (_, member) =>
      this.handleWentActive(undefined, member as { stats: PlayerStatsPayload })
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  handleUpdatedStats(stats: PlayerStatsPayload, member: { inactive: boolean; lastUpdated?: Date }): void {
    this.updateStatBars(stats);
    this.updateWorld(stats.world, member.inactive, member.lastUpdated);
  }

  handleWentInactive(inactive: boolean, member: { lastUpdated?: Date }): void {
    this.updateWorld(undefined, inactive, member.lastUpdated);
  }

  handleWentActive(_: unknown, member: { stats: PlayerStatsPayload }): void {
    this.world = undefined;
    this.updateWorld(member.stats.world, false);
  }

  updateWorld(world: number | undefined, isInactive: boolean, lastUpdated?: Date): void {
    if (!this.worldEl) {
      return;
    }

    if (isInactive) {
      const locale = Intl?.DateTimeFormat()?.resolvedOptions()?.locale || undefined;
      this.worldEl.innerText = lastUpdated ? `${lastUpdated.toLocaleString(locale)}` : "Offline";
      if (!this.classList.contains("player-stats__inactive")) {
        this.classList.add("player-stats__inactive");
      }
    } else if (this.world !== world) {
      this.world = world;
      if (this.classList.contains("player-stats__inactive")) {
        this.classList.remove("player-stats__inactive");
      }
      this.worldEl.innerText = `W${this.world}`;
    }
  }

  updateStatBars(stats: PlayerStatsPayload): void {
    if (stats.hitpoints === undefined || stats.prayer === undefined || stats.energy === undefined) {
      return;
    }

    const { hitpoints, prayer, energy } = stats;

    this.updateText(hitpoints, "hitpoints");
    this.updateText(prayer, "prayer");

    window.requestAnimationFrame(() => {
      if (!this.isConnected || !this.hitpointsBar || !this.prayerBar || !this.energyBar) return;
      this.hitpointsBar.update(hitpoints.current / hitpoints.max);
      this.prayerBar.update(prayer.current / prayer.max);
      this.energyBar.update(energy.current / energy.max);
    });
  }

  updateText(stat: StatValue, name: "hitpoints" | "prayer" | "energy"): void {
    const numbers = this.querySelector<HTMLElement>(`.player-stats__${name}-numbers`);
    if (!numbers) return;

    const currentStat = this[name];
    if (currentStat === undefined || currentStat.current !== stat.current || currentStat.max !== stat.max) {
      this[name] = stat;
      numbers.innerText = `${stat.current} / ${stat.max}`;
    }
  }
}
customElements.define("player-stats", PlayerStats);
