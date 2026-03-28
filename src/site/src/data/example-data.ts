import { Item } from "./item";
import { SkillName } from "./skill";
import { Quest } from "./quest";
import { utility } from "../utility";
import { SkillGraph } from "../skill-graph/skill-graph";
import { GroupData } from "./group-data";
import { AchievementDiary } from "./diaries";

type ExampleMemberState = {
  quests?: number[] | Record<number, string>;
  bank?: number[];
  stats?: number[];
  skills?: number[];
  equipment?: number[];
  inventory?: number[];
  coordinates?: [number, number, number];
  last_updated?: string;
  diary_vars?: number[];
  rune_pouch?: number[];
  interacting?: Record<string, unknown>;
  [key: string]: unknown;
};

type ExampleGroupData = {
  members: Map<string, { name: string; skills?: Record<string, { xp: number }> }>;
};

class ExampleData {
  intervals: number[];
  members: Record<string, ExampleMemberState>;

  constructor() {
    this.intervals = [];
    this.members = {};
  }

  enable(): void {
    this.disable();
    this.reset();
    this.intervals = [
      utility.callOnInterval(this.doHealthUpdate.bind(this), 3000),
      utility.callOnInterval(this.doXpDrop.bind(this), 2000),
      utility.callOnInterval(() => {
        let plane = this.members["Zezima"].coordinates[2];
        plane += 1;
        if (plane > 3) plane = 0;
        this.members["Zezima"].coordinates = [
          this.members["Zezima"].coordinates[0] + 1,
          this.members["Zezima"].coordinates[1],
          plane,
        ];
      }, 1000),
    ];
  }

  disable(): void {
    if (this.intervals) {
      for (const interval of this.intervals) {
        clearInterval(interval);
      }

      this.intervals = [];
    }
  }

  reset(): void {
    this.members = {
      Zezima: {
        quests: Quest.randomQuestStates(),
        bank: [995, Math.floor(Math.random() * 25000000)],
        stats: [99, 99, 99, 99, 100, 100, 330],
        skills: Object.values(SkillName).map(() => Math.floor(Math.random() * 14000000)),
        equipment: Item.randomItems(14, 1),
        inventory: Item.randomItems(28),
        coordinates: [3029, 3000, 0],
        last_updated: "2022-01-23T01:34:06.104Z",
        diary_vars: AchievementDiary.randomDiaries(),
      },
      "group alt two": {
        rune_pouch: [563, 1922, 561, 5, 554, 15194],
        quests: Quest.randomQuestStates(),
        coordinates: [3029, 3000, 0],
        // coordinates: [3129, 3100, 0],
        stats: [55, 93, 13, 70, 75, 100, 330],
        skills: Object.values(SkillName).map(() => Math.floor(Math.random() * 14000000)),
        bank: [995, Math.floor(Math.random() * 5000000)],
        diary_vars: AchievementDiary.randomDiaries(),
        inventory: [
          26382,
          1,
          26384,
          1,
          26386,
          1,
          12791,
          1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          6685,
          1,
          6685,
          1,
          6685,
          1,
          6685,
          1,
          6685,
          1,
          6685,
          1,
          6685,
          1,
          6685,
          1,
          6685,
          1,
          995,
          Math.floor(Math.random() * 5000000),
        ],
        equipment: [26382, 1, 0, 0, 0, 0, 0, 0, 26384, 1, 0, 0, 0, 0, 26386, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      "Bank alt": {
        bank: [995, Math.floor(Math.random() * 5000000), ...Item.randomItems(500)],
        skills: Object.values(SkillName).map(() => Math.floor(Math.random() * 14000000)),
        stats: [7, 10, 10, 10, 100, 100, 309],
        equipment: Item.randomItems(14, 1),
        // coordinates: [3029, 3000, 0],
        coordinates: [3103, 3025, 0],
        quests: Quest.randomQuestStates(),
        diary_vars: AchievementDiary.randomDiaries(),
        interacting: {
          last_updated: "2050-01-01T00:00:00.000Z",
          name: "Goblin",
          ratio: 25,
          scale: 30,
          location: {
            x: 3104,
            y: 3025,
            plane: 0,
          },
        },
      },
      "@SHARED": {
        bank: [995, 1000000],
      },
    };
  }

  getGroupData(): Parameters<GroupData["update"]>[0] {
    const groupData = Object.entries(this.members).map(([name, data]) => {
      return { name, ...data };
    });
    this.members = {
      "group alt two": {
        skills: this.members["group alt two"].skills,
      },
      Zezima: {
        coordinates: this.members["Zezima"].coordinates,
      },
      "Bank alt": {},
      "@SHARED": {},
    };
    return groupData;
  }

  doXpDrop(): void {
    this.members["group alt two"].skills[0] += 50;
  }

  doHealthUpdate(): void {
    this.members["group alt two"].stats = [Math.floor(Math.max(1, Math.random() * 93)), 93, 13, 70, 75, 100, 330];
  }

  getSkillData(period: Parameters<typeof SkillGraph.datesForPeriod>[0], groupData: ExampleGroupData) {
    const dates = SkillGraph.datesForPeriod(period);
    const result: Array<{ name: string; skill_data: Array<{ time: string; data: number[] }> }> = [];
    const skillNames = Object.values(SkillName);
    skillNames.sort((a, b) => a.localeCompare(b));

    for (const member of groupData.members.values()) {
      if (!member.skills) continue;
      const memberSkills = member.skills;
      const skillData: Array<{ time: string; data: number[] }> = [];
      let s = skillNames.map((skillName) => memberSkills[skillName].xp);

      for (const date of dates) {
        skillData.push({
          time: date.toISOString(),
          data: s,
        });
        s = s.map((x) => (Math.random() > 0.9 ? Math.round(x + Math.random() * 10000) : x));
      }

      const transformed = GroupData.transformSkillsFromStorage(s) ?? {};
      for (const [skillName, xp] of Object.entries(transformed)) {
        memberSkills[skillName].xp = Number(xp);
      }

      if (this.members[member.name].skills) {
        this.members[member.name].skills = s;
      }

      result.push({
        name: member.name,
        skill_data: skillData,
      });
    }

    return result;
  }

  getCollectionLog(): Record<string, never> {
    return {};
  }
}

const exampleData = new ExampleData();

export { exampleData };
