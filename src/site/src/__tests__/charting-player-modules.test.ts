import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../data/api", () => ({
  api: {
    getSkillData: vi.fn(),
  },
}));

vi.mock("../data/group-data", () => ({
  GroupData: {
    transformSkillsFromStorage: vi.fn((skills: number[] | null | undefined) => {
      const values = skills ?? [];
      const attack = values[0] ?? 0;
      const strength = values[1] ?? 0;
      return {
        Attack: attack,
        Strength: strength,
        Overall: attack + strength,
      };
    }),
  },
}));

import { SkillsGraphs } from "../skills-graphs/skills-graphs";
import { SkillGraph } from "../skill-graph/skill-graph";
import { PlayerStats } from "../player-stats/player-stats";
import { PlayerQuests } from "../player-quests/player-quests";
import { Skill, SkillName } from "../data/skill";
import { Quest, QuestState } from "../data/quest";
import { api } from "../data/api";
import { GroupData } from "../data/group-data";

type ChartMock = {
  constructorMock: ReturnType<typeof vi.fn>;
  instances: Array<{ ctx: unknown; config: any; destroy: ReturnType<typeof vi.fn> }>;
};

function installChartMock(): ChartMock {
  const instances: Array<{ ctx: unknown; config: any; destroy: ReturnType<typeof vi.fn> }> = [];

  const constructorMock = vi.fn(function (this: { destroy: ReturnType<typeof vi.fn> }, ctx: unknown, config: any) {
    this.destroy = vi.fn();
    instances.push({ ctx, config, destroy: this.destroy });
  });

  (constructorMock as any).defaults = {
    scale: {
      grid: {
        borderColor: "",
        color: "",
      },
    },
    color: "",
  };

  (globalThis as any).Chart = constructorMock;
  return { constructorMock, instances };
}

function makeQuest(id: number, state: string): Quest {
  return new Quest(String(id), state as (typeof QuestState)[keyof typeof QuestState]);
}

describe("charting and player modules", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.mocked(api.getSkillData).mockReset();
    vi.mocked(GroupData.transformSkillsFromStorage).mockClear();

    Quest.questData = {
      "1": { name: "Cook's Assistant", difficulty: "Novice", points: 1, sortName: "Cooks Assistant" },
      "2": { name: "Dragon Slayer", difficulty: "Experienced", points: 2, sortName: "Dragon Slayer" },
      "3": { name: "X Marks the Spot", difficulty: "Novice", points: 1, sortName: "X Marks the Spot" },
    } as any;
    Quest.freeToPlayQuests = { "2": Quest.questData["2"], "1": Quest.questData["1"] } as any;
    Quest.memberQuests = {};
    Quest.miniQuests = {};
    Quest.tutorial = { "3": Quest.questData["3"] } as any;
  });

  afterEach(() => {
    delete (globalThis as any).Chart;
    SkillsGraphs.chartJsScriptTag = undefined;
    vi.restoreAllMocks();
  });

  it("creates a skills graph element from fetched group history", async () => {
    installChartMock();
    const graphs = new SkillsGraphs();
    graphs.period = "Week";
    graphs.selectedSkill = SkillName.Attack;
    graphs.chartContainer = document.createElement("div");

    const waitForChart = vi.spyOn(graphs, "waitForChartjs").mockResolvedValue();

    vi.mocked(api.getSkillData).mockResolvedValue([
      {
        name: "zara",
        skill_data: [
          { time: "2026-03-28T01:00:00.000Z", data: [25, 5] },
          { time: "2026-03-28T03:00:00.000Z", data: [30, 7] },
        ],
      },
      {
        name: "alice",
        skill_data: [{ time: "2026-03-28T02:00:00.000Z", data: [40, 2] }],
      },
    ]);

    await graphs.createChart();

    expect(api.getSkillData).toHaveBeenCalledWith("Week");
    expect(waitForChart).toHaveBeenCalled();

    const createdGraph = graphs.chartContainer.querySelector("skill-graph") as HTMLElement & {
      skillDataForGroup: Array<{ name: string; skill_data: Array<{ time: Date; data: Record<string, number> }> }>;
    };
    expect(createdGraph).toBeTruthy();
    expect(createdGraph.getAttribute("data-period")).toBe("Week");
    expect(createdGraph.getAttribute("skill-name")).toBe(SkillName.Attack);
    expect(createdGraph.skillDataForGroup.map((x) => x.name)).toEqual(["alice", "zara"]);
    expect(createdGraph.skillDataForGroup[1].skill_data[0].time.getTime()).toBeGreaterThan(
      createdGraph.skillDataForGroup[1].skill_data[1].time.getTime()
    );
    expect(createdGraph.skillDataForGroup[0].skill_data[0].data).toEqual({ Attack: 40, Strength: 2, Overall: 42 });
    expect(GroupData.transformSkillsFromStorage).toHaveBeenCalled();
  });

  it("handles skills graph load failures", async () => {
    installChartMock();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const graphs = new SkillsGraphs();
    graphs.chartContainer = document.createElement("div");
    vi.spyOn(graphs, "waitForChartjs").mockResolvedValue();
    vi.mocked(api.getSkillData).mockRejectedValue(new Error("boom"));

    await graphs.createChart();

    expect(consoleError).toHaveBeenCalled();
    expect(graphs.chartContainer.textContent).toContain("Failed to load Error: boom");
  });

  it("loads chart.js script once when waiting for chart", async () => {
    installChartMock();
    const graphs = new SkillsGraphs();
    const initialScripts = document.body.querySelectorAll("script").length;

    await graphs.waitForChartjs();
    await graphs.waitForChartjs();

    const scripts = Array.from(document.body.querySelectorAll("script"));
    const chartScripts = scripts.filter((x) => x.src.includes("chart.min.js"));
    expect(chartScripts.length).toBe(1);
    expect(document.body.querySelectorAll("script").length).toBe(initialScripts + 1);
  });

  it("builds datasets, chart config and table output for skill graph", () => {
    const { constructorMock, instances } = installChartMock();

    const graph = new SkillGraph();
    graph.period = "Day";
    graph.skillName = SkillName.Overall;
    graph.ctx = {} as CanvasRenderingContext2D;
    graph.tableContainer = document.createElement("div");

    const now = new Date("2026-03-28T03:00:00.000Z");
    graph.dates = [
      new Date("2026-03-28T01:00:00.000Z"),
      new Date("2026-03-28T02:00:00.000Z"),
      new Date("2026-03-28T03:00:00.000Z"),
    ];
    graph.skillDataForGroup = [
      {
        name: "alice",
        skill_data: [
          { time: now, data: { Overall: 1300, Attack: 700 } },
          { time: new Date("2026-03-28T02:00:00.000Z"), data: { Overall: 1200, Attack: 650 } },
          { time: new Date("2026-03-28T01:00:00.000Z"), data: { Overall: 1000, Attack: 600 } },
        ],
      },
      {
        name: "bob",
        skill_data: [
          { time: now, data: { Overall: 900, Attack: 450 } },
          { time: new Date("2026-03-28T02:00:00.000Z"), data: { Overall: 850, Attack: 430 } },
          { time: new Date("2026-03-28T01:00:00.000Z"), data: { Overall: 800, Attack: 400 } },
        ],
      },
    ];
    graph.currentGroupData = {
      members: new Map([
        [
          "alice",
          {
            color: "#ff0000",
            skills: {
              Overall: new Skill(SkillName.Overall, 1300),
              Attack: new Skill(SkillName.Attack, 700),
            },
          },
        ],
        [
          "bob",
          {
            color: "#00ff00",
            skills: {
              Overall: new Skill(SkillName.Overall, 900),
              Attack: new Skill(SkillName.Attack, 450),
            },
          },
        ],
      ]),
    };

    const dataSets = graph.dataSets(SkillName.Overall);
    expect(dataSets).toHaveLength(2);
    expect(dataSets[0].label).toBe("alice");
    expect(dataSets[0].data[dataSets[0].data.length - 1]).toBe(300);

    graph.createTable(dataSets);
    expect(graph.tableContainer.innerHTML).toContain("skill-graph__overall-groups");
    expect(graph.tableContainer.innerHTML).toContain("alice");

    graph.createChart(dataSets);
    expect(constructorMock).toHaveBeenCalledTimes(1);

    const chartConfig = instances[0].config;
    expect(chartConfig.options.plugins.title.text).toBe("Overall - Day");
    expect(chartConfig.data.labels).toHaveLength(3);

    const tooltipLabel = chartConfig.options.plugins.tooltip.callbacks.label({ dataset: dataSets[0], dataIndex: 1 });
    expect(tooltipLabel).toContain("alice");
    expect(tooltipLabel).toContain("+200");
  });

  it("updates player stats bars and world state", () => {
    const stats = new PlayerStats();
    document.body.appendChild(stats);

    stats.worldEl = document.createElement("div");
    stats.hitpointsBar = { update: vi.fn() } as any;
    stats.prayerBar = { update: vi.fn() } as any;
    stats.energyBar = { update: vi.fn() } as any;

    const hp = document.createElement("div");
    hp.className = "player-stats__hitpoints-numbers";
    const prayer = document.createElement("div");
    prayer.className = "player-stats__prayer-numbers";
    const energy = document.createElement("div");
    energy.className = "player-stats__energy-numbers";
    stats.append(hp, prayer, energy);

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    stats.updateStatBars({
      hitpoints: { current: 70, max: 99 },
      prayer: { current: 50, max: 99 },
      energy: { current: 8000, max: 10000 },
      world: 302,
    });

    expect(hp.innerText).toBe("70 / 99");
    expect(prayer.innerText).toBe("50 / 99");
    expect((stats.hitpointsBar.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(70 / 99);
    expect((stats.prayerBar.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(50 / 99);
    expect((stats.energyBar.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(0.8);

    stats.updateWorld(undefined, true);
    expect(stats.worldEl.innerText).toBe("Offline");
    expect(stats.classList.contains("player-stats__inactive")).toBe(true);

    stats.updateWorld(302, false);
    expect(stats.worldEl.innerText).toBe("W302");
    expect(stats.classList.contains("player-stats__inactive")).toBe(false);
  });

  it("renders and updates player quests list with filtering", () => {
    const quests = new PlayerQuests();
    quests.quests = {
      1: makeQuest(1, QuestState.NOT_STARTED),
      2: makeQuest(2, QuestState.NOT_STARTED),
      3: makeQuest(3, QuestState.NOT_STARTED),
    };

    const sectionHtml = quests.questSectionHtml(Quest.freeToPlayQuests);
    expect(sectionHtml.indexOf("Cook's Assistant")).toBeLessThan(sectionHtml.indexOf("Dragon Slayer"));

    const q1 = document.createElement("div");
    const q2 = document.createElement("div");
    quests.questListElements = new Map([
      [1, q1],
      [2, q2],
    ]);
    quests.currentQuestPointsEl = document.createElement("div");

    quests.handleUpdatedQuests({
      1: makeQuest(1, QuestState.FINISHED),
      2: makeQuest(2, QuestState.IN_PROGRESS),
      3: makeQuest(3, QuestState.NOT_STARTED),
    });

    expect(q1.classList.contains("player-quests__finished")).toBe(true);
    expect(q2.classList.contains("player-quests__in-progress")).toBe(true);
    expect(quests.currentQuestPointsEl.innerHTML).toBe("1");

    quests.searchElement = { value: "dragon" } as any;
    quests.handleSearch();
    expect(q1.classList.contains("player-quests__hidden")).toBe(true);
    expect(q2.classList.contains("player-quests__hidden")).toBe(false);

    quests.searchElement = { value: "" } as any;
    quests.handleSearch();
    expect(q1.classList.contains("player-quests__hidden")).toBe(false);
  });
});
