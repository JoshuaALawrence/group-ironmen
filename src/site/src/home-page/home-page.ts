import { BaseElement } from "../base-element/base-element";
import { MemberData } from "../data/member-data";
import { Quest, QuestState } from "../data/quest";
import { Skill, SkillName } from "../data/skill";
import { groupData } from "../data/group-data";
import { collectionLog } from "../data/collection-log";
import { storage } from "../data/storage";

interface BlogPost {
  title: string;
  description: string;
  link: string;
  category: string;
  pubDate: string;
  imageUrl: string;
}

interface GroupEvent {
  event_id: number;
  title: string;
  event_type: string;
  event_time: string;
  event_end_time: string | null;
  icon: string;
}

interface YtVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  published: string;
}

interface TwitchStream {
  live: boolean;
  title: string;
  thumbnail: string;
  link: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Game Updates": "#ff981f",
  Community: "#0dc10d",
  "Dev Blogs": "#00c8ff",
  "Future Updates": "#ffff00",
  Events: "#ff00ff",
};

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

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatGp(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export class HomePage extends BaseElement {
  members: MemberData[] = [];
  blogPosts: BlogPost[] = [];
  upcomingEvents: GroupEvent[] = [];
  ytVideos: YtVideo[] = [];
  twitchStream: TwitchStream | null = null;

  html(): string {
    return `{{home-page.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.subscribe("members-updated", (members) => {
      this.members = members as MemberData[];
      this.updateDashboard();
    });
    this.fetchBlogPosts();
    this.fetchEvents();
    this.fetchYtVideos();
    this.fetchTwitchStream();
  }

  async fetchBlogPosts(): Promise<void> {
    try {
      const res = await fetch("/api/osrs-news");
      if (res.ok) {
        this.blogPosts = await res.json();
        this.renderNews();
      }
    } catch { /* ignore */ }
  }

  async fetchEvents(): Promise<void> {
    const group = storage.getGroup();
    if (!group || group.groupName === "@EXAMPLE") return;
    try {
      const headers: Record<string, string> = {};
      if (group.groupToken) headers["Authorization"] = group.groupToken;
      const res = await fetch(`/api/group/${group.groupName}/events`, { headers });
      if (res.ok) {
        const allEvents: GroupEvent[] = await res.json();
        const now = Date.now();
        this.upcomingEvents = allEvents
          .filter((e) => {
            const start = new Date(e.event_time).getTime();
            const end = e.event_end_time ? new Date(e.event_end_time).getTime() : null;
            return start > now || (end !== null && end > now);
          })
          .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())
          .slice(0, 5);
        this.renderEvents();
      }
    } catch { /* ignore */ }
  }

  async fetchYtVideos(): Promise<void> {
    try {
      const res = await fetch("/api/osrs-youtube");
      if (res.ok) {
        this.ytVideos = await res.json();
        this.renderYtVideos();
      }
    } catch { /* ignore */ }
  }

  async fetchTwitchStream(): Promise<void> {
    try {
      const res = await fetch("/api/osrs-twitch");
      if (res.ok) {
        this.twitchStream = await res.json();
        this.renderTwitchStream();
      }
    } catch { /* ignore */ }
  }

  updateDashboard(): void {
    this.renderMemberCards();
    this.renderGroupStats();
  }

  renderMemberCards(): void {
    const container = this.querySelector(".home-page__members");
    if (!container) return;
    const members = this.members.filter((m) => m.name !== "@SHARED");
    const titles = this.getMemberTitles(members);
    container.innerHTML = members.map((m) => {
      const t = titles.get(m.name);
      return this.renderMemberCard(m, t?.title || "", t?.color || "", t?.desc || "");
    }).join("");
  }

  renderMemberCard(member: MemberData, title: string, titleColor: string, titleDesc: string): string {
    const totalLevel = this.getTotalLevel(member);
    const totalXp = this.getTotalXp(member);
    const questsDone = this.getQuestsCompleted(member);
    const totalQuests = Object.keys(Quest.questData).length;
    const collectionCount = collectionLog.totalUnlockedItems(member.name);
    const collectionTotal = collectionLog.totalUniqueItems;
    const diaryDone = this.getDiaryTasksCompleted(member);
    const combatLevel = member.combatLevel ?? 3;
    const inactive = member.inactive;
    const statusDot = inactive ? "home-page__dot--offline" : "home-page__dot--online";

    const topSkills = this.getTopSkills(member, 3);

    return `
      <div class="home-page__member-card rsborder rsbackground">
        <div class="home-page__member-header">
          <div class="home-page__member-name-row">
            <span class="home-page__dot ${statusDot}"></span>
            <span class="home-page__member-name">${escapeHtml(member.name)}</span>
          </div>
          <span class="home-page__combat-badge">
            <img src="/ui/197-0.png" class="home-page__combat-icon" alt="" />${combatLevel}
          </span>
        </div>
        ${title ? `<span class="home-page__member-title" style="color:${titleColor}" title="${escapeHtml(titleDesc)}">${escapeHtml(title)}</span>` : ""}
        <div class="home-page__member-bars">
          <div class="home-page__bar-row">
            <span class="home-page__bar-label">Total Lvl</span>
            <span class="home-page__bar-value">${formatNumber(totalLevel)}</span>
          </div>
          <div class="home-page__bar-row">
            <span class="home-page__bar-label">Total XP</span>
            <span class="home-page__bar-value">${formatGp(totalXp)}</span>
          </div>
          <div class="home-page__bar-row">
            <span class="home-page__bar-label">Collections</span>
            <span class="home-page__bar-value">${formatNumber(collectionCount)}${collectionTotal ? `<span class="home-page__bar-dim">/${formatNumber(collectionTotal)}</span>` : ""}</span>
          </div>
          <div class="home-page__bar-row">
            <span class="home-page__bar-label">Quests</span>
            <span class="home-page__bar-value">${questsDone}<span class="home-page__bar-dim">/${totalQuests}</span></span>
          </div>
          <div class="home-page__bar-row">
            <span class="home-page__bar-label">Diaries</span>
            <span class="home-page__bar-value">${diaryDone.done}<span class="home-page__bar-dim">/${diaryDone.total}</span></span>
          </div>
        </div>
        ${topSkills.length > 0 ? `
        <div class="home-page__top-skills">
          ${topSkills.map((s) => `
            <div class="home-page__skill-pill">
              <img src="${Skill.getIcon(s.name)}" alt="" /><span>${s.level}</span>
            </div>
          `).join("")}
        </div>` : ""}
      </div>`;
  }

  renderGroupStats(): void {
    const container = this.querySelector(".home-page__stats-grid");
    if (!container) return;
    const members = this.members.filter((m) => m.name !== "@SHARED");
    const totalItems = Object.keys(groupData.groupItems).length;
    const bestQp = this.getGroupQuestPoints(members);
    const maxQp = Quest.totalPoints;
    const totalGeValue = this.getGroupGeValue();
    const totalHaValue = this.getGroupHaValue();
    const onlineCount = members.filter((m) => !m.inactive).length;

    container.innerHTML = `
      <div class="home-page__stat-card">
        <span class="home-page__stat-icon">⚔️</span>
        <span class="home-page__stat-big">${onlineCount}<span class="home-page__stat-dim">/${members.length}</span></span>
        <span class="home-page__stat-label">Online</span>
      </div>
      <div class="home-page__stat-card">
        <span class="home-page__stat-icon">🎒</span>
        <span class="home-page__stat-big">${formatNumber(totalItems)}</span>
        <span class="home-page__stat-label">Unique Items</span>
      </div>
      <div class="home-page__stat-card">
        <span class="home-page__stat-icon">📜</span>
        <span class="home-page__stat-big">${bestQp}<span class="home-page__stat-dim">/${maxQp || "?"}</span></span>
        <span class="home-page__stat-label">Best QP</span>
      </div>
      <div class="home-page__stat-card">
        <span class="home-page__stat-icon">💰</span>
        <span class="home-page__stat-big">${formatGp(totalGeValue)}</span>
        <span class="home-page__stat-label">GE Value</span>
      </div>
      <div class="home-page__stat-card">
        <span class="home-page__stat-icon">🪙</span>
        <span class="home-page__stat-big">${formatGp(totalHaValue)}</span>
        <span class="home-page__stat-label">HA Value</span>
      </div>
    `;
  }

  renderNews(): void {
    const container = this.querySelector(".home-page__news-list");
    if (!container) return;
    const posts = this.blogPosts.slice(0, 4);
    if (posts.length === 0) {
      container.innerHTML = `<span class="home-page__empty">No news available.</span>`;
      return;
    }
    container.innerHTML = posts.map((post) => {
      const catColor = CATEGORY_COLORS[post.category] || "#ccc";
      const img = post.imageUrl ? `<img class="home-page__news-img" src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy" />` : "";
      return `
        <a class="home-page__news-item" href="${escapeHtml(post.link)}" target="_blank" rel="noopener noreferrer">
          ${img}
          <div class="home-page__news-body">
            <div class="home-page__news-meta">
              <span style="color:${catColor}">${escapeHtml(post.category)}</span>
              <span class="home-page__news-date">${formatDate(post.pubDate)}</span>
            </div>
            <span class="home-page__news-title">${escapeHtml(post.title)}</span>
          </div>
        </a>`;
    }).join("");
  }

  renderEvents(): void {
    const container = this.querySelector(".home-page__events-list");
    if (!container) return;
    if (this.upcomingEvents.length === 0) {
      container.innerHTML = `<span class="home-page__empty">No upcoming events.</span>`;
      return;
    }
    container.innerHTML = this.upcomingEvents.map((e) => {
      const color = EVENT_TYPE_COLORS[e.event_type] || EVENT_TYPE_COLORS.other;
      const when = this.getEventTimeLabel(e);
      return `
        <div class="home-page__event-row" style="border-left-color:${color}">
          <span class="home-page__event-title">${escapeHtml(e.title)}</span>
          <span class="home-page__event-time">${escapeHtml(when)}</span>
        </div>`;
    }).join("");
  }

  renderYtVideos(): void {
    const container = this.querySelector(".home-page__yt-list");
    if (!container) return;
    if (this.ytVideos.length === 0) {
      container.innerHTML = `<span class="home-page__empty">No videos available.</span>`;
      return;
    }
    container.innerHTML = this.ytVideos.map((v) => `
      <a class="home-page__yt-item" href="https://www.youtube.com/watch?v=${escapeHtml(v.videoId)}" target="_blank" rel="noopener noreferrer">
        <div class="home-page__yt-preview">
          <img class="home-page__yt-thumb" src="${escapeHtml(v.thumbnail)}" alt="" loading="lazy" />
          <span class="home-page__yt-title">${escapeHtml(v.title)}</span>
        </div>
      </a>
    `).join("");
  }

  renderTwitchStream(): void {
    const container = this.querySelector(".home-page__twitch-card");
    if (!container || !this.twitchStream) return;
    const s = this.twitchStream;
    const statusClass = s.live ? "home-page__twitch-badge--live" : "home-page__twitch-badge--offline";
    const statusText = s.live ? "LIVE" : "OFFLINE";
    const title = s.title ? escapeHtml(s.title) : (s.live ? "Live now" : "Last stream");
    const thumb = s.thumbnail
      ? `<img class="home-page__twitch-thumb" src="${escapeHtml(s.thumbnail)}" alt="" loading="lazy" />`
      : `<div class="home-page__twitch-thumb home-page__twitch-thumb--placeholder"></div>`;

    container.innerHTML = `
      <a class="home-page__twitch-link" href="${escapeHtml(s.link || 'https://www.twitch.tv/oldschoolrs')}" target="_blank" rel="noopener noreferrer">
        <div class="home-page__twitch-preview">
          ${thumb}
          <span class="home-page__twitch-badge ${statusClass}">${statusText}</span>
          <span class="home-page__twitch-title">${title}</span>
        </div>
      </a>
    `;
  }

  getEventTimeLabel(event: GroupEvent): string {
    const now = Date.now();
    const start = new Date(event.event_time).getTime();
    const diff = start - now;
    if (diff <= 0) return "Happening now";
    const mins = Math.ceil(diff / 60000);
    if (mins < 60) return `In ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `In ${hours}h`;
    const days = Math.floor(hours / 24);
    return `In ${days}d`;
  }

  getTotalLevel(member: MemberData): number {
    if (!member.skills) return 0;
    const overall = member.skills[SkillName.Overall];
    return overall?.level ?? 0;
  }

  getTotalXp(member: MemberData): number {
    if (!member.skills) return 0;
    const overall = member.skills[SkillName.Overall];
    return overall?.xp ?? 0;
  }

  getQuestsCompleted(member: MemberData): number {
    let count = 0;
    for (const quest of Object.values(member.quests)) {
      if (quest.state === QuestState.FINISHED) count++;
    }
    return count;
  }

  getDiaryTasksCompleted(member: MemberData): { done: number; total: number } {
    if (!member.diaries || typeof member.diaries !== "object") return { done: 0, total: 0 };
    let done = 0;
    let total = 0;
    for (const region of Object.values(member.diaries)) {
      if (!region || typeof region !== "object") continue;
      for (const tasks of Object.values(region)) {
        if (!Array.isArray(tasks)) continue;
        for (const completed of tasks) {
          total++;
          if (completed) done++;
        }
      }
    }
    return { done, total };
  }

  getTopSkills(member: MemberData, count: number): Array<{ name: string; level: number }> {
    if (!member.skills) return [];
    return Object.values(member.skills)
      .filter((s) => s.name !== SkillName.Overall)
      .sort((a, b) => b.level - a.level)
      .slice(0, count)
      .map((s) => ({ name: s.name, level: s.level }));
  }

  getGroupQuestPoints(members: MemberData[]): number {
    let best = 0;
    for (const member of members) {
      let points = 0;
      for (const quest of Object.values(member.quests)) {
        if (quest.state === QuestState.FINISHED) {
          const data = Quest.questData[quest.id];
          if (data) points += Number(data.points) || 0;
        }
      }
      if (points > best) best = points;
    }
    return best;
  }

  getGroupGeValue(): number {
    let total = 0;
    for (const item of Object.values(groupData.groupItems)) {
      total += (item.gePrice ?? 0) * item.quantity;
    }
    return total;
  }

  getGroupHaValue(): number {
    let total = 0;
    for (const item of Object.values(groupData.groupItems)) {
      total += (item.highAlch ?? 0) * item.quantity;
    }
    return total;
  }

  getMemberTitles(members: MemberData[]): Map<string, { title: string; color: string; desc: string }> {
    const titles = new Map<string, { title: string; color: string; desc: string }>();
    const claimed = new Set<string>();

    interface TitleCandidate {
      title: string;
      desc: string;
      color: string;
      score: (m: MemberData) => number;
      higher: boolean;
    }

    const candidates: TitleCandidate[] = [
      { title: "Gold Goblin", desc: "Highest GE value in the group", color: "#ffd700", score: (m) => this.getMemberGeValue(m), higher: true },
      { title: "Broke Boy", desc: "Lowest GE value... someone's gotta be last", color: "#8b6914", score: (m) => this.getMemberGeValue(m), higher: false },
      { title: "Sweat Lord", desc: "Most total XP... do they ever log off?", color: "#ff4444", score: (m) => this.getTotalXp(m), higher: true },
      { title: "Combat Monkey", desc: "Highest combat level in the group", color: "#ff6600", score: (m) => m.combatLevel ?? 3, higher: true },
      { title: "Pacifist", desc: "Lowest combat level... violence is never the answer", color: "#88ddff", score: (m) => m.combatLevel ?? 3, higher: false },
      { title: "Lore Nerd", desc: "Most quests completed... actually reads the dialogue", color: "#c8a2f8", score: (m) => this.getQuestsCompleted(m), higher: true },
      { title: "Tree Hugger", desc: "Highest Woodcutting... talks to trees", color: "#4caf50", score: (m) => m.skills?.[SkillName.Woodcutting]?.level ?? 0, higher: true },
      { title: "Rock Sniffer", desc: "Highest Mining... can smell copper from a mile away", color: "#a0826d", score: (m) => m.skills?.[SkillName.Mining]?.level ?? 0, higher: true },
      { title: "Fish Whisperer", desc: "Highest Fishing... the fish fear them", color: "#42a5f5", score: (m) => m.skills?.[SkillName.Fishing]?.level ?? 0, higher: true },
      { title: "Kitchen Menace", desc: "Highest Cooking... burns water occasionally", color: "#ff9800", score: (m) => m.skills?.[SkillName.Cooking]?.level ?? 0, higher: true },
      { title: "Touch Grass", desc: "Highest Farming... ironically never goes outside", color: "#66bb6a", score: (m) => m.skills?.[SkillName.Farming]?.level ?? 0, higher: true },
      { title: "Pray Warrior", desc: "Highest Prayer... buries bones for fun", color: "#e0e0e0", score: (m) => m.skills?.[SkillName.Prayer]?.level ?? 0, higher: true },
      { title: "Sticky Fingers", desc: "Highest Thieving... check your pockets", color: "#ab47bc", score: (m) => m.skills?.[SkillName.Thieving]?.level ?? 0, higher: true },
      { title: "Wizard Wannabe", desc: "Highest Magic... splashes in their sleep", color: "#5c6bc0", score: (m) => m.skills?.[SkillName.Magic]?.level ?? 0, higher: true },
      { title: "Gym Rat", desc: "Highest Strength... never skips arm day", color: "#ef5350", score: (m) => m.skills?.[SkillName.Strength]?.level ?? 0, higher: true },
      { title: "Bug Catcher", desc: "Highest Hunter... has a net collection", color: "#8bc34a", score: (m) => m.skills?.[SkillName.Hunter]?.level ?? 0, higher: true },
      { title: "Arsonist", desc: "Highest Firemaking... suspiciously into flames", color: "#ff5722", score: (m) => m.skills?.[SkillName.Firemaking]?.level ?? 0, higher: true },
      { title: "Parkour Pro", desc: "Highest Agility... rooftop enjoyer", color: "#26c6da", score: (m) => m.skills?.[SkillName.Agility]?.level ?? 0, higher: true },
    ];

    for (const c of candidates) {
      if (claimed.size >= members.length) break;
      // Find the TRUE best among ALL members
      const allSorted = [...members].sort((a, b) =>
        c.higher ? c.score(b) - c.score(a) : c.score(a) - c.score(b)
      );
      const trueBest = allSorted[0];
      // Only assign if the true best hasn't been claimed yet
      if (claimed.has(trueBest.name)) continue;
      if (c.score(trueBest) > 0 || !c.higher) {
        titles.set(trueBest.name, { title: c.title, color: c.color, desc: c.desc });
        claimed.add(trueBest.name);
      }
    }

    return titles;
  }

  getMemberGeValue(member: MemberData): number {
    let total = 0;
    for (const item of member.allItems()) {
      const qty = member.totalItemQuantity(item.id);
      total += (item.gePrice ?? 0) * qty;
    }
    return total;
  }
}

customElements.define("home-page", HomePage);
