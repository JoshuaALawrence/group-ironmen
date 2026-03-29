import { BaseElement } from "../base-element/base-element";
import { api } from "../data/api";
import { storage } from "../data/storage";
import { createGroupResponseSchema, groupNameSchema, validationErrorFromSchema } from "../validators";
import { loadingScreenManager } from "../loading-screen/loading-screen-manager";

declare global {
  interface Window {
    hcaptcha?: {
      render(container: string, options: { sitekey: string; theme: string }): string | number;
      getResponse(widgetId?: string | number): string;
    };
    menCaptchaLoaded?: () => void;
  }
}

type MenInputElement = HTMLElement & {
  validators?: Array<(value: string | undefined) => string | null>;
  valid: boolean;
  value: string | undefined;
};

export class CreateGroup extends BaseElement {
  groupName!: MenInputElement;
  serverError!: HTMLElement;
  captchaEnabled = false;
  sitekey = "";
  captchaWidgetID?: string | number;

  html(): string {
    return `{{create-group.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    loadingScreenManager.showLoadingScreen();
    void this.initCaptcha().then(() => {
      loadingScreenManager.hideLoadingScreen();
      if (!this.isConnected) {
        return;
      }

      this.render();
      const groupName = this.querySelector(".create-group__name");
      const serverError = this.querySelector(".create-group__server-error");
      const memberCountSelect = this.querySelector("#group-member-count");
      const submitButton = this.querySelector(".create-group__submit");
      if (!(groupName instanceof HTMLElement) || !(serverError instanceof HTMLElement) || !memberCountSelect || !submitButton) {
        return;
      }

      this.groupName = groupName as MenInputElement;
      this.groupName.validators = [(value) => validationErrorFromSchema(groupNameSchema, value)];
      this.serverError = serverError;

      this.eventListener(memberCountSelect, "change", this.handleMemberCountChange.bind(this));
      this.eventListener(submitButton, "click", this.createGroup.bind(this));

      if (this.captchaEnabled && window.hcaptcha) {
        this.captchaWidgetID = window.hcaptcha.render("create-group__step-captcha", {
          sitekey: this.sitekey,
          theme: "dark",
        });
      }
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    // NOTE: For some reason hcaptcha only works on the first widget so we have to just
    // destroy it after we leave and import again later.
    if (this.captchaEnabled) {
      document.getElementById("hcaptcha")?.remove();
      window.hcaptcha = undefined;
    }
  }

  resetMembersSection(): void {
    const membersSection = this.querySelector(".create-group__member-inputs");
    if (membersSection instanceof HTMLElement) {
      membersSection.innerHTML = "";
    }
  }

  get memberNameInputs(): MenInputElement[] {
    return Array.from(this.querySelectorAll(".create-group__member-inputs member-name-input")) as MenInputElement[];
  }

  validateMemberNames(): boolean {
    const inputs = this.memberNameInputs;
    let allValid = true;
    for (const input of inputs) {
      if (!input.valid) {
        allValid = false;
      }
    }

    return allValid;
  }

  displayMembersSection(memberCount: number): void {
    this.resetMembersSection();
    const membersSection = this.querySelector(".create-group__member-inputs");
    const membersStep = this.querySelector(".create-group__step-members");
    const submitButton = this.querySelector(".create-group__submit");
    if (!(membersSection instanceof HTMLElement) || !(membersStep instanceof HTMLElement) || !(submitButton instanceof HTMLElement)) {
      return;
    }

    const memberInputEls = document.createDocumentFragment();
    for (let index = 0; index < memberCount; ++index) {
      const memberInput = document.createElement("member-name-input");
      memberInput.setAttribute("member-number", String(index + 1));
      memberInputEls.appendChild(memberInput);
    }

    membersSection.innerHTML = "";
    membersSection.appendChild(memberInputEls);
    membersStep.style.display = "block";
    submitButton.style.display = "block";
  }

  handleMemberCountChange(evt: Event): void {
    const target = evt.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const memberCount = parseInt(target.value, 10);
    this.displayMembersSection(memberCount);
  }

  async createGroup(): Promise<void> {
    this.serverError.textContent = "";
    if (!this.groupName.valid || !this.validateMemberNames()) {
      return;
    }

    let captchaResponse = "";
    if (this.captchaEnabled) {
      captchaResponse = window.hcaptcha?.getResponse(this.captchaWidgetID) ?? "";
      if (!captchaResponse) {
        this.serverError.textContent = "Complete the captcha";
        return;
      }
    }

    const groupName = this.groupName.value ?? "";
    const memberInputs = this.memberNameInputs;
    const memberNames: string[] = [];
    for (const input of memberInputs) {
      memberNames.push(input.value ?? "");
    }

    for (let index = memberNames.length; index < 5; ++index) {
      memberNames.push("");
    }

    const submitBtn = this.querySelector(".create-group__submit");
    if (!(submitBtn instanceof HTMLButtonElement)) {
      return;
    }

    try {
      submitBtn.disabled = true;
      const result = await api.createGroup(groupName, memberNames, captchaResponse);
      if (!result.ok) {
        const message = await result.text();
        this.serverError.textContent = `Error creating group: ${message}`;
      } else {
        const createdGroup = createGroupResponseSchema.parse(await result.json());
        storage.storeGroup(createdGroup.name, createdGroup.token);
        window.history.pushState("", "", "/setup-instructions");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.serverError.textContent = `Error creating group: ${message}`;
    } finally {
      submitBtn.disabled = false;
    }
  }

  async initCaptcha(): Promise<void> {
    const captchaEnabled = await api.getCaptchaEnabled();
    this.captchaEnabled = captchaEnabled.enabled;
    this.sitekey = captchaEnabled.sitekey;

    if (this.captchaEnabled) {
      await this.waitForCaptchaScript();
    }
  }

  waitForCaptchaScript(): Promise<void> {
    return new Promise((resolve) => {
      if (document.getElementById("hcaptcha")) {
        resolve();
        return;
      }

      window.menCaptchaLoaded = () => resolve();
      const script = document.createElement("script");
      script.id = "hcaptcha";
      script.src = "https://js.hcaptcha.com/1/api.js?render=explicit&onload=menCaptchaLoaded";
      document.body.appendChild(script);
    });
  }
}

customElements.define("create-group", CreateGroup);