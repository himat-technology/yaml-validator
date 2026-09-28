import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { RangeSetBuilder, type Extension, type Text } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import type { Diagnostic, SourceLanguage } from "@/lib/types";

export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "var(--editor-bg)",
    color: "var(--editor-fg)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
    overflow: "auto",
  },
  ".cm-content": { caretColor: "var(--editor-fg)", paddingBlock: "8px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--editor-fg)" },
  "&.cm-focused": { outline: "none" },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter-bg)",
    color: "var(--editor-gutter-fg)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine": { backgroundColor: "var(--editor-active-line)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--editor-active-line)", color: "var(--editor-fg)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "var(--editor-selection)" },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--surface-muted)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
  },
  ".cm-placeholder": { color: "var(--editor-gutter-fg)" },
  ".cm-tooltip": {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--invalid)",
    textUnderlineOffset: "3px",
    backgroundColor: "var(--invalid-soft)",
  },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--warning)",
    textUnderlineOffset: "3px",
  },
  ".cm-lintPoint-error:after": { borderBottomColor: "var(--invalid)" },
});

const highlightStyle = HighlightStyle.define([
  { tag: [t.propertyName, t.definition(t.propertyName)], color: "var(--syn-key)" },
  { tag: [t.string, t.special(t.string)], color: "var(--syn-string)" },
  { tag: t.number, color: "var(--syn-number)" },
  { tag: [t.bool, t.null, t.atom], color: "var(--syn-atom)" },
  { tag: [t.lineComment, t.comment], color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.labelName, t.typeName, t.meta, t.keyword, t.attributeValue], color: "var(--syn-meta)" },
  { tag: [t.separator, t.punctuation, t.squareBracket, t.brace], color: "var(--syn-punct)" },
]);

const indentGuideMark = Decoration.mark({ class: "cm-indent-guide" });
const leadingTabMark = Decoration.mark({ class: "cm-leading-tab", attributes: { title: "Tab character in indentation" } });

function buildIndentDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc: Text = view.state.doc;
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      const text = line.text;
      let end = 0;
      while (end < text.length && (text[end] === " " || text[end] === "\t")) end++;
      if (end > 0 && end < text.length) {
        let start = 0;
        while (start < end) {
          const isTab = text[start] === "\t";
          let runEnd = start;
          while (runEnd < end && (text[runEnd] === "\t") === isTab) runEnd++;
          builder.add(line.from + start, line.from + runEnd, isTab ? leadingTabMark : indentGuideMark);
          start = runEnd;
        }
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

/** Draws indentation guides over leading spaces and flags tab indentation (invalid in YAML). */
export const indentationGuides = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildIndentDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildIndentDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export function languageExtension(language: SourceLanguage): Extension {
  return language === "json" ? json() : yaml();
}

export const baseExtensions: Extension[] = [syntaxHighlighting(highlightStyle), indentationGuides];

/** Maps tool diagnostics onto CodeMirror ranges; diagnostics without a real position are skipped. */
export function toCodeMirrorDiagnostics(diagnostics: readonly Diagnostic[], doc: Text): CmDiagnostic[] {
  const result: CmDiagnostic[] = [];
  for (const d of diagnostics) {
    let from: number | undefined = d.from;
    let to: number | undefined = d.to;
    if (from === undefined && d.line !== undefined && d.line >= 1 && d.line <= doc.lines) {
      const line = doc.line(d.line);
      from = Math.min(line.from + Math.max(0, (d.column ?? 1) - 1), line.to);
      to = from;
    }
    if (from === undefined) continue;
    from = Math.max(0, Math.min(from, doc.length));
    to = Math.max(from, Math.min(to ?? from, doc.length));
    if (to === from && from < doc.length) {
      const lineEnd = doc.lineAt(from).to;
      to = lineEnd > from ? from + 1 : from;
    }
    result.push({
      from,
      to,
      severity: d.severity === "info" ? "info" : d.severity,
      message: d.hint ? `${d.message}\n${d.hint}` : d.message,
      source: d.code,
    });
  }
  return result;
}
