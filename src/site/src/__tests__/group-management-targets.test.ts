import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const managementState = vi.hoisted(() => ({
  activeMember: null as string | null,
  group: { groupName: "group", groupToken: "token" } as { groupName: string; groupToken?: string } | null,
  api: {
    getCaptchaEnabled: vi.fn(),
    createGroup: vi.fn(),
    restart: vi.fn(),
    renameMember: vi.fn(),
    removeMember: vi.fn(),
    addMember: vi.fn(),
  },
  storage: {
    storeGroup: vi.fn(),
    getActiveMember: vi.fn(() => managementState.activeMember),
    setActiveMember: vi.fn((name: string) => {
      managementState.activeMember = name;
    }),
    getGroup: vi.fn(() => managementState.group),
  },
  loading: {
    showLoadingScreen: vi.fn(),
    hideLoadingScreen: vi.fn(),
  },
  appearance: {
    getLayout: vi.fn(() => "row"),
    getTheme: vi.fn(() => "classic"),
    setLayout: vi.fn(),
    setTheme: vi.fn(),
  },
  pubsub: {
    publish: vi.fn(),
    waitUntilNextEvent: vi.fn(async () => undefined),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
  memberSelect: {
    selectMember: vi.fn(async (names: string[]) => names[0] ?? ""),
  },
  confirm: {
    confirm: vi.fn(),
  },
  iconSrc: vi.fn((icon: string) => `/icons/${icon}.webp`),
  validationErrorFromSchema: vi.fn(() => null),
  fetchMock: vi.fn(),
}));

vi.mock("../data/api", () => ({
  api: managementState.api,
}));

vi.mock("../data/storage", () => ({
  storage: managementState.storage,
}));

vi.mock("../loading-screen/loading-screen-manager", () => ({
  loadingScreenManager: managementState.loading,
}));

vi.mock("../validators", () => ({
  createGroupResponseSchema: {
    parse: (value: unknown) => value,
  },
  groupNameSchema: {},
  validationErrorFromSchema: managementState.validationErrorFromSchema,
}));

vi.mock("../appearance", () => ({
  appearance: managementState.appearance,
}));

vi.mock("../data/pubsub", () => ({
  pubsub: managementState.pubsub,
}));

vi.mock("../member-select-dialog/member-select-dialog-manager", () => ({
  memberSelectDialogManager: managementState.memberSelect,
}));

vi.mock("../confirm-dialog/confirm-dialog-manager", () => ({
  confirmDialogManager: managementState.confirm,
}));

vi.mock("../data/event-icons", () => ({
  iconSrc: managementState.iconSrc,
}));

import { CreateGroup } from "../create-group/create-group";
import { GroupSettings } from "../group-settings/group-settings";
import { EditMember } from "../edit-member/edit-member";
import { EventBanner } from "../event-banner/event-banner";

function flushPromises(): Promise<void> {
  return Promise.resolve().then(() => undefined).then(() => undefined);
}

describe("group management target components", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    managementState.activeMember = null;
    managementState.group = { groupName: "group", groupToken: "token" };
    vi.clearAllMocks();

    managementState.api.getCaptchaEnabled.mockResolvedValue({ enabled: false, sitekey: "" });
    managementState.api.createGroup.mockResolvedValue({ ok: true, json: async () => ({ name: "group", token: "abc" }) });
    managementState.api.restart.mockResolvedValue(undefined);
    managementState.api.renameMember.mockResolvedValue({ ok: true, text: async () => "" });
    managementState.api.removeMember.mockResolvedValue({ ok: true, text: async () => "" });
    managementState.api.addMember.mockResolvedValue({ ok: true, text: async () => "" });

    managementState.fetchMock.mockReset();
    managementState.fetchMock.mockResolvedValue({ ok: false, text: async () => "not configured" });
    vi.stubGlobal("fetch", managementState.fetchMock);
    window.hcaptcha = undefined;
    window.menCaptchaLoaded = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("covers create-group validation, captcha, async submit, and cleanup branches", async () => {
    managementState.api.getCaptchaEnabled.mockResolvedValue({ enabled: true, sitekey: "site-key" });
    window.hcaptcha = {
      render: vi.fn(() => 77),
      getResponse: vi.fn(() => ""),
    };

    const pushStateSpy = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);
    const element = new CreateGroup();
    vi.spyOn(element, "html").mockReturnValue(`
      <member-name-input class="create-group__name"></member-name-input>
      <div class="create-group__server-error"></div>
      <select id="group-member-count"><option value="2">2</option></select>
      <div class="create-group__step-members" style="display:none"></div>
      <div class="create-group__member-inputs"></div>
      <div id="create-group__step-captcha"></div>
      <button class="create-group__submit" style="display:none"></button>
    `);

    document.body.appendChild(element);
    await flushPromises();
    window.menCaptchaLoaded?.();
    await flushPromises();

    expect(window.hcaptcha.render).toHaveBeenCalledWith("create-group__step-captcha", {
      sitekey: "site-key",
      theme: "dark",
    });

    const memberCount = element.querySelector("#group-member-count") as HTMLSelectElement;
    memberCount.value = "2";
    memberCount.dispatchEvent(new Event("change", { bubbles: true }));

    const memberInputs = Array.from(
      element.querySelectorAll(".create-group__member-inputs member-name-input")
    ) as Array<HTMLElement & { valid: boolean; value?: string }>;
    expect(memberInputs).toHaveLength(2);
    expect((element.querySelector(".create-group__step-members") as HTMLElement).style.display).toBe("block");
    expect((element.querySelector(".create-group__submit") as HTMLElement).style.display).toBe("block");

    const groupName = element.querySelector(".create-group__name") as HTMLElement & { valid: boolean; value?: string };
    groupName.valid = true;
    groupName.value = "Iron Team";
    memberInputs[0].valid = true;
    memberInputs[0].value = "Alice";
    memberInputs[1].valid = true;
    memberInputs[1].value = "Bob";

    await element.createGroup();
    expect(element.serverError.textContent).toBe("Complete the captcha");
    expect(managementState.api.createGroup).not.toHaveBeenCalled();

    (window.hcaptcha.getResponse as ReturnType<typeof vi.fn>).mockReturnValue("captcha-token");
    managementState.api.createGroup.mockResolvedValueOnce({ ok: false, text: async () => "server rejected" });
    await element.createGroup();
    expect(element.serverError.textContent).toBe("Error creating group: server rejected");

    managementState.api.createGroup.mockRejectedValueOnce(new Error("network down"));
    await element.createGroup();
    expect(element.serverError.textContent).toBe("Error creating group: network down");

    managementState.api.createGroup.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: "Iron Team", token: "group-token" }),
    });
    await element.createGroup();

    expect(managementState.api.createGroup).toHaveBeenLastCalledWith("Iron Team", ["Alice", "Bob", "", "", ""], "captcha-token");
    expect(managementState.storage.storeGroup).toHaveBeenCalledWith("Iron Team", "group-token");
    expect(pushStateSpy).toHaveBeenCalledWith("", "", "/setup-instructions");

    const invalidElement = new CreateGroup();
    invalidElement.groupName = { valid: false, value: "bad" } as HTMLElement & { valid: boolean; value?: string };
    invalidElement.serverError = document.createElement("div");
    invalidElement.appendChild(document.createElement("button")).className = "create-group__submit";
    vi.spyOn(invalidElement, "validateMemberNames").mockReturnValue(false);
    await invalidElement.createGroup();
    expect(managementState.api.createGroup).toHaveBeenCalledTimes(3);

    const existingScript = document.createElement("script");
    existingScript.id = "hcaptcha";
    document.body.appendChild(existingScript);
    await expect(element.waitForCaptchaScript()).resolves.toBeUndefined();
    existingScript.remove();

    const waitForScript = element.waitForCaptchaScript();
    expect(document.getElementById("hcaptcha")).toBeTruthy();
    window.menCaptchaLoaded?.();
    await waitForScript;

    expect(document.getElementById("hcaptcha")).toBeTruthy();
    element.captchaEnabled = true;
    element.disconnectedCallback();
    expect(document.getElementById("hcaptcha")).toBeNull();
    expect(window.hcaptcha).toBeUndefined();
  });

  it("covers group-settings member rendering, toggles, identity flow, and discord save paths", async () => {
    managementState.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        has_webhook: true,
        members: [
          { name: "Alice", has_discord_id: true },
          { name: "Bob", has_discord_id: false },
        ],
      }),
    });

    const element = new GroupSettings();
    vi.spyOn(element, "html").mockReturnValue(`
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
      <button class="group-settings__tab" data-tab="discord">Discord</button>
      <div class="group-settings__panel group-settings__panel--active" data-panel="general"></div>
      <div class="group-settings__panel" data-panel="discord"></div>
      <div class="group-settings__discord-content"></div>
    `);

    document.body.appendChild(element);
    await flushPromises();

    expect(element.querySelector(".group-settings__identity-name")?.textContent).toBe("Not set");
    expect(managementState.fetchMock).toHaveBeenCalledWith("/api/group/group/discord-settings", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "token",
      },
    });
    expect(element.querySelectorAll(".group-settings__discord-set")).toHaveLength(2);

    element.handleUpdatedMembers([{ name: "Alice" }, { name: "@SHARED" }, null] as unknown[]);
    const editMembers = element.querySelectorAll(".group-settings__members edit-member");
    expect(editMembers).toHaveLength(2);
    expect((editMembers[0] as HTMLElement & { member?: { name: string } }).member?.name).toBe("Alice");
    expect((editMembers[1] as HTMLElement & { member?: { name: string } }).member).toBeUndefined();

    const discordTab = element.querySelectorAll<HTMLButtonElement>(".group-settings__tab")[1];
    discordTab.click();
    expect(discordTab.classList.contains("group-settings__tab--active")).toBe(true);
    expect(
      element.querySelector<HTMLElement>('.group-settings__panel[data-panel="discord"]')?.classList.contains(
        "group-settings__panel--active"
      )
    ).toBe(true);

    const rightInput = element.querySelector<HTMLInputElement>('input[name="panel-dock-side"][value="right"]');
    if (!rightInput) {
      throw new Error("expected right dock input");
    }
    rightInput.checked = true;
    rightInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(managementState.appearance.setLayout).toHaveBeenCalledWith("row-reverse");

    const styleInput = element.querySelector<HTMLInputElement>('input[name="appearance-style"]');
    if (!styleInput) {
      throw new Error("expected style input");
    }
    styleInput.checked = true;
    styleInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(managementState.appearance.setTheme).toHaveBeenCalledWith("retro");

    managementState.memberSelect.selectMember.mockResolvedValueOnce("Alice");
    await element.handleChangeIdentity();
    expect(managementState.storage.setActiveMember).toHaveBeenCalledWith("Alice");
    expect(managementState.pubsub.publish).toHaveBeenCalledWith("active-member-changed", "Alice");
    expect(element.querySelector(".group-settings__identity-name")?.textContent).toBe("Alice");

    const saveRefreshSpy = vi.spyOn(element, "fetchDiscordSettings").mockResolvedValue(undefined);
    const webhookInput = element.querySelector("#discord-webhook-url") as HTMLInputElement;
    const memberInputs = element.querySelectorAll<HTMLInputElement>(".group-settings__discord-member input");
    webhookInput.value = "https://discord.example/webhook";
    memberInputs[0].value = "1234";
    memberInputs[1].value = "";

    managementState.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await element.saveDiscordSettings();
    expect(managementState.fetchMock).toHaveBeenLastCalledWith("/api/group/group/discord-settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "token",
      },
      body: JSON.stringify({
        webhook_url: "https://discord.example/webhook",
        members: [
          { name: "Alice", discord_id: "1234" },
          { name: "Bob", discord_id: "" },
        ],
      }),
    });
    expect(element.querySelector("#discord-status")?.textContent).toBe("Saved!");
    expect(saveRefreshSpy).toHaveBeenCalled();

    managementState.fetchMock.mockResolvedValueOnce({ ok: false, text: async () => "bad request" });
    await element.saveDiscordSettings();
    expect(element.querySelector("#discord-status")?.textContent).toBe("bad request");
    expect(element.querySelector("#discord-status")?.className).toContain("group-settings__discord-status--err");

    managementState.fetchMock.mockRejectedValueOnce(new Error("offline"));
    await element.saveDiscordSettings();
    expect(element.querySelector("#discord-status")?.textContent).toBe("Error saving");

    element.memberSection = document.createElement("div");
    element.handleUpdatedMembers("bad input" as unknown);
    expect(element.memberSection.children).toHaveLength(0);

    managementState.group = { groupName: "@EXAMPLE", groupToken: "demo" };
    await element.fetchDiscordSettings();
    expect(managementState.fetchMock).toHaveBeenCalledTimes(4);

    const noTokenSettings = new GroupSettings();
    managementState.group = { groupName: "group" };
    expect(noTokenSettings.getAuthHeaders()).toEqual({ "Content-Type": "application/json" });
  });

  it("covers edit-member command flows and event-bound actions", async () => {
    managementState.confirm.confirm.mockImplementation(({ yesCallback }: { yesCallback: () => Promise<void> }) => {
      void yesCallback();
    });

    const element = new EditMember();
    vi.spyOn(element, "html").mockReturnValue(`
      <member-name-input></member-name-input>
      <div class="edit-member__error"></div>
      <button class="edit-member__rename">Rename</button>
      <button class="edit-member__remove">Remove</button>
      <button class="edit-member__add">Add</button>
    `);

    document.body.appendChild(element);
    const input = element.querySelector("member-name-input") as HTMLElement & { valid: boolean; value?: string };
    input.valid = true;
    input.value = "Alice";
    element.member = { name: "Alice" };

    element.querySelector<HTMLButtonElement>(".edit-member__rename")?.click();
    await flushPromises();
    expect(element.error.textContent).toBe("New name is the same as the old name");

    input.value = "Bob";
    managementState.api.renameMember.mockResolvedValueOnce({ ok: false, text: async () => "taken" });
    await element.renameMember();
    expect(element.error.textContent).toBe("Failed to rename member taken");

    managementState.api.renameMember.mockRejectedValueOnce(new Error("rename offline"));
    await element.renameMember();
    expect(element.error.textContent).toBe("Failed to rename member rename offline");

    managementState.api.renameMember.mockResolvedValueOnce({ ok: true, text: async () => "" });
    await element.renameMember();
    expect(managementState.api.restart).toHaveBeenCalled();
    expect(managementState.pubsub.waitUntilNextEvent).toHaveBeenCalledWith("get-group-data", false);
    expect(managementState.loading.showLoadingScreen).toHaveBeenCalled();
    expect(managementState.loading.hideLoadingScreen).toHaveBeenCalled();

    managementState.api.removeMember.mockResolvedValueOnce({ ok: false, text: async () => "cannot delete" });
    element.querySelector<HTMLButtonElement>(".edit-member__remove")?.click();
    await flushPromises();
    expect(managementState.confirm.confirm).toHaveBeenCalled();
    expect(element.error.textContent).toBe("Failed to remove member cannot delete");

    managementState.api.removeMember.mockRejectedValueOnce(new Error("remove offline"));
    element.removeMember();
    await flushPromises();
    expect(element.error.textContent).toBe("Failed to remove member remove offline");

    managementState.api.removeMember.mockResolvedValueOnce({ ok: true, text: async () => "" });
    element.removeMember();
    await flushPromises();
    expect(managementState.api.removeMember).toHaveBeenLastCalledWith("Alice");

    input.valid = false;
    await element.addMember();
    expect(managementState.api.addMember).not.toHaveBeenCalled();

    input.valid = true;
    input.value = "Charlie";
    managementState.api.addMember.mockResolvedValueOnce({ ok: false, text: async () => "duplicate" });
    element.querySelector<HTMLButtonElement>(".edit-member__add")?.click();
    await flushPromises();
    expect(element.error.textContent).toBe("Failed to add member duplicate");

    managementState.api.addMember.mockRejectedValueOnce(new Error("add offline"));
    await element.addMember();
    expect(element.error.textContent).toBe("Failed to add member add offline");

    managementState.api.addMember.mockResolvedValueOnce({ ok: true, text: async () => "" });
    await element.addMember();
    expect(managementState.api.addMember).toHaveBeenLastCalledWith("Charlie");
  });

  it("covers event-banner time labels, filtering, and polling cleanup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00.000Z"));

    const banner = new EventBanner();
    const renderSpy = vi.spyOn(banner, "render").mockImplementation(() => undefined);

    managementState.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          event_id: 1,
          title: "<b>Boss Trip</b>",
          event_type: "boss",
          event_time: "2026-03-28T12:20:00.000Z",
          event_end_time: null,
          icon: "boss",
        },
        {
          event_id: 2,
          title: "Raid Run",
          event_type: "raid",
          event_time: "2026-03-28T11:20:00.000Z",
          event_end_time: "2026-03-28T12:45:00.000Z",
          icon: "raid",
        },
        {
          event_id: 3,
          title: "Expired",
          event_type: "other",
          event_time: "2026-03-28T10:00:00.000Z",
          event_end_time: "2026-03-28T11:00:00.000Z",
          icon: "",
        },
        {
          event_id: 4,
          title: "Too Far Away",
          event_type: "other",
          event_time: "2026-03-28T13:00:00.000Z",
          event_end_time: null,
          icon: "",
        },
      ],
    });

    await banner.fetchAndRender();
    expect(managementState.fetchMock).toHaveBeenCalledWith("/api/group/group/events", {
      headers: {
        Authorization: "token",
      },
    });
    expect(renderSpy).toHaveBeenCalled();
    expect(banner.activeEvents).toHaveLength(2);
    const rendered = banner.renderBanners();
    expect(rendered).toContain("&lt;b&gt;Boss Trip&lt;/b&gt;");
    expect(rendered).toContain("Starts in 20m");
    expect(rendered).toContain("Ends in 45m");
    expect(rendered).toContain("/icons/boss.webp");

    expect(
      banner.getTimeLabel({
        event_id: 9,
        title: "Start now",
        event_type: "other",
        event_time: "2026-03-28T12:00:10.000Z",
        event_end_time: null,
        icon: "",
      })
    ).toBe("Starting now!");
    expect(
      banner.getTimeLabel({
        event_id: 10,
        title: "End now",
        event_type: "other",
        event_time: "2026-03-28T11:00:00.000Z",
        event_end_time: "2026-03-28T12:00:10.000Z",
        icon: "",
      })
    ).toBe("Ending soon!");
    expect(
      banner.getTimeLabel({
        event_id: 11,
        title: "Long event",
        event_type: "other",
        event_time: "2026-03-28T11:00:00.000Z",
        event_end_time: "2026-03-28T14:15:00.000Z",
        icon: "",
      })
    ).toBe("Ends in 2h 15m");
    expect(
      banner.getTimeLabel({
        event_id: 12,
        title: "Already ended",
        event_type: "other",
        event_time: "2026-03-28T10:00:00.000Z",
        event_end_time: "2026-03-28T11:59:00.000Z",
        icon: "",
      })
    ).toBe("Ended");
    expect(
      banner.getTimeLabel({
        event_id: 13,
        title: "Running",
        event_type: "other",
        event_time: "2026-03-28T11:59:00.000Z",
        event_end_time: null,
        icon: "",
      })
    ).toBe("Happening now!");

    banner.startPolling();
    expect(banner.pollTimer).toBeDefined();
    banner.stopPolling();
    expect(banner.pollTimer).toBeUndefined();

    managementState.group = { groupName: "@EXAMPLE", groupToken: "demo" };
    await banner.fetchAndRender();
    expect(banner.activeEvents).toEqual([]);

    managementState.group = null;
    await banner.fetchAndRender();
    expect(managementState.fetchMock).toHaveBeenCalledTimes(1);

    banner.disconnectedCallback();
    expect(banner.pollTimer).toBeUndefined();
  });
});