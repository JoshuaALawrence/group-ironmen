type MemberSelectDialogElement = Element & {
  show(members: string[]): Promise<string>;
};

class MemberSelectDialogManager {
  private _dialog?: MemberSelectDialogElement | null;

  get dialog(): MemberSelectDialogElement | null {
    if (this._dialog) return this._dialog;
    this._dialog = document.querySelector("member-select-dialog") as MemberSelectDialogElement | null;
    return this._dialog;
  }

  selectMember(members: string[]): Promise<string> {
    const d = this.dialog;
    if (!d) return Promise.resolve(members[0] || "");
    return d.show(members);
  }
}

const memberSelectDialogManager = new MemberSelectDialogManager();

export { memberSelectDialogManager };
