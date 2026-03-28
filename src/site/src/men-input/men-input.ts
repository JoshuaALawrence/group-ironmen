import { BaseElement } from "../base-element/base-element";

type Validator = (value: string | undefined) => string | null;

export class MenInput extends BaseElement {
  noTrim = false;
  input!: HTMLInputElement;
  validationError!: HTMLElement;
  validators?: Validator[];

  html(): string {
    const id = this.getAttribute("input-id");
    const placeholder = this.getAttribute("placeholder-text");
    const label = this.getAttribute("input-label");
    const isPassword = this.hasAttribute("type-password");
    const maxLength = parseInt(this.getAttribute("max-length") ?? "", 10) || 16;
    return `{{men-input.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.noTrim = this.hasAttribute("no-trim");
    const input = this.querySelector("input");
    const validationError = this.querySelector(".validation-error");
    if (!(input instanceof HTMLInputElement) || !(validationError instanceof HTMLElement)) {
      return;
    }

    this.input = input;
    const initialValue = this.trim(this.getAttribute("input-value"));
    if (initialValue) {
      this.input.value = initialValue;
    }

    this.validationError = validationError;
    this.eventListener(this.input, "blur", this.handleBlurEvent.bind(this));
  }

  trim(value: string | null | undefined): string | undefined {
    if (value == null) {
      return value ?? undefined;
    }

    if (this.noTrim) {
      return value;
    }

    return value.trim();
  }

  handleBlurEvent(): void {
    this.updateValueAndValidity();
  }

  makeInvalid(invalidReason: string): void {
    this.input.classList.add("invalid");
    this.validationError.innerHTML = invalidReason;
  }

  makeValid(): void {
    this.input.classList.remove("invalid");
    this.validationError.innerHTML = "";
  }

  get value(): string | undefined {
    return this.trim(this.input.value);
  }

  get valid(): boolean {
    return this.updateValueAndValidity();
  }

  updateValueAndValidity(): boolean {
    this.input.value = this.trim(this.input.value) ?? "";
    if (this.validators) {
      for (const validator of this.validators) {
        const invalidReason = validator(this.input.value);
        if (invalidReason) {
          this.makeInvalid(invalidReason);
          return false;
        }
      }
    }

    this.makeValid();
    return true;
  }
}

customElements.define("men-input", MenInput);