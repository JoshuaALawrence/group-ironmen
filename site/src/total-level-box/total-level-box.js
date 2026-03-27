import { BaseElement } from "../base-element/base-element";

export class TotalLevelBox extends BaseElement {
  constructor() {
    super();
  }

  html() {
    return `{{total-level-box.html}}`;
  }

  connectedCallback() {
    super.connectedCallback();
    this.enableTooltip();
    this.playerName = this.getAttribute("player-name");
    this.render();
    this.totalLevel = this.querySelector(".total-level-box__level");
    this.subscribe(`skills:${this.playerName}`, this.handleUpdatedSkills.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  handleUpdatedSkills(skills) {
    const overallSkill = skills?.Overall;
    if (!overallSkill) {
      return;
    }

    this.handleUpdatedTotalXp(overallSkill);
  }

  handleUpdatedTotalXp(skill) {
    this.totalLevel.innerHTML = skill.level;
    this.updateTooltip(`Total XP: ${skill.xp.toLocaleString()}`);
  }
}
customElements.define("total-level-box", TotalLevelBox);
