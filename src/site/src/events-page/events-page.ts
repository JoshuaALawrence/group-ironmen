import { BaseElement } from "../base-element/base-element";
import { storage } from "../data/storage";
import { groupData } from "../data/group-data";
import { EVENT_ICON_CATEGORIES, iconSrc } from "../data/event-icons";

interface GroupEvent {
  event_id: number;
  title: string;
  description: string;
  event_type: string;
  event_time: string;
  event_end_time: string | null;
  created_by: string;
  created_at: string;
  icon: string;
}

const EVENT_TYPE_INFO: Record<string, { label: string; color: string }> = {
  boss: { label: "Boss", color: "#ff981f" },
  skilling: { label: "Skilling", color: "#0dc10d" },
  minigame: { label: "Minigame", color: "#00c8ff" },
  quest: { label: "Quest", color: "#ffff00" },
  raid: { label: "Raid", color: "#ff4444" },
  pking: { label: "PK Trip", color: "#ff00ff" },
  other: { label: "Other", color: "#cccccc" },
};

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export class EventsPage extends BaseElement {
  events: GroupEvent[];
  showForm: boolean;
  filterType: string;
  selectedIcon: string;

  constructor() {
    super();
    this.events = [];
    this.showForm = false;
    this.filterType = "all";
    this.selectedIcon = "";
  }

  html(): string {
    return `{{events-page.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.events = [];
    this.showForm = false;
    this.filterType = "all";
    this.selectedIcon = "";
    this.fetchEvents();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  get isDemo(): boolean {
    const group = storage.getGroup();
    return group?.groupName === "@EXAMPLE";
  }

  getApiBase(): string {
    const group = storage.getGroup();
    return `/api/group/${group?.groupName}`;
  }

  getAuthHeaders(): Record<string, string> {
    const group = storage.getGroup();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (group?.groupToken) {
      headers["Authorization"] = group.groupToken;
    }
    return headers;
  }

  async fetchEvents(): Promise<void> {
    if (!this.isDemo) {
      try {
        const res = await fetch(`${this.getApiBase()}/events`, {
          headers: this.getAuthHeaders(),
        });
        if (res.ok) {
          this.events = await res.json();
        }
      } catch {
        /* ignore fetch errors */
      }
    }
    this.render();
    this.bindEvents();
  }

  getFilteredEvents(): GroupEvent[] {
    let filtered = this.events;
    if (this.filterType !== "all") {
      filtered = filtered.filter((e) => e.event_type === this.filterType);
    }
    return filtered;
  }

  getUpcomingEvents(): GroupEvent[] {
    const now = new Date().toISOString();
    return this.getFilteredEvents().filter((e) => {
      const end = e.event_end_time || e.event_time;
      return end >= now;
    });
  }

  getPastEvents(): GroupEvent[] {
    const now = new Date().toISOString();
    return this.getFilteredEvents()
      .filter((e) => {
        const end = e.event_end_time || e.event_time;
        return end < now;
      })
      .reverse();
  }

  formatEventTime(isoString: string): string {
    const d = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    return d.toLocaleDateString(undefined, options);
  }

  getRelativeTime(isoString: string): string {
    const now = Date.now();
    const target = new Date(isoString).getTime();
    const diff = target - now;
    const absDiff = Math.abs(diff);

    if (absDiff < 60000) return diff > 0 ? "Starting now" : "Just ended";
    if (absDiff < 3600000) {
      const mins = Math.floor(absDiff / 60000);
      return diff > 0 ? `In ${mins}m` : `${mins}m ago`;
    }
    if (absDiff < 86400000) {
      const hours = Math.floor(absDiff / 3600000);
      return diff > 0 ? `In ${hours}h` : `${hours}h ago`;
    }
    const days = Math.floor(absDiff / 86400000);
    return diff > 0 ? `In ${days}d` : `${days}d ago`;
  }

  renderEventCard(event: GroupEvent): string {
    const info = EVENT_TYPE_INFO[event.event_type] || EVENT_TYPE_INFO.other;
    const endRef = event.event_end_time ? new Date(event.event_end_time) : new Date(event.event_time);
    const isPast = endRef < new Date();
    const pastClass = isPast ? " events-page__card--past" : "";
    const iconHtml = event.icon
      ? `<img class="events-page__card-icon" src="${iconSrc(event.icon)}" alt="" />`
      : "";
    return `
      <div class="events-page__card${pastClass}" data-event-id="${event.event_id}">
        <div class="events-page__card-header">
          <span class="events-page__card-type" style="color: ${info.color}">${info.label}</span>
          <span class="events-page__card-time">${escapeHtml(this.formatEventTime(event.event_time))}${event.event_end_time ? ` — ${escapeHtml(this.formatEventTime(event.event_end_time))}` : ''}</span>
        </div>
        <div class="events-page__card-title-row">
          ${iconHtml}
          <h3 class="events-page__card-title">${escapeHtml(event.title)}</h3>
        </div>
        ${event.description ? `<p class="events-page__card-desc">${escapeHtml(event.description)}</p>` : ""}
        <div class="events-page__card-footer">
          <span class="events-page__card-relative">${escapeHtml(this.getRelativeTime(event.event_time))}</span>
          <span class="events-page__card-author">Posted by ${escapeHtml(event.created_by)}</span>
          ${this.isDemo ? '' : `<button class="events-page__delete-btn" data-delete-id="${event.event_id}" title="Cancel event">\u00D7</button>`}
        </div>
      </div>`;
  }

  renderUpcoming(): string {
    const upcoming = this.getUpcomingEvents();
    if (upcoming.length === 0) {
      return `<div class="events-page__empty">No upcoming adventures on the board. Rally your group!</div>`;
    }
    return upcoming.map((e) => this.renderEventCard(e)).join("");
  }

  renderPast(): string {
    const past = this.getPastEvents();
    if (past.length === 0) return "";
    return `
      <div class="events-page__past-section">
        <h3 class="events-page__section-subtitle">Past Adventures</h3>
        ${past.map((e) => this.renderEventCard(e)).join("")}
      </div>`;
  }

  renderFilterTabs(): string {
    const types = [{ key: "all", label: "All" }, ...Object.entries(EVENT_TYPE_INFO).map(([key, v]) => ({ key, label: v.label }))];
    return types
      .map(
        (t) =>
          `<button class="events-page__filter-tab${this.filterType === t.key ? " active" : ""}" data-filter="${t.key}">${t.label}</button>`
      )
      .join("");
  }

  renderForm(): string {
    if (!this.showForm) return "";

    const members = [...groupData.members.values()]
      .filter((m) => (m as any).name !== "@SHARED")
      .map((m) => (m as any).name as string);

    const typeOptions = Object.entries(EVENT_TYPE_INFO)
      .map(([key, v]) => `<option value="${key}">${v.label}</option>`)
      .join("");

    const activeMember = storage.getActiveMember();
    const memberOptions = members
      .map((n) => `<option value="${escapeHtml(n)}"${n === activeMember ? ' selected' : ''}>${escapeHtml(n)}</option>`)
      .join("");

    return `
      <div class="events-page__form rsborder rsbackground">
        <h3 class="events-page__form-title rstext">Post a New Adventure</h3>
        <div class="events-page__form-row">
          <label class="events-page__label">Title</label>
          <input type="text" id="event-title" class="events-page__input" placeholder="e.g. Corp Beast mass, GWD trip..." maxlength="100" />
        </div>
        <div class="events-page__form-row">
          <label class="events-page__label">Type</label>
          <select id="event-type" class="events-page__select">${typeOptions}</select>
        </div>
        <div class="events-page__form-row">
          <label class="events-page__label">Date &amp; Time</label>
          <input type="datetime-local" id="event-time" class="events-page__input" />
        </div>
        <div class="events-page__form-row">
          <label class="events-page__label">End Time <span class="events-page__label-hint">(optional)</span></label>
          <input type="datetime-local" id="event-end-time" class="events-page__input" />
        </div>
        <div class="events-page__form-row">
          <label class="events-page__label">Description</label>
          <textarea id="event-desc" class="events-page__textarea" placeholder="Gear requirements, world, location..." maxlength="500" rows="3"></textarea>
        </div>
        <div class="events-page__form-row">
          <label class="events-page__label">Icon</label>
          <div class="events-page__icon-picker" id="event-icon-picker">
            <button type="button" class="events-page__icon-option${this.selectedIcon === '' ? ' selected' : ''}" data-icon="">None</button>
            ${EVENT_ICON_CATEGORIES.map((cat) => `<div class="events-page__icon-category"><span class="events-page__icon-category-label">${cat.category}</span><div class="events-page__icon-category-grid">${cat.icons.map((ic) => `<button type="button" class="events-page__icon-option${this.selectedIcon === ic.id ? ' selected' : ''}" data-icon="${ic.id}"><img src="${ic.src}" alt="${ic.id}" /></button>`).join('')}</div></div>`).join('')}
          </div>
        </div>
        <div class="events-page__form-row">
          <label class="events-page__label">Posted by</label>
          <select id="event-author" class="events-page__select">${memberOptions}</select>
        </div>
        <div class="events-page__form-actions">
          <button class="men-button events-page__submit-btn" id="event-submit">Post to Board</button>
          <button class="men-button events-page__cancel-btn" id="event-cancel">Cancel</button>
        </div>
      </div>`;
  }

  bindEvents(): void {
    const newBtn = this.querySelector("#events-new-btn");
    if (newBtn) {
      this.eventListener(newBtn, "click", () => {
        this.showForm = true;
        this.render();
        this.bindEvents();
      });
    }

    const cancelBtn = this.querySelector("#event-cancel");
    if (cancelBtn) {
      this.eventListener(cancelBtn, "click", () => {
        this.showForm = false;
        this.selectedIcon = "";
        this.render();
        this.bindEvents();
      });
    }

    const submitBtn = this.querySelector("#event-submit");
    if (submitBtn) {
      this.eventListener(submitBtn, "click", () => this.handleSubmit());
    }

    const filterTabs = this.querySelectorAll(".events-page__filter-tab");
    for (const tab of Array.from(filterTabs)) {
      this.eventListener(tab, "click", () => {
        this.filterType = tab.getAttribute("data-filter") || "all";
        this.render();
        this.bindEvents();
      });
    }

    const deleteBtns = this.querySelectorAll(".events-page__delete-btn");
    for (const btn of Array.from(deleteBtns)) {
      this.eventListener(btn, "click", (e: Event) => {
        e.stopPropagation();
        const eventId = btn.getAttribute("data-delete-id");
        if (eventId) this.handleDelete(parseInt(eventId, 10));
      });
    }

    const iconBtns = this.querySelectorAll(".events-page__icon-option");
    for (const btn of Array.from(iconBtns)) {
      this.eventListener(btn, "click", () => {
        this.selectedIcon = btn.getAttribute("data-icon") || "";
        for (const ib of Array.from(iconBtns)) {
          ib.classList.toggle("selected", ib === btn);
        }
      });
    }
  }

  async handleSubmit(): Promise<void> {
    const titleEl = this.querySelector("#event-title") as HTMLInputElement | null;
    const typeEl = this.querySelector("#event-type") as HTMLSelectElement | null;
    const timeEl = this.querySelector("#event-time") as HTMLInputElement | null;
    const endTimeEl = this.querySelector("#event-end-time") as HTMLInputElement | null;
    const descEl = this.querySelector("#event-desc") as HTMLTextAreaElement | null;
    const authorEl = this.querySelector("#event-author") as HTMLSelectElement | null;

    const title = titleEl?.value?.trim() || "";
    const eventType = typeEl?.value || "boss";
    const eventTime = timeEl?.value || "";
    const eventEndTime = endTimeEl?.value || "";
    const description = descEl?.value?.trim() || "";
    const createdBy = authorEl?.value || "";

    if (!title) {
      titleEl?.focus();
      return;
    }
    if (!eventTime) {
      timeEl?.focus();
      return;
    }

    try {
      const res = await fetch(`${this.getApiBase()}/events`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          title,
          event_type: eventType,
          event_time: new Date(eventTime).toISOString(),
          event_end_time: eventEndTime ? new Date(eventEndTime).toISOString() : undefined,
          description,
          created_by: createdBy,
          icon: this.selectedIcon,
        }),
      });
      if (res.ok) {
        this.showForm = false;
        this.selectedIcon = "";
        await this.fetchEvents();
      }
    } catch {
      /* ignore */
    }
  }

  async handleDelete(eventId: number): Promise<void> {
    try {
      const res = await fetch(`${this.getApiBase()}/events/${eventId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        this.events = this.events.filter((e) => e.event_id !== eventId);
        this.render();
        this.bindEvents();
      }
    } catch {
      /* ignore */
    }
  }
}

customElements.define("events-page", EventsPage);
