import { BaseElement } from "../base-element/base-element";
import { Item } from "../data/item";
import { Quest } from "../data/quest";
import { api } from "../data/api";
import { storage } from "../data/storage";
import { pubsub } from "../data/pubsub";
import { loadingScreenManager } from "../loading-screen/loading-screen-manager";
import { exampleData } from "../data/example-data";
import { AchievementDiary } from "../data/diaries";
import { groupData } from "../data/group-data";
import { memberSelectDialogManager } from "../member-select-dialog/member-select-dialog-manager";

export class AppInitializer extends BaseElement {
  constructor() {
    super();
  }

  html() {
    return `{{app-initializer.html}}`;
  }

  connectedCallback() {
    super.connectedCallback();
    this.initializeApp();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanup();
  }

  cleanup(): void {
    api.disable();
    // Unpublish everything to prevent any data leaking over into another session
    pubsub.unpublishAll();
    exampleData.disable();
    api.exampleDataEnabled = false;
    loadingScreenManager.hideLoadingScreen();
  }

  async initializeApp(): Promise<void> {
    this.cleanup();
    loadingScreenManager.showLoadingScreen();
    await Promise.all([Item.loadItems(), Item.loadGePrices(), Quest.loadQuests(), AchievementDiary.loadDiaries()]);
    const group = storage.getGroup();

    // Make sure this component is still connected after loading the above. We don't want to start
    // making requests for group data if the user navigated away before the preload completed.
    if (this.isConnected) {
      if (!group) {
        window.history.pushState("", "", "/login");
        loadingScreenManager.hideLoadingScreen();
        return;
      }

      if (group.groupName === "@EXAMPLE") {
        await this.loadExampleData();
      } else {
        await this.loadGroup(group);
      }

      // Ask the user to identify themselves if not already set
      if (this.isConnected && group.groupName !== "@EXAMPLE") {
        await this.ensureActiveMember(group.groupName);
      }

      loadingScreenManager.hideLoadingScreen();
    }
  }

  async loadExampleData(): Promise<void> {
    exampleData.enable();
    api.exampleDataEnabled = true;
    await api.enable();
  }

  async loadGroup(group: { groupName: string; groupToken: string }): Promise<void> {
    const firstDataEvent = pubsub.waitUntilNextEvent("get-group-data", false);
    await api.enable(group.groupName, group.groupToken);
    await firstDataEvent;
  }

  async ensureActiveMember(groupName: string): Promise<void> {
    const members = [...groupData.members.values()]
      .map((m) => m.name)
      .filter((n) => n !== "@SHARED");

    if (members.length === 0) return;

    const saved = storage.getActiveMember();
    if (saved && members.includes(saved)) {
      pubsub.publish("active-member-changed", saved);
      return;
    }

    // Need to ask the user
    loadingScreenManager.hideLoadingScreen();
    const selected = await memberSelectDialogManager.selectMember(members);
    storage.setActiveMember(selected);
    pubsub.publish("active-member-changed", selected);
  }
}

customElements.define("app-initializer", AppInitializer);
