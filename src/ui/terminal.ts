export class Terminal {
  private el: HTMLElement;
  private buffer: string[] = [];
  private maxLines = 500;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  log(line: string): void {
    this.buffer.push(line);
    if (this.buffer.length > this.maxLines) {
      this.buffer.shift();
    }
    const entry = document.createElement("div");
    entry.className = "term-line";
    entry.textContent = line;
    this.el.appendChild(entry);
    if (this.el.childElementCount > this.maxLines) {
      this.el.removeChild(this.el.firstElementChild as Element);
    }
    this.el.scrollTop = this.el.scrollHeight;
  }

  clear(): void {
    this.buffer = [];
    this.el.innerHTML = "";
  }

  getBuffer(): string[] {
    return [...this.buffer];
  }
}
