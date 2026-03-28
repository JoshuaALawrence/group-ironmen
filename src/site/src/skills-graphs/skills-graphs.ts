/* global Chart */
import { BaseElement } from "../base-element/base-element";
import { api } from "../data/api";
import { SkillName } from "../data/skill";
import { GroupData } from "../data/group-data";

type Period = "Day" | "Week" | "Month" | "Year";

type SkillSnapshot = {
  time: Date;
  data: Record<string, number>;
};

type PlayerSkillHistory = {
  name: string;
  skill_data: SkillSnapshot[];
};

type SkillGraphElement = HTMLElement & {
  skillDataForGroup: PlayerSkillHistory[];
};

type ChartInstance = {
  destroy?: () => void;
};

declare const Chart: {
  defaults: {
    scale: {
      grid: {
        borderColor: string;
        color: string;
      };
    };
    color: string;
  };
  new (ctx: CanvasRenderingContext2D, config: unknown): ChartInstance;
};

export class SkillsGraphs extends BaseElement {
  static chartJsScriptTag?: HTMLScriptElement;

  period: Period;
  chartContainer: HTMLElement | null;
  periodSelect: HTMLSelectElement | null;
  refreshButton: HTMLElement | null;
  skillSelect: HTMLSelectElement | null;
  selectedSkill: string;

  constructor() {
    super();
    this.period = "Day";
    this.chartContainer = null;
    this.periodSelect = null;
    this.refreshButton = null;
    this.skillSelect = null;
    this.selectedSkill = SkillName.Overall;
  }

  /* eslint-disable no-unused-vars */
  html(): string {
    const skillNames = Object.values(SkillName).sort((a, b) => {
      if (a === "Overall") return -1;
      if (b === "Overall") return 1;
      return a.localeCompare(b);
    });
    return `{{skills-graphs.html}}`;
  }
  /* eslint-enable no-unused-vars */

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.period = "Day";

    this.chartContainer = this.querySelector<HTMLElement>(".skills-graphs__chart-container");
    this.periodSelect = this.querySelector<HTMLSelectElement>(".skills-graphs__period-select");
    this.refreshButton = this.querySelector<HTMLElement>(".skills-graphs__refresh");
    this.skillSelect = this.querySelector<HTMLSelectElement>(".skills-graphs__skill-select");
    this.selectedSkill = this.skillSelect?.value ?? SkillName.Overall;
    if (this.periodSelect) {
      this.eventListener(this.periodSelect, "change", this.handlePeriodChange.bind(this));
    }
    if (this.refreshButton) {
      this.eventListener(this.refreshButton, "click", this.handleRefreshClicked.bind(this));
    }
    if (this.skillSelect) {
      this.eventListener(this.skillSelect, "change", this.handleSkillSelectChange.bind(this));
    }

    this.subscribeOnce("get-group-data", this.createChart.bind(this));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  handleSkillSelectChange(): void {
    this.selectedSkill = this.skillSelect?.value ?? SkillName.Overall;
    this.subscribeOnce("get-group-data", this.createChart.bind(this));
  }

  handlePeriodChange(): void {
    this.period = (this.periodSelect?.value as Period) || "Day";
    this.subscribeOnce("get-group-data", this.createChart.bind(this));
  }

  handleRefreshClicked(): void {
    this.subscribeOnce("get-group-data", this.createChart.bind(this));
  }

  async createChart(): Promise<void> {
    if (!this.chartContainer) {
      return;
    }

    const loader = document.createElement("div");
    loader.classList.add("skills-graphs__loader");
    loader.classList.add("loader");
    this.chartContainer.appendChild(loader);

    try {
      const [skillDataForGroup] = (await Promise.all([
        api.getSkillData(this.period),
        this.waitForChartjs(),
      ])) as [PlayerSkillHistory[], void];
      skillDataForGroup.sort((a, b) => a.name.localeCompare(b.name));
      skillDataForGroup.forEach((playerSkillData) => {
        playerSkillData.skill_data.forEach((x) => {
          x.time = new Date(x.time);
          x.data = (GroupData.transformSkillsFromStorage(x.data as unknown as number[]) ?? {}) as Record<string, number>;
        });
        playerSkillData.skill_data.sort((a, b) => b.time.getTime() - a.time.getTime());
      });

      this.chartContainer.innerHTML = "";
      Chart.defaults.scale.grid.borderColor = "rgba(255, 255, 255, 0)";
      const style = getComputedStyle(document.body);
      Chart.defaults.color = style.getPropertyValue("--primary-text");
      Chart.defaults.scale.grid.color = style.getPropertyValue("--graph-grid-border");

      const skillGraph = document.createElement("skill-graph") as SkillGraphElement;
      skillGraph.skillDataForGroup = skillDataForGroup;
      skillGraph.setAttribute("data-period", this.period);
      skillGraph.setAttribute("skill-name", this.selectedSkill);
      this.chartContainer.appendChild(skillGraph);
    } catch (err) {
      console.error(err);
      this.chartContainer.textContent = `Failed to load ${err}`;
    }
  }

  async waitForChartjs(): Promise<void> {
    if (!SkillsGraphs.chartJsScriptTag) {
      SkillsGraphs.chartJsScriptTag = document.createElement("script");
      SkillsGraphs.chartJsScriptTag.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js";
      document.body.appendChild(SkillsGraphs.chartJsScriptTag);
    }

    while (typeof Chart === "undefined") {
      await new Promise((resolve) => setTimeout(() => resolve(true), 100));
    }
  }
}

customElements.define("skills-graphs", SkillsGraphs);
