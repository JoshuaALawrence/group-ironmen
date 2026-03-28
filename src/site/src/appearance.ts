declare global {
  interface Window {
    getTheme(): string | null;
    updateTheme(): void;
  }
}

class Appearance {
  private themeMediaQuery: MediaQueryList | null;
  private themeChangeHandler: (() => void) | null;

  constructor() {
    this.themeMediaQuery = null;
    this.themeChangeHandler = null;
    if (window.matchMedia) {
      this.themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.themeChangeHandler = () => this.updateTheme();
      this.themeMediaQuery.addEventListener("change", this.themeChangeHandler);
    }

    this.updateLayout();
  }

  destroy(): void {
    if (this.themeMediaQuery && this.themeChangeHandler) {
      this.themeMediaQuery.removeEventListener("change", this.themeChangeHandler);
      this.themeMediaQuery = null;
      this.themeChangeHandler = null;
    }
  }

  setLayout(layout: string): void {
    localStorage.setItem("layout-direction", layout);
    this.updateLayout();
  }

  getLayout(): string | null {
    return localStorage.getItem("layout-direction");
  }

  updateLayout(): void {
    const authedSection = document.querySelector(".authed-section");
    if (!(authedSection instanceof HTMLElement)) {
      return;
    }

    const layoutDirection = this.getLayout();
    authedSection.style.flexDirection = layoutDirection === "row-reverse" ? "row" : "row-reverse";
  }

  setTheme(theme: string): void {
    localStorage.setItem("theme", theme);
    this.updateTheme();
  }

  getTheme(): string | null {
    return window.getTheme();
  }

  updateTheme(): void {
    window.updateTheme();
  }
}

const appearance = new Appearance();

export { appearance };