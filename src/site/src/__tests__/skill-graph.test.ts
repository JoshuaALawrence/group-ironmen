import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pubsub } from "../data/pubsub";
import { Skill, SkillName } from "../data/skill";
import { SkillGraph } from "../skill-graph/skill-graph";

type ChartMockInstance = {
  ctx: unknown;
  config: any;
  destroy: ReturnType<typeof vi.fn>;
};

function installChartMock(): {
  constructorMock: ReturnType<typeof vi.fn>;
  instances: ChartMockInstance[];
} {
  const instances: ChartMockInstance[] = [];

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

function makeDataSet(
  label: string,
  color: string,
  data: number[],
  changeData: number[] = data.map((value, index) => (index === 0 ? 0 : value - data[index - 1])),
  totalXpData: number[] = data
) {
  return {
    type: "line",
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    pointBorderWidth: 0,
    pointHoverBorderWidth: 0,
    pointHoverRadius: 3,
    pointRadius: 0,
    borderWidth: 2,
    changeData,
    totalXpData,
  };
}

function makeGroupData(entries: Array<[string, string, Record<string, number>]>) {
  return {
    members: new Map(
      entries.map(([name, color, skills]) => [
        name,
        {
          color,
          skills: Skill.parseSkillData(skills),
        },
      ])
    ),
  };
}

describe("SkillGraph", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    pubsub.unpublishAll();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T15:45:30.000Z"));
  });

  afterEach(() => {
    delete (globalThis as any).Chart;
    pubsub.unpublishAll();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("generates truncated date buckets for each supported period", () => {
    const dayDates = SkillGraph.datesForPeriod("Day");
    expect(dayDates).toHaveLength(24);
    expect(dayDates[0].getMinutes()).toBe(0);
    expect(dayDates[0].getSeconds()).toBe(0);
    expect(dayDates[0].getMilliseconds()).toBe(0);
    expect(dayDates[dayDates.length - 1].getHours()).toBe(new Date().getHours());

    const weekDates = SkillGraph.datesForPeriod("Week");
    expect(weekDates).toHaveLength(7);
    expect(weekDates[0].getHours()).toBe(0);
    expect(weekDates[weekDates.length - 1].getHours()).toBe(0);

    const monthDates = SkillGraph.datesForPeriod("Month");
    expect(monthDates).toHaveLength(30);
    expect(monthDates[0].getHours()).toBe(0);
    expect(monthDates[monthDates.length - 1].getHours()).toBe(0);

    const yearDates = SkillGraph.datesForPeriod("Year");
    expect(yearDates).toHaveLength(12);
    for (const date of yearDates) {
      expect(date.getDate()).toBe(1);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
    }
  });

  it("truncates dates, formats labels, and chooses tick limits by period", () => {
    const graph = new SkillGraph();
    const source = new Date("2026-03-28T15:45:30.123Z");

    const day = SkillGraph.truncatedDateForPeriod(source, "Day");
    expect(day.getHours()).toBe(source.getHours());
    expect(day.getMinutes()).toBe(0);
    expect(day.getSeconds()).toBe(0);
    expect(day.getMilliseconds()).toBe(0);

    const week = SkillGraph.truncatedDateForPeriod(source, "Week");
    expect(week.getHours()).toBe(0);
    expect(week.getMinutes()).toBe(0);

    const year = SkillGraph.truncatedDateForPeriod(source, "Year");
    expect(year.getHours()).toBe(0);
    expect(year.getDate()).toBe(1);

    const dates = [
      new Date("2026-03-28T01:00:00.000Z"),
      new Date("2026-03-28T02:00:00.000Z"),
      new Date("2026-03-28T03:00:00.000Z"),
    ];

    expect(graph.labelsForPeriod("Day", dates)).toEqual(
      dates.map((date) => date.toLocaleTimeString([], { hour: "numeric" }))
    );
    expect(graph.labelsForPeriod("Week", dates)).toEqual(
      dates.map((date) => date.toLocaleDateString([], { timeZone: "UTC", day: "numeric", month: "short" }))
    );
    expect(graph.labelsForPeriod("Month", dates)).toEqual(
      dates.map((date) => date.toLocaleDateString([], { timeZone: "UTC", day: "numeric", month: "short" }))
    );
    expect(graph.labelsForPeriod("Year", dates)).toEqual(
      dates.map((date) => date.toLocaleDateString([], { timeZone: "UTC", year: "numeric", month: "short" }))
    );

    const invalidPeriod = "Quarter" as unknown as Parameters<SkillGraph["labelsForPeriod"]>[0];
    expect(graph.labelsForPeriod(invalidPeriod, dates)).toEqual([]);

    expect(graph.maxTickCountForPeriod("Day")).toBe(8);
    expect(graph.maxTickCountForPeriod("Week")).toBe(7);
    expect(graph.maxTickCountForPeriod("Month")).toBe(10);
    expect(graph.maxTickCountForPeriod("Year")).toBe(12);
    expect(graph.maxTickCountForPeriod(invalidPeriod)).toBe(8);
  });

  it("normalizes NaN xp gain when building table cell data", () => {
    const graph = new SkillGraph();

    expect(
      graph.tableDataForDataSet(
        makeDataSet("alice", "#abc123", [10, Number.NaN], [0, Number.NaN], [100, 100])
      )
    ).toEqual({
      xpGain: 0,
      color: "#abc123",
    });
  });

  it("returns early from create when the element is not connected", () => {
    const graph = new SkillGraph();
    const createChart = vi.spyOn(graph, "createChart");
    const createTable = vi.spyOn(graph, "createTable");

    graph.create(makeGroupData([["alice", "#ff0000", { Attack: 100, Overall: 100 }]]));

    expect(graph.currentGroupData).toBeUndefined();
    expect(createChart).not.toHaveBeenCalled();
    expect(createTable).not.toHaveBeenCalled();
  });

  it("subscribes once on connect, reads attributes, and destroys the chart on disconnect", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);

    const graph = new SkillGraph();
    vi.spyOn(graph, "html").mockReturnValue('<div class="skill-graph__table-container"></div><canvas></canvas>');
    const create = vi.spyOn(graph, "create").mockImplementation(() => undefined);

    graph.setAttribute("data-period", "Week");
    graph.setAttribute("skill-name", SkillName.Attack);
    document.body.appendChild(graph);

    expect(graph.period).toBe("Week");
    expect(graph.skillName).toBe(SkillName.Attack);
    expect(graph.tableContainer).toBeTruthy();
    expect(graph.ctx).toBeTruthy();

    const firstGroupData = makeGroupData([["alice", "#ff0000", { Attack: 100, Overall: 100 }]]);
    const secondGroupData = makeGroupData([["bob", "#00ff00", { Attack: 200, Overall: 200 }]]);

    pubsub.publish("get-group-data", firstGroupData);
    pubsub.publish("get-group-data", secondGroupData);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(firstGroupData);

    const destroy = vi.fn();
    graph.chart = { destroy };
    graph.remove();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("builds complete time series and cumulative deltas from sparse history", () => {
    const graph = new SkillGraph();
    graph.period = "Day";
    graph.dates = [
      new Date("2026-03-28T00:00:00.000Z"),
      new Date("2026-03-28T01:00:00.000Z"),
      new Date("2026-03-28T02:00:00.000Z"),
      new Date("2026-03-28T03:00:00.000Z"),
      new Date("2026-03-28T04:00:00.000Z"),
    ];
    graph.currentGroupData = makeGroupData([["alice", "#ff0000", { Attack: 185, Overall: 185 }]]);

    const history = [
      {
        time: new Date("2026-03-27T23:45:00.000Z"),
        data: { Attack: 90, Overall: 90 },
      },
      {
        time: new Date("2026-03-28T01:15:00.000Z"),
        data: { Attack: 100, Overall: 100 },
      },
      {
        time: new Date("2026-03-28T03:35:00.000Z"),
        data: { Attack: 160, Overall: 160 },
      },
    ];

    const currentSkills = Skill.parseSkillData({ Attack: 185, Overall: 185 });
    expect(graph.generateCompleteTimeSeries(history, currentSkills, SkillName.Attack)).toEqual([90, 100, 100, 160, 185]);

    expect(graph.dataForPlayer({ name: "alice", skill_data: history }, graph.dates, SkillName.Attack)).toEqual([
      [90, 100, 100, 160, 185],
      [0, 10, 0, 60, 25],
      [0, 10, 10, 70, 95],
    ]);

    expect(graph.dataForPlayer({ name: "missing", skill_data: history }, graph.dates, SkillName.Attack)).toEqual([
      [],
      [],
      [],
    ]);
  });

  it("renders skill-specific and overall summary tables from lightweight datasets", () => {
    const attackGraph = new SkillGraph();
    attackGraph.skillName = SkillName.Attack;
    attackGraph.tableContainer = document.createElement("div");

    attackGraph.createTable([
      makeDataSet("alice", "#ff0000", [0, 150], [0, 150], [1000, 1150]),
      makeDataSet("bob", "#00ff00", [0, 25], [0, 25], [800, 825]),
    ]);

    expect(attackGraph.tableContainer.innerHTML).toContain("<table>");
    expect(attackGraph.tableContainer.innerHTML).toContain("alice");
    expect(attackGraph.tableContainer.innerHTML).toContain("+150");

    const overallGraph = new SkillGraph();
    overallGraph.skillName = SkillName.Overall;
    overallGraph.tableContainer = document.createElement("div");

    vi.spyOn(overallGraph, "dataSets").mockImplementation((skillName: string) => {
      if (skillName === SkillName.Attack) {
        return [
          makeDataSet("alice", "#ff0000", [0, 200], [0, 200], [1000, 1200]),
          makeDataSet("bob", "#00ff00", [0, 0], [0, 0], [900, 900]),
        ];
      }
      if (skillName === SkillName.Strength) {
        return [
          makeDataSet("alice", "#ff0000", [0, 100], [0, 100], [800, 900]),
          makeDataSet("bob", "#00ff00", [0, 50], [0, 50], [700, 750]),
        ];
      }
      return [];
    });

    overallGraph.createTable([
      makeDataSet("alice", "#ff0000", [0, 300], [0, 300], [1800, 2100]),
      makeDataSet("bob", "#00ff00", [0, 50], [0, 50], [1600, 1650]),
    ]);

    expect(overallGraph.tableContainer.innerHTML).toContain("skill-graph__overall-groups");
    expect(overallGraph.tableContainer.innerHTML).toContain("skill-graph__overall-summary");
    expect(overallGraph.tableContainer.innerHTML).toContain("Attack +200");
    expect(overallGraph.tableContainer.innerHTML).toContain("Strength +100");
  });

  it("creates chart configs with the mocked Chart constructor and replaces previous charts", () => {
    const { constructorMock, instances } = installChartMock();

    const graph = new SkillGraph();
    graph.period = "Month";
    graph.skillName = SkillName.Attack;
    graph.ctx = {} as CanvasRenderingContext2D;
    graph.dates = [
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-03-02T00:00:00.000Z"),
      new Date("2026-03-03T00:00:00.000Z"),
    ];

    const previousDestroy = vi.fn();
    graph.chart = { destroy: previousDestroy };

    const dataSets = [
      makeDataSet("alice", "#ff0000", [0, 50, 75], [0, 50, 25], [100, 150, 175]),
      makeDataSet("bob", "#00ff00", [5, 10, 20], [0, 5, 10], [200, 205, 215]),
    ];

    graph.createChart(dataSets);

    expect(previousDestroy).toHaveBeenCalledTimes(1);
    expect(constructorMock).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);

    const chartConfig = instances[0].config;
    expect(chartConfig.type).toBe("line");
    expect(chartConfig.options.plugins.title.text).toBe("Attack - Month");
    expect(chartConfig.options.scales.x.ticks.maxTicksLimit).toBe(10);
    expect(chartConfig.options.scales.y.min).toBe(0);
    expect(chartConfig.options.scales.y.max).toBe(76);
    expect(chartConfig.data.labels).toEqual(graph.labelsForPeriod("Month", graph.dates));

    const tooltipLabel = chartConfig.options.plugins.tooltip.callbacks.label({
      dataset: dataSets[0],
      dataIndex: 2,
    });
    expect(tooltipLabel).toBe("alice: 175 (+25)");
  });
});