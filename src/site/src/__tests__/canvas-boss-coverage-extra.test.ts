import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedState = vi.hoisted(() => ({
  collectionLog: {
    initLogInfo: vi.fn(),
    load: vi.fn(),
    completionCountForPage: vi.fn(),
    pageSize: vi.fn(),
    info: [] as unknown[],
  },
  getPlayerBossKc: vi.fn(),
}));

vi.mock("../data/collection-log", () => ({
  collectionLog: mockedState.collectionLog,
}));

vi.mock("../data/wise-old-man", () => ({
  wiseOldMan: {
    getPlayerBossKc: mockedState.getPlayerBossKc,
  },
}));

import {
  BossKcDialog,
  buildBossCollectionLogPageMap,
  resolveSummaryIconSlug,
  resolveSummaryIconSource,
} from "../boss-kc-dialog/boss-kc-dialog";
import { Animation } from "../canvas-map/animation";
import { CanvasMap } from "../canvas-map/canvas-map";

type CtxMock = {
  beginPath: ReturnType<typeof vi.fn>;
  rect: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  strokeText: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  resetTransform: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  imageSmoothingEnabled: boolean;
  fillStyle: string;
  strokeStyle: string;
  font: string;
  textAlign: CanvasTextAlign;
  lineWidth: number;
  globalAlpha: number;
};

function createCtx(): CtxMock {
  return {
    beginPath: vi.fn(),
    rect: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    strokeText: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    resetTransform: vi.fn(),
    setTransform: vi.fn(),
    imageSmoothingEnabled: false,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "left",
    lineWidth: 1,
    globalAlpha: 1,
  };
}

function createMap() {
  const map = new CanvasMap();
  const ctx = createCtx();

  map.canvas = {
    width: 640,
    height: 480,
    offsetTop: 0,
    offsetLeft: 0,
  } as unknown as HTMLCanvasElement;
  map.coordinatesDisplay = { innerText: "" } as HTMLElement;
  map.ctx = ctx as unknown as CanvasRenderingContext2D;
  map.camera = {
    x: new Animation({ current: 0, target: 0, progress: 1, time: 1 }),
    y: new Animation({ current: 0, target: 0, progress: 1, time: 1 }),
    zoom: new Animation({ current: 1, target: 1, progress: 1, time: 1 }),
    maxZoom: 6,
    minZoom: 0.5,
    isDragging: false,
  };
  map.cursor = {
    x: 0,
    y: 0,
    frameX: [],
    frameY: [],
    frameIndex: 0,
    frameCount: 0,
    frameSumX: 0,
    frameSumY: 0,
  };
  map.touch = { pinchDistance: 0, startDistance: 1, startZoom: 1 };
  map.followingPlayer = { name: null };
  map.view = { left: 0, right: 1, top: 1, bottom: 0 };
  map.tiles = [new Map(), new Map(), new Map(), new Map()];
  map.tilesInView = [];
  map.validTiles = [new Set<number>(), new Set<number>(), new Set<number>(), new Set<number>()];
  map.playerMarkers = new Map();
  map.interactingMarkers = new Set();
  map.mapLabelImages = new Map();
  map.locations = {};
  map.mapLabels = {};
  map.plane = 1;
  map.previousFrameTime = 0;
  map.updateRequested = 0;
  map.coordDisplayPending = false;
  map.disposed = false;
  map.update = map._update.bind(map);

  return { map, ctx };
}

describe("boss kc dialog extra coverage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockedState.collectionLog.initLogInfo.mockReset().mockResolvedValue(undefined);
    mockedState.collectionLog.load.mockReset().mockResolvedValue(undefined);
    mockedState.collectionLog.completionCountForPage.mockReset().mockReturnValue(0);
    mockedState.collectionLog.pageSize.mockReset().mockReturnValue(0);
    mockedState.collectionLog.info = [];
    mockedState.getPlayerBossKc.mockReset().mockResolvedValue({
      playerName: "Alice",
      bosses: [],
      summary: [],
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("skips blank collection log aliases and exhausts boss icon fallbacks", () => {
    const dialog = new BossKcDialog();
    const pageMap = buildBossCollectionLogPageMap([
      {
        pages: [
          { name: "", completion_labels: ["   "] },
          { name: "Gauntlet", completion_labels: ["", "Gauntlet completions"] },
          { name: "   " },
        ],
      },
      {},
    ]);

    expect([...pageMap.entries()]).toEqual([["gauntlet", "Gauntlet"]]);
    expect(resolveSummaryIconSlug(undefined)).toBeNull();
    expect(resolveSummaryIconSource({ label: "Unknown", metric: "  " })).toBeNull();
    expect(dialog.createSummaryIcon({ label: "Unknown", metric: "  " } as never)).toBeNull();

    const icon = dialog.createBossIcon("Zulrah");
    expect(icon.getAttribute("src")).toBe("/images/boss-icons/zulrah_icon.png");

    icon.dispatchEvent(new Event("error"));
    expect(icon.getAttribute("src")).toBe("/images/skills/Combat_icon.png");

    icon.dispatchEvent(new Event("error"));
    expect(icon.getAttribute("src")).toBe("/images/skills/Combat_icon.png");
  });

  it("loads boss KC without mounted DOM nodes and still enriches collection log progress", async () => {
    const dialog = new BossKcDialog();
    const renderSortedRowsSpy = vi.spyOn(dialog, "renderSortedRows").mockImplementation(() => undefined);

    vi.spyOn(dialog, "initCollectionLogProgress").mockResolvedValue(new Map([["artio", "Callisto and Artio"]]));
    dialog.collectionLogCompletionCountByPage = new Map([["Callisto and Artio", 3]]);
    dialog.collectionLogPageSizeByPage = new Map([["Callisto and Artio", 7]]);
    mockedState.getPlayerBossKc.mockResolvedValueOnce({
      playerName: "Alice",
      summary: [{ label: "Collections Logged", metric: "collections_logged", displayType: "score", score: 12 }],
      bosses: [{ name: "Artio", metric: "artio", kills: 17, rank: 55 }],
    });

    await dialog.loadBossKc();

    expect(dialog.titleEl).toBeNull();
    expect(dialog.summary).toEqual([
      { label: "Collections Logged", metric: "collections_logged", displayType: "score", score: 12 },
    ]);
    expect(dialog.bosses).toEqual([
      { name: "Artio", metric: "artio", kills: 17, rank: 55, logObtained: 3, logTotal: 7 },
    ]);
    expect(renderSortedRowsSpy).toHaveBeenCalledOnce();
  });
});

describe("canvas map extra coverage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the template and forwards connected subscription callbacks", () => {
    const map = new CanvasMap();
    const ctx = createCtx();
    const coordinatesDisplay = { innerText: "" } as HTMLElement;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(ctx),
    } as unknown as HTMLCanvasElement;
    const querySelector = vi.fn((selector: string) => {
      if (selector === ".canvas-map__coordinates") return coordinatesDisplay;
      if (selector === "canvas") return canvas;
      return null;
    });
    const subscriptions = new Map<string, (value: unknown) => void>();
    const requestAnimationFrameMock = vi.fn().mockReturnValue(91);

    expect(map.html()).toContain("canvas-map.html");

    Object.defineProperty(map, "offsetWidth", { value: 480, configurable: true });
    Object.defineProperty(map, "offsetHeight", { value: 320, configurable: true });
    Object.defineProperty(map, "isConnected", { value: true, configurable: true });
    Object.defineProperty(map, "querySelector", { value: querySelector, configurable: true });
    Object.defineProperty(window, "requestAnimationFrame", { value: requestAnimationFrameMock, configurable: true });

    map.render = vi.fn();
    map.eventListener = vi.fn();
    map.subscribe = vi.fn((topic: string, callback: (value: unknown) => void) => {
      subscriptions.set(topic, callback);
    });
    map.getMapJson = vi.fn().mockResolvedValue(undefined);

    map.connectedCallback();

    const handleMembersSpy = vi.spyOn(map, "handleUpdatedMembers");
    const handleCoordinatesSpy = vi.spyOn(map, "handleUpdatedCoordinates");
    const members = [{ name: "alice", coordinates: { x: 3200, y: 3200, plane: 0 } }];
    const member = { name: "bob", coordinates: { x: 3300, y: 3300, plane: 1 } };

    subscriptions.get("members-updated")?.(members);
    subscriptions.get("coordinates")?.(member);

    expect(handleMembersSpy).toHaveBeenCalledWith(members);
    expect(handleCoordinatesSpy).toHaveBeenCalledWith(member);
  });

  it("resolves deferred label and tile loads through their onload callbacks", () => {
    const { map } = createMap();
    const requestUpdateSpy = vi.spyOn(map, "requestUpdate");

    map.mapLabels = { 0: { 1: { 0: [3200, 3200, 11] } } };
    map.view = { left: 0, right: 1, top: 1, bottom: 0 };
    map.drawMapAreaLabels(true);

    const [labelCanvasX, labelCanvasY] = map.gamePositionToCanvas(3200, 3200);
    const labelKey = map.cantor(labelCanvasX, labelCanvasY);
    const labelImage = map.mapLabelImages.get(labelKey);
    const labelOnload = labelImage?.onload;

    expect(typeof labelOnload).toBe("function");

    requestUpdateSpy.mockClear();
    map.drawMapAreaLabels(false);
    expect(labelImage?.onload).toBe(labelOnload);

    labelOnload?.(new Event("load"));
    expect(labelImage?.loaded).toBe(true);
    expect(requestUpdateSpy).toHaveBeenCalledOnce();

    const tileKey = map.cantor(0, 1);
    map.validTiles[0] = new Set([tileKey]);
    map.view = { left: 0, right: 1, top: 1, bottom: 0 };
    map.drawMapSquaresInView(true);

    const tile = map.tiles[0].get(tileKey);
    const tileOnload = tile?.onload;

    expect(typeof tileOnload).toBe("function");

    requestUpdateSpy.mockClear();
    tileOnload?.(new Event("load"));

    expect(tile?.loaded).toBe(true);
    expect(tile?.animation).toBeInstanceOf(Animation);
    expect(requestUpdateSpy).toHaveBeenCalledOnce();
  });

  it("rolls cursor velocity samples, ignores invalid follow targets, and uses default zoom timing", () => {
    const { map } = createMap();

    map.cursor.frameIndex = 2;
    map.cursor.frameCount = 10;
    map.cursor.frameX = Array.from({ length: 10 }, (_value, index) => index + 1);
    map.cursor.frameY = Array.from({ length: 10 }, (_value, index) => (index + 1) * 2);
    map.cursor.frameSumX = 55;
    map.cursor.frameSumY = 110;

    map.pushCursorVelocitySample(20, -10, 10);

    expect(map.cursor.frameCount).toBe(10);
    expect(map.cursor.frameIndex).toBe(3);
    expect(map.cursor.frameX[2]).toBe(-2);
    expect(map.cursor.frameY[2]).toBe(-1);
    expect(map.cursor.frameSumX).toBe(50);
    expect(map.cursor.frameSumY).toBe(103);

    const requestUpdateSpy = vi.spyOn(map, "requestUpdate");
    map.followPlayer("missing-player");
    expect(map.followingPlayer.name).toBeNull();
    expect(requestUpdateSpy).not.toHaveBeenCalled();

    requestUpdateSpy.mockClear();

    const cameraXGoToSpy = vi.spyOn(map.camera.x, "goTo");
    const cameraYGoToSpy = vi.spyOn(map.camera.y, "goTo");
    const zoomGoToSpy = vi.spyOn(map.camera.zoom, "goTo");

    map.zoomOntoPoint({ x: 160, y: 120, zoom: 2 });

    expect(cameraXGoToSpy).toHaveBeenCalledWith(expect.any(Number), 1);
    expect(cameraYGoToSpy).toHaveBeenCalledWith(expect.any(Number), 1);
    expect(zoomGoToSpy).toHaveBeenCalledWith(2, 1);
    expect(requestUpdateSpy).toHaveBeenCalledOnce();
  });
});