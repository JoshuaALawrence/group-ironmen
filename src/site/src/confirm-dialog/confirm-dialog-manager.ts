type ConfirmDialogOptions = {
  headline: string;
  body: string;
  yesCallback: () => void;
  noCallback: () => void;
};

type ConfirmDialogElement = Element & {
  show(options: ConfirmDialogOptions): void;
};

class ConfirmDialogManager {
  _globalConfirmDialog?: ConfirmDialogElement | null;

  get globalConfirmDialog(): ConfirmDialogElement | null {
    if (this._globalConfirmDialog) {
      return this._globalConfirmDialog;
    }

    this._globalConfirmDialog = document.querySelector("confirm-dialog") as ConfirmDialogElement | null;
    return this._globalConfirmDialog;
  }

  confirm(options: ConfirmDialogOptions): void {
    this.globalConfirmDialog?.show(options);
  }
}

const confirmDialogManager = new ConfirmDialogManager();

export { confirmDialogManager };
export type { ConfirmDialogOptions };