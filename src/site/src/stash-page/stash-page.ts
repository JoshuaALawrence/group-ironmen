import { BaseElement } from "../base-element/base-element";
import { groupData } from "../data/group-data";
import { Item } from "../data/item";
import { DIFFICULTIES, DIFFICULTY_COLORS, STASHES, getStashesByDifficulty } from "./stash-data";

type StashItem = {
  name: string;
  iconId: number;
  itemIds: number[];
  isAll?: boolean;
};

type StashClue = {
  text: string;
  items: StashItem[];
};

type Stash = {
  name: string;
  difficulty: string;
  clues: StashClue[];
};

type StashChildStatus = {
  id: number;
  name: string;
  have: number;
  need: number;
  satisfied: boolean;
};

type StashAllItemStatus = StashItem & {
  children: StashChildStatus[];
  satisfied: boolean;
};

type StashSingleItemStatus = StashItem & {
  have: number;
  need: number;
  satisfied: boolean;
};

export class StashPage extends BaseElement {
  selectedTier: string;
  hideComplete: boolean;
  searchQuery: string;

  constructor() {
    super();
    this.selectedTier = "All";
    this.hideComplete = false;
    this.searchQuery = "";
  }

  html(): string {
    return `{{stash-page.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.selectedTier = "All";
    this.hideComplete = false;
    this.searchQuery = "";

    this.subscribe("members-updated", () => {
      this.render();
      this.bindEvents();
    });
    this.subscribe("items-updated", () => {
      this.render();
      this.bindEvents();
    });

    this.render();
    this.bindEvents();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  getMembers(): Array<{ name: string; totalItemQuantity: (itemId: number) => number }> {
    return [...groupData.members.values()] as Array<{ name: string; totalItemQuantity: (itemId: number) => number }>;
  }

  getMemberCount(): number {
    return this.getMembers().filter((m) => m.name !== "@SHARED").length || 1;
  }

  /**
   * For a given stash, check how many of each item the group has vs needs.
   * Need = memberCount (each player needs a filled stash).
   * For ANY items (isAll=false with multiple itemIds), having any single id counts.
   * For ALL items (isAll=true), need all children.
   */
  getStashStatus(stash: Stash) {
    const members = this.getMembers();
    const need = this.getMemberCount();
    let allComplete = true;
    const clueStatuses = [];

    for (const clue of stash.clues) {
      const itemStatuses = [];
      for (const item of clue.items) {
        if (item.isAll) {
          // ALL: every itemId must have enough qty
          const children = [];
          for (const id of item.itemIds) {
            let have = 0;
            for (const m of members) have += m.totalItemQuantity(id);
            const satisfied = have >= need;
            if (!satisfied) allComplete = false;
            children.push({ id, name: this.safeItemName(id), have, need, satisfied });
          }
          itemStatuses.push({ ...item, children, satisfied: children.every((c) => c.satisfied) });
        } else {
          // Single or ANY: sum across all candidate ids
          let have = 0;
          for (const id of item.itemIds) {
            for (const m of members) have += m.totalItemQuantity(id);
          }
          const satisfied = have >= need;
          if (!satisfied) allComplete = false;
          itemStatuses.push({ ...item, have, need, satisfied });
        }
      }
      clueStatuses.push({ text: clue.text, items: itemStatuses });
    }

    return { allComplete, clueStatuses };
  }

  safeItemName(id: number): string {
    try {
      return Item.itemName(id);
    } catch {
      return `Item ${id}`;
    }
  }

  getFilteredStashes(): Stash[] {
    let stashes = (this.selectedTier === "All" ? STASHES : getStashesByDifficulty(this.selectedTier)) as Stash[];
    if (this.hideComplete) {
      stashes = stashes.filter((s) => !this.getStashStatus(s).allComplete);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      stashes = stashes.filter((s) => {
        if (s.name.toLowerCase().includes(q)) return true;
        if (s.difficulty.toLowerCase().includes(q)) return true;
        for (const clue of s.clues) {
          for (const item of clue.items) {
            if (item.name.toLowerCase().includes(q)) return true;
          }
        }
        return false;
      });
    }
    return stashes;
  }

  renderTierTabs(): string {
    const tabs = ["All", ...DIFFICULTIES];
    return tabs
      .map((tier) => {
        const active = this.selectedTier === tier ? "active" : "";
        const difficultyColors = DIFFICULTY_COLORS as Record<string, string>;
        const style = tier !== "All" && difficultyColors[tier] ? ` style="border-color:${difficultyColors[tier]}"` : "";
        return `<button class="stash-page__tier-tab ${active}" data-tier="${tier}"${style}>${tier}</button>`;
      })
      .join("");
  }

  renderSummary(): string {
    const need = this.getMemberCount();
    const members = this.getMembers();
    const rows = DIFFICULTIES.map((d) => {
      const stashes = getStashesByDifficulty(d);
      let complete = 0;
      for (const s of stashes) {
        if (this.getStashStatus(s).allComplete) complete++;
      }
      const color = (DIFFICULTY_COLORS as Record<string, string>)[d] || "#ccc";
      return `<div class="stash-page__summary-row">
        <span class="stash-page__summary-label" style="color:${color}">${d}</span>
        <span class="stash-page__summary-value" style="color:${
          complete === stashes.length ? "var(--green)" : "#ccc"
        }">${complete}/${stashes.length}</span>
      </div>`;
    });

    const totalComplete = STASHES.filter((s) => this.getStashStatus(s).allComplete).length;
    rows.push(`<div class="stash-page__summary-row" style="border-top:1px solid var(--light-border);margin-top:4px;padding-top:4px">
      <span class="stash-page__summary-label">Total</span>
      <span class="stash-page__summary-value" style="color:${
        totalComplete === STASHES.length ? "var(--green)" : "#ccc"
      }">${totalComplete}/${STASHES.length}</span>
    </div>`);

    if (members.length > 0) {
      rows.unshift(
        `<div style="font-size:12px;color:#888;margin-bottom:4px">Need ${need}x each item (${need} player${
          need > 1 ? "s" : ""
        })</div>`
      );
    }

    return rows.join("");
  }

  renderStashes(): string {
    const stashes = this.getFilteredStashes();
    if (stashes.length === 0) {
      return `<div class="stash-page__no-stashes">No stashes to show</div>`;
    }

    return stashes
      .map((stash) => {
        const { allComplete, clueStatuses } = this.getStashStatus(stash);
        const diffColor = (DIFFICULTY_COLORS as Record<string, string>)[stash.difficulty] || "#ccc";

        const cluesHtml = clueStatuses
          .map((clue) => {
            const itemsHtml = clue.items
              .map((item) => {
                if (item.isAll && "children" in item) {
                  return item.children
                    .map((child: StashChildStatus) => {
                      const cls = child.satisfied ? "has-item" : "missing-item";
                      const iconUrl = this.getIconUrl(child.id);
                      return `<div class="stash-page__item ${cls}">
                <img class="stash-page__item-icon" src="${iconUrl}" loading="lazy" />
                <span>${child.name} (${child.have}/${child.need})</span>
              </div>`;
                    })
                    .join("");
                } else {
                  const singleItem = item as StashSingleItemStatus;
                  const cls = item.satisfied ? "has-item" : "missing-item";
                  const iconUrl = this.getIconUrl(item.iconId);
                  return `<div class="stash-page__item ${cls}">
              <img class="stash-page__item-icon" src="${iconUrl}" loading="lazy" />
              <span>${item.name} (${singleItem.have}/${singleItem.need})</span>
            </div>`;
                }
              })
              .join("");

            return `<div class="stash-page__clue">
          <div class="stash-page__clue-text">${clue.text}</div>
          <div class="stash-page__items">${itemsHtml}</div>
        </div>`;
          })
          .join("");

        return `<div class="stash-page__stash ${allComplete ? "complete" : ""}">
        <div class="stash-page__stash-header">
          <span class="stash-page__stash-name">${stash.name} <span style="color:${diffColor};font-size:12px">(${
          stash.difficulty
        })</span></span>
          <span class="stash-page__stash-status ${allComplete ? "complete" : "incomplete"}">${
          allComplete ? "✓ Complete" : "✗ Incomplete"
        }</span>
        </div>
        ${cluesHtml}
      </div>`;
      })
      .join("");
  }

  getIconUrl(itemId: number): string {
    try {
      return Item.imageUrl(itemId, 1);
    } catch {
      return "";
    }
  }

  bindEvents(): void {
    const tierTabs = this.querySelectorAll<HTMLElement>(".stash-page__tier-tab");
    for (const tab of tierTabs) {
      this.eventListener(tab, "click", () => {
        this.selectedTier = tab.dataset.tier ?? "All";
        this.render();
        this.bindEvents();
      });
    }

    const hideCheckbox = this.querySelector<HTMLInputElement>("#stash-page__hide-complete");
    if (hideCheckbox) {
      this.eventListener(hideCheckbox, "change", () => {
        this.hideComplete = hideCheckbox.checked;
        this.render();
        this.bindEvents();
      });
    }

    const searchInput = this.querySelector<HTMLInputElement>("#stash-page__search");
    if (searchInput) {
      searchInput.focus();
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
      this.eventListener(searchInput, "input", () => {
        this.searchQuery = searchInput.value;
        const grid = this.querySelector(".stash-page__grid");
        const count = this.querySelector(".stash-page__count");
        if (grid) grid.innerHTML = this.renderStashes();
        if (count) count.textContent = `${this.getFilteredStashes().length} stashes`;
      });
    }
  }
}

customElements.define("stash-page", StashPage);
