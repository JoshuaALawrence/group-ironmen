import { BaseElement } from "../base-element/base-element";

export class RsTooltip extends BaseElement {
  height = 0;

  html(): string {
    if (this.tooltipText) {
      this.style.display = "block";
      return `{{rs-tooltip.html}}`;
    }

    this.style.display = "none";
    return "";
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
  }

  updatePosition(mouseEvent: MouseEvent): void {
    const x = mouseEvent.clientX;
    const y = mouseEvent.clientY;
    const top = Math.max(0, y - this.height);
    let left = x + 2;
    if (left >= document.body.clientWidth / 2) {
      left -= this.offsetWidth + 2;
    }

    this.style.transform = `translate(${left}px, ${top}px)`;
  }

  showTooltip(tooltipText: string): void {
    this.tooltipText = tooltipText;
    this.eventListener(document.body, "mousemove", (event) => this.updatePosition(event as MouseEvent));
    this.render();
    this.height = this.offsetHeight;
  }

  hideTooltip(): void {
    this.tooltipText = undefined;
    this.unbindEvents();
    this.render();
  }
}

customElements.define("rs-tooltip", RsTooltip);