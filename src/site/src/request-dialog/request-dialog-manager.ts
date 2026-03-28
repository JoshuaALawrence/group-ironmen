type RequestDialogElement = Element & {
  show(itemName: string): Promise<number | null>;
};

class RequestDialogManager {
  private _dialog?: RequestDialogElement | null;

  get dialog(): RequestDialogElement | null {
    if (this._dialog) return this._dialog;
    this._dialog = document.querySelector("request-dialog") as RequestDialogElement | null;
    return this._dialog;
  }

  requestQuantity(itemName: string): Promise<number | null> {
    const d = this.dialog;
    if (!d) return Promise.resolve(null);
    return d.show(itemName);
  }
}

const requestDialogManager = new RequestDialogManager();

export { requestDialogManager };
