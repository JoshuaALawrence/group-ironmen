import { utility } from "../utility";
import { pubsub } from "./pubsub";

export const QuestState = {
  IN_PROGRESS: "IN_PROGRESS",
  NOT_STARTED: "NOT_STARTED",
  FINISHED: "FINISHED",
};

type QuestStateValue = (typeof QuestState)[keyof typeof QuestState];

type QuestDataEntry = {
  name: string;
  difficulty: string;
  hidden?: boolean;
  sortName?: string;
  points: number | string;
  miniquest?: boolean;
  tutorial?: boolean;
  member?: boolean;
};

export class Quest {
  static questData: Record<string, QuestDataEntry> = {};
  static freeToPlayQuests: Record<string, QuestDataEntry> = {};
  static memberQuests: Record<string, QuestDataEntry> = {};
  static miniQuests: Record<string, QuestDataEntry> = {};
  static tutorial: Record<string, QuestDataEntry> = {};
  static lookupByName: Map<string, string> = new Map();
  static questIds: number[] = [];
  static totalPoints = 0;

  id: string;
  state: QuestStateValue;

  constructor(id: string | number, state: QuestStateValue) {
    this.id = String(id);

    if (!(state in QuestState)) {
      console.error(`Unrecognized quest state ${state}`);
    }
    this.state = state;
  }

  get name() {
    return Quest.questData[this.id].name || "UNKNOWN_QUEST";
  }

  get difficulty() {
    return Quest.questData[this.id].difficulty;
  }

  get icon() {
    const difficulty = this.difficulty;
    switch (difficulty) {
      case "Novice":
        return "/icons/3399-0.png";
      case "Intermediate":
        return "/icons/3400-0.png";
      case "Experienced":
        return "/icons/3402-0.png";
      case "Master":
        return "/icons/3403-0.png";
      case "Grandmaster":
        return "/icons/3404-0.png";
      case "Special":
        return "/icons/3404-0.png";
    }

    console.error(`Unknown quest difficulty for icon ${difficulty}`);
    return "";
  }

  get wikiLink() {
    const name = this.name;
    const wikiName = name.replaceAll(" ", "_");
    return `https://oldschool.runescape.wiki/w/${wikiName}/Quick_guide`;
  }

  get points() {
    if (this.state === QuestState.FINISHED) {
      return Quest.questData[this.id]?.points || 0;
    }
    return 0;
  }

  static parseQuestData(data?: Record<string, QuestStateValue> | null): Record<string, Quest> {
    const result: Record<string, Quest> = {};
    if (data) {
      for (const [questId, questState] of Object.entries(data)) {
        result[questId] = new Quest(questId, questState);
      }
    }

    return result;
  }

  static async loadQuests(): Promise<void> {
    const response = await fetch("/data/quest_data.json");
    Quest.questData = (await response.json()) as Record<string, QuestDataEntry>;
    Quest.freeToPlayQuests = {};
    Quest.memberQuests = {};
    Quest.miniQuests = {};
    Quest.tutorial = {};
    Quest.lookupByName = new Map();
    Quest.questIds = Object.keys(Quest.questData)
      .map((s) => parseInt(s))
      .sort((a, b) => a - b);
    let totalQuestPoints = 0;

    for (const [questId, questData] of Object.entries(Quest.questData)) {
      if (questData.hidden) continue;
      questData.sortName = utility.removeArticles(questData.name);
      questData.points = Number.parseInt(String(questData.points), 10);
      totalQuestPoints += questData.points;
      if (questData.miniquest) {
        Quest.miniQuests[questId] = questData;
      } else if (questData.tutorial) {
        Quest.tutorial[questId] = questData;
      } else if (questData.member === false) {
        Quest.freeToPlayQuests[questId] = questData;
      } else {
        Quest.memberQuests[questId] = questData;
      }
      Quest.lookupByName.set(questData.name, questId);
    }

    Quest.totalPoints = totalQuestPoints;

    pubsub.publish("quest-data-loaded");
  }

  static randomQuestStates(): number[] | undefined {
    if (!Quest.questData) return;
    const result: number[] = [];
    const states = Object.keys(QuestState);
    let amount = 0;
    for (const questId of Object.keys(Quest.questData)) {
      amount = Math.max(parseInt(questId), amount);
    }

    for (let i = 0; i < amount; ++i) {
      result.push(Math.floor(Math.random() * states.length));
    }

    return result;
  }
}
