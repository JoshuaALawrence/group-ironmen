import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BankDialog } from "../bank-dialog/bank-dialog";
import { groupData } from "../data/group-data";
import { pubsub } from "../data/pubsub";

function mountBankDialog(playerName: string): BankDialog {
  const dialog = new BankDialog();
  vi.spyOn(dialog, "html").mockReturnValue(`
    <div class="dialog__visible">
      <button class="dialog__close">Close</button>
      <div class="bank-dialog__status"></div>
      <div class="bank-dialog__item-count"></div>
      <div class="bank-dialog__value"></div>
      <input class="bank-dialog__search-input" />
      <div class="bank-dialog__items"></div>
    </div>
  `);
  dialog.setAttribute("player-name", playerName);
  document.body.appendChild(dialog);
  return dialog;
}

describe("bank dialog branches", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    groupData.members = new Map();
  });

  afterEach(() => {
    pubsub.unpublishAll();
    vi.restoreAllMocks();
  });

  it("covers empty-state rendering plus background and close button flows", () => {
    groupData.members.set("Alice", { name: "Alice", bank: [] } as never);

    const dialog = mountBankDialog("Alice");
    expect(dialog.statusEl?.textContent).toBe("No bank data available.");
    expect(dialog.statusEl?.hidden).toBe(false);
    expect(dialog.itemsEl?.hidden).toBe(true);

    const closeSpy = vi.spyOn(dialog, "close");
    const innerTarget = document.createElement("div");
    dialog.background?.appendChild(innerTarget);

    innerTarget.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(closeSpy).not.toHaveBeenCalled();

    dialog.background?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(dialog.isConnected).toBe(false);

    groupData.members.set("Bob", { name: "Bob", bank: [] } as never);
    const closeButtonDialog = mountBankDialog("Bob");
    const closeButton = closeButtonDialog.querySelector(".dialog__close") as HTMLButtonElement;
    closeButton.click();
    expect(closeButtonDialog.isConnected).toBe(false);
  });

  it("covers populated bank updates, search filtering, value rendering, and pubsub updates", () => {
    groupData.members.set(
      "Alice",
      {
        name: "Alice",
        bank: [
          {
            id: 1,
            name: "Rune scimitar",
            quantity: 2,
            highAlch: 15_000,
            gePrice: 18_000,
            isValid: () => true,
          },
          {
            id: 2,
            name: "Coins",
            quantity: 500,
            highAlch: 1,
            gePrice: 1,
            isValid: () => true,
          },
          {
            id: 3,
            name: "Broken Item",
            quantity: 1,
            highAlch: 0,
            gePrice: 0,
            isValid: () => false,
          },
        ],
      } as never
    );

    const dialog = mountBankDialog("Alice");
    expect(dialog.bank).toHaveLength(2);
    expect(dialog.statusEl?.hidden).toBe(true);
    expect(dialog.itemsEl?.hidden).toBe(false);
    expect(dialog.itemCountEl?.textContent).toBe("2 items");
    expect(dialog.valueEl?.textContent).toBe("GE: 36,500 | HA: 30,500");
    expect(dialog.querySelectorAll("item-box")).toHaveLength(2);

    const searchInput = dialog.searchInput as HTMLInputElement;
    searchInput.value = "rune";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(dialog.searchQuery).toBe("rune");
    expect(dialog.itemCountEl?.textContent).toBe("1 items");
    expect(dialog.querySelectorAll("item-box")).toHaveLength(1);

    pubsub.publish("bank:Alice", [
      {
        id: 4,
        name: "Dragon scimitar",
        quantity: 3,
        highAlch: 40_000,
        gePrice: 60_000,
        isValid: () => true,
      },
    ]);
    expect(dialog.bank).toHaveLength(1);
    expect(dialog.itemCountEl?.textContent).toBe("0 items");
    expect(dialog.valueEl?.textContent).toBe("GE: 180,000 | HA: 120,000");

    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(dialog.itemCountEl?.textContent).toBe("1 items");
    expect(dialog.querySelectorAll("item-box")).toHaveLength(1);
  });
});