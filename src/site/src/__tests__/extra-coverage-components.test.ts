import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedApi = vi.hoisted(() => ({
  getSkillData: vi.fn(),
}));

vi.mock("../data/api", () => ({
  api: mockedApi,
}));

import { pubsub } from "../data/pubsub";
import { TotalLevelBox } from "../total-level-box/total-level-box";
import { SkillBox } from "../skill-box/skill-box";
import { SkillsGraphs } from "../skills-graphs/skills-graphs";

describe("extra coverage - TotalLevelBox, SkillBox, SkillsGraphs", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
    SkillsGraphs.chartJsScriptTag = undefined;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // TotalLevelBox
  // ---------------------------------------------------------------------------
  describe("TotalLevelBox", () => {
    it("subscribes to skills events on connect", () => {
      const box = new TotalLevelBox();
      vi.spyOn(box, "html").mockReturnValue(`<div class="total-level-box__level"></div>`);
      box.setAttribute("player-name", "Alice");
      document.body.appendChild(box);

      expect(pubsub.anyoneListening("skills:Alice")).toBe(true);
    });

    it("handleUpdatedSkills() updates totalLevel from Overall skill", () => {
      const box = new TotalLevelBox();
      vi.spyOn(box, "html").mockReturnValue(`<div class="total-level-box__level"></div>`);
      box.setAttribute("player-name", "Alice");
      document.body.appendChild(box);

      box.handleUpdatedSkills({ Overall: { level: 2277, xp: 200_000_000 } });

      expect(box.totalLevel?.textContent).toBe("2277");
    });

    it("handleUpdatedSkills() does nothing when Overall is missing", () => {
      const box = new TotalLevelBox();
      vi.spyOn(box, "html").mockReturnValue(`<div class="total-level-box__level"></div>`);
      box.setAttribute("player-name", "Alice");
      document.body.appendChild(box);

      box.handleUpdatedSkills({});
      expect(box.totalLevel?.textContent).toBe("");
    });

    it("handleUpdatedSkills() does nothing when skills is nullish", () => {
      const box = new TotalLevelBox();
      vi.spyOn(box, "html").mockReturnValue(`<div class="total-level-box__level"></div>`);
      box.setAttribute("player-name", "Alice");
      document.body.appendChild(box);

      expect(() => box.handleUpdatedSkills(null as never)).not.toThrow();
    });

    it("handleUpdatedTotalXp() updates level text and tooltip", () => {
      const box = new TotalLevelBox();
      vi.spyOn(box, "html").mockReturnValue(`<div class="total-level-box__level"></div>`);
      box.setAttribute("player-name", "Alice");
      document.body.appendChild(box);

      box.handleUpdatedTotalXp({ level: 1500, xp: 50_000_000 });

      expect(box.totalLevel?.textContent).toBe("1500");
      expect(box.tooltipText).toContain("50,000,000");
    });

    it("handleUpdatedTotalXp() does nothing when totalLevel is null", () => {
      const box = new TotalLevelBox();
      vi.spyOn(box, "html").mockReturnValue(`<div></div>`);
      box.setAttribute("player-name", "Alice");
      document.body.appendChild(box);

      expect(() => box.handleUpdatedTotalXp({ level: 1000, xp: 10_000_000 })).not.toThrow();
    });

    it("pubsub update triggers handleUpdatedSkills", () => {
      const box = new TotalLevelBox();
      vi.spyOn(box, "html").mockReturnValue(`<div class="total-level-box__level"></div>`);
      box.setAttribute("player-name", "Alice");
      document.body.appendChild(box);

      pubsub.publish("skills:Alice", { Overall: { level: 2000, xp: 150_000_000 } });

      expect(box.totalLevel?.textContent).toBe("2000");
    });

    it("disconnectedCallback unsubscribes from skills events", () => {
      const box = new TotalLevelBox();
      vi.spyOn(box, "html").mockReturnValue(`<div class="total-level-box__level"></div>`);
      box.setAttribute("player-name", "Alice");
      document.body.appendChild(box);

      expect(pubsub.anyoneListening("skills:Alice")).toBe(true);
      document.body.removeChild(box);
      expect(pubsub.anyoneListening("skills:Alice")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // SkillBox
  // ---------------------------------------------------------------------------
  describe("SkillBox", () => {
    function makeSkillBoxHtml() {
      return `
        <div class="skill-box__current-level"></div>
        <div class="skill-box__baseline-level"></div>
        <div class="skill-box__progress-bar"></div>
      `;
    }

    it("subscribes to skills events on connect", () => {
      const box = new SkillBox();
      vi.spyOn(box, "html").mockReturnValue(makeSkillBoxHtml());
      box.setAttribute("player-name", "Alice");
      box.setAttribute("skill-name", "Attack");
      document.body.appendChild(box);

      expect(pubsub.anyoneListening("skills:Alice")).toBe(true);
    });

    it("handleUpdatedSkills() updates DOM elements for known skill", () => {
      const box = new SkillBox();
      vi.spyOn(box, "html").mockReturnValue(makeSkillBoxHtml());
      box.setAttribute("player-name", "Alice");
      box.setAttribute("skill-name", "Attack");
      document.body.appendChild(box);

      box.handleUpdatedSkills({
        Attack: {
          level: 85,
          xp: 3_258_594,
          levelProgress: 0.72,
          xpUntilNextLevel: 50_000,
        },
      });

      expect(box.currentLevel?.innerHTML).toBe("85");
      expect(box.baseLevel?.innerHTML).toBe("85");
      expect(box.progressBar?.style.transform).toContain("scaleX(0.72)");
    });

    it("handleUpdatedSkills() clamps level display to 99", () => {
      const box = new SkillBox();
      vi.spyOn(box, "html").mockReturnValue(makeSkillBoxHtml());
      box.setAttribute("player-name", "Alice");
      box.setAttribute("skill-name", "Attack");
      document.body.appendChild(box);

      box.handleUpdatedSkills({
        Attack: {
          level: 120,
          xp: 200_000_000,
          levelProgress: 1.0,
          xpUntilNextLevel: 0,
        },
      });

      expect(box.currentLevel?.innerHTML).toBe("99");
      expect(box.baseLevel?.innerHTML).toBe("120");
    });

    it("handleUpdatedSkills() does nothing when skill name is missing from skills", () => {
      const box = new SkillBox();
      vi.spyOn(box, "html").mockReturnValue(makeSkillBoxHtml());
      box.setAttribute("player-name", "Alice");
      box.setAttribute("skill-name", "Attack");
      document.body.appendChild(box);

      const initialText = box.currentLevel?.innerHTML;
      box.handleUpdatedSkills({ Strength: { level: 99, xp: 200_000_000, levelProgress: 1.0, xpUntilNextLevel: 0 } });
      expect(box.currentLevel?.innerHTML).toBe(initialText);
    });

    it("handleUpdatedSkills() does nothing when skillName is null", () => {
      const box = new SkillBox();
      vi.spyOn(box, "html").mockReturnValue(makeSkillBoxHtml());
      box.setAttribute("player-name", "Alice");
      document.body.appendChild(box);
      // skillName not set → null
      expect(() =>
        box.handleUpdatedSkills({ Attack: { level: 99, xp: 200_000_000, levelProgress: 1.0, xpUntilNextLevel: 0 } })
      ).not.toThrow();
    });

    it("handleUpdatedSkill() does nothing when DOM elements are null", () => {
      const box = new SkillBox();
      vi.spyOn(box, "html").mockReturnValue(`<div></div>`);
      box.setAttribute("player-name", "Alice");
      box.setAttribute("skill-name", "Attack");
      document.body.appendChild(box);

      expect(() =>
        box.handleUpdatedSkill({ level: 85, xp: 3_258_594, levelProgress: 0.72, xpUntilNextLevel: 50_000 })
      ).not.toThrow();
    });

    it("pubsub update triggers handleUpdatedSkills", () => {
      const box = new SkillBox();
      vi.spyOn(box, "html").mockReturnValue(makeSkillBoxHtml());
      box.setAttribute("player-name", "Alice");
      box.setAttribute("skill-name", "Strength");
      document.body.appendChild(box);

      pubsub.publish("skills:Alice", {
        Strength: { level: 70, xp: 1_000_000, levelProgress: 0.5, xpUntilNextLevel: 20_000 },
      });

      expect(box.currentLevel?.innerHTML).toBe("70");
    });

    it("disconnectedCallback unsubscribes from skills events", () => {
      const box = new SkillBox();
      vi.spyOn(box, "html").mockReturnValue(makeSkillBoxHtml());
      box.setAttribute("player-name", "Alice");
      box.setAttribute("skill-name", "Attack");
      document.body.appendChild(box);

      expect(pubsub.anyoneListening("skills:Alice")).toBe(true);
      document.body.removeChild(box);
      expect(pubsub.anyoneListening("skills:Alice")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // SkillsGraphs
  // ---------------------------------------------------------------------------
  describe("SkillsGraphs", () => {
    it("html() returns the template placeholder", () => {
      const graphs = new SkillsGraphs();
      expect(graphs.html()).toBe("{{skills-graphs.html}}");
    });

    it("connectedCallback() sets default values and queries DOM elements", () => {
      const graphs = new SkillsGraphs();
      vi.spyOn(graphs, "html").mockReturnValue(`
        <div class="skills-graphs__chart-container"></div>
        <select class="skills-graphs__period-select"></select>
        <div class="skills-graphs__refresh"></div>
        <select class="skills-graphs__skill-select"></select>
      `);
      document.body.appendChild(graphs);

      expect(graphs.period).toBe("Day");
      expect(graphs.chartContainer).not.toBeNull();
      expect(graphs.periodSelect).not.toBeNull();
      expect(graphs.refreshButton).not.toBeNull();
    });

    it("handlePeriodChange() updates period property", () => {
      const graphs = new SkillsGraphs();
      vi.spyOn(graphs, "html").mockReturnValue(`
        <select class="skills-graphs__period-select"><option value="Week">Week</option></select>
        <div class="skills-graphs__chart-container"></div>
        <div class="skills-graphs__refresh"></div>
        <select class="skills-graphs__skill-select"></select>
      `);
      document.body.appendChild(graphs);

      if (graphs.periodSelect) {
        graphs.periodSelect.value = "Week";
      }
      graphs.handlePeriodChange();
      expect(graphs.period).toBe("Week");
    });

    it("handlePeriodChange() defaults to Day when select has no value", () => {
      const graphs = new SkillsGraphs();
      vi.spyOn(graphs, "html").mockReturnValue(`<div class="skills-graphs__chart-container"></div>`);
      document.body.appendChild(graphs);

      graphs.periodSelect = null;
      graphs.handlePeriodChange();
      expect(graphs.period).toBe("Day");
    });

    it("handleSkillSelectChange() updates selectedSkill", () => {
      const graphs = new SkillsGraphs();
      vi.spyOn(graphs, "html").mockReturnValue(`
        <select class="skills-graphs__skill-select"><option value="Attack">Attack</option></select>
        <div class="skills-graphs__chart-container"></div>
        <select class="skills-graphs__period-select"></select>
        <div class="skills-graphs__refresh"></div>
      `);
      document.body.appendChild(graphs);

      if (graphs.skillSelect) {
        graphs.skillSelect.value = "Attack";
      }
      graphs.handleSkillSelectChange();
      expect(graphs.selectedSkill).toBe("Attack");
    });

    it("handleRefreshClicked() re-subscribes to get-group-data without throwing", () => {
      const graphs = new SkillsGraphs();
      vi.spyOn(graphs, "html").mockReturnValue(`<div class="skills-graphs__chart-container"></div>`);
      document.body.appendChild(graphs);

      expect(() => graphs.handleRefreshClicked()).not.toThrow();
    });

    it("createChart() does nothing when chartContainer is null", async () => {
      const graphs = new SkillsGraphs();
      vi.spyOn(graphs, "html").mockReturnValue(`<div></div>`);
      document.body.appendChild(graphs);

      graphs.chartContainer = null;
      await expect(graphs.createChart()).resolves.toBeUndefined();
    });

    it("createChart() populates chart container on successful data fetch", async () => {
      const graphs = new SkillsGraphs();
      vi.spyOn(graphs, "html").mockReturnValue(`<div class="skills-graphs__chart-container"></div>`);
      document.body.appendChild(graphs);

      const mockSkillData = [
        {
          name: "Alice",
          skill_data: [
            { time: "2024-01-01T00:00:00Z", data: new Array(25).fill(0) },
          ],
        },
      ];
      mockedApi.getSkillData.mockResolvedValue(mockSkillData);

      // Stub Chart global with a class so no 'any' type is needed
      vi.stubGlobal("Chart", class {
        static defaults = { scale: { grid: { borderColor: "", color: "" } }, color: "" };
      });

      // Provide chartJsScriptTag so waitForChartjs resolves immediately
      SkillsGraphs.chartJsScriptTag = document.createElement("script");

      await graphs.createChart();

      expect(graphs.chartContainer?.querySelector("skill-graph")).not.toBeNull();
    });

    it("createChart() shows error in chartContainer on API failure", async () => {
      const graphs = new SkillsGraphs();
      vi.spyOn(graphs, "html").mockReturnValue(`<div class="skills-graphs__chart-container"></div>`);
      document.body.appendChild(graphs);

      mockedApi.getSkillData.mockRejectedValue(new Error("API down"));
      SkillsGraphs.chartJsScriptTag = document.createElement("script");
      vi.stubGlobal("Chart", {
        defaults: { scale: { grid: { borderColor: "", color: "" } }, color: "" },
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await graphs.createChart();

      expect(graphs.chartContainer?.textContent).toContain("Failed to load");
      consoleSpy.mockRestore();
    });

    it("waitForChartjs() creates and appends script tag if not already present", async () => {
      SkillsGraphs.chartJsScriptTag = undefined;
      const graphs = new SkillsGraphs();
      document.body.appendChild(graphs);

      vi.stubGlobal("Chart", { defaults: { scale: { grid: {} } } });

      await graphs.waitForChartjs();
      expect(SkillsGraphs.chartJsScriptTag).not.toBeNull();
    });

    it("disconnectedCallback unsubscribes events without errors", () => {
      const graphs = new SkillsGraphs();
      vi.spyOn(graphs, "html").mockReturnValue(`<div></div>`);
      document.body.appendChild(graphs);
      expect(() => document.body.removeChild(graphs)).not.toThrow();
    });
  });
});
