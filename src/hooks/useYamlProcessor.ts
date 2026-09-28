"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProcessorClient, type ProcessedState } from "@/lib/processor-client";
import type { ProcessRequest } from "@/lib/types";

function createWorker(): Worker {
  return new Worker(new URL("../workers/yaml.worker.ts", import.meta.url), { type: "module" });
}

export function useYamlProcessor() {
  const clientRef = useRef<ProcessorClient | null>(null);
  const [processed, setProcessed] = useState<ProcessedState | null>(null);
  const [busy, setBusy] = useState(false);

  const getClient = useCallback(() => {
    clientRef.current ??= new ProcessorClient({
      onResult: setProcessed,
      onBusyChange: setBusy,
      createWorker: typeof Worker === "undefined" ? undefined : createWorker,
    });
    return clientRef.current;
  }, []);

  useEffect(
    () => () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    },
    [],
  );

  const process = useCallback(
    (request: ProcessRequest, options?: { force?: boolean }) => getClient().process(request, options),
    [getClient],
  );

  return { processed, busy, process };
}
