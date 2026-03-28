class LoadingScreenManager {
  _globalLoadingScreen?: HTMLElement | null;

  get globalLoadingScreen(): HTMLElement {
    if (this._globalLoadingScreen) return this._globalLoadingScreen;
    this._globalLoadingScreen = document.querySelector<HTMLElement>("loading-screen");
    if (!this._globalLoadingScreen) {
      this._globalLoadingScreen = document.createElement("loading-screen");
      document.body.appendChild(this._globalLoadingScreen);
    }
    return this._globalLoadingScreen;
  }

  showLoadingScreen(): void {
    this.globalLoadingScreen.style.display = "block";
  }

  hideLoadingScreen(): void {
    this.globalLoadingScreen.style.display = "none";
  }
}

const loadingScreenManager = new LoadingScreenManager();

export { loadingScreenManager };
