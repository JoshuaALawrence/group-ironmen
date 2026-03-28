import { BaseElement } from "../base-element/base-element";
import { storage } from "../data/storage";
import { iconSrc } from "../data/event-icons";

interface BannerEvent {
  event_id: number;
  title: string;
  event_type: string;
  event_time: string;
  event_end_time: string | null;
  icon: string;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  boss: "#ff981f",
  skilling: "#0dc10d",
  minigame: "#00c8ff",
  quest: "#ffff00",
  raid: "#ff4444",
  pking: "#ff00ff",
  other: "#cccccc",
};

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export class EventBanner extends BaseElement {
  activeEvents: BannerEvent[];
  pollTimer: number | undefined;

  constructor() {
    super();
    this.activeEvents = [];
  }

  html(): string {
    return `{{event-banner.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.activeEvents = [];
    this.subscribe("get-group-data", () => {
      this.fetchAndRender();
      this.startPolling();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopPolling();
  }

  startPolling(): void {
    this.stopPolling();
    this.pollTimer = window.setInterval(() => this.fetchAndRender(), 60000);
  }

  stopPolling(): void {
    if (this.pollTimer !== undefined) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  get isDemo(): boolean {
    const group = storage.getGroup();
    return group?.groupName === "@EXAMPLE";
  }

  async fetchAndRender(): Promise<void> {
    if (this.isDemo) {
      this.activeEvents = [];
      this.render();
      return;
    }

    const group = storage.getGroup();
    if (!group) return;

    try {
      const headers: Record<string, string> = {};
      if (group.groupToken) {
        headers["Authorization"] = group.groupToken;
      }
      const res = await fetch(`/api/group/${group.groupName}/events`, { headers });
      if (res.ok) {
        const allEvents: BannerEvent[] = await res.json();
        const now = Date.now();
        // Show events that start within 30 min and haven't ended yet
        this.activeEvents = allEvents.filter((e) => {
          const start = new Date(e.event_time).getTime();
          const end = e.event_end_time
            ? new Date(e.event_end_time).getTime()
            : null;
          // Not yet started: show if within 30 min of start
          if (start > now) return start <= now + 30 * 60000;
          // Already started: hide if ended (or no end time and started over 30 min ago)
          if (end !== null) return end > now;
          return now - start <= 30 * 60000;
        });
      }
    } catch {
      /* ignore */
    }
    this.render();
  }

  getTimeLabel(event: BannerEvent): string {
    const now = Date.now();
    const start = new Date(event.event_time).getTime();
    const diffToStart = start - now;

    if (diffToStart > 0) {
      const mins = Math.ceil(diffToStart / 60000);
      return mins <= 1 ? "Starting now!" : `Starts in ${mins}m`;
    }

    // Event has started — show time until end if available
    if (event.event_end_time) {
      const end = new Date(event.event_end_time).getTime();
      const diffToEnd = end - now;
      if (diffToEnd > 0) {
        const mins = Math.ceil(diffToEnd / 60000);
        if (mins <= 1) return "Ending soon!";
        if (mins < 60) return `Ends in ${mins}m`;
        const hours = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return remainMins > 0 ? `Ends in ${hours}h ${remainMins}m` : `Ends in ${hours}h`;
      }
      return "Ended";
    }

    const ago = Math.floor(Math.abs(diffToStart) / 60000);
    return ago < 1 ? "Happening now!" : "Happening now!";
  }

  renderBanners(): string {
    if (this.activeEvents.length === 0) return "";
    return this.activeEvents
      .map((e) => {
        const color = EVENT_TYPE_COLORS[e.event_type] || EVENT_TYPE_COLORS.other;
        const iconHtml = e.icon
          ? `<img class="event-banner__icon" src="${iconSrc(e.icon)}" alt="" />`
          : "";
        return `<div class="event-banner__item" style="border-left-color: ${color}">
          ${iconHtml}
          <span class="event-banner__title">${escapeHtml(e.title)}</span>
          <span class="event-banner__time">${escapeHtml(this.getTimeLabel(e))}</span>
        </div>`;
      })
      .join("");
  }
}

customElements.define("event-banner", EventBanner);
