import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockedState = vi.hoisted(() => ({
  getGroup: vi.fn(() => ({ groupName: "iron", groupToken: "token-123" })),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  showTooltip: vi.fn(),
  hideTooltip: vi.fn(),
}));

vi.mock("../data/storage", () => ({
  storage: {
    getGroup: mockedState.getGroup,
  },
}));

vi.mock("../data/pubsub", () => ({
  pubsub: {
    subscribe: mockedState.subscribe,
    unsubscribe: mockedState.unsubscribe,
  },
}));

vi.mock("../rs-tooltip/tooltip-manager", () => ({
  tooltipManager: {
    showTooltip: mockedState.showTooltip,
    hideTooltip: mockedState.hideTooltip,
  },
}));

import { RequestDialog } from "../request-dialog/request-dialog";
import { requestDialogManager } from "../request-dialog/request-dialog-manager";

type PendingRequestDialog = RequestDialog & {
  resolveRequest?: (quantity: number | null) => void;
};

type ManagerDialog = Element & {
  show(itemName: string): Promise<number | null>;
};

type PrivateRequestDialogManager = typeof requestDialogManager & {
  _dialog?: ManagerDialog | null;
};

function createDialog(
  options: {
    includeInput?: boolean;
    includeConfirm?: boolean;
    includeCancel?: boolean;
  } = {}
): PendingRequestDialog {
  const { includeInput = true, includeConfirm = true, includeCancel = true } = options;
  const dialog = new RequestDialog() as PendingRequestDialog;

  document.body.appendChild(dialog);
  vi.spyOn(dialog, "render").mockImplementation(() => {
    dialog.innerHTML = `
      <div class="dialog__container request-dialog__container">
        ${includeInput ? '<input class="request-dialog__quantity" type="text" value="1" />' : ""}
        ${includeConfirm ? '<button class="request-dialog__confirm">Confirm</button>' : ""}
        ${includeCancel ? '<button class="request-dialog__cancel">Cancel</button>' : ""}
      </div>
    `;
  });

  return dialog;
}

describe("request dialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockedState.getGroup.mockReset().mockReturnValue({ groupName: "iron", groupToken: "token-123" });
    mockedState.subscribe.mockReset();
    mockedState.unsubscribe.mockReset();
    mockedState.showTooltip.mockReset();
    mockedState.hideTooltip.mockReset();
    (requestDialogManager as PrivateRequestDialogManager)._dialog = undefined;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    (requestDialogManager as PrivateRequestDialogManager)._dialog = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("parses OSRS quantities across suffix and invalid branches", () => {
    expect(RequestDialog.parseOsrsQuantity("1,234")).toBe(1234);
    expect(RequestDialog.parseOsrsQuantity(" 2.5k ")).toBe(2500);
    expect(RequestDialog.parseOsrsQuantity("3.75m")).toBe(3750000);
    expect(RequestDialog.parseOsrsQuantity("1.2b")).toBe(1200000000);
    expect(RequestDialog.parseOsrsQuantity("9.9")).toBe(9);
    expect(RequestDialog.parseOsrsQuantity("nope")).toBeNaN();
  });

  it("shows and confirms a typed quantity by button click", async () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus").mockImplementation(() => undefined);
    const dialog = createDialog();

    const pending = dialog.show("Abyssal whip");
    const quantityInput = dialog.querySelector<HTMLInputElement>(".request-dialog__quantity");
    const confirmBtn = dialog.querySelector<HTMLButtonElement>(".request-dialog__confirm");

    expect(dialog.itemName).toBe("Abyssal whip");
    expect(dialog.classList.contains("dialog__visible")).toBe(true);
    expect(focusSpy).toHaveBeenCalledOnce();
    expect(dialog.eventUnbinders.size).toBe(2);

    quantityInput!.value = "2.5k";
    confirmBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await expect(pending).resolves.toBe(2500);
    expect(dialog.classList.contains("dialog__visible")).toBe(false);
    expect(dialog.eventUnbinders.size).toBe(0);
    expect(dialog.eventListeners.size).toBe(0);
  });

  it("keeps the dialog open on invalid confirm and resolves null on cancel", async () => {
    const dialog = createDialog();
    const pending = dialog.show("Shark");
    const unresolved = Symbol("unresolved");
    let resolvedValue: number | null | symbol = unresolved;

    void pending.then((value) => {
      resolvedValue = value;
    });

    const quantityInput = dialog.querySelector<HTMLInputElement>(".request-dialog__quantity");
    const confirmBtn = dialog.querySelector<HTMLButtonElement>(".request-dialog__confirm");
    const cancelBtn = dialog.querySelector<HTMLButtonElement>(".request-dialog__cancel");

    quantityInput!.value = "0";
    confirmBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();

    expect(resolvedValue).toBe(unresolved);
    expect(dialog.classList.contains("dialog__visible")).toBe(true);

    cancelBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect(pending).resolves.toBeNull();
    expect(dialog.classList.contains("dialog__visible")).toBe(false);
  });

  it("confirms on Enter keypress", async () => {
    const dialog = createDialog();
    const pending = dialog.show("Rune arrow");
    const quantityInput = dialog.querySelector<HTMLInputElement>(".request-dialog__quantity");

    quantityInput!.value = "42";
    quantityInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    await expect(pending).resolves.toBe(42);
    expect(dialog.classList.contains("dialog__visible")).toBe(false);
  });

  it("hides and unbinds click listeners", async () => {
    const dialog = createDialog();
    const pending = dialog.show("Coal");

    expect(dialog.classList.contains("dialog__visible")).toBe(true);
    expect(dialog.eventUnbinders.size).toBe(2);

    dialog.hide();

    expect(dialog.classList.contains("dialog__visible")).toBe(false);
    expect(dialog.eventUnbinders.size).toBe(0);
    expect(dialog.eventListeners.size).toBe(0);

    dialog.resolveRequest?.(null);
    await expect(pending).resolves.toBeNull();
  });

  it("builds API base and auth headers with and without a stored token", () => {
    mockedState.getGroup.mockReturnValueOnce({ groupName: "group-name", groupToken: "secret-token" });
    expect(RequestDialog.getApiBase()).toBe("/api/group/group-name");

    mockedState.getGroup.mockReturnValueOnce({ groupName: "group-name", groupToken: "secret-token" });
    expect(RequestDialog.getAuthHeaders()).toEqual({
      "Content-Type": "application/json",
      Authorization: "secret-token",
    });

    mockedState.getGroup.mockReturnValueOnce(undefined);
    expect(RequestDialog.getApiBase()).toBe("/api/group/undefined");

    mockedState.getGroup.mockReturnValueOnce(undefined);
    expect(RequestDialog.getAuthHeaders()).toEqual({
      "Content-Type": "application/json",
    });
  });

  it("posts item requests and returns false for response and network failures", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce({ ok: true });
    await expect(RequestDialog.sendItemRequest("Abyssal whip", 4, "alice", { alice: 1, bob: 3 })).resolves.toBe(true);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/group/iron/request-item", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "token-123",
      },
      body: JSON.stringify({
        item_name: "Abyssal whip",
        quantity: 4,
        requested_by: "alice",
        member_quantities: { alice: 1, bob: 3 },
      }),
    });

    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(RequestDialog.sendItemRequest("Shark", 2, "bob", { bob: 2 })).resolves.toBe(false);

    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(RequestDialog.sendItemRequest("Coal", 10, "charlie", { charlie: 10 })).resolves.toBe(false);
  });
});

describe("request dialog manager", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    (requestDialogManager as PrivateRequestDialogManager)._dialog = undefined;
  });

  afterEach(() => {
    (requestDialogManager as PrivateRequestDialogManager)._dialog = undefined;
    vi.restoreAllMocks();
  });

  it("caches the queried dialog and delegates requestQuantity", async () => {
    const dialog = {
      show: vi.fn(async (itemName: string) => (itemName === "Twisted bow" ? 7 : null)),
    } as unknown as ManagerDialog;
    const querySelectorSpy = vi.spyOn(document, "querySelector").mockReturnValue(dialog);

    expect(requestDialogManager.dialog).toBe(dialog);
    expect(requestDialogManager.dialog).toBe(dialog);
    expect(querySelectorSpy).toHaveBeenCalledTimes(1);

    await expect(requestDialogManager.requestQuantity("Twisted bow")).resolves.toBe(7);
    expect((dialog.show as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("Twisted bow");
  });

  it("returns null when no dialog is present", async () => {
    const querySelectorSpy = vi.spyOn(document, "querySelector").mockReturnValue(null);

    await expect(requestDialogManager.requestQuantity("Dragon claws")).resolves.toBeNull();
    expect(querySelectorSpy).toHaveBeenCalledWith("request-dialog");
  });
});