import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Skill, SkillName } from "../data/skill";
import { SkillGraph } from "../skill-graph/skill-graph";

type ChartMockInstance = {
  ctx: unknown;
  config: unknown;
  destroy: ReturnType<typeof vi.fn>;
};

function installChartMock(): {
  constructorMock: ReturnType<typeof vi.fn>;
  instances: ChartMockInstance[];
} {
  const instances: ChartMockInstance[] = [];

  const constructorMock = vi.fn(function (this: { destroy: ReturnType<typeof vi.fn> }, ctx: unknown, config: unknown) {
    this.destroy = vi.fn();
    instances.push({ ctx, config, destroy: this.destroy });
  });

  (constructorMock as typeof constructorMock & { defaults: unknown }).defaults = {
    scale: {
      grid: {
        borderColor: "",
        color: "",
      },
    },
    color: "",
  };

  (globalThis as typeof globalThis & { Chart?: unknown }).Chart = constructorMock;
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

describe("SkillGraph extra coverage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { Chart?: unknown }).Chart;
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("covers the default template html and the connected create path", () => {
    const graph = new SkillGraph();
    expect(graph.html()).toBe("{{skill-graph.html}}");

    document.body.appendChild(graph);
    graph.period = "Week";
    graph.skillName = SkillName.Attack;

    const dates = [new Date("2026-03-22T00:00:00.000Z"), new Date("2026-03-28T00:00:00.000Z")];
    const dataSets = [makeDataSet("alice", "#ff0000", [0, 25], [0, 25], [100, 125])];
    const groupData = makeGroupData([["alice", "#ff0000", { Attack: 125, Overall: 125 }]]);

    vi.spyOn(SkillGraph, "datesForPeriod").mockReturnValue(dates);
    const dataSetsSpy = vi.spyOn(graph, "dataSets").mockReturnValue(dataSets);
    const createChartSpy = vi.spyOn(graph, "createChart").mockImplementation(() => undefined);
    const createTableSpy = vi.spyOn(graph, "createTable").mockImplementation(() => undefined);

    graph.create(groupData);

    expect(dataSetsSpy).toHaveBeenCalledWith(SkillName.Attack);
    expect(graph.currentGroupData).toBe(groupData);
    expect(graph.dates).toEqual(dates);
    expect(createChartSpy).toHaveBeenCalledWith(dataSets);
    expect(createTableSpy).toHaveBeenCalledWith(dataSets);
  });

  it("renders only valid overall rows and shows the no-gains summary fallback", () => {
    const graph = new SkillGraph();
    graph.skillName = SkillName.Overall;
    graph.tableContainer = document.createElement("div");

    vi.spyOn(graph, "dataSets").mockImplementation((skillName: string) => {
      if (skillName === SkillName.Attack) {
        return [makeDataSet("ghost", "#00ff00", [0, 75], [0, 75], [500, 575])];
      }

      return [];
    });

    graph.createTable([makeDataSet("alice", "#ff0000", [0, 5], [0, 5], [100, 105])]);

    expect(graph.tableContainer.innerHTML).toContain("alice");
    expect(graph.tableContainer.innerHTML).toContain("No skill gains recorded");
    expect(graph.tableContainer.innerHTML).not.toContain("ghost");
  });

  it("does not destroy or create charts when no canvas context is available", () => {
    const { constructorMock } = installChartMock();

    const graph = new SkillGraph();
    const previousDestroy = vi.fn();
    graph.chart = { destroy: previousDestroy };

    graph.createChart([makeDataSet("alice", "#ff0000", [0, 25], [0, 25], [100, 125])]);

    expect(previousDestroy).not.toHaveBeenCalled();
    expect(constructorMock).not.toHaveBeenCalled();
  });

  it("treats undefined time-series gaps as zero change when computing player deltas", () => {
    const graph = new SkillGraph();
    graph.currentGroupData = makeGroupData([["alice", "#ff0000", { Attack: 130, Overall: 130 }]]);

    vi.spyOn(graph, "generateCompleteTimeSeries").mockReturnValue([100, undefined, 130] as unknown as number[]);

    expect(graph.dataForPlayer({ name: "alice", skill_data: [] }, [], SkillName.Attack)).toEqual([
      [100, undefined, 130],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
});