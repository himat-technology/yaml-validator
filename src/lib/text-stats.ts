import type { TextStats } from "./types";

/** UTF-8 encoded size of a string, computed without allocating a buffer. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/** Number of Unicode code points (so an emoji counts as one character). */
export function countCharacters(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    count++;
  }
  return count;
}

/**
 * Number of lines as an editor would display them, ignoring a single trailing
 * newline. Empty text has zero lines.
 */
export function countLines(text: string): number {
  if (text.length === 0) return 0;
  let lines = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lines++;
  }
  if (text.charCodeAt(text.length - 1) === 10) lines--;
  return lines;
}

export function computeTextStats(text: string): TextStats {
  return {
    characters: countCharacters(text),
    lines: countLines(text),
    bytes: utf8ByteLength(text),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** Recursively counts keys of every plain object inside a JSON-like value. */
export function countObjectKeys(value: unknown): number {
  let total = 0;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    } else if (current !== null && typeof current === "object") {
      const keys = Object.keys(current);
      total += keys.length;
      for (const key of keys) stack.push((current as Record<string, unknown>)[key]);
    }
  }
  return total;
}

export type LineColumnLookup = (offset: number) => { line: number; column: number };

/**
 * Builds a reusable 0-based offset -> 1-based line/column lookup, so mapping
 * many diagnostics in a large document stays cheap.
 */
export function createLineIndex(text: string): LineColumnLookup {
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }
  return (offset) => {
    const clamped = Math.max(0, Math.min(offset, text.length));
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (lineStarts[mid] <= clamped) low = mid;
      else high = mid - 1;
    }
    return { line: low + 1, column: clamped - lineStarts[low] + 1 };
  };
}

/** Converts a 0-based string offset into a 1-based line/column pair. */
export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  return createLineIndex(text)(offset);
}

/** Converts a 1-based line/column pair into a 0-based offset, clamped to the text. */
export function lineColumnToOffset(text: string, line: number, column: number): number {
  let currentLine = 1;
  let index = 0;
  while (currentLine < line) {
    const next = text.indexOf("\n", index);
    if (next === -1) return text.length;
    index = next + 1;
    currentLine++;
  }
  const lineEnd = text.indexOf("\n", index);
  const end = lineEnd === -1 ? text.length : lineEnd;
  return Math.min(index + Math.max(0, column - 1), end);
}
