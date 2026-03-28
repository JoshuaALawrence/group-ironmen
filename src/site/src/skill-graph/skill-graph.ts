/* global Chart */
import { BaseElement } from "../base-element/base-element";
import { Skill, SkillName } from "../data/skill";

type Period = "Day" | "Week" | "Month" | "Year";

type SkillSnapshot = {
  time: Date;
  data: Record<string, number>;
};

type PlayerSkillHistory = {
  name: string;
  skill_data: SkillSnapshot[];
};

type GroupMemberLike = {
  color: string;
  skills: Record<string, Skill>;
};

type GroupDataLike = {
  members: Map<string, GroupMemberLike>;
};

type ChartDataSet = {
  type: string;
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
  pointBorderWidth: number;
  pointHoverBorderWidth: number;
  pointHoverRadius: number;
  pointRadius: number;
  borderWidth: number;
  changeData: number[];
  totalXpData: number[];
};

type TableDataCell = {
  xpGain: number;
  color: string;
  totalXpGain?: number;
};

type ChartInstance = {
  destroy: () => void;
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

export class SkillGraph extends BaseElement {
  period: Period;
  skillName: string;
  tableContainer: HTMLElement | null;
  ctx: CanvasRenderingContext2D | null;
  chart?: ChartInstance;
  currentGroupData?: GroupDataLike;
  dates: Date[];
  skillDataForGroup: PlayerSkillHistory[];

  constructor() {
    super();
    this.period = "Day";
    this.skillName = SkillName.Overall;
    this.tableContainer = null;
    this.ctx = null;
    this.dates = [];
    this.skillDataForGroup = [];
  }

  html(): string {
    return `{{skill-graph.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.period = (this.getAttribute("data-period") as Period) || "Day";
    this.skillName = this.getAttribute("skill-name") || SkillName.Overall;
    this.render();
    this.tableContainer = this.querySelector<HTMLElement>(".skill-graph__table-container");
    const canvas = this.querySelector<HTMLCanvasElement>("canvas");
    this.ctx = canvas?.getContext("2d") ?? null;

    this.subscribeOnce("get-group-data", (groupData) => this.create(groupData as GroupDataLike));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.chart) {
      this.chart.destroy();
    }
  }

  create(groupData: GroupDataLike): void {
    if (!this.isConnected) return;
    this.currentGroupData = groupData;
    this.dates = SkillGraph.datesForPeriod(this.period);
    const dataSets = this.dataSets(this.skillName);

    this.createChart(dataSets);
    this.createTable(dataSets);
  }

  tableDataForDataSet(dataSet: ChartDataSet): TableDataCell {
    let xpGain = dataSet.data[dataSet.data.length - 1];
    if (isNaN(xpGain)) xpGain = 0;
    return {
      xpGain,
      color: dataSet.backgroundColor,
    };
  }

  createTable(dataSets: ChartDataSet[]): void {
    const dataSetsSkills: Record<string, ChartDataSet[]> = {
      [this.skillName]: dataSets,
    };

    const skillNames = Object.values(SkillName)
      .filter((x) => x !== SkillName.Overall)
      .sort((a, b) => {
        return a.localeCompare(b);
      });
    if (this.skillName === SkillName.Overall) {
      for (const skillName of skillNames) {
        dataSetsSkills[skillName] = this.dataSets(skillName);
      }
    }

    const tableData: Record<string, Record<string, TableDataCell>> = {};
    for (const [skillName, dataSets] of Object.entries(dataSetsSkills)) {
      let totalXpGain = 0;
      for (const dataSet of dataSets) {
        if (!tableData[dataSet.label]) {
          tableData[dataSet.label] = {};
        }
        tableData[dataSet.label][skillName] = this.tableDataForDataSet(dataSet);
        totalXpGain += tableData[dataSet.label][skillName].xpGain;
      }

      for (const dataSet of dataSets) {
        tableData[dataSet.label][skillName].totalXpGain = totalXpGain;
      }
    }

    const row = (cls: string, label: string, data: TableDataCell, totalXpGain: number): string => {
      const xpGainPercent = totalXpGain > 0 ? Math.round((data.xpGain / totalXpGain) * 100) : 0;
      const skillIcon = Skill.getIcon(label);
      const skillImg = skillIcon.length ? `<img src="${Skill.getIcon(label)}" />` : "";
      return `
<tr class="${cls}" style="background: linear-gradient(90deg, ${
        data.color
      } ${xpGainPercent}%, transparent ${xpGainPercent}%)">
  <td>${skillImg}${label}</td>
  <td class="skill-graph__xp-change-data">${data.xpGain > 0 ? "+" : ""}${data.xpGain.toLocaleString()}</td>
</tr>
`;
    };

    if (this.tableContainer) {
      if (this.skillName === SkillName.Overall) {
        const tableEntries = Object.entries(tableData);
        const maxTotalXpGain = Math.max(...tableEntries.map(([, skills]) => skills[this.skillName]?.xpGain ?? 0), 0);
        const overallGroups = tableEntries
          .map(([name, x], index) => {
            const currentSkillData = x[this.skillName];
            if (!currentSkillData) {
              return "";
            }

            const skillNamesSortedByXpGain = [...skillNames]
              .filter((skillName) => x[skillName]?.xpGain > 0)
              .sort((a, b) => x[b].xpGain - x[a].xpGain);
            const topSkills = skillNamesSortedByXpGain
              .slice(0, 3)
              .map((skillName) => `${skillName} +${x[skillName].xpGain.toLocaleString()}`)
              .join(" • ");
            const detailRows = skillNamesSortedByXpGain
              .map((skillName) => row("skill-graph__overall-skill-change", skillName, x[skillName], currentSkillData.xpGain))
              .join("");
            const summaryWidth =
              maxTotalXpGain > 0 ? Math.max(10, Math.round((currentSkillData.xpGain / maxTotalXpGain) * 100)) : 0;

            return `
<details class="skill-graph__overall-player" ${index === 0 ? "open" : ""}>
  <summary class="skill-graph__overall-summary" style="background: linear-gradient(90deg, ${currentSkillData.color} ${summaryWidth}%, transparent ${summaryWidth}%);">
    <span class="skill-graph__overall-summary-name">${name}</span>
    <span class="skill-graph__overall-summary-total">${currentSkillData.xpGain > 0 ? "+" : ""}${currentSkillData.xpGain.toLocaleString()}</span>
    <span class="skill-graph__overall-summary-top">${topSkills || "No skill gains recorded"}</span>
  </summary>
  <div class="skill-graph__overall-details">
    <table>
      ${detailRows}
    </table>
  </div>
</details>`;
          })
          .join("");

        this.tableContainer.innerHTML = `<div class="skill-graph__overall-groups">${overallGroups}</div>`;
        return;
      }

      const tableRows: string[] = [];
      for (const [name, x] of Object.entries(tableData)) {
        const currentSkillData = x[this.skillName];
        if (!currentSkillData) {
          continue;
        }
        const totalXpGain = currentSkillData.totalXpGain ?? 0;
        tableRows.push(row("", name, x[this.skillName], totalXpGain));
      }

      this.tableContainer.innerHTML = `
<table>
  ${tableRows.join("")}
</table>
`;
    }
  }

  createChart(dataSets: ChartDataSet[]): void {
    if (!this.ctx) {
      return;
    }

    if (this.chart) this.chart.destroy();

    let min = Number.MAX_SAFE_INTEGER;
    let max = 0;
    for (let i = 0; i < dataSets.length; ++i) {
      min = Math.min(min, dataSets[i].data[0]);
      max = Math.max(max, dataSets[i].data[dataSets[i].data.length - 1]);
    }

    const scales = {
      x: {
        grid: {
          drawTicks: false,
        },
        ticks: {
          autoSkip: true,
          maxTicksLimit: this.maxTickCountForPeriod(this.period),
          maxRotation: 0,
          minRotation: 0,
        },
      },
      y: {
        type: "linear",
        min,
        max: max + 1,
        title: {
          display: true,
          text: "XP Gain",
        },
      },
    };

    this.chart = new Chart(this.ctx, {
      type: "line",
      options: {
        maintainAspectRatio: false,
        animation: false,
        normalized: true,
        layout: {
          padding: 0,
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (tooltip: { dataset: ChartDataSet; dataIndex: number }) => {
                const xpChange = tooltip.dataset.changeData[tooltip.dataIndex];
                const xpChangeString = `${xpChange > 0 ? "+" : ""}${xpChange.toLocaleString()}`;
                const totalXp = tooltip.dataset.totalXpData[tooltip.dataIndex] || 0;
                return `${tooltip.dataset.label}: ${totalXp.toLocaleString()} (${xpChangeString})`;
              },
            },
          },
          title: {
            display: true,
            text: `${this.skillName} - ${this.period}`,
          },
        },
        interaction: {
          intersect: false,
          mode: "index",
        },
        scales,
      },
      data: {
        labels: this.labelsForPeriod(this.period, this.dates),
        datasets: dataSets,
      },
    });
  }

  dataSets(skillName: string): ChartDataSet[] {
    const result: ChartDataSet[] = [];
    for (let i = 0; i < this.skillDataForGroup.length; ++i) {
      const playerSkillData = this.skillDataForGroup[i];
      const [totalXpData, changeData, cumulativeChangeData] = this.dataForPlayer(
        playerSkillData,
        this.dates,
        skillName
      );
      const color = this.currentGroupData?.members.get(playerSkillData.name)?.color ?? "#ffffff";

      result.push({
        type: "line",
        label: playerSkillData.name,
        data: cumulativeChangeData,
        borderColor: color,
        backgroundColor: color,
        pointBorderWidth: 0,
        pointHoverBorderWidth: 0,
        pointHoverRadius: 3,
        pointRadius: 0,
        borderWidth: 2,
        changeData,
        totalXpData,
      });
    }

    return result;
  }

  dataForPlayer(playerSkillData: PlayerSkillHistory, dates: Date[], skillName: string): [number[], number[], number[]] {
    const latestSkillData = this.currentGroupData?.members.get(playerSkillData.name)?.skills;
    if (!latestSkillData) {
      return [[], [], []];
    }
    const completeTimeSeries = this.generateCompleteTimeSeries(playerSkillData.skill_data, latestSkillData, skillName);
    const changeData = [0];
    const cumulativeChangeData = [0];

    let s = 0;
    for (let i = 1; i < completeTimeSeries.length; ++i) {
      const previous = completeTimeSeries[i - 1];
      const current = completeTimeSeries[i];
      if (previous === undefined || current === undefined) {
        changeData.push(0);
        cumulativeChangeData.push(s);
      } else {
        changeData.push(current - previous);
        s += current - previous;
        cumulativeChangeData.push(s);
      }
    }

    return [completeTimeSeries, changeData, cumulativeChangeData];
  }

  generateCompleteTimeSeries(
    playerSkillData: SkillSnapshot[],
    currentSkillData: Record<string, Skill>,
    skillName: string
  ): number[] {
    const bucketedSkillData = new Map<number, Record<string, number>>();
    const earliestDateInPeriod = SkillGraph.truncatedDateForPeriod(this.dates[0], this.period);
    const datesOutsideOfPeriod: SkillSnapshot[] = [];
    for (const skillData of playerSkillData) {
      const date = SkillGraph.truncatedDateForPeriod(skillData.time, this.period);
      bucketedSkillData.set(date.getTime(), skillData.data);

      if (date < earliestDateInPeriod) {
        datesOutsideOfPeriod.push(skillData);
      }
    }

    let lastData = datesOutsideOfPeriod.length ? datesOutsideOfPeriod[0].data[skillName] : undefined;
    const result: number[] = [];

    for (let i = 0; i < this.dates.length; ++i) {
      const date = this.dates[i];
      const time = date.getTime();
      if (bucketedSkillData.has(time)) {
        const data = bucketedSkillData.get(time)?.[skillName] ?? lastData ?? 0;
        result.push(data);
        lastData = data;
      } else {
        result.push(lastData ?? 0);
      }
    }

    result[result.length - 1] = currentSkillData[skillName]?.xp ?? 0;
    return result;
  }

  labelsForPeriod(period: Period, dates: Date[]): string[] {
    if (period === "Day") {
      return dates.map((date) => date.toLocaleTimeString([], { hour: "numeric" }));
    } else if (period === "Week" || period === "Month") {
      // NOTE: For the rest of these periods we don't know at exactly what time the events occured in the user's timezone
      // due to them being truncated. Just going to display the times in UTC
      return dates.map((date) => date.toLocaleDateString([], { timeZone: "UTC", day: "numeric", month: "short" }));
    } else if (period === "Year") {
      return dates.map((date) => date.toLocaleDateString([], { timeZone: "UTC", year: "numeric", month: "short" }));
    }

    return [];
  }

  maxTickCountForPeriod(period: Period): number {
    switch (period) {
      case "Day":
        return 8;
      case "Week":
        return 7;
      case "Month":
        return 10;
      case "Year":
        return 12;
      default:
        return 8;
    }
  }

  static datesForPeriod(period: Period): Date[] {
    const stepInMillisecondsForPeriods: Record<Period, number> = {
      Day: 3600000,
      Week: 86400000,
      Month: 86400000,
      Year: 2629800000,
    };
    const step = stepInMillisecondsForPeriods[period];
    const stepCountsForPeriods: Record<Period, number> = {
      Day: 24,
      Week: 7,
      Month: 30,
      Year: 12,
    };
    const count = stepCountsForPeriods[period];

    const now = new Date();
    const result: Date[] = [];

    for (let i = count - 1; i >= 0; --i) {
      const t = new Date(now.getTime() - i * step);
      result.push(SkillGraph.truncatedDateForPeriod(t, period));
    }

    return result;
  }

  static truncatedDateForPeriod(date: Date, period: Period): Date {
    const t = new Date(date);
    t.setMinutes(0, 0, 0);

    if (period !== "Day") {
      t.setHours(0);
    }

    if (period === "Year") {
      t.setMonth(t.getMonth(), 1);
    }

    return t;
  }
}

customElements.define("skill-graph", SkillGraph);
