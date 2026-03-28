import { BaseElement } from "../base-element/base-element";

type DiaryCompletionData = Record<string, boolean[]>;

type PlayerDiariesData = {
  completion: Record<string, DiaryCompletionData>;
};

type DiaryCompletionElement = HTMLElement & {
  diaryCompletion?: DiaryCompletionData;
};

export class PlayerDiaries extends BaseElement {
  playerName: string | null;
  completionsEl: HTMLElement | null;

  constructor() {
    super();
    this.playerName = null;
    this.completionsEl = null;
  }

  html(): string {
    return `{{player-diaries.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.playerName = this.getAttribute("player-name");
    this.completionsEl = this.querySelector<HTMLElement>(".player-diaries__completions");
    this.subscribe(`diaries:${this.playerName}`, (playerDiaries) => this.handleDiaries(playerDiaries as PlayerDiariesData));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  handleDiaries(playerDiaries: PlayerDiariesData): void {
    const completionEls = document.createDocumentFragment();

    for (const [diaryName, diaryCompletion] of Object.entries(playerDiaries.completion)) {
      const el = document.createElement("diary-completion") as DiaryCompletionElement;
      el.setAttribute("diary-name", diaryName);
      el.setAttribute("player-name", this.playerName ?? "");
      el.diaryCompletion = diaryCompletion;
      completionEls.appendChild(el);
    }

    if (this.completionsEl) {
      this.completionsEl.innerHTML = "";
      this.completionsEl.appendChild(completionEls);
    }
  }
}

customElements.define("player-diaries", PlayerDiaries);
