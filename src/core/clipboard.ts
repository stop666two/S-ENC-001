export class ClipboardManager {
  private autoClear = false;

  enableAutoClear(): void {
    this.autoClear = true;
  }

  disableAutoClear(): void {
    this.autoClear = false;
  }

  get isAutoClearEnabled(): boolean {
    return this.autoClear;
  }

  async clearClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText("");
    } catch {
      // clipboard API may not be available
    }
  }

  async copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
