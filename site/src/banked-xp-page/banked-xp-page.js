import { BaseElement } from "../base-element/base-element";
import { groupData } from "../data/group-data";
import { Item } from "../data/item";
import { Skill, SkillName } from "../data/skill";
import {
  BANKABLE_SKILLS,
  MODIFIERS,
  getLevelForXp,
  getActivitiesForItem,
  createBankedItemMap,
  rebuildLinkedMap,
  calculateBankedXpTotal,
  calculateSecondaries,
  getActivityXpRate,
  getItemQty,
} from "./banked-xp-calc";

// Map lowercase skill names from data to SkillName enum
const SKILL_NAME_MAP = {
  construction: SkillName.Construction,
  cooking: SkillName.Cooking,
  crafting: SkillName.Crafting,
  farming: SkillName.Farming,
  firemaking: SkillName.Firemaking,
  fletching: SkillName.Fletching,
  herblore: SkillName.Herblore,
  hunter: SkillName.Hunter,
  prayer: SkillName.Prayer,
  sailing: SkillName.Sailing,
  smithing: SkillName.Smithing,
  thieving: SkillName.Thieving,
};

// Outfit piece item IDs: [helm, top, bottom, boots]
const OUTFIT_PIECE_IDS = {
  "Zealot's Robes (Per Piece)": [25438, 25434, 25436, 25440],
  "Farmer's Outfit": [13646, 13642, 13640, 13644],
  "Carpenter's Outfit": [24872, 24874, 24876, 24878],
  "Pyromancer Outfit": [20708, 20704, 20706, 20710],
};

export class BankedXpPage extends BaseElement {
  constructor() {
    super();
  }

  html() {
    return `{{banked-xp-page.html}}`;
  }

  connectedCallback() {
    super.connectedCallback();

    this.selectedSkill = BANKABLE_SKILLS[0];
    this.cascadeEnabled = true;
    this.xpMultiplier = 1;
    this.bankedItems = [];
    this.linkedMap = new Map();
    this.enabledModifiers = [];
    this.modifierStates = {};
    this.currentXp = 0;
    this.currentLevel = 1;
    this.bankedXpTotal = 0;
    this.endLevel = 1;
    this.selectedMember = null;
    this.storageFilter = "@ALL";
    this.limitToLevel = true;

    // Load saved state from localStorage
    this.loadState();

    // Pick first member if none saved
    const members = [...groupData.members.values()];
    if (!this.selectedMember || !groupData.members.has(this.selectedMember)) {
      if (members.length > 0) {
        this.selectedMember = members[0].name;
      }
    }

    this.subscribe("members-updated", () => this.handleMembersUpdated());
    this.subscribe("items-updated", () => this.handleItemsUpdated());

    // Subscribe to skill updates for all members so XP refreshes
    for (const member of members) {
      this.subscribe(`skills:${member.name}`, () => {
        this.refreshData();
        this.updateDisplay();
        this.bindDynamicEvents();
      });
    }

    this.refreshData();
    this.render();
    this.bindEvents();
    this.bindDynamicEvents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  handleMembersUpdated() {
    const members = [...groupData.members.values()];
    if (members.length > 0 && !groupData.members.has(this.selectedMember)) {
      this.selectedMember = members[0].name;
    }

    // Subscribe to skill updates for any new members
    for (const member of members) {
      this.subscribe(`skills:${member.name}`, () => {
        this.refreshData();
        this.updateDisplay();
        this.bindDynamicEvents();
      });
    }

    this.refreshData();
    this.render();
    this.bindEvents();
    this.bindDynamicEvents();
  }

  handleItemsUpdated() {
    this.refreshData();
    this.updateDisplay();
  }

  refreshData() {
    // Get current XP for selected skill from selected member
    this.currentXp = 0;
    this.currentLevel = 1;
    if (this.selectedMember) {
      const member = groupData.members.get(this.selectedMember);
      if (member && member.skills) {
        const skillName = SKILL_NAME_MAP[this.selectedSkill];
        const skill = member.skills[skillName];
        if (skill) {
          this.currentXp = skill.xp;
          this.currentLevel = skill.level;
        }
      }
    }

    // Build banked items (filtered by storage selection)
    const levelLimit = this.limitToLevel ? this.currentLevel : -1;
    const result = createBankedItemMap(this.selectedSkill, this.getFilteredMembers(), levelLimit);
    this.bankedItems = result.bankedItems;
    this.linkedMap = result.linkedMap;

    // Sort by name
    this.bankedItems.sort((a, b) => {
      const nameA = this.getItemDisplayName(a.item.itemID);
      const nameB = this.getItemDisplayName(b.item.itemID);
      return nameA.localeCompare(nameB);
    });

    // Restore ignored and activity states from localStorage
    const saved = this.getSavedItemStates();
    for (const bi of this.bankedItems) {
      const key = `${this.selectedSkill}_${bi.item.name}`;
      const state = saved[key];
      if (state) {
        if (state.ignored !== undefined) bi.ignored = state.ignored;
        if (state.activity) {
          const activities = this.getFilteredActivities(bi.item.name);
          const activity = activities.find((a) => a.name === state.activity);
          if (activity) bi.selectedActivity = activity;
        }
      }
    }
    this.linkedMap = rebuildLinkedMap(this.bankedItems);

    // Apply saved modifier states
    this.buildEnabledModifiers();

    // Calculate
    this.recalculate();
  }

  recalculate() {
    this.bankedXpTotal = calculateBankedXpTotal(
      this.bankedItems,
      this.linkedMap,
      this.enabledModifiers,
      this.xpMultiplier,
      this.cascadeEnabled
    );
    const endXp = Math.min(200000000, this.currentXp + this.bankedXpTotal);
    this.endLevel = getLevelForXp(Math.floor(endXp));
  }

  getFilteredActivities(itemName) {
    const all = getActivitiesForItem(itemName);
    if (!this.limitToLevel || this.currentLevel <= 0) return all;
    return all.filter((a) => a.level <= this.currentLevel);
  }

  getFilteredMembers() {
    if (this.storageFilter === "@ALL") return groupData.members;
    const filtered = new Map();
    const member = groupData.members.get(this.storageFilter);
    if (member) filtered.set(this.storageFilter, member);
    return filtered;
  }

  buildEnabledModifiers() {
    this.enabledModifiers = [];
    const skillModifiers = MODIFIERS.filter((m) => m.skill === this.selectedSkill);

    for (let i = 0; i < skillModifiers.length; i++) {
      const mod = skillModifiers[i];
      const key = `${this.selectedSkill}_${i}`;
      const state = this.modifierStates[key];

      if (mod.type === "skillingOutfit") {
        // Outfit: check if any piece enabled
        const pieces = state?.pieces || [false, false, false, false];
        if (pieces.some(Boolean)) {
          this.enabledModifiers.push({ ...mod, _enabledPieces: pieces });
        }
      } else {
        if (state?.enabled) {
          this.enabledModifiers.push(mod);
        }
      }
    }
  }

  updateDisplay() {
    this.recalculate();

    // Update XP summary
    const summary = this.querySelector(".banked-xp__xp-summary");
    if (summary) {
      summary.innerHTML = this.renderXpSummary();
    }

    // Update items
    const grid = this.querySelector(".banked-xp__items-grid");
    if (grid) {
      grid.innerHTML = this.renderItemHeader() + this.renderItemRows();
    }

    const count = this.querySelector(".banked-xp__items-count");
    if (count) {
      count.textContent = `${this.bankedItems.filter((bi) => !bi.ignored).length} items`;
    }

    // Update secondaries
    const secList = this.querySelector(".banked-xp__secondaries-list");
    if (secList) {
      secList.innerHTML = this.renderSecondaries();
    }

    this.bindItemEvents();
    this.bindDynamicEvents();
  }

  bindDynamicEvents() {
    // Rebind member select (it gets replaced when XP summary re-renders)
    const memberSelect = this.querySelector("#banked-xp__member-select");
    if (memberSelect) {
      memberSelect.onchange = () => {
        this.selectedMember = memberSelect.value;
        this.saveState();
        this.refreshData();
        this.updateDisplay();
        this.bindDynamicEvents();
      };
    }

    // Rebind storage filter select
    const storageSelect = this.querySelector("#banked-xp__storage-select");
    if (storageSelect) {
      storageSelect.onchange = () => {
        this.storageFilter = storageSelect.value;
        this.saveState();
        this.refreshData();
        this.updateDisplay();
        this.bindDynamicEvents();
      };
    }
  }

  bindEvents() {
    // Skill tabs
    this.querySelectorAll(".banked-xp__skill-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.selectedSkill = tab.dataset.skill;
        this.saveState();
        this.refreshData();
        this.render();
        this.bindEvents();
      });
    });

    // Cascade toggle
    const cascadeCheckbox = this.querySelector("#banked-xp__cascade");
    if (cascadeCheckbox) {
      cascadeCheckbox.addEventListener("change", () => {
        this.cascadeEnabled = cascadeCheckbox.checked;
        this.saveState();
        this.recalculate();
        this.updateDisplay();
        this.bindDynamicEvents();
      });
    }

    // Limit to level toggle
    const limitLevelCheckbox = this.querySelector("#banked-xp__limit-level");
    if (limitLevelCheckbox) {
      limitLevelCheckbox.addEventListener("change", () => {
        this.limitToLevel = limitLevelCheckbox.checked;
        this.saveState();
        this.refreshData();
        this.updateDisplay();
        this.bindDynamicEvents();
      });
    }

    // XP multiplier
    const multiplierInput = this.querySelector("#banked-xp__multiplier");
    if (multiplierInput) {
      multiplierInput.addEventListener("change", () => {
        this.xpMultiplier = Math.max(1, parseInt(multiplierInput.value) || 1);
        this.saveState();
        this.recalculate();
        this.updateDisplay();
        this.bindDynamicEvents();
      });
    }

    // Modifier checkboxes
    this.querySelectorAll(".banked-xp__modifier-check").forEach((cb) => {
      cb.addEventListener("change", () => {
        const key = cb.dataset.modKey;
        if (!this.modifierStates[key]) this.modifierStates[key] = {};
        this.modifierStates[key].enabled = cb.checked;
        this.saveState();
        this.buildEnabledModifiers();
        this.recalculate();
        this.updateDisplay();
        this.bindDynamicEvents();
      });
    });

    // Outfit piece buttons
    this.querySelectorAll(".banked-xp__modifier-piece").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.modKey;
        const piece = parseInt(btn.dataset.piece);
        if (!this.modifierStates[key]) this.modifierStates[key] = { pieces: [false, false, false, false] };
        if (!this.modifierStates[key].pieces) this.modifierStates[key].pieces = [false, false, false, false];
        this.modifierStates[key].pieces[piece] = !this.modifierStates[key].pieces[piece];
        btn.classList.toggle("active");
        this.saveState();
        this.buildEnabledModifiers();
        this.recalculate();
        this.updateDisplay();
        this.bindDynamicEvents();
      });
    });

    // Ignore all / Include all
    const ignoreAllBtn = this.querySelector("#banked-xp__ignore-all");
    if (ignoreAllBtn) {
      ignoreAllBtn.addEventListener("click", () => {
        this.bankedItems.forEach((bi) => (bi.ignored = true));
        this.saveItemStates();
        this.recalculate();
        this.updateDisplay();
        this.bindDynamicEvents();
      });
    }
    const unignoreAllBtn = this.querySelector("#banked-xp__unignore-all");
    if (unignoreAllBtn) {
      unignoreAllBtn.addEventListener("click", () => {
        this.bankedItems.forEach((bi) => (bi.ignored = false));
        this.saveItemStates();
        this.recalculate();
        this.updateDisplay();
        this.bindDynamicEvents();
      });
    }

    this.bindItemEvents();
    this.bindDynamicEvents();
  }

  bindItemEvents() {
    // Item icon click to toggle ignored
    this.querySelectorAll(".banked-xp__item-icon").forEach((icon) => {
      icon.addEventListener("click", () => {
        const idx = parseInt(icon.dataset.idx);
        const bi = this.bankedItems[idx];
        if (bi) {
          bi.ignored = !bi.ignored;
          this.saveItemStates();
          this.recalculate();
          this.updateDisplay();
          this.bindDynamicEvents();
        }
      });
    });

    // Item name click to toggle ignored
    this.querySelectorAll(".banked-xp__item-name").forEach((nameEl) => {
      nameEl.addEventListener("click", () => {
        const idx = parseInt(nameEl.dataset.idx);
        const bi = this.bankedItems[idx];
        if (bi) {
          bi.ignored = !bi.ignored;
          this.saveItemStates();
          this.recalculate();
          this.updateDisplay();
          this.bindDynamicEvents();
        }
      });
    });

    // Activity selects
    this.querySelectorAll(".banked-xp__activity-select").forEach((select) => {
      select.addEventListener("change", () => {
        const idx = parseInt(select.dataset.idx);
        const bi = this.bankedItems[idx];
        if (bi) {
          const activities = this.getFilteredActivities(bi.item.name);
          const activity = activities.find((a) => a.name === select.value);
          if (activity) {
            bi.selectedActivity = activity;
            this.linkedMap = rebuildLinkedMap(this.bankedItems);
            this.saveItemStates();
            this.recalculate();
            this.updateDisplay();
            this.bindDynamicEvents();
          }
        }
      });
    });
  }

  // ─── localStorage persistence ───

  loadState() {
    try {
      const raw = localStorage.getItem("banked-xp-state");
      if (raw) {
        const state = JSON.parse(raw);
        if (state.selectedSkill) this.selectedSkill = state.selectedSkill;
        if (state.selectedMember) this.selectedMember = state.selectedMember;
        if (state.storageFilter) this.storageFilter = state.storageFilter;
        if (state.cascadeEnabled !== undefined) this.cascadeEnabled = state.cascadeEnabled;
        if (state.limitToLevel !== undefined) this.limitToLevel = state.limitToLevel;
        if (state.xpMultiplier) this.xpMultiplier = state.xpMultiplier;
        if (state.modifierStates) this.modifierStates = state.modifierStates;
      }
    } catch {}
  }

  saveState() {
    try {
      localStorage.setItem(
        "banked-xp-state",
        JSON.stringify({
          selectedSkill: this.selectedSkill,
          selectedMember: this.selectedMember,
          storageFilter: this.storageFilter,
          cascadeEnabled: this.cascadeEnabled,
          limitToLevel: this.limitToLevel,
          xpMultiplier: this.xpMultiplier,
          modifierStates: this.modifierStates,
        })
      );
    } catch {}
  }

  getSavedItemStates() {
    try {
      const raw = localStorage.getItem("banked-xp-items");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  saveItemStates() {
    try {
      const saved = this.getSavedItemStates();
      for (const bi of this.bankedItems) {
        const key = `${this.selectedSkill}_${bi.item.name}`;
        saved[key] = {
          ignored: bi.ignored,
          activity: bi.selectedActivity?.name || null,
        };
      }
      localStorage.setItem("banked-xp-items", JSON.stringify(saved));
    } catch {}
  }

  getItemDisplayName(itemId) {
    try {
      return Item.itemName(itemId);
    } catch {
      return `Item #${itemId}`;
    }
  }

  formatNumber(n) {
    return n.toLocaleString();
  }

  renderSkillTabs() {
    return BANKABLE_SKILLS.map((skill) => {
      const skillName = SKILL_NAME_MAP[skill];
      const icon = Skill.getIcon(skillName);
      const active = this.selectedSkill === skill ? "active" : "";
      const label = skill.charAt(0).toUpperCase() + skill.slice(1);
      return `<button class="banked-xp__skill-tab ${active}" data-skill="${skill}">
        <img loading="lazy" src="${icon}" alt="${label}" />${label}
      </button>`;
    }).join("");
  }

  renderModifiers() {
    const skillModifiers = MODIFIERS.filter((m) => m.skill === this.selectedSkill);
    if (skillModifiers.length === 0) return '<div style="font-size:13px;color:#888;">None for this skill</div>';

    return skillModifiers
      .map((mod, i) => {
        const key = `${this.selectedSkill}_${i}`;

        if (mod.type === "skillingOutfit") {
          const pieces = this.modifierStates[key]?.pieces || [false, false, false, false];
          const pieceIds = OUTFIT_PIECE_IDS[mod.name] || [];
          const pieceLabels = ["Helm", "Top", "Bottom", "Boots"];
          return `<div class="banked-xp__modifier">
          <div class="banked-xp__modifier-row" style="font-size:15px;margin-bottom:4px;">${mod.name}</div>
          <div class="banked-xp__modifier-pieces">
            ${pieceLabels
              .map((label, pi) => {
                const imgSrc = pieceIds[pi] ? `/icons/items/${pieceIds[pi]}.webp` : "";
                return `<button class="banked-xp__modifier-piece ${
                  pieces[pi] ? "active" : ""
                }" data-mod-key="${key}" data-piece="${pi}" title="${label}">${
                  imgSrc ? `<img loading="lazy" src="${imgSrc}" alt="${label}" />` : label
                }</button>`;
              })
              .join("")}
          </div>
        </div>`;
        }

        const checked = this.modifierStates[key]?.enabled ? "checked" : "";
        const tooltipHtml = mod.tooltip ? `<div class="banked-xp__modifier-tooltip">${mod.tooltip}</div>` : "";
        return `<div class="banked-xp__modifier">
        <div class="banked-xp__modifier-row">
          <input type="checkbox" class="banked-xp__modifier-check" id="mod_${key}" data-mod-key="${key}" ${checked} />
          <label for="mod_${key}">${mod.name}</label>
        </div>
        ${tooltipHtml}
      </div>`;
      })
      .join("");
  }

  renderSecondaries() {
    const needed = calculateSecondaries(this.bankedItems, this.linkedMap, this.cascadeEnabled);
    if (needed.size === 0) return '<div style="font-size:13px;color:#888;">None needed</div>';

    const entries = [...needed.entries()];
    return entries
      .map(([itemId, info]) => {
        const name = this.getItemDisplayName(itemId);
        const imgSrc = Item.itemDetails[itemId] ? `/icons/items/${itemId}.webp` : "";
        return `<div class="banked-xp__secondary-item">
        ${imgSrc ? `<img loading="lazy" src="${imgSrc}" alt="${name}" />` : ""}
        <span>${name}</span>
        <span class="banked-xp__secondary-qty">x${this.formatNumber(info.qty)}</span>
      </div>`;
      })
      .join("");
  }

  renderXpSummary() {
    const endXp = Math.min(200000000, this.currentXp + this.bankedXpTotal);
    const members = [...groupData.members.values()];

    return `
      <div class="banked-xp__xp-row" style="width:100%;margin-bottom:4px;gap:10px;flex-wrap:wrap;">
        <span style="display:inline-flex;align-items:center;gap:4px;">
          <label for="banked-xp__member-select" style="color:#ccc;">Player:</label>
          <select id="banked-xp__member-select" style="background:var(--elevated);border:1px solid var(--light-border);color:var(--primary-text);font-family:rssmall;font-size:13px;padding:2px;border-radius:3px;text-shadow:1px 1px var(--black);cursor:pointer;">
            ${members
              .map(
                (m) =>
                  `<option value="${m.name}" ${m.name === this.selectedMember ? "selected" : ""}>${m.name}</option>`
              )
              .join("")}
          </select>
        </span>
        <span style="display:inline-flex;align-items:center;gap:4px;">
          <label for="banked-xp__storage-select" style="color:#ccc;">Storage:</label>
          <select id="banked-xp__storage-select" style="background:var(--elevated);border:1px solid var(--light-border);color:var(--primary-text);font-family:rssmall;font-size:13px;padding:2px;border-radius:3px;text-shadow:1px 1px var(--black);cursor:pointer;">
            <option value="@ALL" ${this.storageFilter === "@ALL" ? "selected" : ""}>All</option>
            ${members
              .map(
                (m) => `<option value="${m.name}" ${m.name === this.storageFilter ? "selected" : ""}>${m.name}</option>`
              )
              .join("")}
          </select>
        </span>
      </div>
      <div class="banked-xp__xp-row">
        <span class="banked-xp__xp-label">Current XP:</span>
        <span class="banked-xp__xp-value">${this.formatNumber(this.currentXp)}</span>
      </div>
      <div class="banked-xp__xp-row">
        <span class="banked-xp__xp-label">Banked XP:</span>
        <span class="banked-xp__xp-value" style="color: var(--green)">${this.formatNumber(
          Math.floor(this.bankedXpTotal)
        )}</span>
      </div>
      <div class="banked-xp__xp-row">
        <span class="banked-xp__xp-label">End XP:</span>
        <span class="banked-xp__xp-value">${this.formatNumber(Math.floor(endXp))}</span>
      </div>
      <div class="banked-xp__xp-row">
        <span class="banked-xp__xp-label">Current Level:</span>
        <span class="banked-xp__xp-value">${this.currentLevel}</span>
      </div>
      <div class="banked-xp__xp-row">
        <span class="banked-xp__xp-label">End Level:</span>
        <span class="banked-xp__xp-value" style="color: ${
          this.endLevel > this.currentLevel ? "var(--green)" : "inherit"
        }">${this.endLevel}</span>
      </div>
    `;
  }

  renderItems() {
    if (this.bankedItems.length === 0) {
      return '<div class="banked-xp__no-items">No banked items found for this skill</div>';
    }

    return this.renderItemHeader() + this.renderItemRows();
  }

  renderItemHeader() {
    return `<div class="banked-xp__item-header">
      <span></span>
      <span>Item</span>
      <span>Activity</span>
      <span>Qty</span>
      <span>XP</span>
    </div>`;
  }

  renderItemRows() {
    return this.bankedItems
      .map((bi, idx) => {
        const name = this.getItemDisplayName(bi.item.itemID);
        const imgSrc = Item.itemDetails[bi.item.itemID]
          ? Item.imageUrl(bi.item.itemID, 1)
          : `/icons/items/${bi.item.itemID}.webp`;
        const activities = this.getFilteredActivities(bi.item.name);
        const effectiveQty = getItemQty(bi, this.linkedMap, this.bankedItems, this.cascadeEnabled);
        // Hide items with no bank qty and no cascaded qty (empty linked targets)
        if (effectiveQty <= 0 && bi.qty <= 0) return "";
        const xpRate = bi.selectedActivity
          ? getActivityXpRate(bi.selectedActivity, this.enabledModifiers) * this.xpMultiplier
          : 0;
        const totalXp = Math.floor(effectiveQty * xpRate);
        const ignoredClass = bi.ignored ? "ignored" : "";

        const activityOptions = activities
          .map((a) => {
            const selected = bi.selectedActivity && bi.selectedActivity.name === a.name ? "selected" : "";
            return `<option value="${a.name}" ${selected}>${a.displayName} (${a.xp}xp, lvl ${a.level})</option>`;
          })
          .join("");

        return `<div class="banked-xp__item ${ignoredClass}">
        <img loading="lazy" class="banked-xp__item-icon" data-idx="${idx}" src="${imgSrc}" alt="${name}" title="Click to ${
          bi.ignored ? "include" : "ignore"
        }" />
        <span class="banked-xp__item-name" data-idx="${idx}" title="${name}">${name}</span>
        <div class="banked-xp__item-activity">
          ${
            activities.length > 0
              ? `<select class="banked-xp__activity-select" data-idx="${idx}">${activityOptions}</select>`
              : "<span style='color:#888'>—</span>"
          }
        </div>
        <span class="banked-xp__item-qty">${this.formatNumber(effectiveQty)}</span>
        <span class="banked-xp__item-xp">${this.formatNumber(totalXp)}</span>
      </div>`;
      })
      .join("");
  }
}

customElements.define("banked-xp-page", BankedXpPage);
