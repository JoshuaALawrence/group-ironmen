import { BaseElement } from "../base-element/base-element";

type OverallSkill = {
  level: number;
  xp: number;
};

export class TotalLevelBox extends BaseElement {
  playerName: string | null;
  totalLevel: HTMLElement | null;

  constructor() {
    super();
    this.playerName = null;
    this.totalLevel = null;
  }

  html(): string {
    return `{{total-level-box.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.enableTooltip();
    this.playerName = this.getAttribute("player-name");
    this.render();
    this.totalLevel = this.querySelector<HTMLElement>(".total-level-box__level");
    this.subscribe(`skills:${this.playerName}`, (skills) => this.handleUpdatedSkills(skills as Record<string, OverallSkill>));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  handleUpdatedSkills(skills: Record<string, OverallSkill>): void {
    const overallSkill = skills?.Overall;
    if (!overallSkill) {
      return;
    }

    this.handleUpdatedTotalXp(overallSkill);
  }

  handleUpdatedTotalXp(skill: OverallSkill): void {
    if (!this.totalLevel) {
      return;
    }

    this.totalLevel.innerHTML = String(skill.level);
    this.updateTooltip(`Total XP: ${skill.xp.toLocaleString()}`);
  }
}
customElements.define("total-level-box", TotalLevelBox);
