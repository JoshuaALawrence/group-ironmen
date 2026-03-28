import { BaseElement } from "../base-element/base-element";

type DiaryTier = "Easy" | "Medium" | "Hard" | "Elite";
type TierCompletion = { total: number; complete: number };
type DiaryCompletionData = Record<DiaryTier, boolean[]>;

export class DiaryCompletion extends BaseElement {
  playerName: string | null;
  diaryName: string | null;
  diaryCompletion!: DiaryCompletionData;
  tierCompletions: Record<DiaryTier, TierCompletion>;
  total: number;
  totalComplete: number;

  constructor() {
    super();
    this.playerName = null;
    this.diaryName = null;
    this.tierCompletions = {
      Easy: { total: 0, complete: 0 },
      Medium: { total: 0, complete: 0 },
      Hard: { total: 0, complete: 0 },
      Elite: { total: 0, complete: 0 },
    };
    this.total = 0;
    this.totalComplete = 0;
  }

  html(): string {
    return `{{diary-completion.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.diaryName = this.getAttribute("diary-name");
    const tierCompletions: Record<DiaryTier, TierCompletion> = {
      Easy: {
        total: 0,
        complete: 0,
      },
      Medium: {
        total: 0,
        complete: 0,
      },
      Hard: {
        total: 0,
        complete: 0,
      },
      Elite: {
        total: 0,
        complete: 0,
      },
    };

    for (const [tierName, completionState] of Object.entries(tierCompletions) as Array<[DiaryTier, TierCompletion]>) {
      const tierData = this.diaryCompletion[tierName];
      for (const completed of tierData) {
        ++completionState.total;
        if (completed) {
          ++completionState.complete;
        }
      }
    }

    this.tierCompletions = tierCompletions;
    this.total =
      tierCompletions.Easy.total +
      tierCompletions.Medium.total +
      tierCompletions.Hard.total +
      tierCompletions.Elite.total;
    this.totalComplete =
      tierCompletions.Easy.complete +
      tierCompletions.Medium.complete +
      tierCompletions.Hard.complete +
      tierCompletions.Elite.complete;
    this.render();

    this.eventListener(this, "click", this.openDiaryDialog.bind(this));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  openDiaryDialog(): void {
    const diaryDialogEl = document.createElement("diary-dialog");
    diaryDialogEl.setAttribute("player-name", this.playerName ?? "");
    diaryDialogEl.setAttribute("diary-name", this.diaryName ?? "");
    document.body.appendChild(diaryDialogEl);
  }
}

customElements.define("diary-completion", DiaryCompletion);
