import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const groupDataMock = vi.hoisted(() => ({
  members: new Map<string, { name: string; bank?: Array<{ id: number; quantity: number; highAlch: number; gePrice: number; isValid: () => boolean }>; totalItemQuantity: (id: number) => number }>(),
}));

vi.mock("../data/group-data", () => ({
  groupData: groupDataMock,
}));

vi.mock("../data/item", () => ({
  Item: {
    itemName: vi.fn((id: number) => `Item ${id}`),
    imageUrl: vi.fn((id: number) => `/icons/${id}.webp`),
  },
}));

vi.mock("../stash-page/stash-data", () => ({
  DIFFICULTIES: ["Easy", "Hard"],
  DIFFICULTY_COLORS: { Easy: "#0f0", Hard: "#f00" },
  STASHES: [
    {
      name: "Varrock stash",
      difficulty: "Easy",
      clues: [
        {
          text: "Wear things",
          items: [{ name: "Hat", iconId: 1, itemIds: [1] }],
        },
      ],
    },
  ],
  getStashesByDifficulty: (d: string) =>
    d === "Easy"
      ? [
          {
            name: "Varrock stash",
            difficulty: "Easy",
            clues: [
              {
                text: "Wear things",
                items: [{ name: "Hat", iconId: 1, itemIds: [1] }],
              },
            ],
          },
        ]
      : [],
}));

vi.mock("../data/api", () => ({
  api: {
    getCaptchaEnabled: vi.fn(async () => ({ enabled: false, sitekey: "" })),
    createGroup: vi.fn(async () => ({ ok: true, json: async () => ({ name: "g", token: "t" }) })),
    renameMember: vi.fn(async () => ({ ok: true, text: async () => "" })),
    removeMember: vi.fn(async () => ({ ok: true, text: async () => "" })),
    addMember: vi.fn(async () => ({ ok: true, text: async () => "" })),
    restart: vi.fn(async () => undefined),
  },
}));

vi.mock("../data/storage", () => ({
  storage: {
    storeGroup: vi.fn(),
    getGroup: vi.fn(() => ({ groupName: "group", groupToken: "token" })),
  },
}));

vi.mock("../loading-screen/loading-screen-manager", () => ({
  loadingScreenManager: {
    showLoadingScreen: vi.fn(),
    hideLoadingScreen: vi.fn(),
  },
}));

vi.mock("../validators", () => ({
  createGroupResponseSchema: { parse: (x: unknown) => x },
  groupNameSchema: {},
  validationErrorFromSchema: vi.fn(() => null),
}));

vi.mock("../data/diaries", () => ({
  AchievementDiary: {
    diaries: {
      Ardougne: {
        Easy: [
          {
            task: "Task 1",
            requirements: { combat: 10, skills: { Attack: 1 }, quests: ["Cook's Assistant"] },
          },
        ],
      },
    },
  },
}));

vi.mock("../data/skill", () => ({
  Skill: {
    getIcon: vi.fn(() => "/icons/skill.webp"),
  },
}));

vi.mock("../data/pubsub", () => ({
  pubsub: {
    waitUntilNextEvent: vi.fn(async () => undefined),
  },
}));

vi.mock("../confirm-dialog/confirm-dialog-manager", () => ({
  confirmDialogManager: {
    confirm: vi.fn((opts: { yesCallback: () => Promise<void> }) => {
      void opts.yesCallback();
    }),
  },
}));

vi.mock("../data/event-icons", () => ({
  iconSrc: vi.fn((x: string) => `/icons/${x}.webp`),
}));

import { api } from "../data/api";
import { storage } from "../data/storage";
import { StashPage } from "../stash-page/stash-page";
import { CreateGroup } from "../create-group/create-group";
import { BankDialog } from "../bank-dialog/bank-dialog";
import { DiaryDialog } from "../diary-dialog/diary-dialog";
import { EditMember } from "../edit-member/edit-member";
import { EventBanner } from "../event-banner/event-banner";

describe("dialogs and pages heavy", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    groupDataMock.members.clear();
    groupDataMock.members.set("alice", {
      name: "alice",
      totalItemQuantity: () => 1,
      bank: [{ id: 1, quantity: 2, highAlch: 100, gePrice: 200, isValid: () => true }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders and filters stash page", () => {
    const page = new StashPage();
    page.selectedTier = "All";
    expect(page.getMemberCount()).toBe(1);
    const status = page.getStashStatus({
      name: "S",
      difficulty: "Easy",
      clues: [{ text: "x", items: [{ name: "hat", iconId: 1, itemIds: [1] }] }],
    });
    expect(status.allComplete).toBe(true);

    expect(page.renderTierTabs()).toContain("Easy");
    expect(page.renderSummary()).toContain("Total");
    expect(page.renderStashes()).toContain("Varrock stash");

    page.searchQuery = "varrock";
    expect(page.getFilteredStashes().length).toBe(1);
    page.hideComplete = true;
    expect(page.getFilteredStashes().length).toBe(0);
  });

  it("creates groups and handles member section", async () => {
    const page = new CreateGroup();
    page.groupName = { valid: true, value: "group" } as never;
    page.serverError = document.createElement("div");

    const submit = document.createElement("button");
    submit.className = "create-group__submit";
    page.appendChild(submit);

    const section = document.createElement("div");
    section.className = "create-group__member-inputs";
    page.appendChild(section);

    const membersStep = document.createElement("div");
    membersStep.className = "create-group__step-members";
    page.appendChild(membersStep);

    page.displayMembersSection(2);
    expect(section.querySelectorAll("member-name-input").length).toBe(2);

    const inputA = document.createElement("member-name-input") as HTMLElement & { valid: boolean; value: string | undefined };
    inputA.valid = true;
    inputA.value = "a";
    const inputB = document.createElement("member-name-input") as HTMLElement & { valid: boolean; value: string | undefined };
    inputB.valid = true;
    inputB.value = "b";
    section.append(inputA, inputB);
    vi.spyOn(page, "validateMemberNames").mockReturnValue(true);

    await page.createGroup();
    expect((api.createGroup as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    expect((storage.storeGroup as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();

    (api.createGroup as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, text: async () => "bad" });
    await page.createGroup();
    expect(page.serverError.textContent).toContain("bad");
  });

  it("renders bank dialog and updates values", () => {
    const dialog = new BankDialog();
    dialog.playerName = "alice";
    dialog.statusEl = document.createElement("div");
    dialog.itemsEl = document.createElement("div");
    dialog.itemCountEl = document.createElement("div");
    dialog.valueEl = document.createElement("div");
    dialog.searchInput = document.createElement("input");

    dialog.handleBankUpdate([
      { id: 1, name: "Rune scimitar", quantity: 2, highAlch: 1000, gePrice: 1200, isValid: () => true },
      { id: 2, name: "Coins", quantity: 50, highAlch: 1, gePrice: 1, isValid: () => true },
    ] as never);
    expect(dialog.itemCountEl.textContent).toContain("2");
    expect(dialog.valueEl.textContent).toContain("GE:");

    dialog.searchInput.value = "rune";
    dialog.handleSearch();
    expect(dialog.itemCountEl.textContent).toContain("1");

    dialog.background = document.createElement("div");
    const closeSpy = vi.spyOn(dialog, "close").mockImplementation(() => undefined);
    dialog.closeIfBackgroundClick({ target: dialog.background } as unknown as MouseEvent);
    expect(closeSpy).toHaveBeenCalled();
  });

  it("renders diaries, edits members and polls events", async () => {
    const diary = new DiaryDialog();
    diary.diaryName = "Ardougne";
    diary.innerHTML = '<div class="diary-dialog__section" diary-tier="Easy"><h2>Easy</h2></div>';
    diary.handleDiaries(
      { completion: { Ardougne: { Easy: [true] } } },
      {
        combatLevel: 50,
        skills: { Attack: { level: 20 } },
        hasQuestComplete: () => true,
      }
    );
    expect(diary.classList.contains("dialog__visible")).toBe(true);

    const editor = new EditMember();
    editor.input = { valid: true, value: "newname" } as never;
    editor.error = document.createElement("div");
    editor.member = { name: "oldname" };
    await editor.renameMember();
    editor.removeMember();
    await editor.addMember();
    expect(editor.error.textContent).toBe("");

    const banner = new EventBanner();
    const renderSpy = vi.spyOn(banner, "render").mockImplementation(() => undefined);
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>) = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          event_id: 1,
          title: "Boss Trip",
          event_type: "boss",
          event_time: new Date(Date.now() + 5 * 60000).toISOString(),
          event_end_time: null,
          icon: "boss",
        },
      ],
    }));

    await banner.fetchAndRender();
    expect(renderSpy).toHaveBeenCalled();
    expect(banner.renderBanners()).toContain("Boss Trip");

    banner.startPolling();
    expect(banner.pollTimer).toBeDefined();
    banner.stopPolling();
    expect(banner.pollTimer).toBeUndefined();
  });
});
