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
      if (!e.dataTransfer) return;
      void this.collect(e.dataTransfer).then((files) => {
        if (files.length) this.onDrop(files);
      });
    });
  }

  private collect(dt: DataTransfer): Promise<File[]> {
    const items = dt.items;
    const fallback = (): File[] => Array.from(dt.files);
    if (!items || items.length === 0) return Promise.resolve(fallback());

    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const raw = items[i] as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null };
      const entry = raw.webkitGetAsEntry ? raw.webkitGetAsEntry() : null;
      if (entry) entries.push(entry);
    }
    if (entries.length === 0) return Promise.resolve(fallback());

    const out: File[] = [];
    const walk = (entry: FileSystemEntry): Promise<void> =>
      new Promise((res) => {
        if (entry.isFile) {
          (entry as FileSystemFileEntry).file(
            (f) => { out.push(f); res(); },
            () => res()
          );
          return;
        }
        if (!entry.isDirectory) { res(); return; }
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const readBatch = (): Promise<void> =>
          new Promise((done) => {
            reader.readEntries(async (batch) => {
              if (batch.length === 0) { done(); return; }
              for (const sub of batch) await walk(sub);
              await readBatch();
              done();
            }, () => done());
          });
        void readBatch().then(res);
      });

    return Promise.all(entries.map(walk)).then(() => out);
  }
}
