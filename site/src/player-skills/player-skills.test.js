import { describe, expect, it } from "vitest";
import { SkillBox } from "../skill-box/skill-box.js";
import { TotalLevelBox } from "../total-level-box/total-level-box.js";

describe("player skills hydration", () => {
  it("hydrates skill and total levels from the aggregate skills payload", () => {
    const skills = {
      Attack: {
        level: 80,
        xp: 1986068,
        levelProgress: 0.42,
        xpUntilNextLevel: 12345,
      },
      Overall: {
        level: 1880,
        xp: 123456789,
        levelProgress: 0,
        xpUntilNextLevel: 0,
      },
    };

    const skillBox = new SkillBox();
    skillBox.skillName = "Attack";
    skillBox.currentLevel = document.createElement("div");
    skillBox.baseLevel = document.createElement("div");
    skillBox.progressBar = document.createElement("div");
    skillBox.updateTooltip = () => {};
    skillBox.handleUpdatedSkills(skills);

    const totalLevelBox = new TotalLevelBox();
    totalLevelBox.totalLevel = document.createElement("span");
    totalLevelBox.updateTooltip = () => {};
    totalLevelBox.handleUpdatedSkills(skills);

    expect(skillBox.currentLevel.innerHTML).toBe("80");
    expect(skillBox.baseLevel.innerHTML).toBe("80");
    expect(skillBox.progressBar.style.transform).toBe("scaleX(0.42)");
    expect(totalLevelBox.totalLevel.innerHTML).toBe("1880");
  });
});
