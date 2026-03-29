import { beforeEach, describe, expect, it, vi } from "vitest";

const scriptState = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  globSync: vi.fn(),
  createInterface: vi.fn(),
  axiosGet: vi.fn(),
  scenario: "banked" as "banked" | "stash" | "generate" | "clean",
}));

vi.mock("fs", () => ({
  default: scriptState,
  readFileSync: scriptState.readFileSync,
  writeFileSync: scriptState.writeFileSync,
  existsSync: scriptState.existsSync,
  mkdirSync: scriptState.mkdirSync,
  rmSync: scriptState.rmSync,
}));

vi.mock("glob", () => ({
  globSync: scriptState.globSync,
}));

vi.mock("readline", () => ({
  default: {
    createInterface: scriptState.createInterface,
  },
  createInterface: scriptState.createInterface,
}));

vi.mock("axios", () => ({
  default: {
    get: scriptState.axiosGet,
  },
}));

function setScriptData(scenario: typeof scriptState.scenario): void {
  scriptState.scenario = scenario;
}

function setCommonItemData(): void {
  scriptState.readFileSync.mockImplementation((filePath: string) => {
    const path = String(filePath);

    if (scriptState.scenario === "banked") {
      if (path.endsWith("ItemID.java")) {
        return `public static final int BONE = 1;\npublic static final int HERB = 2;\npublic static final int COINS = 995;\n`;
      }
      if (path.endsWith("ExperienceItem.java")) {
        return `public enum ExperienceItem {\n  BONES(ItemID.BONE, Skill.PRAYER, "Bones"),\n  MIXED(Skill.PRAYER, true, ItemID.BONE, ItemID.HERB);\n  private final int itemID;\n`;
      }
      if (path.endsWith("Secondaries.java")) {
        return `public enum Secondaries {\n  BURY(new ByDose(ItemID.BONE, ItemID.HERB)),\n  CLEAN(new Degrime()),\n  CRUSH(new Crushable(ItemID.BONE, ItemID.HERB)),\n  STACK(new ItemStack(ItemID.BONE, 2), new ItemStack(ItemID.HERB, 3));\n  private final int marker;\n`;
      }
      if (path.endsWith("Activity.java")) {
        return `public enum Activity {\n  BURY(ItemID.BONE, "Bury", 1, 12.5, ExperienceItem.BONES, null, null),\n  MIX(ItemID.HERB, "Mix", 5, 25.0, true, ExperienceItem.MIXED, Secondaries.BURY, new ItemStack(ItemID.BONE, 1));\n  private final int icon;\n`;
      }
      if (path.includes("/cache/dumps/") && path.endsWith("item_data.json")) {
        return JSON.stringify({
          1: { name: "Bone" },
          2: { name: "Herb" },
        });
      }
      if (path.includes("/public/data/") && path.endsWith("item_data.json")) {
        return JSON.stringify({
          100: { name: "Bone" },
          200: { name: "Herb" },
          995: { name: "Coins" },
        });
      }
    }

    if (scriptState.scenario === "stash") {
      if (path.endsWith("ItemID.java")) {
        return `public static final int BONE = 1;\npublic static final int HERB = 2;\n`;
      }
      if (path.endsWith("StashUnit.java")) {
        return `public enum StashUnit {\n  UNIT_ONE("First stash", STASHUnit.A, Type.BEGINNER),\n  UNIT_TWO("Second stash", "Alt stash", STASHUnit.B, Type.MEDIUM);\n`;
      }
      if (path.endsWith("EmoteClueItem.java")) {
        return `public enum EmoteClueItem implements ItemRequirement {\n  SWORD("Sword", ItemID.BONE),\n  SHIELD("Shield", 2),\n  ARMOUR("Armour", true, EmoteClueItem.SWORD, EmoteClueItem.SHIELD);\n  private final int itemId;\n`;
      }
      if (path.endsWith("EmoteClue.java")) {
        return `CLUES = ImmutableSet.of(\n  new EmoteClue(Beginner, "Sword clue", "A place", UNIT_ONE, new WorldPoint(0, 0, 0), EmoteClueItem.SWORD, EmoteClueItem.ARMOUR),\n  new EmoteClue(Medium, "No stash", "Elsewhere", null, new WorldPoint(1, 1, 0), EmoteClueItem.SHIELD)\n);\n`;
      }
      if (path.includes("/cache/dumps/") && path.endsWith("item_data.json")) {
        return JSON.stringify({
          1: { name: "Sword" },
          2: { name: "Shield" },
        });
      }
      if (path.includes("/public/data/") && path.endsWith("item_data.json")) {
        return JSON.stringify({
          100: { name: "Sword" },
          200: { name: "Shield" },
        });
      }
    }

    if (scriptState.scenario === "generate") {
      if (path === "components.json") {
        return JSON.stringify([]);
      }
      if (path === "src/index.ts") {
        return "import './existing/existing.ts';\n";
      }
      return "";
    }

    return "";
  });

  scriptState.existsSync.mockImplementation((filePath: string) => {
    const path = String(filePath);
    if (scriptState.scenario === "generate") {
      return !path.includes("/src/test-widget") && !path.endsWith("components.json") && !path.endsWith("src/index.ts");
    }
    return false;
  });

  scriptState.mkdirSync.mockImplementation(() => undefined);
  scriptState.writeFileSync.mockImplementation(() => undefined);
  scriptState.rmSync.mockImplementation(() => undefined);
  scriptState.globSync.mockImplementation(() => []);
  scriptState.createInterface.mockReturnValue({
    question(_prompt: string, callback: (value: string) => void) {
      callback("test-widget");
      return undefined;
    },
    close() {
      return undefined;
    },
  } as never);
  scriptState.axiosGet.mockResolvedValue({
    data: "<html></html>",
  });
}

describe("script generators", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setCommonItemData();
  });

  it("generates banked XP data from the Java sources", async () => {
    setScriptData("banked");

    await import("../../../site/scripts/convert-banked-xp.ts");

    expect(scriptState.writeFileSync).toHaveBeenCalled();
    const [outputPath, output] = scriptState.writeFileSync.mock.calls.at(-1) as [string, string];
    expect(outputPath).toContain("banked-xp-data.ts");
    expect(output).toContain("export const XP_TABLE");
    expect(output).toContain("export function getLevelForXp");
    expect(output).toContain("BONES");
    expect(output).toContain("MIXED");
  });

  it("generates stash data from the clue sources", async () => {
    setScriptData("stash");

    await import("../../../site/scripts/convert-stash-data.ts");

    expect(scriptState.writeFileSync).toHaveBeenCalled();
    const [outputPath, output] = scriptState.writeFileSync.mock.calls.at(-1) as [string, string];
    expect(outputPath).toContain("stash-data.ts");
    expect(output).toContain("export const DIFFICULTIES");
    expect(output).toContain("export const STASHES");
    expect(output).toContain("getStashesByDifficulty");
    expect(output).toContain("First stash");
  });

  it("cleans generated site assets", async () => {
    setScriptData("clean");
    scriptState.globSync.mockReturnValue(["public/app.js", "public/app.js.map", "public/index.html"]);

    await import("../../../site/scripts/clean.ts");

    expect(scriptState.rmSync).toHaveBeenCalledTimes(9);
    expect(scriptState.rmSync).toHaveBeenCalledWith("public/app.js");
    expect(scriptState.rmSync).toHaveBeenCalledWith("public/app.js.map");
    expect(scriptState.rmSync).toHaveBeenCalledWith("public/index.html");
  });

  it("creates a new component scaffold", async () => {
    setScriptData("generate");

    await import("../../../site/scripts/generate-component.ts");

    expect(scriptState.writeFileSync).toHaveBeenCalled();
    expect(scriptState.writeFileSync).toHaveBeenCalledWith(
      "./src/test-widget/test-widget.ts",
      expect.stringContaining("export class TestWidget")
    );
    expect(scriptState.writeFileSync).toHaveBeenCalledWith("./src/test-widget/test-widget.css", "");
    expect(scriptState.writeFileSync).toHaveBeenCalledWith("./src/test-widget/test-widget.html", "");
    expect(scriptState.writeFileSync).toHaveBeenCalledWith("components.json", expect.stringContaining("test-widget"));
    expect(scriptState.writeFileSync).toHaveBeenCalledWith(
      "src/index.ts",
      expect.stringContaining("import \"./test-widget/test-widget.ts\";")
    );
  });
});