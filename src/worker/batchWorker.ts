import type { WorkerCommand } from "./mainWorker";

interface BatchTask {
  id: string;
  command: WorkerCommand;
}

export class BatchWorker {
  private queue: BatchTask[] = [];
  private running = false;

  add(task: BatchTask): void {
    this.queue.push(task);
    if (!this.running) {
      void this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.running = false;
      return;
    }
    this.running = true;
    const task = this.queue.shift()!;
    // TODO: dispatch to worker
    void task;
    await this.processNext();
  }

  cancel(): void {
    this.queue = [];
    this.running = false;
  }

  get status(): string {
    return `${this.queue.length} queued, running: ${this.running}`;
  }
}
