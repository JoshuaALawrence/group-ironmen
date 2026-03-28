import { BaseElement } from "../base-element/base-element";
import { AchievementDiary } from "../data/diaries";
import { Skill } from "../data/skill";

type DiaryTask = {
  task: string;
  requirements?: {
    combat?: number;
    skills?: Record<string, number>;
    quests?: string[];
  };
};

type DiaryDataSet = Record<string, Record<string, DiaryTask[]>>;

type DiaryPlayer = {
  combatLevel: number;
  skills: Record<string, { level: number }>;
  hasQuestComplete: (questName: string) => boolean;
};

type DiaryCompletion = {
  completion: Record<string, Record<string, boolean[]>>;
};

export class DiaryDialog extends BaseElement {
  diaryName: string | null;
  playerName: string | null;
  background: HTMLElement | null;

  constructor() {
    super();
    this.diaryName = null;
    this.playerName = null;
    this.background = null;
  }

  html(): string {
    return `{{diary-dialog.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.diaryName = this.getAttribute("diary-name");
    this.playerName = this.getAttribute("player-name");
    this.render();
    this.background = this.querySelector<HTMLElement>(".dialog__visible");

    this.subscribeOnce(`diaries:${this.playerName}`, (playerDiaries, player) =>
      this.handleDiaries(playerDiaries as DiaryCompletion, player as DiaryPlayer)
    );
    const closeButton = this.querySelector<HTMLElement>(".dialog__close");
    if (closeButton) {
      this.eventListener(closeButton, "click", this.close.bind(this));
    }
    if (this.background) {
      this.eventListener(this.background, "click", this.closeIfBackgroundClick.bind(this) as EventListener);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  closeIfBackgroundClick(evt: MouseEvent): void {
    if (evt.target === this.background) {
      this.close();
    }
  }

  close(): void {
    this.remove();
  }

  handleDiaries(playerDiaries: DiaryCompletion, player: DiaryPlayer): void {
    const diaries = AchievementDiary.diaries as DiaryDataSet;
    const diary = diaries[this.diaryName ?? ""];
    if (!diary || !this.diaryName) {
      return;
    }
    let completeTiers = 0;

    for (const [tierName, tasks] of Object.entries(diary)) {
      const taskSection = document.createDocumentFragment();
      const completionData = playerDiaries.completion[this.diaryName][tierName];
      let complete = 0;
      for (let i = 0; i < tasks.length; ++i) {
        const task = tasks[i];
        const completed = completionData[i];
        const taskEl = document.createElement("div");
        taskEl.classList.add("diary-dialog__task");
        taskEl.innerText = task.task;

        if (completed) {
          taskEl.classList.add("diary-dialog__task-complete");
          ++complete;
        }

        const requirementsHtml = [];
        const combatRequirement = task.requirements?.combat;
        if (combatRequirement) {
          const playerCombat = player.combatLevel;
          const hasCombatRequirement = playerCombat >= combatRequirement;
          requirementsHtml.push(`
<span class="${hasCombatRequirement ? "diary-dialog__requirement-met" : ""}">
  ${playerCombat}/${combatRequirement} Combat
</span>`);
        }

        const skillRequirements = task.requirements?.skills;
        if (skillRequirements) {
          for (const [skillName, level] of Object.entries(skillRequirements)) {
            const playerLevel = player.skills[skillName].level;
            const hasSkillRequirement = playerLevel >= level;
            requirementsHtml.push(`
<span class="${hasSkillRequirement ? "diary-dialog__requirement-met" : ""}">
  ${playerLevel}/${level} <img title="${skillName}" alt="${skillName}" src="${Skill.getIcon(skillName)}" />
</span>
`);
          }
        }

        const questRequirements = task.requirements?.quests;
        if (questRequirements) {
          for (const quest of questRequirements) {
            const questComplete = player.hasQuestComplete(quest);
            requirementsHtml.push(
              `<span class="${questComplete ? "diary-dialog__requirement-met" : ""}">${quest}</span>`
            );
          }
        }

        if (requirementsHtml.length > 0) {
          const requirementsEl = document.createElement("div");
          requirementsEl.classList.add("diary-dialog__requirements");
          requirementsEl.innerHTML = `&nbsp;(${requirementsHtml.join(",&nbsp;")})`;
          taskEl.appendChild(requirementsEl);
        }

        taskSection.appendChild(taskEl);
      }

      const section = this.querySelector<HTMLElement>(`.diary-dialog__section[diary-tier="${tierName}"]`);
      const header = section?.querySelector<HTMLElement>("h2");
      if (!section || !header) {
        continue;
      }
      const sectionLink = `https://oldschool.runescape.wiki/w/${this.diaryName.replace(/ /g, "_")}_Diary#${tierName}`;
      header.innerHTML = `<a href="${sectionLink}" target="_blank">${header.innerText} - ${complete} / ${tasks.length}</a>`;
      if (complete === tasks.length) {
        section.classList.add("diary-dialog__tier-complete");
        ++completeTiers;
      }

      section.appendChild(taskSection);
    }

    if (completeTiers === 4) {
      this.classList.add("diary-dialog__diary-complete");
    }

    this.classList.add("dialog__visible");
  }
}

customElements.define("diary-dialog", DiaryDialog);
