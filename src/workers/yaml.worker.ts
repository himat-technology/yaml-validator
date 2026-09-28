import { processInput } from "@/lib/processor";
import type { WorkerRequest, WorkerResponse } from "@/lib/processor-client";

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, request } = event.data;
  const started = performance.now();
  const result = processInput(request);
  scope.postMessage({ id, result, durationMs: performance.now() - started });
};
