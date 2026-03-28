import { pubsub } from "./pubsub";
import { utility } from "../utility";
import { groupData } from "./group-data";
import { exampleData } from "./example-data";
import { captchaEnabledSchema, createGroupRequestSchema } from "../validators";

type LiveUpdateHandle = Promise<number | void> | undefined;
type SkillDataPeriod = "Day" | "Week" | "Month" | "Year";

export class Api {
  baseUrl: string;
  createGroupUrl: string;
  exampleDataEnabled: boolean;
  enabled: boolean;
  groupName?: string;
  groupToken?: string;
  nextCheck!: string;
  groupDataSyncInFlight = false;
  groupDataSyncQueued = false;
  usingIntervalUpdates = false;
  liveUpdateHandle: LiveUpdateHandle;
  groupEventsAbortController?: AbortController;
  groupEventsTask?: Promise<void>;
  constructor() {
    this.baseUrl = "/api";
    this.createGroupUrl = `${this.baseUrl}/create-group`;
    this.exampleDataEnabled = false;
    this.enabled = false;
  }

  get getGroupDataUrl() {
    return `${this.baseUrl}/group/${this.groupName}/get-group-data`;
  }

  get groupEventsUrl() {
    return `${this.baseUrl}/group/${this.groupName}/group-events`;
  }

  get addMemberUrl() {
    return `${this.baseUrl}/group/${this.groupName}/add-group-member`;
  }

  get deleteMemberUrl() {
    return `${this.baseUrl}/group/${this.groupName}/delete-group-member`;
  }

  get renameMemberUrl() {
    return `${this.baseUrl}/group/${this.groupName}/rename-group-member`;
  }

  get amILoggedInUrl() {
    return `${this.baseUrl}/group/${this.groupName}/am-i-logged-in`;
  }

  get gePricesUrl() {
    return `${this.baseUrl}/ge-prices`;
  }

  get skillDataUrl() {
    return `${this.baseUrl}/group/${this.groupName}/get-skill-data`;
  }

  get captchaEnabledUrl() {
    return `${this.baseUrl}/captcha-enabled`;
  }

  get collectionLogInfoUrl() {
    return `${this.baseUrl}/collection-log-info`;
  }

  setCredentials(groupName?: string, groupToken?: string) {
    this.groupName = groupName;
    this.groupToken = groupToken;
  }

  authHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    if (!this.groupToken) {
      return extraHeaders;
    }

    return {
      ...extraHeaders,
      Authorization: this.groupToken,
    };
  }

  async restart() {
    const groupName = this.groupName;
    const groupToken = this.groupToken;
    await this.enable(groupName, groupToken);
  }

  async enable(groupName?: string, groupToken?: string) {
    await this.disable();
    this.nextCheck = new Date(0).toISOString();
    this.setCredentials(groupName, groupToken);
    this.groupDataSyncInFlight = false;
    this.groupDataSyncQueued = false;
    this.usingIntervalUpdates = this.exampleDataEnabled;

    if (!this.enabled) {
      this.enabled = true;
      // liveUpdateHandle is a Promise so we can make sure this method does not leak
      // any intervals or SSE connections with multiple calls to .enable(). This could be
      // possible because of the wait for the item and quest data loads before we start.
      this.liveUpdateHandle = pubsub.waitForAllEvents("item-data-loaded", "quest-data-loaded").then(() => {
        if (!this.enabled) {
          return undefined;
        }

        if (this.exampleDataEnabled) {
          return utility.callOnInterval(this.getGroupData.bind(this), 1000);
        }

        this.startGroupEvents();
        return undefined;
      });
    }

    await this.liveUpdateHandle;
  }

  async disable() {
    this.enabled = false;
    const pendingHandle = this.liveUpdateHandle;
    this.liveUpdateHandle = undefined;
    this.groupName = undefined;
    this.groupToken = undefined;
    this.groupDataSyncQueued = false;
    groupData.members = new Map();
    groupData.groupItems = {};
    groupData.textFilters = [""];

    if (this.groupEventsAbortController) {
      this.groupEventsAbortController.abort();
      this.groupEventsAbortController = undefined;
    }

    if (pendingHandle && this.usingIntervalUpdates) {
      const liveUpdateHandle = await pendingHandle;
      if (typeof liveUpdateHandle === "number") {
        window.clearInterval(liveUpdateHandle);
      }
    }

    this.groupEventsTask = undefined;
    this.liveUpdateHandle = undefined;
    this.usingIntervalUpdates = false;
  }

  async triggerGroupDataSync() {
    if (!this.enabled) {
      return;
    }

    if (this.groupDataSyncInFlight) {
      this.groupDataSyncQueued = true;
      return;
    }

    this.groupDataSyncInFlight = true;
    try {
      do {
        this.groupDataSyncQueued = false;
        await this.getGroupData();
      } while (this.enabled && this.groupDataSyncQueued);
    } finally {
      this.groupDataSyncInFlight = false;
    }
  }

  startGroupEvents() {
    this.groupEventsAbortController = new AbortController();
    this.groupEventsTask = this.runGroupEventsLoop(this.groupEventsAbortController.signal);
  }

  async runGroupEventsLoop(signal: AbortSignal) {
    while (this.enabled && !signal.aborted) {
      try {
        const response = await fetch(this.groupEventsUrl, {
          cache: "no-store",
          headers: this.authHeaders({
            Accept: "text/event-stream",
          }),
          signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            await this.disable();
            window.history.pushState("", "", "/login");
            pubsub.publish("get-group-data");
            return;
          }

          throw new Error(`Failed to subscribe to group events: ${response.status}`);
        }

        await this.triggerGroupDataSync();
        await this.consumeGroupEvents(response, signal);
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        console.error(error);
      }

      await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
    }
  }

  async consumeGroupEvents(response: Response, signal: AbortSignal) {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Group event stream did not include a readable body.");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (this.enabled && !signal.aborted) {
      const { value, done } = await reader.read();
      if (done) {
        return;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      buffer = this.processGroupEventBuffer(buffer);
    }
  }

  processGroupEventBuffer(buffer: string) {
    let startIdx = 0;
    let eventBoundary = buffer.indexOf("\n\n");

    while (eventBoundary !== -1) {
      const rawEvent = buffer.substring(startIdx, eventBoundary);

      if (rawEvent.includes("data:")) {
        this.triggerGroupDataSync();
      }

      startIdx = eventBoundary + 2;
      eventBoundary = buffer.indexOf("\n\n", startIdx);
    }

    return startIdx === 0 ? buffer : buffer.substring(startIdx);
  }

  async getGroupData() {
    const nextCheck = this.nextCheck;

    if (this.exampleDataEnabled) {
      const newGroupData = exampleData.getGroupData();
      groupData.update(newGroupData);
      pubsub.publish("get-group-data", groupData);
    } else {
      const response = await fetch(`${this.getGroupDataUrl}?from_time=${nextCheck}`, {
        headers: this.authHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          await this.disable();
          window.history.pushState("", "", "/login");
          pubsub.publish("get-group-data");
        }
        return;
      }

      const newGroupData = await response.json();
      this.nextCheck = groupData.update(newGroupData).toISOString();
      pubsub.publish("get-group-data", groupData);
    }
  }

  async createGroup(groupName: string, memberNames: string[], captchaResponse: string) {
    const requestPayload = createGroupRequestSchema.parse({
      name: groupName,
      member_names: memberNames,
      captcha_response: captchaResponse,
    });

    const response = await fetch(this.createGroupUrl, {
      body: JSON.stringify(requestPayload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    return response;
  }

  async addMember(memberName: string | undefined) {
    const response = await fetch(this.addMemberUrl, {
      body: JSON.stringify({ name: memberName }),
      headers: this.authHeaders({
        "Content-Type": "application/json",
      }),
      method: "POST",
    });

    return response;
  }

  async removeMember(memberName: string | undefined) {
    const response = await fetch(this.deleteMemberUrl, {
      body: JSON.stringify({ name: memberName }),
      headers: this.authHeaders({
        "Content-Type": "application/json",
      }),
      method: "DELETE",
    });

    return response;
  }

  async renameMember(originalName: string, newName: string) {
    const response = await fetch(this.renameMemberUrl, {
      body: JSON.stringify({ original_name: originalName, new_name: newName }),
      headers: this.authHeaders({
        "Content-Type": "application/json",
      }),
      method: "PUT",
    });

    return response;
  }

  async amILoggedIn() {
    const response = await fetch(this.amILoggedInUrl, {
      headers: this.authHeaders(),
    });

    return response;
  }

  async getGePrices() {
    const response = await fetch(this.gePricesUrl);
    return response;
  }

  async getSkillData(period: SkillDataPeriod) {
    if (this.exampleDataEnabled) {
      const skillData = exampleData.getSkillData(period, groupData);
      return skillData;
    } else {
      const response = await fetch(`${this.skillDataUrl}?period=${period}`, {
        headers: this.authHeaders(),
      });
      return response.json();
    }
  }

  async getCaptchaEnabled() {
    const response = await fetch(this.captchaEnabledUrl);
    return captchaEnabledSchema.parse(await response.json());
  }
}

const api = new Api();

export { api };
