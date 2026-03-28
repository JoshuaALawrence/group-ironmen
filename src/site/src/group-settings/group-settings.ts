import { BaseElement } from "../base-element/base-element";
import { appearance } from "../appearance";

type MemberSummary = {
  name: string;
};

type EditMemberElement = HTMLElement & {
  member?: MemberSummary;
  memberNumber?: number;
};

export class GroupSettings extends BaseElement {
  memberSection: HTMLElement | null = null;
  panelDockSide: HTMLElement | null = null;
  appearanceStyle: HTMLElement | null = null;

  html(): string {
    const selectedPanelDockSide = appearance.getLayout();
    const style = appearance.getTheme();
    return `{{group-settings.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.memberSection = this.querySelector(".group-settings__members");
    this.panelDockSide = this.querySelector(".group-settings__panels");
    this.appearanceStyle = this.querySelector(".group-settings__style");
    this.subscribe("members-updated", this.handleUpdatedMembers.bind(this));
    if (this.panelDockSide) {
      this.eventListener(this.panelDockSide, "change", this.handlePanelDockSideChange.bind(this));
    }
    if (this.appearanceStyle) {
      this.eventListener(this.appearanceStyle, "change", this.handleStyleChange.bind(this));
    }
  }

  handleStyleChange(): void {
    const styleInput = this.querySelector<HTMLInputElement>('input[name="appearance-style"]:checked');
    if (!styleInput) {
      return;
    }

    appearance.setTheme(styleInput.value);
  }

  handlePanelDockSideChange(): void {
    const sideInput = this.querySelector<HTMLInputElement>('input[name="panel-dock-side"]:checked');
    if (!sideInput) {
      return;
    }

    if (sideInput.value === "right") {
      appearance.setLayout("row-reverse");
    } else {
      appearance.setLayout("row");
    }
  }

  handleUpdatedMembers(members: unknown): void {
    if (!Array.isArray(members) || !this.memberSection) {
      return;
    }

    const filteredMembers = members.filter(
      (member): member is MemberSummary =>
        typeof member === "object" && member !== null && "name" in member && (member as MemberSummary).name !== "@SHARED"
    );

    const memberEdits = document.createDocumentFragment();
    for (let index = 0; index < filteredMembers.length; ++index) {
      const member = filteredMembers[index];
      const memberEdit = document.createElement("edit-member") as EditMemberElement;
      memberEdit.member = member;
      memberEdit.memberNumber = index + 1;

      memberEdits.appendChild(memberEdit);
    }

    if (filteredMembers.length < 5) {
      const addMember = document.createElement("edit-member") as EditMemberElement;
      addMember.memberNumber = filteredMembers.length + 1;
      memberEdits.appendChild(addMember);
    }

    this.memberSection.innerHTML = "";
    this.memberSection.appendChild(memberEdits);
  }
}

customElements.define("group-settings", GroupSettings);