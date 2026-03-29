import { beforeEach, describe, expect, it, vi } from "vitest";

const scriptState = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  promisesReadFile: vi.fn(),
  promisesWriteFile: vi.fn(),
  esbuildBuild: vi.fn(),
  axiosGet: vi.fn(),
  minify: vi.fn(),
  cleanCssMinify: vi.fn(),
}));

vi.mock("fs", () => ({
  default: {
    existsSync: scriptState.existsSync,
    readdirSync: scriptState.readdirSync,
    readFileSync: scriptState.readFileSync,
    writeFileSync: scriptState.writeFileSync,
    promises: {
      readFile: scriptState.promisesReadFile,
      writeFile: scriptState.promisesWriteFile,
    },
  },
  existsSync: scriptState.existsSync,
  readdirSync: scriptState.readdirSync,
  readFileSync: scriptState.readFileSync,
  writeFileSync: scriptState.writeFileSync,
  promises: {
    readFile: scriptState.promisesReadFile,
    writeFile: scriptState.promisesWriteFile,
  },
}));

vi.mock("esbuild", () => ({
  build: scriptState.esbuildBuild,
}));

vi.mock("terser", () => ({
  minify: scriptState.minify,
}));

vi.mock("clean-css", () => ({
  default: vi.fn(function () {
    return {
      minify: scriptState.cleanCssMinify,
    };
  }),
}));

vi.mock("axios", () => ({
  default: {
    get: scriptState.axiosGet,
  },
}));

describe("site scripts build and quest", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    scriptState.existsSync.mockImplementation((p: string) => String(p).includes("src/index.ts"));
    scriptState.readdirSync.mockReturnValue(["0_1_2.webp"]);
    scriptState.readFileSync.mockImplementation((p: string) => {
      const path = String(p);
      if (path === "components.json") return JSON.stringify(["app-initializer"]);
      if (path.includes("map_icons.json")) return JSON.stringify({});
      if (path.includes("map_labels.json")) return JSON.stringify({});
      if (path.endsWith("quest-mapping.json")) return JSON.stringify({ 1: "Tutorial Island", 2: "Cook's Assistant" });
      return "";
    });
    scriptState.promisesReadFile.mockImplementation(async (p: string) => {
      const path = String(p);
      if (path.endsWith("src/index.html")) return "<html><style>{{style}}</style><script>{{js}}</script></html>";
      if (path.endsWith("main.css")) return "body{background:url('/ui/border.png')}";
      if (path.endsWith("app-initializer.css")) return ".x{}";
      if (path.includes("/ui/")) return "ZmFrZQ==";
      if (path.endsWith("public/app.js")) return "console.log('app');";
      if (path.endsWith("app-initializer.html")) return "<div>init</div>";
      if (path.endsWith("app-initializer.ts")) return "export const x = 1;";
      return "";
    });
    scriptState.promisesWriteFile.mockResolvedValue(undefined);
    scriptState.minify.mockResolvedValue({ code: "min", map: "map" });
    scriptState.cleanCssMinify.mockReturnValue({ styles: "body{}" });
    scriptState.esbuildBuild.mockResolvedValue(undefined);
  });

  it("runs site build script and plugins", async () => {
    const argv = process.argv;
    process.argv = ["node", "build.ts", "--prod"];

    await import("../../../site/build.ts");
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(scriptState.esbuildBuild).toHaveBeenCalled();

    const buildArg = scriptState.esbuildBuild.mock.calls[0][0];
    expect(buildArg.entryPoints).toEqual(["src/index.ts"]);
    expect(Array.isArray(buildArg.plugins)).toBe(true);

    process.argv = argv;
  });

  it("runs quest scrapper and writes quest data", async () => {
    scriptState.axiosGet.mockResolvedValue({
      data: `
      <html><body>
        <table><thead><tr><th>Name</th><th>Difficulty</th><th>Length</th><th>Series</th><th>Release date</th><th></th></tr></thead><tbody>
          <tr><td>Tutorial Island</td><td>Novice</td><td>1</td></tr>
        </tbody></table>
        <table><thead><tr><th>Name</th><th>Difficulty</th><th>Length</th><th>Series</th><th>Release date</th><th></th></tr></thead><tbody>
          <tr><td>Cook's Assistant</td><td>Novice</td><td>1</td></tr>
        </tbody></table>
        <table><thead><tr><th>Name</th><th>Difficulty</th><th>Length</th><th>Series</th><th>Release date</th><th></th></tr></thead><tbody>
        </tbody></table>
      </body></html>
      `,
    });

    await import("../../../site/scripts/quest-scrapper.ts");
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(scriptState.writeFileSync).toHaveBeenCalledWith(
      "./public/data/quest_data.json",
      expect.any(String)
    );
  });
});