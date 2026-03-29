import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  activeMember: null as string | null,
  group: { groupName: "group", groupToken: "token" } as { groupName: string; groupToken?: string } | null,
  appearance: {
    getLayout: vi.fn(() => "row"),
    getTheme: vi.fn(() => "classic"),
    setLayout: vi.fn(),
    setTheme: vi.fn(),
  },
  storage: {
    getActiveMember: vi.fn(() => state.activeMember),
    setActiveMember: vi.fn((name: string) => {
      state.activeMember = name;
    }),
    getGroup: vi.fn(() => state.group),
  },
  memberSelect: {
    selectMember: vi.fn(async (names: string[]) => names.at(-1) ?? ""),
  },
  fetchMock: vi.fn(),
}));

vi.mock("../appearance", () => ({
  appearance: state.appearance,
}));

vi.mock("../data/storage", () => ({
  storage: state.storage,
}));

vi.mock("../member-select-dialog/member-select-dialog-manager", () => ({
  memberSelectDialogManager: state.memberSelect,
}));

import { pubsub } from "../data/pubsub";
import { GroupSettings } from "../group-settings/group-settings";

function flushPromises(): Promise<void> {
  return Promise.resolve().then(() => undefined).then(() => undefined);
}

function mountSettings(markup: string): GroupSettings {
  const element = new GroupSettings();
  vi.spyOn(element, "html").mockReturnValue(markup);
  document.body.appendChild(element);
  return element;
}

describe("group-settings residual coverage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    state.activeMember = null;
    state.group = { groupName: "group", groupToken: "token" };
    pubsub.subscribers.clear();
    pubsub.mostRecentPublish.clear();
    vi.clearAllMocks();
    state.memberSelect.selectMember.mockImplementation(async (names: string[]) => names.at(-1) ?? "");
    state.fetchMock.mockReset();
    state.fetchMock.mockResolvedValue({ ok: false, text: async () => "" });
    vi.stubGlobal("fetch", state.fetchMock);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.mostRecentPublish.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("covers html, connection no-ops, render guards, and fetch failures", async () => {
    const plain = new GroupSettings();
    expect(plain.html()).toBe("{{group-settings.html}}");
    expect(state.appearance.getLayout).toHaveBeenCalledTimes(1);
    expect(state.appearance.getTheme).toHaveBeenCalledTimes(1);
    expect(() => plain.updateIdentityDisplay()).not.toThrow();

    state.fetchMock.mockResolvedValueOnce({ ok: false, text: async () => "not configured" });
    const element = mountSettings(`
      <button class="group-settings__tab group-settings__tab--active">Broken</button>
      <div class="group-settings__panel group-settings__panel--active" data-panel="general"></div>
    `);
    await flushPromises();

    expect(() => element.handleUpdatedMembers([{ name: "Alice" }])).not.toThrow();

    const brokenTab = element.querySelector<HTMLButtonElement>(".group-settings__tab");
    brokenTab?.click();
    expect(brokenTab?.classList.contains("group-settings__tab--active")).toBe(true);

    element.discordSettings = { has_webhook: false, members: [] };
    expect(() => element.renderDiscordSection()).not.toThrow();

    element.innerHTML = '<div class="group-settings__discord-content"></div>';
    element.discordSettings = null;
    expect(() => element.renderDiscordSection()).not.toThrow();

    state.fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(element.fetchDiscordSettings()).resolves.toBeUndefined();
  });

  it("covers pubsub updates, dialog flow, and appearance validation branches", async () => {
    state.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        has_webhook: false,
        members: [
          { name: "Alice <Admin>", has_discord_id: false },
          { name: "Bob", has_discord_id: true },
        ],
      }),
    });

    const element = mountSettings(`
      <div class="group-settings__members"></div>
      <div class="group-settings__panels">
        <input type="radio" name="panel-dock-side" value="left" checked />
        <input type="radio" name="panel-dock-side" value="right" />
      </div>
      <div class="group-settings__style">
        <input type="radio" name="appearance-style" value="retro" checked />
      </div>
      <button id="change-identity-btn">Change</button>
      <span class="group-settings__identity-name"></span>
      <button class="group-settings__tab group-settings__tab--active" data-tab="general">General</button>
      <button class="group-settings__tab">Broken</button>
      <div class="group-settings__panel group-settings__panel--active" data-panel="general"></div>
      <div class="group-settings__discord-content"></div>
    `);
    await flushPromises();

    const webhookInput = element.querySelector<HTMLInputElement>("#discord-webhook-url");
    const memberInputs = element.querySelectorAll<HTMLInputElement>(".group-settings__discord-member input");
    expect(webhookInput?.placeholder).toBe("https://discord.com/api/webhooks/...");
    expect(memberInputs).toHaveLength(2);
    expect(memberInputs[0]?.placeholder).toBe("Discord User ID");
    expect(memberInputs[1]?.placeholder).toBe("Enter new ID to update");
    expect(memberInputs[0]?.getAttribute("data-member-name")).toBe("Alice <Admin>");
    expect(element.querySelector(".group-settings__discord-member admin")).toBeNull();

    pubsub.publish("members-updated", [
      { name: "Alice" },
      { name: "Bob" },
      { name: "Cara" },
      { name: "Drew" },
      { name: "Evan" },
    ]);

    const memberEditors = element.querySelectorAll<HTMLElement>(".group-settings__members edit-member");
    expect(memberEditors).toHaveLength(5);
    expect((memberEditors[4] as HTMLElement & { memberNumber?: number }).memberNumber).toBe(5);

    state.activeMember = "Bob";
    pubsub.publish("active-member-changed", "Bob");
    expect(element.querySelector(".group-settings__identity-name")?.textContent).toBe("Bob");

    const leftInput = element.querySelector<HTMLInputElement>('input[name="panel-dock-side"][value="left"]');
    if (!leftInput) {
      throw new Error("expected left dock input");
    }

    leftInput.checked = true;
    leftInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(state.appearance.setLayout).toHaveBeenCalledWith("row");

    const styleInput = element.querySelector<HTMLInputElement>('input[name="appearance-style"]');
    if (!styleInput) {
      throw new Error("expected style input");
    }

    styleInput.checked = false;
    element.handleStyleChange();
    expect(state.appearance.setTheme).not.toHaveBeenCalled();

    leftInput.checked = false;
    const rightInput = element.querySelector<HTMLInputElement>('input[name="panel-dock-side"][value="right"]');
    if (!rightInput) {
      throw new Error("expected right dock input");
    }

    rightInput.checked = false;
    element.handlePanelDockSideChange();
    expect(state.appearance.setLayout).toHaveBeenCalledTimes(1);

    const publishSpy = vi.spyOn(pubsub, "publish");
    state.memberSelect.selectMember.mockResolvedValueOnce("Cara");
    element.querySelector<HTMLButtonElement>("#change-identity-btn")?.click();
    await flushPromises();

    expect(state.memberSelect.selectMember).toHaveBeenCalledWith(["Alice", "Bob", "Cara", "Drew", "Evan"]);
    expect(state.storage.setActiveMember).toHaveBeenCalledWith("Cara");
    expect(publishSpy).toHaveBeenCalledWith("active-member-changed", "Cara");
    expect(element.querySelector(".group-settings__identity-name")?.textContent).toBe("Cara");
  });

  it("covers identity early returns and discord save fallback and refresh paths", async () => {
    state.group = { groupName: "@EXAMPLE", groupToken: "demo" };
    const demoElement = new GroupSettings();
    demoElement.memberSection = document.createElement("div");
    await demoElement.handleChangeIdentity();
    expect(state.memberSelect.selectMember).not.toHaveBeenCalled();

    state.group = { groupName: "group", groupToken: "token" };
    const noMembersElement = new GroupSettings();
    await noMembersElement.handleChangeIdentity();
    expect(state.memberSelect.selectMember).not.toHaveBeenCalled();

    const namelessMembersElement = new GroupSettings();
    namelessMembersElement.memberSection = document.createElement("div");
    namelessMembersElement.memberSection.appendChild(document.createElement("edit-member"));
    await namelessMembersElement.handleChangeIdentity();
    expect(state.memberSelect.selectMember).not.toHaveBeenCalled();

    state.fetchMock.mockResolvedValueOnce({ ok: false, text: async () => "ignored" });
    const element = mountSettings(`
      <div class="group-settings__members"></div>
      <span class="group-settings__identity-name"></span>
      <div class="group-settings__discord-content"></div>
    `);
    await flushPromises();

    element.discordSettings = {
      has_webhook: true,
      members: [{ name: "Alice", has_discord_id: true }],
    };
    element.renderDiscordSection();

    const refreshSpy = vi.spyOn(element, "fetchDiscordSettings").mockResolvedValue(undefined);
    const renderedWebhookInput = element.querySelector<HTMLInputElement>("#discord-webhook-url");
    const renderedMemberInput = element.querySelector<HTMLInputElement>(".group-settings__discord-member input");
    if (!renderedWebhookInput || !renderedMemberInput) {
      throw new Error("expected discord inputs");
    }

    renderedWebhookInput.value = "   ";
    renderedMemberInput.value = "   ";

    state.fetchMock.mockResolvedValueOnce({ ok: false, text: async () => "" });
    element.querySelector<HTMLButtonElement>("#discord-save-btn")?.click();
    await flushPromises();

    expect(state.fetchMock).toHaveBeenLastCalledWith("/api/group/group/discord-settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "token",
      },
      body: JSON.stringify({
        webhook_url: "",
        members: [{ name: "Alice", discord_id: "" }],
      }),
    });
    expect(element.querySelector("#discord-status")?.textContent).toBe("Error saving");
    expect(element.querySelector("#discord-status")?.className).toContain("group-settings__discord-status--err");
    expect(refreshSpy).not.toHaveBeenCalled();

    state.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await element.saveDiscordSettings();
    expect(element.querySelector("#discord-status")?.textContent).toBe("Saved!");
    expect(element.querySelector("#discord-status")?.className).toContain("group-settings__discord-status--ok");
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });
});