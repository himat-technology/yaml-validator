"use client";

import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import type { Diagnostic, SourceLanguage } from "@/lib/types";
import { baseExtensions, editorTheme, languageExtension, toCodeMirrorDiagnostics } from "./codemirror-setup";

export interface CodeEditorHandle {
  focus(): void;
  /** Moves the cursor to a 1-based line/column and scrolls it into view. */
  goTo(line: number, column?: number): void;
}

export interface CodeEditorProps {
  value: string;
  language: SourceLanguage;
  ariaLabel: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  diagnostics?: readonly Diagnostic[];
  placeholder?: string;
  indentWidth?: number;
  onSubmit?: () => void;
  onDropFile?: (file: File) => void;
  handleRef?: Ref<CodeEditorHandle>;
  id?: string;
}

const EMPTY: readonly Diagnostic[] = [];

export default function CodeEditor({
  value,
  language,
  ariaLabel,
  onChange,
  readOnly = false,
  diagnostics = EMPTY,
  placeholder,
  indentWidth = 2,
  onSubmit,
  onDropFile,
  handleRef,
  id,
}: CodeEditorProps) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);

  useImperativeHandle(
    handleRef,
    () => ({
      focus() {
        cmRef.current?.view?.focus();
      },
      goTo(line, column = 1) {
        const view = cmRef.current?.view;
        if (!view) return;
        const doc = view.state.doc;
        const target = doc.line(Math.max(1, Math.min(line, doc.lines)));
        const pos = Math.min(target.from + Math.max(0, column - 1), target.to);
        view.dispatch({
          selection: EditorSelection.cursor(pos),
          effects: EditorView.scrollIntoView(pos, { y: "center" }),
        });
        view.focus();
      },
    }),
    [],
  );

  const extensions = useMemo(
    () => [
      editorTheme,
      ...baseExtensions,
      languageExtension(language),
      lintGutter(),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        // Keeps the scrollable editor reachable (and scrollable) from the keyboard.
        tabindex: "0",
        ...(readOnly ? { "aria-readonly": "true" } : {}),
      }),
    ],
    [language, ariaLabel, readOnly],
  );

  // Capture-phase handlers run before CodeMirror's own listeners, so
  // Ctrl/Cmd+Enter validates instead of inserting a line and dropped files
  // replace the content instead of being inserted as text.
  function handleKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    if (onSubmit && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      onSubmit();
    }
  }

  function handleDropCapture(event: DragEvent<HTMLDivElement>) {
    const file = event.dataTransfer?.files?.[0];
    if (!file || !onDropFile || readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    onDropFile(file);
  }

  useEffect(() => {
    const view = cmRef.current?.view;
    if (!view) return;
    // Diagnostics are computed for `value`; skip if the editor has already moved on.
    if (view.state.doc.length !== value.length) return;
    view.dispatch(setDiagnostics(view.state, toCodeMirrorDiagnostics(diagnostics, view.state.doc)));
  }, [diagnostics, value]);

  return (
    <div
      className="editor-frame h-full min-h-0 overflow-hidden"
      style={{ ["--indent-guide-width" as string]: indentWidth }}
      onKeyDownCapture={handleKeyDownCapture}
      onDropCapture={handleDropCapture}
    >
      <CodeMirror
        id={id}
        ref={cmRef}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        editable
        theme="none"
        height="100%"
        className="h-full"
        placeholder={placeholder}
        extensions={extensions}
        indentWithTab={!readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          autocompletion: false,
          closeBrackets: !readOnly,
          bracketMatching: true,
          highlightSelectionMatches: true,
          searchKeymap: true,
          tabSize: indentWidth,
        }}
      />
    </div>
  );
}
