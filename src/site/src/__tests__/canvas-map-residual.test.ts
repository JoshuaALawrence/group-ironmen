import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function createTouchList(...touches: Array<{ clientX: number; clientY: number }>) {
  return touches as unknown as TouchList;
}

describe("CanvasMap residual coverage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("initializes connected lifecycle and clears state on disconnect", () => {
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
    const requestAnimationFrameMock = vi.fn().mockReturnValue(42);
    const cancelAnimationFrameMock = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    Object.defineProperty(map, "offsetWidth", { value: 512, configurable: true });
    Object.defineProperty(map, "offsetHeight", { value: 320, configurable: true });
    Object.defineProperty(map, "isConnected", { value: true, configurable: true });
    Object.defineProperty(map, "querySelector", { value: querySelector, configurable: true });
    Object.defineProperty(window, "requestAnimationFrame", { value: requestAnimationFrameMock, configurable: true });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    map.render = vi.fn();
    map.eventListener = vi.fn();
    map.subscribe = vi.fn();
    map.getMapJson = vi.fn().mockResolvedValue(undefined);

    map.connectedCallback();

    expect(map.render).toHaveBeenCalledOnce();
    expect(querySelector).toHaveBeenCalledWith(".canvas-map__coordinates");
    expect(querySelector).toHaveBeenCalledWith("canvas");
    expect(canvas.width).toBe(512);
    expect(canvas.height).toBe(320);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(map.eventListener).toHaveBeenCalledTimes(11);
    expect(map.subscribe).toHaveBeenCalledTimes(2);
    expect(map.getMapJson).toHaveBeenCalledOnce();
    expect(map.updateRequested).toBe(1);
    expect(map.animationFrameId).toBe(42);
    expect(map.disposed).toBe(false);

    map.playerMarkers.set("alice", { label: "alice", coordinates: { x: 1, y: 2, plane: 0 } });
    map.interactingMarkers.add({ label: "target", coordinates: { x: 3, y: 4, plane: 0 } });
    map.mapLabelImages.set(1, new Image() as HTMLImageElement & { loaded?: boolean });
    map.tiles[0].set(1, new Image() as unknown as never);
    map.tilesInView = [{ regionX: 0, regionY: 0 } as unknown as never];

    map.disconnectedCallback();

    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(42);
    expect(map.disposed).toBe(true);
    expect(map.playerMarkers.size).toBe(0);
    expect(map.interactingMarkers.size).toBe(0);
    expect(map.mapLabelImages.size).toBe(0);
    expect(map.tiles[0].size).toBe(0);
    expect(map.tilesInView).toEqual([]);
  });

  it("updates followed player coordinates and keeps the update loop alive while following", () => {
    const { map } = createMap();
    const requestAnimationFrameMock = vi.fn().mockReturnValue(77);

    map.followingPlayer = { name: "alice", coordinates: { x: 3200, y: 3200, plane: 0 } };
    map.playerMarkers.set("alice", { label: "alice", coordinates: { x: 3200, y: 3200, plane: 0 } });
    vi.spyOn(map, "isGameTileInView").mockReturnValue(true);

    map.handleUpdatedCoordinates({ name: "alice", coordinates: { x: 3301, y: 3402, plane: 2 } });

    expect(map.followingPlayer.coordinates).toEqual({ x: 3301, y: 3402, plane: 2 });
    expect(map.updateRequested).toBe(1);

    map.updateRequested = 1;
    map.previousFrameTime = 0;
    map.disposed = false;
    Object.defineProperty(window, "requestAnimationFrame", { value: requestAnimationFrameMock, configurable: true });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    vi.spyOn(map, "drawMapSquaresInView").mockImplementation(() => undefined);
    vi.spyOn(map, "drawLocations").mockImplementation(() => undefined);
    vi.spyOn(map, "drawMapAreaLabels").mockImplementation(() => undefined);
    vi.spyOn(map, "drawTileMarkers").mockImplementation(() => undefined);
    vi.spyOn(map, "drawCursorTile").mockImplementation(() => undefined);

    map._update(16);

    expect(map.camera.x.target).not.toBe(0);
    expect(map.camera.y.target).not.toBe(0);
    expect(map.plane).toBe(3);
    expect(map.updateRequested).toBe(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledWith(map.update);
    expect(map.animationFrameId).toBe(77);
  });

  it("throttles coordinate display updates to one animation frame", () => {
    const { map } = createMap();
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });

    Object.defineProperty(window, "requestAnimationFrame", { value: requestAnimationFrameMock, configurable: true });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    vi.spyOn(performance, "now").mockReturnValue(100);

    map.handleMovement(8, 12, 1, 1);
    map.handleMovement(28, 36, 2, 2);

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(map.coordDisplayPending).toBe(true);

    callbacks[0]?.(16);

    expect(map.coordDisplayPending).toBe(false);
    expect(map.coordinatesDisplay.innerText).toBe(`${map.cursor.worldX}, ${map.cursor.worldY}`);

    map.handleMovement(40, 44, 0, 0);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);
  });

  it("handles pointer and touch edge cases including pinch zoom variants", () => {
    const { map } = createMap();
    const handleMovementSpy = vi.spyOn(map, "handleMovement");
    const startDraggingSpy = vi.spyOn(map, "startDragging");
    const stopDraggingSpy = vi.spyOn(map, "stopDragging");
    const zoomOntoPointSpy = vi.spyOn(map, "zoomOntoPoint").mockImplementation(() => undefined);

    map.onPointerMove({ clientX: 11, clientY: 13 } as MouseEvent);
    expect(handleMovementSpy).toHaveBeenLastCalledWith(11, 13, 0, 0);

    map.touch.startDistance = 123;
    map.touch.startZoom = 4;
    map.onTouchStart({ touches: createTouchList({ clientX: 1, clientY: 2 }) } as TouchEvent);
    expect(map.touch.startDistance).toBe(123);
    expect(map.touch.startZoom).toBe(4);

    map.camera.isDragging = true;
    map.cursor.previousX = undefined;
    map.cursor.previousY = undefined;
    map.onTouchMove({ touches: createTouchList({ clientX: 7, clientY: 9 }) } as TouchEvent);
    expect(startDraggingSpy).not.toHaveBeenCalled();
    expect(handleMovementSpy).toHaveBeenLastCalledWith(7, 9, 0, 0);

    map.onTouchMove({ touches: createTouchList() } as TouchEvent);
    expect(zoomOntoPointSpy).not.toHaveBeenCalled();

    const startTouches = createTouchList(
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 10 }
    );
    map.camera.zoom.current = 1;
    map.onTouchStart({ touches: startTouches } as TouchEvent);
    expect(map.touch.startDistance).toBe(10);
    expect(map.touch.startZoom).toBe(1);

    const pinchTouches = createTouchList(
      { clientX: 0, clientY: 0 },
      { clientX: 20, clientY: 0 }
    );
    map.onTouchMove({ touches: pinchTouches } as TouchEvent);

    expect(stopDraggingSpy).toHaveBeenCalled();
    expect(zoomOntoPointSpy).toHaveBeenCalledWith({ x: 10, y: 0, zoom: 2 });
  });

  it("clamps zoom targets and ignores scroll while dragging or when the clamped zoom is unchanged", () => {
    const { map } = createMap();
    const requestUpdateSpy = vi.spyOn(map, "requestUpdate");

    map.zoomOntoPoint({ x: 0, y: 0, delta: 100, animationTime: 5 });
    expect(map.camera.zoom.target).toBe(map.camera.maxZoom);

    map.camera.zoom.target = 1;
    map.zoomOntoPoint({ x: 0, y: 0, delta: -100, animationTime: 5 });
    expect(map.camera.zoom.target).toBe(map.camera.minZoom);

    map.camera.zoom.target = 1;
    map.zoomOntoPoint({ x: 0, y: 0, zoom: 99, animationTime: 5 });
    expect(map.camera.zoom.target).toBe(map.camera.maxZoom);

    requestUpdateSpy.mockClear();
    map.camera.zoom.target = map.camera.maxZoom;
    map.zoomOntoPoint({ x: 0, y: 0, zoom: 999, animationTime: 5 });
    expect(requestUpdateSpy).not.toHaveBeenCalled();

    const zoomOntoPointSpy = vi.spyOn(map, "zoomOntoPoint");
    map.camera.isDragging = true;
    map.onScroll({ deltaY: -1 } as WheelEvent);
    expect(zoomOntoPointSpy).not.toHaveBeenCalled();
  });

  it("logs and skips invalid icon, label, and tile drawing cases", () => {
    const { map, ctx } = createMap();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    map.tilesInView = [{ regionX: 1, regionY: 2 } as unknown as never];
    map.locations = { 1: { 2: { 3: [3200, 3200] } } };
    map.locationIconsSheet = new Image();
    ctx.drawImage.mockImplementationOnce(() => {
      throw new Error("bad icon");
    });
    map.drawLocations();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("failed to draw map icon 3"), expect.any(Error));

    map.mapLabels = { 0: { 1: { 0: [3200, 3200, 11] } } };
    map.view = { left: 0, right: 1, top: 1, bottom: 0 };
    map.mapLabelImages.clear();
    map.drawMapAreaLabels(false);
    expect(map.mapLabelImages.size).toBe(0);

    const labelKey = map.cantor(3200 * map.pixelsPerGameTile, -3200 * map.pixelsPerGameTile + map.tileSize);
    const labelImage = new Image() as HTMLImageElement & { loaded?: boolean };
    labelImage.loaded = true;
    Object.defineProperty(labelImage, "width", { value: 20, configurable: true });
    Object.defineProperty(labelImage, "height", { value: 10, configurable: true });
    map.mapLabelImages.set(labelKey, labelImage);
    ctx.drawImage.mockImplementationOnce(() => {
      throw new Error("bad label");
    });
    map.drawMapAreaLabels(false);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("failed to draw map image label 11"), expect.any(Error));

    const tileKey = map.cantor(0, 1);
    const loadedTile = new Image() as HTMLImageElement & {
      regionX: number;
      regionY: number;
      loaded?: boolean;
      animation?: Animation;
    };
    loadedTile.regionX = 0;
    loadedTile.regionY = 1;
    loadedTile.loaded = true;
    loadedTile.animation = new Animation({ current: 0.5, target: 1, progress: 0.5, time: 100 });
    map.validTiles[0] = new Set([tileKey]);
    map.tiles[0].set(tileKey, loadedTile as unknown as never);
    ctx.drawImage.mockImplementationOnce(() => {
      throw new Error("bad tile");
    });
    map.drawMapSquaresInView(false);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("failed to draw map tile 0_0_1"), expect.any(Error));

    const pendingTile = new Image() as HTMLImageElement & {
      regionX: number;
      regionY: number;
      loaded?: boolean;
      animation?: Animation;
      onload: ((event: Event) => void) | null;
    };
    pendingTile.regionX = 0;
    pendingTile.regionY = 1;
    pendingTile.loaded = false;
    pendingTile.onload = vi.fn();
    map.tiles[0].set(tileKey, pendingTile as unknown as never);
    ctx.clearRect.mockClear();
    map.drawMapSquaresInView(false);

    expect(ctx.clearRect).toHaveBeenCalled();
  });
});