import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AchievementDiary } from "../data/diaries";
import { pubsub } from "../data/pubsub";
import { DiaryDialog } from "../diary-dialog/diary-dialog";

type DiaryTask = {
  task: string;
  requirements?: {
    combat?: number;
    skills?: Record<string, number>;
    quests?: string[];
  };
};

type DiaryDataSet = Record<string, Record<string, DiaryTask[]>>;

type DiaryCompletion = {
  completion: Record<string, Record<string, boolean[]>>;
};

type DiaryPlayer = {
  combatLevel: number;
  skills: Record<string, { level: number }>;
  hasQuestComplete: (questName: string) => boolean;
};

let originalDiaries: unknown;

function renderDialog(dialog: DiaryDialog): string {
  return `
    <div class="dialog dialog__visible">
      <div class="dialog__container rsborder rsbackground">
        <div class="diary-dialog__header rsborder-tiny">
          <h2 class="diary-dialog__title">Achievement Diary - ${dialog.diaryName} - ${dialog.playerName}</h2>
          <button class="dialog__close">Close</button>
        </div>
        <div class="diary-dialog__scroll-container">
          <div class="diary-dialog__section rsborder-tiny" diary-tier="Easy"><h2>Easy</h2></div>
          <div class="diary-dialog__section rsborder-tiny" diary-tier="Medium"><h2>Medium</h2></div>
          <div class="diary-dialog__section rsborder-tiny" diary-tier="Hard"><h2>Hard</h2></div>
          <div class="diary-dialog__section rsborder-tiny" diary-tier="Elite"><h2>Elite</h2></div>
        </div>
      </div>
    </div>
  `;
}

function mountDialog(options: { diaryName?: string | null; playerName?: string | null } = {}): DiaryDialog {
  const { diaryName = "Ardougne", playerName = "Alice" } = options;
  const dialog = document.createElement("diary-dialog") as DiaryDialog;

  if (diaryName !== null) {
    dialog.setAttribute("diary-name", diaryName);
  }
  if (playerName !== null) {
    dialog.setAttribute("player-name", playerName);
  }

  vi.spyOn(dialog, "render").mockImplementation(() => {
    dialog.innerHTML = renderDialog(dialog);
  });

  document.body.appendChild(dialog);
  return dialog;
}

function createPlayer(overrides: Partial<DiaryPlayer> = {}): DiaryPlayer {
  return {
    combatLevel: 85,
    skills: {
      Attack: { level: 70 },
      Agility: { level: 50 },
      Strength: { level: 99 },
    },
    hasQuestComplete: (questName: string) => questName === "Cook's Assistant",
    ...overrides,
  };
}

function createCompletion(region: string, tiers: Partial<Record<string, boolean[]>>): DiaryCompletion {
  return {
    completion: {
      [region]: {
        Easy: [],
        Medium: [],
        Hard: [],
        Elite: [],
        ...tiers,
      },
    },
  };
}

describe("diary dialog residual coverage", () => {
  beforeEach(() => {
    originalDiaries = AchievementDiary.diaries;
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
  });

  afterEach(() => {
    AchievementDiary.diaries = originalDiaries;
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
  });

  it("returns early when the diary name is missing or not present in the diary dataset", () => {
    AchievementDiary.diaries = {
      Ardougne: {
        Easy: [{ task: "Talk to Aleck" }],
      },
    } satisfies DiaryDataSet;

    const missingNameDialog = mountDialog({ diaryName: null, playerName: "Alice" });
    pubsub.publish("diaries:Alice", createCompletion("Ardougne", { Easy: [true] }), createPlayer());

    expect(missingNameDialog.classList.contains("dialog__visible")).toBe(false);
    expect(missingNameDialog.querySelectorAll(".diary-dialog__task")).toHaveLength(0);
    expect(pubsub.anyoneListening("diaries:Alice")).toBe(false);

    const unknownDiaryDialog = mountDialog({ diaryName: "Unknown Diary", playerName: "Bob" });
    pubsub.publish("diaries:Bob", createCompletion("Unknown Diary", { Easy: [true] }), createPlayer());

    expect(unknownDiaryDialog.classList.contains("dialog__visible")).toBe(false);
    expect(unknownDiaryDialog.querySelectorAll(".diary-dialog__task")).toHaveLength(0);
    expect(pubsub.anyoneListening("diaries:Bob")).toBe(false);
  });

  it("renders requirements, task completion, and header links from the subscribed diary event", () => {
    AchievementDiary.diaries = {
      Ardougne: {
        Easy: [
          {
            task: "Meet the requirements",
            requirements: {
              combat: 90,
              skills: {
                Attack: 70,
                Agility: 60,
              },
              quests: ["Cook's Assistant", "Dragon Slayer"],
            },
          },
          {
            task: "Already complete",
          },
        ],
      },
    } satisfies DiaryDataSet;

    const dialog = mountDialog();

    expect(pubsub.anyoneListening("diaries:Alice")).toBe(true);

    pubsub.publish(
      "diaries:Alice",
      createCompletion("Ardougne", { Easy: [false, true] }),
      createPlayer()
    );

    const tasks = dialog.querySelectorAll<HTMLElement>(".diary-dialog__task");
    const requirements = dialog.querySelector<HTMLElement>(".diary-dialog__requirements");
    const headerLink = dialog.querySelector<HTMLAnchorElement>('.diary-dialog__section[diary-tier="Easy"] h2 a');
    const attackIcon = requirements?.querySelector<HTMLImageElement>('img[alt="Attack"]');
    const agilityIcon = requirements?.querySelector<HTMLImageElement>('img[alt="Agility"]');
    const questSpans = Array.from(requirements?.querySelectorAll<HTMLElement>("span") ?? []).filter((element) =>
      ["Cook's Assistant", "Dragon Slayer"].includes(element.textContent?.trim() ?? "")
    );

    expect(pubsub.anyoneListening("diaries:Alice")).toBe(false);
    expect(dialog.classList.contains("dialog__visible")).toBe(true);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.classList.contains("diary-dialog__task-complete")).toBe(false);
    expect(tasks[1]?.classList.contains("diary-dialog__task-complete")).toBe(true);
    expect(tasks[1]?.querySelector(".diary-dialog__requirements")).toBeNull();

    expect(requirements?.innerHTML).toContain("85/90 Combat");
    expect(requirements?.innerHTML).toContain("Cook's Assistant");
    expect(requirements?.innerHTML).toContain("Dragon Slayer");
    expect(attackIcon?.getAttribute("src")).toBe("/ui/197-0.png");
    expect(attackIcon?.closest("span")?.classList.contains("diary-dialog__requirement-met")).toBe(true);
    expect(agilityIcon?.closest("span")?.classList.contains("diary-dialog__requirement-met")).toBe(false);
    expect(questSpans).toHaveLength(2);
    expect(questSpans[0]?.classList.contains("diary-dialog__requirement-met")).toBe(true);
    expect(questSpans[1]?.classList.contains("diary-dialog__requirement-met")).toBe(false);
    expect(headerLink?.getAttribute("href")).toBe("https://oldschool.runescape.wiki/w/Ardougne_Diary#Easy");
    expect(headerLink?.textContent).toContain("1 / 2");
    expect(dialog.querySelector('.diary-dialog__section[diary-tier="Easy"]')?.classList.contains("diary-dialog__tier-complete")).toBe(false);
  });

  it("marks all tiers complete, ignores inner clicks, and closes on backdrop clicks", () => {
    AchievementDiary.diaries = {
      Ardougne: {
        Easy: [{ task: "Easy task" }],
        Medium: [{ task: "Medium task" }],
        Hard: [{ task: "Hard task" }],
        Elite: [{ task: "Elite task" }],
      },
    } satisfies DiaryDataSet;

    const dialog = mountDialog();

    pubsub.publish(
      "diaries:Alice",
      createCompletion("Ardougne", {
        Easy: [true],
        Medium: [true],
        Hard: [true],
        Elite: [true],
      }),
      createPlayer()
    );

    expect(dialog.classList.contains("dialog__visible")).toBe(true);
    expect(dialog.classList.contains("diary-dialog__diary-complete")).toBe(true);
    expect(dialog.querySelectorAll(".diary-dialog__tier-complete")).toHaveLength(4);

    dialog.querySelector<HTMLElement>(".dialog__container")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog.isConnected).toBe(true);

    dialog.background?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(dialog.isConnected).toBe(false);
    expect(dialog.eventUnbinders.size).toBe(0);
    expect(dialog.eventListeners.size).toBe(0);
  });
});