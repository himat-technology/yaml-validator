"use client";

import dynamic from "next/dynamic";
import type { Ref } from "react";
import { formatCount } from "@/lib/text-stats";
import type { Diagnostic, SourceLanguage, TextStats } from "@/lib/types";
import type { CodeEditorHandle } from "./CodeEditor";
import { CopyButton } from "./CopyButton";
import { EditorSkeleton } from "./EditorSkeleton";
import { FileUploader } from "./FileUploader";
import { TrashIcon } from "./Icons";
import { buttonStyles, cx } from "./ui";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <EditorSkeleton label="editor" />,
});

interface YamlEditorProps {
  value: string;
  language: SourceLanguage;
  stats: TextStats;
  sourceLabel: string | null;
  diagnostics: readonly Diagnostic[];
  indent: number;
  fileError: string | null;
  editorRef: Ref<CodeEditorHandle>;
  onChange: (value: string) => void;
  onClear: () => void;
  onFile: (file: File) => void;
  onValidate: () => void;
  onAnnounce: (message: string) => void;
  className?: string;
}

export function YamlEditor({
  value,
  language,
  stats,
  sourceLabel,
  diagnostics,
  indent,
  fileError,
  editorRef,
  onChange,
  onClear,
  onFile,
  onValidate,
  onAnnounce,
  className,
}: YamlEditorProps) {
  const langLabel = language === "json" ? "JSON" : "YAML";

  return (
    <section
      aria-labelledby="input-heading"
      className={cx("flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <h2 id="input-heading" className="text-sm font-semibold">
            {langLabel} Input
          </h2>
          <p className="truncate text-xs text-muted" data-testid="input-meta">
            {formatCount(stats.characters)} characters · {formatCount(stats.lines)} lines
            {sourceLabel ? ` · ${sourceLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FileUploader onFile={onFile} />
          <CopyButton
            label={`Copy ${langLabel}`}
            ariaLabel={`Copy ${langLabel} input`}
            getText={() => value}
            disabled={value.length === 0}
            onResult={onAnnounce}
          />
          <button
            type="button"
            className={buttonStyles.secondary}
            onClick={onClear}
            disabled={value.length === 0}
            aria-label="Clear input"
          >
            <TrashIcon />
            <span>Clear</span>
          </button>
        </div>
      </header>
      {fileError && (
        <p role="alert" className="border-b border-invalid/40 bg-invalid-soft px-3 py-2 text-sm text-invalid">
          {fileError}
        </p>
      )}
      <div className="h-[55vh] min-h-72 sm:h-[560px]">
        <CodeEditor
          id="source-editor"
          value={value}
          language={language}
          ariaLabel={`${langLabel} input editor`}
          onChange={onChange}
          diagnostics={diagnostics}
          placeholder={
            language === "json"
              ? '{\n  "paste": "JSON here"\n}'
              : "# Paste YAML here, drop a .yaml / .yml / .json file, or choose a preset"
          }
          indentWidth={indent}
          onSubmit={onValidate}
          onDropFile={onFile}
          handleRef={editorRef}
        />
      </div>
      <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
        <kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">Enter</kbd> validates ·{" "}
        <kbd className="font-mono">Esc</kbd> then <kbd className="font-mono">Tab</kbd> leaves the editor
      </p>
    </section>
  );
}
