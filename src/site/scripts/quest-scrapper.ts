import { JSDOM } from "jsdom";
import axios from "axios";
import fs from "fs";
import questsMapping from "./quest-mapping.json";

const questNameToIdMap = new Map<string, number>();
for (const [questId, questName] of Object.entries(questsMapping)) {
  questNameToIdMap.set(questName, parseInt(questId));
}

interface QuestData {
  name: string;
  difficulty: string;
  points: string | number;
  member?: boolean;
  miniquest?: boolean;
  tutorial?: boolean;
  hidden?: boolean;
}

function getQuestTableData(table: Element): QuestData[] {
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const result: QuestData[] = [];
  const ths = Array.from(table.querySelectorAll("th"));
  const headers = ths.map((th) => th.textContent!.trim());
  for (const row of rows) {
    const tds = Array.from(row.querySelectorAll("td"));
    if (tds.length === 0) continue;
    const name = tds[headers.indexOf("Name")].textContent!.trim();
    const difficulty = tds[headers.indexOf("Difficulty")].textContent!.trim();
    const points = tds[headers.indexOf("")]?.textContent?.trim() || 0;
    result.push({ name, difficulty, points });
  }

  return result;
}

async function run() {
  const questsListHtml = await axios.get("https://oldschool.runescape.wiki/w/Quests/List");
  const dom = new JSDOM(questsListHtml.data);

  const questTables = Array.from(dom.window.document.querySelectorAll("table")).filter((table) => {
    const ths = Array.from(table.querySelectorAll("th"));
    if (ths.length === 0) return false;

    const headerText = ths.map((th) => th.textContent!.trim()).join("");
    if (headerText.includes("NameDifficultyLengthSeriesRelease date")) return true;
    return false;
  });

  const freeToPlayQuestTable = questTables[0];
  const memberQuestTable = questTables[1];
  const miniQuestTable = questTables[2];

  const freeToPlayQuests = getQuestTableData(freeToPlayQuestTable);
  freeToPlayQuests.forEach((quest) => (quest.member = false));
  const memberQuests = getQuestTableData(memberQuestTable);
  memberQuests.forEach((quest) => (quest.member = true));
  const miniQuests = getQuestTableData(miniQuestTable);
  miniQuests.forEach((quest) => {
    quest.member = true;
    quest.miniquest = true;
  });
  const tutorialQuests: QuestData[] = [
    { name: "Tutorial Island", difficulty: "Novice", points: 1, tutorial: true },
  ];

  const result: Record<number, QuestData> = {};
  for (const quest of [...freeToPlayQuests, ...memberQuests, ...miniQuests, ...tutorialQuests]) {
    if (!questNameToIdMap.has(quest.name)) {
      console.error(`quest mapping is missing quest ${quest.name} from the wiki`);
      continue;
    }

    // The points come from the subquests, setting this to 0 so we don't count the points twice
    if (quest.name === "Recipe for Disaster") {
      quest.points = 0;
    }

    result[questNameToIdMap.get(quest.name)!] = quest;
  }

  const mappedQuestIds = new Set(Object.keys(result).map((id) => parseInt(id)));
  for (const [name, questId] of questNameToIdMap.entries()) {
    if (!mappedQuestIds.has(questId)) {
      console.error(`quest ${name} - ${questId} was not found on the wiki (could be an unfinished quest)`);

      result[questId] = {
        name,
        difficulty: "UNKNOWN",
        points: 0,
        hidden: true,
      };
    }
  }

  fs.writeFileSync("./public/data/quest_data.json", JSON.stringify(result));
}

run();
