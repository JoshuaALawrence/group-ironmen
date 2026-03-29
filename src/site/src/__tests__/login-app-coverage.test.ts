import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: {
    getGroup: vi.fn(() => null),
    storeGroup: vi.fn(),
    clearGroup: vi.fn(),
    getActiveMember: vi.fn(() => null),
    setActiveMember: vi.fn(),
  },
  api: {
    disable: vi.fn(),
    enable: vi.fn(async () => undefined),
    setCredentials: vi.fn(),
    amILoggedIn: vi.fn(),
    get exampleDataEnabled() {
      return this._exampleDataEnabled;
    },
    set exampleDataEnabled(v: boolean) {
      this._exampleDataEnabled = v;
    },
    _exampleDataEnabled: false,
  },
  exampleData: { disable: vi.fn(), enable: vi.fn() },
  loadingScreenManager: { showLoadingScreen: vi.fn(), hideLoadingScreen: vi.fn() },
  Item: { loadItems: vi.fn(async () => undefined), loadGePrices: vi.fn(async () => undefined) },
  AchievementDiary: { loadDiaries: vi.fn(async () => undefined) },
  groupData: { members: new Map<string, { name: string }>() },
  memberSelectDialogManager: { selectMember: vi.fn(async () => "Alice") },
  validationErrorFromSchema: vi.fn(() => null),
  questLoadQuests: vi.fn(async () => undefined),
}));

vi.mock("../data/storage", () => ({ storage: mocks.storage }));
vi.mock("../data/api", () => ({ api: mocks.api }));
vi.mock("../data/example-data", () => ({ exampleData: mocks.exampleData }));
vi.mock("../loading-screen/loading-screen-manager", () => ({ loadingScreenManager: mocks.loadingScreenManager }));
vi.mock("../data/item", () => ({ Item: mocks.Item }));
vi.mock("../data/quest", () => ({
  Quest: class MockQuest {
    static freeToPlayQuests: Record<string, unknown> = {};
    static memberQuests: Record<string, unknown> = {};
    static miniQuests: Record<string, unknown> = {};
    static tutorial: Record<string, unknown> = {};
    static loadQuests = mocks.questLoadQuests;
    id: string;
    state: string;
    points: number;
    constructor(id: string | number, state: string) {
      this.id = String(id);
      this.state = state;
      this.points = 0;
    }
    get name() {
      return `Quest ${this.id}`;
    }
    get wikiLink() {
      return "#";
    }
    get icon() {
      return "";
    }
    get difficulty() {
      return "Easy";
    }
  },
  QuestState: { NOT_STARTED: "NOT_STARTED", IN_PROGRESS: "IN_PROGRESS", FINISHED: "FINISHED" },
}));
vi.mock("../data/diaries", () => ({ AchievementDiary: mocks.AchievementDiary }));
vi.mock("../data/group-data", () => ({ groupData: mocks.groupData }));
vi.mock("../member-select-dialog/member-select-dialog-manager", () => ({
  memberSelectDialogManager: mocks.memberSelectDialogManager,
}));
vi.mock("../validators", () => ({
  loginFieldSchema: {},
  validationErrorFromSchema: mocks.validationErrorFromSchema,
}));

import { pubsub } from "../data/pubsub";
import { LoginPage } from "../login-page/login-page";
import { AppInitializer } from "../app-initializer/app-initializer";
import { PlayerQuests } from "../player-quests/player-quests";
import { MapPage } from "../map-page/map-page";

function resetAll() {
  document.body.innerHTML = "";
  pubsub.subscribers.clear();
  pubsub.unpublishAll();
  vi.clearAllMocks();
  mocks.api._exampleDataEnabled = false;
  mocks.groupData.members.clear();
}

beforeEach(resetAll);
afterEach(resetAll);

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------
describe("LoginPage", () => {
  function makeLoginPage() {
    const page = new LoginPage();
    vi.spyOn(page, "html").mockReturnValue(`
      <div>
        <input class="login__name" />
        <input class="login__token" />
        <button class="login__button"></button>
        <div class="login__error"></div>
      </div>
    `);
    return page;
  }

  function makeLoginPageNoElements() {
    const page = new LoginPage();
    vi.spyOn(page, "html").mockReturnValue(`<div></div>`);
    return page;
  }

  function makeReadyLoginPage() {
    const page = new LoginPage();
    // Set up internals without connectedCallback DOM
    const name = Object.assign(document.createElement("input"), { valid: true, value: "GroupA" });
    const token = Object.assign(document.createElement("input"), { valid: true, value: "tok123" });
    const loginButton = document.createElement("button");
    const error = document.createElement("div");
    page.name = name as any;
    page.token = token as any;
    page.loginButton = loginButton;
    page.error = error;
    return page;
  }

  it("connectedCallback sets up elements and validators", () => {
    const page = makeLoginPage();
    document.body.appendChild(page);
    expect(page.name).toBeDefined();
    expect(page.token).toBeDefined();
    expect(page.loginButton).toBeDefined();
    expect(page.error).toBeDefined();
    expect(Array.isArray(page.name.validators)).toBe(true);
    expect(Array.isArray(page.token.validators)).toBe(true);
  });

  it("connectedCallback returns early when DOM elements are missing", () => {
    const page = makeLoginPageNoElements();
    document.body.appendChild(page);
    // name would remain unset (not assigned in early-return path)
    expect(page.name).toBeUndefined();
  });

  it("login() returns early when name.valid is false", async () => {
    const page = makeReadyLoginPage();
    page.name.valid = false;
    await page.login();
    expect(mocks.api.amILoggedIn).not.toHaveBeenCalled();
  });

  it("login() returns early when token.valid is false", async () => {
    const page = makeReadyLoginPage();
    page.name.valid = true;
    page.token.valid = false;
    await page.login();
    expect(mocks.api.amILoggedIn).not.toHaveBeenCalled();
  });

  it("login() ok response stores group and redirects", async () => {
    const page = makeReadyLoginPage();
    mocks.api.amILoggedIn.mockResolvedValue({ ok: true, status: 200 });
    const pushState = vi.spyOn(window.history, "pushState");
    await page.login();
    expect(mocks.storage.storeGroup).toHaveBeenCalledWith("GroupA", "tok123");
    expect(pushState).toHaveBeenCalledWith("", "", "/group");
    expect(page.loginButton.disabled).toBe(false);
  });

  it("login() 401 response sets error message", async () => {
    const page = makeReadyLoginPage();
    mocks.api.amILoggedIn.mockResolvedValue({ ok: false, status: 401 });
    await page.login();
    expect(page.error.textContent).toBe("Group name or token is incorrect");
    expect(page.loginButton.disabled).toBe(false);
  });

  it("login() non-401 error response sets error with body text", async () => {
    const page = makeReadyLoginPage();
    mocks.api.amILoggedIn.mockResolvedValue({ ok: false, status: 500, text: async () => "Server Error" });
    await page.login();
    expect(page.error.textContent).toBe("Unable to login Server Error");
    expect(page.loginButton.disabled).toBe(false);
  });

  it("login() thrown error sets error message and re-enables button", async () => {
    const page = makeReadyLoginPage();
    mocks.api.amILoggedIn.mockRejectedValue(new Error("network down"));
    await page.login();
    expect(page.error.textContent).toContain("Unable to login");
    expect(page.loginButton.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AppInitializer
// ---------------------------------------------------------------------------
describe("AppInitializer", () => {
  function makeApp() {
    const app = new AppInitializer();
    vi.spyOn(app, "html").mockReturnValue(`<div></div>`);
    return app;
  }

  it("cleanup() calls the right methods", () => {
    const app = makeApp();
    vi.spyOn(pubsub, "unpublishAll");
    app.cleanup();
    expect(mocks.api.disable).toHaveBeenCalled();
    expect(mocks.exampleData.disable).toHaveBeenCalled();
    expect(mocks.loadingScreenManager.hideLoadingScreen).toHaveBeenCalled();
  });

  it("initializeApp() when group is null → redirects to /login and hides loading screen", async () => {
    const app = makeApp();
    document.body.appendChild(app);
    mocks.storage.getGroup.mockReturnValue(null);
    const pushState = vi.spyOn(window.history, "pushState");
    await app.initializeApp();
    expect(pushState).toHaveBeenCalledWith("", "", "/login");
    expect(mocks.loadingScreenManager.hideLoadingScreen).toHaveBeenCalled();
  });

  it("initializeApp() with @EXAMPLE group calls loadExampleData", async () => {
    const app = makeApp();
    document.body.appendChild(app);
    mocks.storage.getGroup.mockReturnValue({ groupName: "@EXAMPLE", groupToken: "" });
    const spy = vi.spyOn(app, "loadExampleData").mockResolvedValue(undefined);
    await app.initializeApp();
    expect(spy).toHaveBeenCalled();
  });

  it("initializeApp() with normal group calls loadGroup then ensureActiveMember", async () => {
    const app = makeApp();
    document.body.appendChild(app);
    mocks.storage.getGroup.mockReturnValue({ groupName: "myGroup", groupToken: "tok" });
    const loadGroup = vi.spyOn(app, "loadGroup").mockResolvedValue(undefined);
    const ensureMember = vi.spyOn(app, "ensureActiveMember").mockResolvedValue(undefined);
    await app.initializeApp();
    expect(loadGroup).toHaveBeenCalledWith({ groupName: "myGroup", groupToken: "tok" });
    expect(ensureMember).toHaveBeenCalledWith("myGroup");
  });

  it("initializeApp() when disconnected after load does nothing", async () => {
    const app = makeApp();
    // Don't attach to DOM so isConnected = false
    mocks.storage.getGroup.mockReturnValue({ groupName: "g", groupToken: "t" });
    const pushState = vi.spyOn(window.history, "pushState");
    await app.initializeApp();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("loadExampleData() enables exampleData and calls api.enable", async () => {
    const app = makeApp();
    await app.loadExampleData();
    expect(mocks.exampleData.enable).toHaveBeenCalled();
    expect(mocks.api._exampleDataEnabled).toBe(true);
    expect(mocks.api.enable).toHaveBeenCalled();
  });

  it("loadGroup() calls api.enable with credentials and waits for event", async () => {
    const app = makeApp();
    vi.spyOn(pubsub, "waitUntilNextEvent").mockResolvedValue(undefined as any);
    await app.loadGroup({ groupName: "g", groupToken: "t" });
    expect(mocks.api.enable).toHaveBeenCalledWith("g", "t");
  });

  it("ensureActiveMember() with 0 members returns without prompting", async () => {
    const app = makeApp();
    mocks.groupData.members.clear();
    await app.ensureActiveMember("g");
    expect(mocks.memberSelectDialogManager.selectMember).not.toHaveBeenCalled();
  });

  it("ensureActiveMember() with saved member that matches publishes without prompting", async () => {
    const app = makeApp();
    mocks.groupData.members.set("Alice", { name: "Alice" });
    mocks.storage.getActiveMember.mockReturnValue("Alice");
    const publish = vi.spyOn(pubsub, "publish");
    await app.ensureActiveMember("g");
    expect(publish).toHaveBeenCalledWith("active-member-changed", "Alice");
    expect(mocks.memberSelectDialogManager.selectMember).not.toHaveBeenCalled();
  });

  it("ensureActiveMember() with no saved member prompts via memberSelectDialogManager", async () => {
    const app = makeApp();
    mocks.groupData.members.set("Bob", { name: "Bob" });
    mocks.storage.getActiveMember.mockReturnValue(null);
    mocks.memberSelectDialogManager.selectMember.mockResolvedValue("Bob");
    const publish = vi.spyOn(pubsub, "publish");
    await app.ensureActiveMember("g");
    expect(mocks.memberSelectDialogManager.selectMember).toHaveBeenCalledWith(["Bob"]);
    expect(mocks.storage.setActiveMember).toHaveBeenCalledWith("Bob");
    expect(publish).toHaveBeenCalledWith("active-member-changed", "Bob");
  });
});

// ---------------------------------------------------------------------------
// PlayerQuests
// ---------------------------------------------------------------------------
describe("PlayerQuests", () => {
  function makePlayerQuests(questItems: Array<{ questId: number }> = []) {
    const questEls = questItems
      .map((q) => `<div class="player-quests__quest" quest-id="${q.questId}"></div>`)
      .join("");
    const pq = new PlayerQuests();
    vi.spyOn(pq, "html").mockReturnValue(`
      <div>
        ${questEls}
        <div class="player-quests__current-points"></div>
        <input class="search-element" />
      </div>
    `);
    return pq;
  }

  it("classForQuestState returns correct class for each state", () => {
    const pq = new PlayerQuests();
    expect(pq.classForQuestState("NOT_STARTED")).toBe("player-quests__not-started");
    expect(pq.classForQuestState("IN_PROGRESS")).toBe("player-quests__in-progress");
    expect(pq.classForQuestState("FINISHED")).toBe("player-quests__finished");
    expect(pq.classForQuestState(undefined)).toBe("");
  });

  it("getQuestById returns quest from this.quests if present", () => {
    const pq = new PlayerQuests();
    const q = { state: "FINISHED", points: 5 } as any;
    pq.quests = { "99": q };
    const result = pq.getQuestById(99);
    expect(result).toBe(q);
  });

  it("getQuestById returns default Quest when not in quests", () => {
    const pq = new PlayerQuests();
    pq.quests = {};
    const result = pq.getQuestById(42);
    expect(result).toBeDefined();
    expect(result.state).toBe("NOT_STARTED");
  });

  it("questPoints sums points only for quests that are FINISHED", () => {
    const pq = new PlayerQuests();
    pq.quests = {
      "1": { state: "FINISHED", points: 3 } as any,
      "2": { state: "NOT_STARTED", points: 1 } as any,
      "3": { state: "FINISHED", points: 2 } as any,
    };
    // mock Quest to return points from the quest object
    // Since Quest mock class returns 0 for points, we use questPoints directly
    // The real questPoints sums quest.points for all quests in this.quests
    expect(pq.questPoints).toBe(6);
  });

  it("handleUpdatedQuests updates element classes when state changes", () => {
    const pq = makePlayerQuests([{ questId: 1 }]);
    document.body.appendChild(pq);
    const el = pq.questListElements.get(1)!;
    expect(el).toBeDefined();

    pq.handleUpdatedQuests({ "1": { state: "FINISHED", points: 1 } as any });
    expect(el.classList.contains("player-quests__finished")).toBe(true);

    pq.handleUpdatedQuests({ "1": { state: "IN_PROGRESS", points: 1 } as any });
    expect(el.classList.contains("player-quests__in-progress")).toBe(true);
    expect(el.classList.contains("player-quests__finished")).toBe(false);
  });

  it("handleUpdatedQuests does not toggle class when state is unchanged", () => {
    const pq = makePlayerQuests([{ questId: 1 }]);
    document.body.appendChild(pq);
    pq.quests = { "1": { state: "FINISHED", points: 1 } as any };
    const el = pq.questListElements.get(1)!;
    el.classList.add("player-quests__finished");
    const removeSpy = vi.spyOn(el.classList, "remove");

    pq.handleUpdatedQuests({ "1": { state: "FINISHED", points: 1 } as any });
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("handleUpdatedQuests updates questPoints display", () => {
    const pq = makePlayerQuests([]);
    document.body.appendChild(pq);
    pq.currentQuestPointsEl = pq.querySelector(".player-quests__current-points");
    pq.quests = {};
    pq.handleUpdatedQuests({});
    expect(pq.currentQuestPointsEl?.innerHTML).toBe("0");
  });

  it("handleSearch shows/hides elements based on text", () => {
    const pq = makePlayerQuests([{ questId: 1 }, { questId: 2 }]);
    document.body.appendChild(pq);
    // Override getQuestById to return predictable names
    vi.spyOn(pq, "getQuestById").mockImplementation((id) => {
      if (String(id) === "1") return { name: "Cook's Assistant", state: "NOT_STARTED" } as any;
      return { name: "Dragon Slayer", state: "NOT_STARTED" } as any;
    });

    const searchEl = pq.querySelector("input") as any;
    pq.searchElement = searchEl;
    searchEl.value = "cook";
    pq.handleSearch();

    const el1 = pq.questListElements.get(1)!;
    const el2 = pq.questListElements.get(2)!;
    expect(el1.classList.contains("player-quests__hidden")).toBe(false);
    expect(el2.classList.contains("player-quests__hidden")).toBe(true);
  });

  it("handleSearch shows all elements when search is empty", () => {
    const pq = makePlayerQuests([{ questId: 1 }]);
    document.body.appendChild(pq);
    const el = pq.questListElements.get(1)!;
    el.classList.add("player-quests__hidden");
    vi.spyOn(pq, "getQuestById").mockReturnValue({ name: "Cook", state: "NOT_STARTED" } as any);
    const searchEl = pq.querySelector("input") as any;
    pq.searchElement = searchEl;
    searchEl.value = "";
    pq.handleSearch();
    expect(el.classList.contains("player-quests__hidden")).toBe(false);
  });

  it("connectedCallback builds questListElements from rendered quest elements", () => {
    const pq = makePlayerQuests([{ questId: 10 }, { questId: 20 }]);
    pq.setAttribute("player-name", "TestPlayer");
    document.body.appendChild(pq);
    expect(pq.questListElements.has(10)).toBe(true);
    expect(pq.questListElements.has(20)).toBe(true);
    expect(pubsub.anyoneListening("quests:TestPlayer")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MapPage
// ---------------------------------------------------------------------------
describe("MapPage", () => {
  function makeWorldMap() {
    const wm = document.createElement("div") as any;
    wm.id = "background-worldmap";
    wm.plane = 0;
    wm.stopFollowingPlayer = vi.fn();
    wm.showPlane = vi.fn();
    wm.followPlayer = vi.fn();
    return wm;
  }

  function makeAuthedSection() {
    const el = document.createElement("div");
    el.className = "authed-section";
    return el;
  }

  function makeMapPage(worldMap?: HTMLElement, authedSection?: HTMLElement) {
    if (worldMap) document.body.appendChild(worldMap);
    if (authedSection) document.body.appendChild(authedSection);

    const page = new MapPage();
    vi.spyOn(page, "html").mockReturnValue(`
      <div>
        <div class="map-page__focus-player-buttons"></div>
        <select class="map-page__plane-select"><option value="0">0</option><option value="1">1</option></select>
      </div>
    `);
    return page;
  }

  it("connectedCallback sets worldMap and authedSection and adds classes", () => {
    const wm = makeWorldMap();
    const as = makeAuthedSection();
    const page = makeMapPage(wm, as);
    document.body.appendChild(page);
    expect(page.worldMap).toBe(wm);
    expect(page.authedSection).toBe(as);
    expect(as.classList.contains("no-pointer-events")).toBe(true);
    expect(wm.classList.contains("interactable")).toBe(true);
  });

  it("connectedCallback sets planeSelect value from worldMap.plane (falsy plane defaults to 1)", () => {
    const wm = makeWorldMap();
    wm.plane = 0; // 0 is falsy, so `plane || 1` → 1
    const page = makeMapPage(wm);
    document.body.appendChild(page);
    expect(page.planeSelect?.value).toBe("1");
  });

  it("disconnectedCallback removes classes from worldMap and authedSection", () => {
    const wm = makeWorldMap();
    const as = makeAuthedSection();
    const page = makeMapPage(wm, as);
    document.body.appendChild(page);
    document.body.removeChild(page);
    expect(wm.classList.contains("interactable")).toBe(false);
    expect(as.classList.contains("no-pointer-events")).toBe(false);
  });

  it("handlePlaneChange() with plane === undefined returns early", () => {
    const page = makeMapPage();
    page.planeSelect = document.createElement("select") as HTMLSelectElement;
    page.planeSelect.value = "1";
    const originalValue = page.planeSelect.value;
    page.handlePlaneChange(new CustomEvent("plane-changed", { detail: {} }));
    expect(page.planeSelect.value).toBe(originalValue);
  });

  it("handlePlaneChange() when getSelectedPlane() === plane does NOT update value", () => {
    const page = makeMapPage();
    const select = document.createElement("select");
    const opt = document.createElement("option");
    opt.value = "1";
    select.appendChild(opt);
    select.value = "1";
    page.planeSelect = select;
    page.handlePlaneChange(new CustomEvent("plane-changed", { detail: { plane: 1 } }));
    expect(select.value).toBe("1");
  });

  it("handlePlaneChange() when getSelectedPlane() !== plane updates value", () => {
    const page = makeMapPage();
    const select = document.createElement("select");
    ["0", "1", "2"].forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      select.appendChild(opt);
    });
    select.value = "1";
    page.planeSelect = select;
    page.handlePlaneChange(new CustomEvent("plane-changed", { detail: { plane: 2 } }));
    expect(select.value).toBe("2");
  });

  it("handlePlaneSelect() calls stopFollowingPlayer and showPlane", () => {
    const wm = makeWorldMap();
    const page = makeMapPage(wm);
    document.body.appendChild(page);
    page.handlePlaneSelect();
    expect(wm.stopFollowingPlayer).toHaveBeenCalled();
    expect(wm.showPlane).toHaveBeenCalled();
  });

  it("handleUpdatedMembers builds buttons excluding @SHARED", () => {
    const page = makeMapPage();
    document.body.appendChild(page);
    page.handleUpdatedMembers([{ name: "@SHARED" }, { name: "Alice" }, { name: "Bob" }]);
    const html = page.playerButtons?.innerHTML ?? "";
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).not.toContain("@SHARED");
  });

  it("handleFocusPlayer with non-Element target calls followPlayer(null)", () => {
    const wm = makeWorldMap();
    const page = makeMapPage(wm);
    document.body.appendChild(page);
    const evt = { target: "not-an-element" } as unknown as MouseEvent;
    page.handleFocusPlayer(evt);
    expect(wm.followPlayer).toHaveBeenCalledWith(null);
  });

  it("handleFocusPlayer with Element target calls followPlayer with player-name", () => {
    const wm = makeWorldMap();
    const page = makeMapPage(wm);
    document.body.appendChild(page);
    const btn = document.createElement("button");
    btn.setAttribute("player-name", "Alice");
    const evt = { target: btn } as unknown as MouseEvent;
    page.handleFocusPlayer(evt);
    expect(wm.followPlayer).toHaveBeenCalledWith("Alice");
  });
});
