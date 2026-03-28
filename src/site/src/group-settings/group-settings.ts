import { BaseElement } from "../base-element/base-element";
import { appearance } from "../appearance";
import { storage } from "../data/storage";
import { pubsub } from "../data/pubsub";
import { memberSelectDialogManager } from "../member-select-dialog/member-select-dialog-manager";

type MemberSummary = {
  name: string;
};

type EditMemberElement = HTMLElement & {
  member?: MemberSummary;
  memberNumber?: number;
};

interface DiscordSettings {
  has_webhook: boolean;
  members: { name: string; has_discord_id: boolean }[];
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export class GroupSettings extends BaseElement {
  memberSection: HTMLElement | null = null;
  panelDockSide: HTMLElement | null = null;
  appearanceStyle: HTMLElement | null = null;
  discordSettings: DiscordSettings | null = null;

  html(): string {
    const selectedPanelDockSide = appearance.getLayout();
    const style = appearance.getTheme();
    return `{{group-settings.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.memberSection = this.querySelector(".group-settings__members");
    this.panelDockSide = this.querySelector(".group-settings__panels");
    this.appearanceStyle = this.querySelector(".group-settings__style");
    this.subscribe("members-updated", this.handleUpdatedMembers.bind(this));
    if (this.panelDockSide) {
      this.eventListener(this.panelDockSide, "change", this.handlePanelDockSideChange.bind(this));
    }
    if (this.appearanceStyle) {
      this.eventListener(this.appearanceStyle, "change", this.handleStyleChange.bind(this));
    }
    const changeIdentityBtn = this.querySelector("#change-identity-btn");
    if (changeIdentityBtn) {
      this.eventListener(changeIdentityBtn, "click", this.handleChangeIdentity.bind(this));
    }
    this.updateIdentityDisplay();
    this.subscribe("active-member-changed", () => this.updateIdentityDisplay());
    this.fetchDiscordSettings();
  }

  handleStyleChange(): void {
    const styleInput = this.querySelector<HTMLInputElement>('input[name="appearance-style"]:checked');
    if (!styleInput) {
      return;
    }

    appearance.setTheme(styleInput.value);
  }

  handlePanelDockSideChange(): void {
    const sideInput = this.querySelector<HTMLInputElement>('input[name="panel-dock-side"]:checked');
    if (!sideInput) {
      return;
    }

    if (sideInput.value === "right") {
      appearance.setLayout("row-reverse");
    } else {
      appearance.setLayout("row");
    }
  }

  handleUpdatedMembers(members: unknown): void {
    if (!Array.isArray(members) || !this.memberSection) {
      return;
    }

    const filteredMembers = members.filter(
      (member): member is MemberSummary =>
        typeof member === "object" && member !== null && "name" in member && (member as MemberSummary).name !== "@SHARED"
    );

    const memberEdits = document.createDocumentFragment();
    for (let index = 0; index < filteredMembers.length; ++index) {
      const member = filteredMembers[index];
      const memberEdit = document.createElement("edit-member") as EditMemberElement;
      memberEdit.member = member;
      memberEdit.memberNumber = index + 1;

      memberEdits.appendChild(memberEdit);
    }

    if (filteredMembers.length < 5) {
      const addMember = document.createElement("edit-member") as EditMemberElement;
      addMember.memberNumber = filteredMembers.length + 1;
      memberEdits.appendChild(addMember);
    }

    this.memberSection.innerHTML = "";
    this.memberSection.appendChild(memberEdits);
  }

  updateIdentityDisplay(): void {
    const el = this.querySelector(".group-settings__identity-name");
    if (el) {
      const name = storage.getActiveMember();
      el.textContent = name || "Not set";
    }
  }

  async handleChangeIdentity(): Promise<void> {
    if (this.isDemo) return;
    const memberEls = this.memberSection?.querySelectorAll("edit-member");
    if (!memberEls) return;
    const names: string[] = [];
    for (const el of Array.from(memberEls)) {
      const member = (el as EditMemberElement).member;
      if (member) names.push(member.name);
    }
    if (names.length === 0) return;
    const selected = await memberSelectDialogManager.selectMember(names);
    storage.setActiveMember(selected);
    pubsub.publish("active-member-changed", selected);
    this.updateIdentityDisplay();
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

  async fetchDiscordSettings(): Promise<void> {
    if (this.isDemo) return;
    try {
      const res = await fetch(`${this.getApiBase()}/discord-settings`, {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        this.discordSettings = await res.json();
        this.renderDiscordSection();
      }
    } catch {
      /* ignore */
    }
  }

  renderDiscordSection(): void {
    const container = this.querySelector(".group-settings__discord-content");
    if (!container || !this.discordSettings) return;

    const memberRows = this.discordSettings.members
      .map(
        (m) => `
        <div class="group-settings__discord-member">
          <label class="group-settings__discord-label">${escapeHtml(m.name)}${m.has_discord_id ? ' <span class="group-settings__discord-set">Set \u2713</span>' : ''}</label>
          <input type="text" class="group-settings__discord-input" data-member-name="${escapeHtml(m.name)}" value="" placeholder="${m.has_discord_id ? 'Enter new ID to update' : 'Discord User ID'}" />
        </div>`
      )
      .join("");

    container.innerHTML = `
      <div class="group-settings__discord-field">
        <label class="group-settings__discord-label">Webhook URL${this.discordSettings.has_webhook ? ' <span class="group-settings__discord-set">Set \u2713</span>' : ''}</label>
        <input type="text" class="group-settings__discord-input" id="discord-webhook-url" value="" placeholder="${this.discordSettings.has_webhook ? 'Enter new URL to update' : 'https://discord.com/api/webhooks/...'}" />
      </div>
      <div class="group-settings__discord-field">
        <label class="group-settings__discord-label">Member Discord IDs</label>
        ${memberRows}
      </div>
      <div class="group-settings__discord-actions">
        <button class="men-button small" id="discord-save-btn">Save</button>
        <span class="group-settings__discord-status" id="discord-status"></span>
      </div>
    `;

    const saveBtn = container.querySelector("#discord-save-btn");
    if (saveBtn) {
      this.eventListener(saveBtn, "click", () => this.saveDiscordSettings());
    }
  }

  async saveDiscordSettings(): Promise<void> {
    const statusEl = this.querySelector("#discord-status");
    const webhookInput = this.querySelector("#discord-webhook-url") as HTMLInputElement | null;
    const memberInputs = this.querySelectorAll<HTMLInputElement>(".group-settings__discord-member input");

    const webhook_url = webhookInput?.value?.trim() || "";
    const members: { name: string; discord_id: string }[] = [];
    for (const input of Array.from(memberInputs)) {
      const name = input.getAttribute("data-member-name") || "";
      members.push({ name, discord_id: input.value.trim() });
    }

    try {
      if (statusEl) statusEl.textContent = "Saving...";
      const res = await fetch(`${this.getApiBase()}/discord-settings`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ webhook_url, members }),
      });
      if (res.ok) {
        if (statusEl) {
          statusEl.textContent = "Saved!";
          statusEl.className = "group-settings__discord-status group-settings__discord-status--ok";
        }
        await this.fetchDiscordSettings();
      } else {
        const msg = await res.text();
        if (statusEl) {
          statusEl.textContent = msg || "Error saving";
          statusEl.className = "group-settings__discord-status group-settings__discord-status--err";
        }
      }
    } catch {
      if (statusEl) {
        statusEl.textContent = "Error saving";
        statusEl.className = "group-settings__discord-status group-settings__discord-status--err";
      }
    }
  }
}

customElements.define("group-settings", GroupSettings);