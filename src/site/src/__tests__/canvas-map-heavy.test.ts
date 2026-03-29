import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CanvasMap } from "../canvas-map/canvas-map";
import { Animation } from "../canvas-map/animation";

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

function createMap(): CanvasMap {
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
    frameX: [0],
    frameY: [0],
    lastPointerMoveTime: 0,
  };
  map.touch = { pinchDistance: 0, startDistance: 1, startZoom: 1 };
  map.view = { left: 0, right: 1, top: 1, bottom: 0 };
  map.tiles = [new Map(), new Map(), new Map(), new Map()];
  map.tilesInView = [];
  map.validTiles = [];

  return map;
}

describe("CanvasMap heavy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates members/coordinates and follows players", () => {
    const map = createMap();
    vi.spyOn(map, "requestUpdate");

    map.handleUpdatedMembers([
      { name: "@SHARED", coordinates: { x: 1, y: 1, plane: 0 } },
      { name: "alice", coordinates: { x: 3200, y: 3200, plane: 0 } },
      { name: "bob", coordinates: { x: Number.NaN, y: 1, plane: 0 } },
    ]);

    expect(map.playerMarkers.has("alice")).toBe(true);
    expect(map.playerMarkers.has("@SHARED")).toBe(false);

    map.followPlayer("alice");
    expect(map.followingPlayer.name).toBe("alice");
    map.stopFollowingPlayer();
    expect(map.followingPlayer.name).toBeNull();

    expect(map.isValidCoordinates({ x: 1, y: 2, plane: 3 })).toBe(true);
    expect(map.isValidCoordinates({ x: Number.NaN, y: 2, plane: 3 })).toBe(false);

    const center = map.gamePositionToCameraCenter(10, 20);
    const client = map.gamePositionToClient(10, 20);
    const canvas = map.gamePositionToCanvas(10, 20);
    expect(center.length).toBe(2);
    expect(client.length).toBe(2);
    expect(canvas).toEqual([40, -80 + map.tileSize]);
    expect(typeof map.cantor(4, 7)).toBe("number");
  });

  it("loads map json and parses tile/icon/label data", async () => {
    const map = createMap();
    const fetchMock = vi.spyOn(globalThis, "fetch" as never).mockResolvedValue({
      json: async () => ({
        tiles: [[1, 2]],
        icons: {
          "3": {
            "4": {
              "5": [100, 200],
            },
          },
        },
        labels: {
          "6": {
            "7": {
              "0": [300, 400, 9],
            },
          },
        },
      }),
    } as Response);

    await map.getMapJson();

    expect(fetchMock).toHaveBeenCalledWith("/data/map.json");
    expect(map.validTiles[0]?.has(1)).toBe(true);
    expect(map.locations[3]?.[4]?.[5]).toEqual([100, 200]);
    expect(map.mapLabels[6]?.[7]?.[0]).toEqual([300, 400, 9]);

    map.locationIconsSheet.onload?.(new Event("load"));
    expect(map.updateRequested).toBeGreaterThan(0);
  });

  it("draws tiles, labels and markers", () => {
    const map = createMap();
    map.drawGameTiles([{ x: 1, y: 2 }], "#fff", "#000");
    expect((map.ctx as unknown as CtxMock).rect).toHaveBeenCalled();

    map.drawLabels(
      [
        { x: 8, y: 10, text: "A" },
        { x: 8, y: 10, text: "B" },
      ],
      "yellow",
      "black",
      "top"
    );
    expect((map.ctx as unknown as CtxMock).fillText).toHaveBeenCalled();

    map.playerMarkers.set("p1", { label: "p1", coordinates: { x: 3200, y: 3200, plane: 0 } });
    map.drawTileMarkers(map.playerMarkers.values(), {
      fillColor: "#1",
      strokeColor: "#2",
      labelPosition: "top",
      labelFill: "#3",
      labelStroke: "#4",
    });
    expect((map.ctx as unknown as CtxMock).stroke).toHaveBeenCalled();

    map.cursor.canvasX = 12;
    map.cursor.canvasY = 34;
    map.drawCursorTile();
    expect((map.ctx as unknown as CtxMock).fill).toHaveBeenCalled();
  });

  it("draws locations and label images", () => {
    const map = createMap();
    const ctx = map.ctx as unknown as CtxMock;

    map.tilesInView = [{ regionX: 1, regionY: 2 } as unknown as never];
    map.locations = { 1: { 2: { 0: [3200, 3200] } } };
    map.locationIconsSheet = new Image();
    map.drawLocations();
    expect(ctx.drawImage).toHaveBeenCalled();

    map.mapLabels = { 0: { 1: { 0: [3200, 3200, 11] } } };
    map.view = { left: 0, right: 1, top: 1, bottom: 0 };
    map.drawMapAreaLabels(true);
    expect(map.mapLabelImages.size).toBeGreaterThan(0);

    const existingLabel = new Image() as HTMLImageElement & { loaded?: boolean };
    existingLabel.loaded = true;
    Object.defineProperty(existingLabel, "width", { value: 20 });
    Object.defineProperty(existingLabel, "height", { value: 10 });
    map.mapLabelImages.set(map.cantor(3200 * 4, -3200 * 4 + map.tileSize), existingLabel);
    map.drawMapAreaLabels(false);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("loads and draws map squares in view", () => {
    const map = createMap();
    const ctx = map.ctx as unknown as CtxMock;
    map.view = { left: 0, right: 1, top: 1, bottom: 0 };

    const invalidKey = map.cantor(0, 1);
    map.validTiles = [new Set<number>(), new Set<number>(), new Set<number>(), new Set<number>()];
    map.drawMapSquaresInView(true);
    expect(ctx.clearRect).toHaveBeenCalled();

    map.validTiles[0] = new Set([invalidKey]);
    map.drawMapSquaresInView(true);
    const tile = map.tiles[0].get(invalidKey);
    expect(tile).toBeDefined();
    expect(typeof tile?.onload).toBe("function");

    tile!.loaded = true;
    tile!.animation = new Animation({ current: 0.5, target: 1, progress: 0.5, time: 100 });
    map.drawMapSquaresInView(false);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("handles drag, movement and pointer/touch flows", () => {
    const map = createMap();
    Object.defineProperty(map, "offsetWidth", { value: 500, configurable: true });
    Object.defineProperty(map, "offsetHeight", { value: 300, configurable: true });
    map.onResize();

    map.startDragging(10, 20);
    expect(map.camera.isDragging).toBe(true);

    vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(120).mockReturnValueOnce(140);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    map.handleMovement(20, 30, 5, 5);
    expect(map.coordinatesDisplay.innerText).toContain(",");

    map.onPointerMove({ clientX: 22, clientY: 35 } as MouseEvent);
    map.onPointerDown({ clientX: 5, clientY: 7 } as MouseEvent);
    map.onPointerUp();
    expect(map.camera.isDragging).toBe(false);

    const touches = [{ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 0 }] as unknown as TouchList;
    map.onTouchStart({ touches } as TouchEvent);
    map.onTouchMove({ touches: [{ clientX: 12, clientY: 14 }] as unknown as TouchList } as TouchEvent);
    map.onTouchMove({ touches } as TouchEvent);

    expect(map.pinchDistance(touches)).toBe(10);
    const center = map.pinchCenter(touches);
    expect(center).toEqual([5, 0]);

    raf.mockRestore();
  });

  it("zooms around cursor and handles wheel", () => {
    const map = createMap();
    map.cursor.x = 20;
    map.cursor.y = 30;

    map.onScroll({ deltaY: -1 } as WheelEvent);
    expect(map.updateRequested).toBeGreaterThan(0);

    map.followingPlayer = { name: "alice", coordinates: { x: 3200, y: 3200, plane: 0 } };
    map.zoomOntoPoint({ x: 0, y: 0, zoom: 2, animationTime: 10 });
    expect(map.camera.zoom.target).toBe(2);

    map.camera.isDragging = true;
    const before = map.camera.zoom.target;
    map.zoomOntoPoint({ x: 0, y: 0, delta: 0.1 });
    expect(map.camera.zoom.target).toBe(before);
  });

  it("runs update loop and cleanup paths", () => {
    const map = createMap();
    map.disposed = true;
    map.updateRequested = 1;
    map.previousFrameTime = 0;
    map.cursor.dx = 0.1;
    map.cursor.dy = 0.1;
    map.followingPlayer = { name: "alice", coordinates: { x: 3200, y: 3200, plane: 1 } };

    const drawSquares = vi.spyOn(map, "drawMapSquaresInView").mockImplementation(() => undefined);
    const drawLabels = vi.spyOn(map, "drawMapAreaLabels").mockImplementation(() => undefined);
    const drawLoc = vi.spyOn(map, "drawLocations").mockImplementation(() => undefined);
    const drawCursor = vi.spyOn(map, "drawCursorTile").mockImplementation(() => undefined);
    const drawMarkers = vi.spyOn(map, "drawTileMarkers").mockImplementation(() => undefined);

    map._update(16);

    expect(drawSquares).toHaveBeenCalled();
    expect(drawLabels).toHaveBeenCalled();
    expect(drawLoc).toHaveBeenCalled();
    expect(drawCursor).toHaveBeenCalled();
    expect(drawMarkers).toHaveBeenCalledTimes(2);

    const marker = map.addInteractingMarker(1, 2, "target");
    expect(map.interactingMarkers.size).toBe(1);
    map.removeInteractingMarker(marker);
    expect(map.interactingMarkers.size).toBe(0);

    const dispatchSpy = vi.spyOn(map, "dispatchEvent");
    map.showPlane(3);
    expect(dispatchSpy).toHaveBeenCalled();

    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    map.animationFrameId = 123;
    map.playerMarkers.set("x", { label: "x", coordinates: { x: 1, y: 1, plane: 0 } });
    map.interactingMarkers.add({ label: "x", coordinates: { x: 1, y: 1, plane: 0 } });
    map.tiles[0].set(1, new Image() as unknown as never);
    map.disconnectedCallback();

    expect(cancel).toHaveBeenCalledWith(123);
    expect(map.playerMarkers.size).toBe(0);
    expect(map.interactingMarkers.size).toBe(0);
  });
});
