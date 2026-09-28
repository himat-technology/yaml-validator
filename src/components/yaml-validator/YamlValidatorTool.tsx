"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useYamlProcessor } from "@/hooks/useYamlProcessor";
import { downloadOutput } from "@/lib/download-utils";
import { readLocalFile } from "@/lib/file-utils";
import { DEFAULT_PRESET, type Preset } from "@/lib/presets";
import { inputLanguageForMode, outputLanguageForMode } from "@/lib/processor";
import { computeTextStats, formatBytes } from "@/lib/text-stats";
import type { Diagnostic, IndentSize, ProcessRequest, ToolMode } from "@/lib/types";
import { ActionButtons } from "./ActionButtons";
import type { CodeEditorHandle } from "./CodeEditor";
import { ConversionControls } from "./ConversionControls";
import { OutputViewer } from "./OutputViewer";
import { PresetSelector } from "./PresetSelector";
import { ToolStats } from "./ToolStats";
import { ValidationStatus, type StatusPhase } from "./ValidationStatus";
import { YamlEditor } from "./YamlEditor";

/** Above this size live validation pauses; the Validate button still works. */
export const AUTO_PROCESS_LIMIT = 1_000_000;

function debounceDelay(length: number): number {
  if (length < 20_000) return 250;
  if (length < 200_000) return 500;
  return 900;
}

const NO_DIAGNOSTICS: Diagnostic[] = [];

export default function YamlValidatorTool() {
  const [input, setInput] = useState<string>(DEFAULT_PRESET.content);
  const [mode, setMode] = useState<ToolMode>("format");
  const [indent, setIndent] = useState<IndentSize>(2);
  const [sortKeys, setSortKeys] = useState(false);
  const [liveValidation, setLiveValidation] = useState(true);
  const [activePreset, setActivePreset] = useState<Preset["id"] | null>(DEFAULT_PRESET.id);
  const [sourceLabel, setSourceLabel] = useState<string | null>(`${DEFAULT_PRESET.label} preset`);
  const [fileError, setFileError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const editorRef = useRef<CodeEditorHandle>(null);
  const firstRunRef = useRef(true);
  const { processed, busy, process } = useYamlProcessor();

  const inputLanguage = inputLanguageForMode(mode);
  const outputLanguage = outputLanguageForMode(mode);
  const autoPaused = input.length > AUTO_PROCESS_LIMIT;

  useEffect(() => {
    if (!liveValidation || autoPaused) return;
    const delay = firstRunRef.current ? 0 : debounceDelay(input.length);
    firstRunRef.current = false;
    const handle = window.setTimeout(() => process({ mode, input, indent, sortKeys }), delay);
    return () => window.clearTimeout(handle);
  }, [mode, input, indent, sortKeys, liveValidation, autoPaused, process]);

  const runNow = useCallback(
    (overrides: Partial<ProcessRequest> = {}, force = false) =>
      process({ mode, input, indent, sortKeys, ...overrides }, { force }),
    [process, mode, input, indent, sortKeys],
  );

  const announce = useCallback((message: string) => {
    // Clearing first makes screen readers repeat identical consecutive messages.
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(message), 50);
  }, []);

  /* ---------------------------- derived state ---------------------------- */

  const statusCurrent =
    processed !== null && processed.request.input === input && processed.request.mode === mode;
  const outputCurrent =
    statusCurrent && processed.request.indent === indent && processed.request.sortKeys === sortKeys;
  const result = statusCurrent ? processed.result : null;

  let phase: StatusPhase;
  if (input.trim() === "") phase = "empty";
  else if (result && result.status !== "empty") phase = result.status;
  else if (busy) phase = "pending";
  else if (autoPaused) phase = "paused";
  else if (!liveValidation) phase = "stale";
  else phase = "pending";

  const output = processed !== null && processed.request.mode === mode && input.trim() !== "" ? processed.result.output : "";

  const deferredInput = useDeferredValue(input);
  const inputStats = useMemo(() => computeTextStats(deferredInput), [deferredInput]);
  const outputStats = useMemo(() => (output ? computeTextStats(output) : null), [output]);

  const diagnostics = useMemo(
    () => (result ? [...result.errors, ...result.warnings] : NO_DIAGNOSTICS),
    [result],
  );

  const inputLines = useMemo(
    () => (phase === "invalid" || (result && result.warnings.length > 0) ? input.split("\n") : null),
    [phase, result, input],
  );
  const getLine = useCallback((line: number) => inputLines?.[line - 1], [inputLines]);

  /* ------------------------------ handlers ------------------------------- */

  function handleInputChange(value: string) {
    setInput(value);
    setActivePreset(null);
    setFileError(null);
    setSourceLabel((label) => (label && !label.endsWith(" (edited)") ? `${label} (edited)` : label));
  }

  function handleValidate() {
    runNow({}, true);
  }

  function handleModeChange(next: ToolMode) {
    setMode(next);
    runNow({ mode: next });
  }

  function handleIndentChange(next: IndentSize) {
    setIndent(next);
    runNow({ indent: next });
  }

  function handleSortKeysChange(next: boolean) {
    setSortKeys(next);
    runNow({ sortKeys: next });
  }

  function handlePreset(preset: Preset) {
    const nextMode: ToolMode = mode === "json-to-yaml" ? "format" : mode;
    setInput(preset.content);
    setMode(nextMode);
    setActivePreset(preset.id);
    setSourceLabel(`${preset.label} preset`);
    setFileError(null);
    runNow({ input: preset.content, mode: nextMode });
    announce(`${preset.label} preset loaded.`);
  }

  async function handleFile(file: File) {
    const loaded = await readLocalFile(file);
    if (!loaded.ok) {
      setFileError(`${loaded.name}: ${loaded.error}`);
      announce(`Could not load ${loaded.name}. ${loaded.error}`);
      return;
    }
    const nextMode: ToolMode =
      loaded.language === "json" ? "json-to-yaml" : mode === "json-to-yaml" ? "format" : mode;
    setInput(loaded.content);
    setMode(nextMode);
    setActivePreset(null);
    setSourceLabel(`${loaded.name} (${formatBytes(loaded.size)})`);
    setFileError(null);
    runNow({ input: loaded.content, mode: nextMode }, true);
    announce(`Loaded ${loaded.name} locally. Validating.`);
  }

  function handleClear() {
    setInput("");
    setActivePreset(null);
    setSourceLabel(null);
    setFileError(null);
    runNow({ input: "" });
    editorRef.current?.focus();
    announce("Input cleared.");
  }

  function handleDownload() {
    if (!outputCurrent || !output) return;
    const fileName = downloadOutput(output, outputLanguage);
    announce(`Downloaded ${fileName}.`);
  }

  function handleUseAsInput() {
    if (!outputCurrent || !output) return;
    const nextMode: ToolMode = outputLanguage === "json" ? "json-to-yaml" : "format";
    setInput(output);
    setMode(nextMode);
    setActivePreset(null);
    setSourceLabel("previous output");
    runNow({ input: output, mode: nextMode });
    announce("Output moved to the input editor.");
  }

  function handleGoTo(line: number, column?: number) {
    editorRef.current?.goTo(line, column);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="yaml-tool">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-lg border border-line bg-surface p-3">
        <PresetSelector activePresetId={activePreset} onSelect={handlePreset} />
        <ConversionControls
          indent={indent}
          sortKeys={sortKeys}
          liveValidation={liveValidation}
          onIndentChange={handleIndentChange}
          onSortKeysChange={handleSortKeysChange}
          onLiveValidationChange={setLiveValidation}
        />
      </div>

      <div className="rounded-lg border border-line bg-surface p-3">
        <ValidationStatus
          phase={phase}
          language={inputLanguage}
          errors={result?.errors ?? NO_DIAGNOSTICS}
          warnings={result?.warnings ?? NO_DIAGNOSTICS}
          documentCount={result?.documentCount ?? 0}
          keyCount={result?.keyCount ?? null}
          durationMs={statusCurrent ? processed.durationMs : null}
          engine={statusCurrent ? (processed.inWorker ? "worker" : "main") : null}
          inputBytes={inputStats.bytes}
          getLine={getLine}
          onGoTo={handleGoTo}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
        <YamlEditor
          value={input}
          language={inputLanguage}
          stats={inputStats}
          sourceLabel={sourceLabel}
          diagnostics={diagnostics}
          indent={indent}
          fileError={fileError}
          editorRef={editorRef}
          onChange={handleInputChange}
          onClear={handleClear}
          onFile={handleFile}
          onValidate={handleValidate}
          onAnnounce={announce}
        />
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 xl:justify-center xl:border-dashed">
          <ActionButtons mode={mode} busy={busy} onValidate={handleValidate} onModeChange={handleModeChange} />
          <p className="hidden text-center text-xs text-muted xl:block" aria-hidden="true">
            input → output
          </p>
        </div>
        <OutputViewer
          mode={mode}
          output={output}
          language={outputLanguage}
          isCurrent={outputCurrent}
          isInvalid={phase === "invalid"}
          sortKeys={sortKeys}
          indent={indent}
          onDownload={handleDownload}
          onUseAsInput={handleUseAsInput}
          onAnnounce={announce}
        />
      </div>

      <ToolStats
        input={inputStats}
        output={outputStats}
        inputLanguage={inputLanguage}
        outputLanguage={outputLanguage}
        keyCount={result?.status === "valid" ? result.keyCount : null}
        documentCount={result?.status === "valid" ? result.documentCount : null}
      />

      <p className="text-center text-sm font-medium text-valid">
        Your YAML stays in your browser. Nothing is uploaded.
      </p>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="announcer">
        {announcement}
      </p>
    </div>
  );
}
