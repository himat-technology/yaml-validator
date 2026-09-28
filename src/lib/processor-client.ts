import { processInput } from "./processor";
import type { ProcessRequest, ProcessResult } from "./types";

export interface WorkerRequest {
  id: number;
  request: ProcessRequest;
}

export interface WorkerResponse {
  id: number;
  result: ProcessResult;
  durationMs: number;
}

export interface ProcessedState {
  request: ProcessRequest;
  result: ProcessResult;
  durationMs: number;
  /** Whether the work ran in a Web Worker (true) or on the main thread (false). */
  inWorker: boolean;
}

export interface ProcessorClientOptions {
  onResult: (state: ProcessedState) => void;
  onBusyChange?: (busy: boolean) => void;
  createWorker?: () => Worker;
}

export function sameRequest(a: ProcessRequest, b: ProcessRequest): boolean {
  return a.mode === b.mode && a.indent === b.indent && a.sortKeys === b.sortKeys && a.input === b.input;
}

/**
 * Runs processing off the main thread when Web Workers are available so large
 * documents cannot freeze the UI. Superseded requests are cancelled by
 * terminating the busy worker. Falls back to the main thread if the worker
 * cannot be created or crashes. All data stays inside this browser tab.
 */
export class ProcessorClient {
  private worker: Worker | null = null;
  private workerDisabled: boolean;
  private pending: { id: number; request: ProcessRequest; startedAt: number } | null = null;
  private lastRequest: ProcessRequest | null = null;
  private nextId = 1;
  private disposed = false;

  constructor(private readonly options: ProcessorClientOptions) {
    this.workerDisabled = !options.createWorker;
  }

  process(request: ProcessRequest, { force = false } = {}): void {
    if (this.disposed) return;
    if (!force && this.lastRequest && sameRequest(this.lastRequest, request)) return;
    this.lastRequest = request;

    if (this.pending && this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    const id = this.nextId++;
    this.pending = { id, request, startedAt: performance.now() };
    this.options.onBusyChange?.(true);

    const worker = this.getWorker();
    if (worker) {
      const message: WorkerRequest = { id, request };
      worker.postMessage(message);
    } else {
      // Yield once so the UI can paint the "validating" state first.
      setTimeout(() => this.runOnMainThread(id), 0);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
    this.pending = null;
  }

  private getWorker(): Worker | null {
    if (this.workerDisabled || !this.options.createWorker) return null;
    if (this.worker) return this.worker;
    try {
      const worker = this.options.createWorker();
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleResponse(event.data);
      worker.onerror = (event) => {
        event.preventDefault();
        this.disableWorker();
      };
      worker.onmessageerror = () => this.disableWorker();
      this.worker = worker;
      return worker;
    } catch {
      this.workerDisabled = true;
      return null;
    }
  }

  private disableWorker() {
    this.workerDisabled = true;
    this.worker?.terminate();
    this.worker = null;
    if (this.pending) {
      const { id } = this.pending;
      setTimeout(() => this.runOnMainThread(id), 0);
    }
  }

  private handleResponse(response: WorkerResponse) {
    if (this.disposed || !this.pending || response.id !== this.pending.id) return;
    const { request } = this.pending;
    this.pending = null;
    this.options.onResult({ request, result: response.result, durationMs: response.durationMs, inWorker: true });
    this.options.onBusyChange?.(false);
  }

  private runOnMainThread(id: number) {
    if (this.disposed || !this.pending || this.pending.id !== id) return;
    const { request } = this.pending;
    const started = performance.now();
    const result = processInput(request);
    if (!this.pending || this.pending.id !== id) return;
    this.pending = null;
    this.options.onResult({ request, result, durationMs: performance.now() - started, inWorker: false });
    this.options.onBusyChange?.(false);
  }
}
