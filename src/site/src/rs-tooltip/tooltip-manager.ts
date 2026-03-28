type TooltipElement = Element & {
  showTooltip(tooltipText: string): void;
  hideTooltip(): void;
};

class TooltipManager {
  _globalTooltip?: TooltipElement | null;

  get globalTooltip(): TooltipElement | null {
    if (this._globalTooltip) {
      return this._globalTooltip;
    }

    this._globalTooltip = document.querySelector("rs-tooltip") as TooltipElement | null;
    return this._globalTooltip;
  }

  showTooltip(tooltipText: string): void {
    this.globalTooltip?.showTooltip(tooltipText);
  }

  hideTooltip(): void {
    this.globalTooltip?.hideTooltip();
  }
}

const tooltipManager = new TooltipManager();

export { tooltipManager };