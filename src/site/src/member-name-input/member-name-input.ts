import { MenInput } from "../men-input/men-input";
import { memberNameSchema, validationErrorFromSchema } from "../validators";

export class MemberNameInput extends MenInput {
  memberNumber = 0;

  connectedCallback(): void {
    this.memberNumber = parseInt(this.getAttribute("member-number") ?? "0", 10);
    this.setAttribute("placeholder-text", "Player name");
    this.setAttribute("input-id", `member-name${this.memberNumber}`);
    this.setAttribute("input-label", `Name of member ${this.memberNumber}`);
    this.setAttribute("no-trim", "true");
    this.validators = [(value) => validationErrorFromSchema(memberNameSchema, value)];
    super.connectedCallback();
  }
}

customElements.define("member-name-input", MemberNameInput);