export type WorkerCommand =
  | { type: "encrypt"; data: ArrayBuffer; password: string; options: Record<string, unknown> }
  | { type: "decrypt"; data: ArrayBuffer; password: string; options?: Record<string, unknown> }
  | { type: "cancel" }
  | { type: "forceStop" };

export type WorkerEvent =
  | { type: "progress"; current: number; total: number }
  | { type: "done"; data: ArrayBuffer; metadata?: Record<string, unknown> }
  | { type: "error"; message: string };

export class MainWorker {
  private worker: Worker | null = null;

  async init(): Promise<void> {
    this.worker = new Worker(
      new URL("./worker.ts", import.meta.url),
      { type: "module" }
    );
  }

  postMessage(msg: WorkerCommand): void {
    this.worker?.postMessage(msg);
  }

  onMessage(handler: (event: WorkerEvent) => void): void {
    if (this.worker) {
      this.worker.onmessage = (e: MessageEvent<WorkerEvent>) => handler(e.data);
    }
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

export {};