import { BaseElement } from "../base-element/base-element";
import { api } from "../data/api";
import { loadingScreenManager } from "../loading-screen/loading-screen-manager";
import { pubsub } from "../data/pubsub";
import { confirmDialogManager } from "../confirm-dialog/confirm-dialog-manager";

type MemberSummary = {
  name: string;
};

type MenInputElement = HTMLElement & {
  valid: boolean;
  value: string | undefined;
};

export class EditMember extends BaseElement {
  input!: MenInputElement;
  error!: HTMLElement;
  member?: MemberSummary;
  memberNumber?: number;

  html(): string {
    return `{{edit-member.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();

    const input = this.querySelector("member-name-input");
    const error = this.querySelector(".edit-member__error");
    const renameButton = this.querySelector(".edit-member__rename");
    const removeButton = this.querySelector(".edit-member__remove");
    const addButton = this.querySelector(".edit-member__add");
    if (!(input instanceof HTMLElement) || !(error instanceof HTMLElement)) {
      return;
    }

    this.input = input as MenInputElement;
    this.error = error;

    if (renameButton) {
      this.eventListener(renameButton, "click", this.renameMember.bind(this));
    }
    if (removeButton) {
      this.eventListener(removeButton, "click", this.removeMember.bind(this));
    }
    if (addButton) {
      this.eventListener(addButton, "click", this.addMember.bind(this));
    }
  }

  hideError(): void {
    this.error.textContent = "";
  }

  showError(message: string): void {
    this.error.textContent = message;
  }

  async renameMember(): Promise<void> {
    this.hideError();
    if (!this.input.valid || !this.member) {
      return;
    }

    const originalName = this.member.name;
    const newName = this.input.value ?? "";
    if (originalName === newName) {
      this.showError("New name is the same as the old name");
      return;
    }

    try {
      loadingScreenManager.showLoadingScreen();
      const result = await api.renameMember(originalName, newName);
      if (result.ok) {
        await api.restart();
        await pubsub.waitUntilNextEvent("get-group-data", false);
      } else {
        const message = await result.text();
        this.showError(`Failed to rename member ${message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showError(`Failed to rename member ${message}`);
    } finally {
      loadingScreenManager.hideLoadingScreen();
    }
  }

  removeMember(): void {
    this.hideError();
    if (!this.member) {
      return;
    }

    confirmDialogManager.confirm({
      headline: `Delete ${this.member.name}?`,
      body: "All player data will be lost and cannot be recovered.",
      yesCallback: async () => {
        try {
          loadingScreenManager.showLoadingScreen();
          const result = await api.removeMember(this.member?.name);
          if (result.ok) {
            await api.restart();
            await pubsub.waitUntilNextEvent("get-group-data", false);
          } else {
            const message = await result.text();
            this.showError(`Failed to remove member ${message}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.showError(`Failed to remove member ${message}`);
        } finally {
          loadingScreenManager.hideLoadingScreen();
        }
      },
      noCallback: () => {},
    });
  }

  async addMember(): Promise<void> {
    this.hideError();
    if (!this.input.valid) {
      return;
    }

    try {
      loadingScreenManager.showLoadingScreen();
      const result = await api.addMember(this.input.value);
      if (result.ok) {
        await api.restart();
        await pubsub.waitUntilNextEvent("get-group-data", false);
      } else {
        const message = await result.text();
        this.showError(`Failed to add member ${message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showError(`Failed to add member ${message}`);
    } finally {
      loadingScreenManager.hideLoadingScreen();
    }
  }
}

customElements.define("edit-member", EditMember);