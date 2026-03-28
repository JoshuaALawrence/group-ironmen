import { BaseElement } from "../base-element/base-element";
// eslint-disable-next-line no-unused-vars
import { Skill } from "../data/skill";

type SkillLike = Pick<Skill, "level" | "xp" | "levelProgress" | "xpUntilNextLevel">;

export class SkillBox extends BaseElement {
  skillName: string | null;
  playerName: string | null;
  currentLevel: HTMLElement | null;
  baseLevel: HTMLElement | null;
  progressBar: HTMLElement | null;

  constructor() {
    super();
    this.skillName = null;
    this.playerName = null;
    this.currentLevel = null;
    this.baseLevel = null;
    this.progressBar = null;
  }

  html(): string {
    return `{{skill-box.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.enableTooltip();
    this.skillName = this.getAttribute("skill-name");
    this.playerName = this.getAttribute("player-name");
    this.render();
    this.currentLevel = this.querySelector<HTMLElement>(".skill-box__current-level");
    this.baseLevel = this.querySelector<HTMLElement>(".skill-box__baseline-level");
    this.progressBar = this.querySelector<HTMLElement>(".skill-box__progress-bar");
    this.subscribe(`skills:${this.playerName}`, (skills) => this.handleUpdatedSkills(skills as Record<string, Skill>));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  handleUpdatedSkills(skills: Record<string, SkillLike>): void {
    if (!this.skillName) {
      return;
    }

    const skill = skills?.[this.skillName];
    if (!skill) {
      return;
    }

    this.handleUpdatedSkill(skill);
  }

  handleUpdatedSkill(skill: SkillLike): void {
    if (!this.currentLevel || !this.baseLevel || !this.progressBar) {
      return;
    }

    this.currentLevel.innerHTML = String(Math.min(99, skill.level));
    this.baseLevel.innerHTML = String(skill.level);
    const levelProgress = skill.levelProgress;
    this.progressBar.style.transform = `scaleX(${levelProgress})`;
    this.progressBar.style.background = `hsl(${levelProgress * 100}, 100%, 50%)`;

    this.updateTooltip(
      `Total XP: ${skill.xp.toLocaleString()}<br />XP until next level: ${skill.xpUntilNextLevel.toLocaleString()}`
    );
  }
}
customElements.define("skill-box", SkillBox);
