export class ProgressBar {
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  show(current: number, total: number, label?: string): void {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    const bars = Math.round(pct / 5);
    const barStr = "[".concat("#".repeat(bars)).concat(" ".repeat(20 - bars)).concat("]");
    this.el.textContent = label
      ? `${barStr} ${pct}% - ${label}`
      : `${barStr} ${pct}%`;
  }

  clear(): void {
    this.el.textContent = "";
  }
}
