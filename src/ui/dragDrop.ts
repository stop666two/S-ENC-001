export class DragDrop {
  constructor(private onDrop: (files: File[]) => void) {
    this.bindEvents();
  }

  private bindEvents(): void {
    const handler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("dragenter", handler);
    document.addEventListener("dragover", (e) => {
      handler(e);
      document.body.classList.add("drag-over");
    });
    document.addEventListener("dragleave", (e) => {
      handler(e);
      document.body.classList.remove("drag-over");
    });
    document.addEventListener("drop", (e) => {
      handler(e);
      document.body.classList.remove("drag-over");
      if (e.dataTransfer?.files.length) {
        this.onDrop(Array.from(e.dataTransfer.files));
      }
    });
  }
}
