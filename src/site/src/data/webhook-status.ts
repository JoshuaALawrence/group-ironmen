import { storage } from "./storage";

class WebhookStatus {
  hasWebhook = false;
  private fetched = false;
  private fetching = false;

  async fetch(): Promise<void> {
    if (this.fetching) return;
    this.fetching = true;
    try {
      const group = storage.getGroup();
      if (!group || group.groupName === "@EXAMPLE") {
        this.hasWebhook = false;
        this.fetched = true;
        return;
      }
      const headers: Record<string, string> = {};
      if (group.groupToken) {
        headers["Authorization"] = group.groupToken;
      }
      const res = await fetch(`/api/group/${group.groupName}/discord-settings`, { headers });
      if (res.ok) {
        const data = await res.json();
        this.hasWebhook = !!data.has_webhook;
      }
      this.fetched = true;
    } catch {
      /* ignore */
    } finally {
      this.fetching = false;
    }
  }

  async ensure(): Promise<void> {
    if (!this.fetched) await this.fetch();
  }
}

const webhookStatus = new WebhookStatus();

export { webhookStatus };
