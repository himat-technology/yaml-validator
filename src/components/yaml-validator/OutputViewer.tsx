"use client";

import dynamic from "next/dynamic";
import { DOWNLOAD_FILES } from "@/lib/download-utils";
import type { SourceLanguage, ToolMode } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { EditorSkeleton } from "./EditorSkeleton";
import { DownloadIcon, SwapIcon } from "./Icons";
import { buttonStyles, cx } from "./ui";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <EditorSkeleton label="output" />,
});

interface OutputViewerProps {
  mode: ToolMode;
  output: string;
  language: SourceLanguage;
  isCurrent: boolean;
  isInvalid: boolean;
  sortKeys: boolean;
  indent: number;
  onDownload: () => void;
  onUseAsInput: () => void;
  onAnnounce: (message: string) => void;
  className?: string;
}

const TITLES: Record<ToolMode, string> = {
  format: "Validated YAML Output",
  "yaml-to-json": "JSON Output",
  "json-to-yaml": "YAML Output",
};

export function OutputViewer({
  mode,
  output,
  language,
  isCurrent,
  isInvalid,
  sortKeys,
  indent,
  onDownload,
  onUseAsInput,
  onAnnounce,
  className,
}: OutputViewerProps) {
  const hasOutput = output.length > 0;
  const canAct = hasOutput && isCurrent;
  const fileName = DOWNLOAD_FILES[language].fileName;

  let placeholder = "Output appears here once the input is valid.";
  if (isInvalid) placeholder = "Fix the errors listed above to see the output.";

  return (
    <section
      aria-labelledby="output-heading"
      className={cx("flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <h2 id="output-heading" className="text-sm font-semibold">
            {TITLES[mode]}
          </h2>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>{indent}-space indent</span>
            {sortKeys && hasOutput && (
              <span
                className="rounded border border-accent/50 bg-accent-soft px-1.5 font-semibold text-accent"
                data-testid="sorted-badge"
              >
                Keys sorted A→Z
              </span>
            )}
            {!isCurrent && hasOutput && <span className="text-warning">Updating…</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton
            label="Copy Output"
            ariaLabel={`Copy ${language.toUpperCase()} output`}
            getText={() => output}
            disabled={!canAct}
            onResult={onAnnounce}
          />
          <button
            type="button"
            className={buttonStyles.secondary}
            onClick={onDownload}
            disabled={!canAct}
            aria-label={`Download output as ${fileName}`}
          >
            <DownloadIcon />
            <span>Download</span>
          </button>
          <button
            type="button"
            className={buttonStyles.subtle}
            onClick={onUseAsInput}
            disabled={!canAct}
            title="Replace the input with this output"
            aria-label="Use output as input"
          >
            <SwapIcon />
            <span className="hidden sm:inline">Use as input</span>
          </button>
        </div>
      </header>
      <div className={cx("relative h-[55vh] min-h-72 sm:h-[560px]", !isCurrent && hasOutput && "opacity-60")}>
        {hasOutput ? (
          <CodeEditor
            value={output}
            language={language}
            ariaLabel={`${TITLES[mode]} (read-only)`}
            readOnly
            indentWidth={indent}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[var(--editor-bg)] p-6 text-center text-sm text-muted">
            {placeholder}
          </div>
        )}
      </div>
      <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
        Downloads as <span className="font-mono">{fileName}</span> · generated in your browser
      </p>
    </section>
  );
}
