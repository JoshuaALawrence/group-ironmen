import { BaseElement } from "../base-element/base-element";
import { storage } from "../data/storage";
import { api } from "../data/api";
import { loginFieldSchema, validationErrorFromSchema } from "../validators";

type MenInputElement = HTMLElement & {
  validators?: Array<(value: string | undefined) => string | null>;
  valid: boolean;
  value: string | undefined;
};

export class LoginPage extends BaseElement {
  name!: MenInputElement;
  token!: MenInputElement;
  loginButton!: HTMLButtonElement;
  error!: HTMLElement;

  html(): string {
    return `{{login-page.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();

    const name = this.querySelector(".login__name");
    const token = this.querySelector(".login__token");
    const loginButton = this.querySelector(".login__button");
    const error = this.querySelector(".login__error");
    if (!(name instanceof HTMLElement) || !(token instanceof HTMLElement) || !(loginButton instanceof HTMLButtonElement) || !(error instanceof HTMLElement)) {
      return;
    }

    this.name = name as MenInputElement;
    this.name.validators = [(value) => validationErrorFromSchema(loginFieldSchema, value)];
    this.token = token as MenInputElement;
    this.token.validators = [(value) => validationErrorFromSchema(loginFieldSchema, value)];
    this.loginButton = loginButton;
    this.error = error;
    this.eventListener(this.loginButton, "click", this.login.bind(this));
  }

  async login(): Promise<void> {
    if (!this.name.valid || !this.token.valid) {
      return;
    }

    try {
      this.error.textContent = "";
      this.loginButton.disabled = true;
      const name = this.name.value ?? "";
      const token = this.token.value ?? "";
      api.setCredentials(name, token);
      const response = await api.amILoggedIn();
      if (response.ok) {
        storage.storeGroup(name, token);
        window.history.pushState("", "", "/group");
      } else if (response.status === 401) {
        this.error.textContent = "Group name or token is incorrect";
      } else {
        const body = await response.text();
        this.error.textContent = `Unable to login ${body}`;
      }
    } catch (error) {
      this.error.textContent = `Unable to login ${error}`;
    } finally {
      this.loginButton.disabled = false;
    }
  }
}

customElements.define("login-page", LoginPage);