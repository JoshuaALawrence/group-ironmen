import { BaseElement } from "../base-element/base-element";

type HslColor = {
  hue: number;
  saturation: number;
  lightness: number;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export class StatBar extends BaseElement {
  bar: HTMLElement | null;
  color: string | HslColor;
  bgColor: string | null;

  constructor() {
    super();
    this.bar = null;
    this.color = "";
    this.bgColor = null;
  }

  html(): string {
    return `{{stat-bar.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.bar = this.querySelector<HTMLElement>(".stat-bar__current");
    this.color = this.getAttribute("bar-color") ?? "";
    this.bgColor = this.getAttribute("bar-bgcolor");

    if (!this.bgColor && typeof this.color === "string" && this.color.startsWith("#")) {
      const darkened = this.darkenColor(this.hexToRgb(this.color));
      if (darkened) {
        this.bgColor = `rgb(${darkened.r}, ${darkened.g}, ${darkened.b})`;
      }
    }

    if (typeof this.color === "string" && this.color.startsWith("hsl")) {
      const colorParts = this.color.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
      const [hue, saturation, lightness] = colorParts;
      this.color = { hue, saturation, lightness };
    }

    const ratio = Number.parseFloat(this.getAttribute("bar-ratio") ?? "");
    if (!isNaN(ratio)) {
      this.update(ratio);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  hexToRgb(hex: string): RgbColor | null {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (_match, r, g, b) {
      return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : null;
  }

  darkenColor(color: RgbColor | null): RgbColor | null {
    if (!color) {
      return null;
    }

    const d = 3.0;
    return {
      r: Math.round(color.r / d),
      g: Math.round(color.g / d),
      b: Math.round(color.b / d),
    };
  }

  getColor(ratio: number): string {
    if (typeof this.color === "string") return this.color;

    const color = { ...this.color };
    color.hue = color.hue * ratio;
    return `hsl(${Math.round(color.hue)}, ${color.saturation}%, ${color.lightness}%)`;
  }

  update(ratio: number): void {
    if (!this.isConnected) return;
    const x = ratio * 100;
    const color = this.getColor(ratio);
    // NOTE: Tried doing this using a canvas and a div with a scaled width, both of them would leave gaps between other
    // bars. This does not leave gaps.
    if (ratio === 1) {
      this.style.background = color;
    } else {
      this.style.background = `linear-gradient(90deg, ${color}, ${x}%, ${this.bgColor ?? color} ${x}%)`;
    }
  }
}

customElements.define("stat-bar", StatBar);
