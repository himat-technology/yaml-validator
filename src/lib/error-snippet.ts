export interface ErrorSnippet {
  /** The (possibly truncated) source line; tabs are shown as "→". */
  text: string;
  /** Spaces followed by a "^" under the reported column. */
  caret: string;
}

/**
 * Builds a one-line excerpt with a caret under a 1-based column, windowed
 * around the column when the line is long.
 */
export function buildErrorSnippet(lineText: string, column: number, maxWidth = 80): ErrorSnippet {
  const index = Math.max(0, Math.min(column - 1, lineText.length));
  let start = 0;
  if (lineText.length > maxWidth) {
    start = Math.max(0, Math.min(index - Math.floor(maxWidth / 2), lineText.length - maxWidth));
  }
  const slice = lineText.slice(start, start + maxWidth).replace(/\t/g, "→");
  const prefix = start > 0 ? "…" : "";
  const suffix = start + maxWidth < lineText.length ? "…" : "";
  return {
    text: `${prefix}${slice}${suffix}`,
    caret: `${" ".repeat(prefix.length + (index - start))}^`,
  };
}
