import { buildErrorSnippet } from "@/lib/error-snippet";
import { formatBytes } from "@/lib/text-stats";
import type { Diagnostic, SourceLanguage } from "@/lib/types";
import { cx } from "./ui";

export type StatusPhase = "empty" | "pending" | "paused" | "stale" | "valid" | "invalid";

interface ValidationStatusProps {
  phase: StatusPhase;
  language: SourceLanguage;
  errors: readonly Diagnostic[];
  warnings: readonly Diagnostic[];
  documentCount: number;
  keyCount: number | null;
  durationMs: number | null;
  engine: "worker" | "main" | null;
  inputBytes: number;
  /** Returns the text of a 1-based input line, used for error excerpts. */
  getLine: (line: number) => string | undefined;
  onGoTo: (line: number, column?: number) => void;
}

const MAX_LISTED = 25;

function positionLabel(d: Diagnostic): string | null {
  if (d.line === undefined) return null;
  return d.column === undefined ? `Line ${d.line}` : `Line ${d.line}, Column ${d.column}`;
}

function DiagnosticItem({
  diagnostic,
  getLine,
  onGoTo,
}: {
  diagnostic: Diagnostic;
  getLine: ValidationStatusProps["getLine"];
  onGoTo: ValidationStatusProps["onGoTo"];
}) {
  const position = positionLabel(diagnostic);
  const lineText = diagnostic.line !== undefined ? getLine(diagnostic.line) : undefined;
  const snippet =
    lineText !== undefined && diagnostic.severity === "error"
      ? buildErrorSnippet(lineText, diagnostic.column ?? 1)
      : null;
  const tone =
    diagnostic.severity === "error"
      ? "border-invalid/40"
      : diagnostic.severity === "warning"
        ? "border-warning/40"
        : "border-info/40";

  return (
    <li className={cx("rounded-md border bg-surface p-3", tone)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 text-sm">
          {position && <span className="font-semibold">{position}: </span>}
          <span>{diagnostic.message}</span>
          {diagnostic.code && (
            <span className="ml-2 font-mono text-xs text-muted">[{diagnostic.code}]</span>
          )}
        </p>
        {diagnostic.line !== undefined && (
          <button
            type="button"
            className="min-h-9 shrink-0 rounded border border-line-strong px-2 text-xs font-medium hover:bg-surface-muted"
            onClick={() => onGoTo(diagnostic.line!, diagnostic.column)}
            aria-label={`Go to ${position ?? "problem"} in the editor`}
          >
            Go to line
          </button>
        )}
      </div>
      {diagnostic.hint && <p className="mt-1 text-sm text-muted">{diagnostic.hint}</p>}
      {snippet && (
        <pre
          className="mt-2 overflow-x-auto rounded bg-surface-muted p-2 font-mono text-xs leading-5"
          aria-label={`Source excerpt for line ${diagnostic.line}`}
        >
          <span className="mr-3 select-none text-muted">{diagnostic.line}</span>
          {snippet.text}
          {"\n"}
          <span className="mr-3 select-none text-muted" aria-hidden="true">
            {" ".repeat(String(diagnostic.line).length)}
          </span>
          <span className="font-bold text-invalid" aria-hidden="true">
            {snippet.caret}
          </span>
        </pre>
      )}
    </li>
  );
}

export function ValidationStatus({
  phase,
  language,
  errors,
  warnings,
  documentCount,
  keyCount,
  durationMs,
  engine,
  inputBytes,
  getLine,
  onGoTo,
}: ValidationStatusProps) {
  const langLabel = language === "json" ? "JSON" : "YAML";

  const headline = {
    empty: "NO INPUT",
    pending: "VALIDATING…",
    paused: "LIVE VALIDATION PAUSED",
    stale: "NOT VALIDATED",
    valid: `VALID ${langLabel}`,
    invalid: `INVALID ${langLabel}`,
  }[phase];

  const errorCount = errors.length;
  const warningCount = warnings.filter((w) => w.severity === "warning").length;

  let detail: string;
  switch (phase) {
    case "empty":
      detail = `Paste ${langLabel}, upload a file, or choose a preset.`;
      break;
    case "pending":
      detail = "Checking your input locally in this browser…";
      break;
    case "paused":
      detail = `Large input (${formatBytes(inputBytes)}). Press Validate or Ctrl+Enter to validate.`;
      break;
    case "stale":
      detail = "Input changed. Press Validate or Ctrl+Enter to validate.";
      break;
    case "valid": {
      const parts: string[] = [];
      if (language === "yaml") parts.push(`${documentCount} document${documentCount === 1 ? "" : "s"}`);
      if (keyCount !== null) parts.push(`${keyCount.toLocaleString("en-US")} mapping key${keyCount === 1 ? "" : "s"}`);
      if (warningCount > 0) parts.push(`${warningCount} warning${warningCount === 1 ? "" : "s"}`);
      if (durationMs !== null) {
        const where = engine === "worker" ? " in a Web Worker" : engine === "main" ? " on the main thread" : "";
        parts.push(`checked locally in ${durationMs < 1 ? "<1" : Math.round(durationMs)} ms${where}`);
      }
      detail = parts.join(" · ");
      break;
    }
    case "invalid":
      detail = `${errorCount} error${errorCount === 1 ? "" : "s"} found${
        warningCount > 0 ? ` · ${warningCount} warning${warningCount === 1 ? "" : "s"}` : ""
      }`;
      break;
  }

  const first = errors[0];
  const srSummary =
    phase === "invalid" && first
      ? `Invalid ${langLabel}. ${errorCount} error${errorCount === 1 ? "" : "s"}. ${
          positionLabel(first) ? `${positionLabel(first)}: ` : ""
        }${first.message}`
      : phase === "valid"
        ? `Valid ${langLabel}.${warningCount > 0 ? ` ${warningCount} warnings.` : ""}`
        : phase === "pending"
          ? ""
          : `${headline}. ${detail}`;

  const badgeTone = {
    empty: "bg-surface-muted text-muted border-line",
    pending: "bg-surface-muted text-muted border-line",
    paused: "bg-warning-soft text-warning border-warning/40",
    stale: "bg-warning-soft text-warning border-warning/40",
    valid: "bg-valid-soft text-valid border-valid/40",
    invalid: "bg-invalid-soft text-invalid border-invalid/40",
  }[phase];

  const listed = phase === "invalid" ? errors : phase === "valid" ? warnings : [];

  return (
    <section aria-labelledby="validation-status-heading" className="flex flex-col gap-3">
      <h2 id="validation-status-heading" className="sr-only">
        Validation status
      </h2>
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
        data-testid="validation-status"
        data-phase={phase}
        data-engine={engine ?? undefined}
      >
        <span
          className={cx(
            "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-sm font-bold tracking-wide",
            badgeTone,
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              "inline-block h-2 w-2 rounded-full",
              phase === "valid" ? "bg-valid" : phase === "invalid" ? "bg-invalid" : "bg-muted",
            )}
          />
          {headline}
        </span>
        <span className="text-sm text-muted">{detail}</span>
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {srSummary}
      </p>
      {listed.length > 0 && (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto" aria-label={phase === "invalid" ? "Errors" : "Warnings"}>
          {listed.slice(0, MAX_LISTED).map((d, index) => (
            <DiagnosticItem key={`${d.line}:${d.column}:${index}`} diagnostic={d} getLine={getLine} onGoTo={onGoTo} />
          ))}
          {listed.length > MAX_LISTED && (
            <li className="text-sm text-muted">…and {listed.length - MAX_LISTED} more.</li>
          )}
        </ul>
      )}
    </section>
  );
}
