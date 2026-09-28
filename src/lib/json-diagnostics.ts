/**
 * A strict RFC 8259 syntax scanner used only for diagnostics: it locates the
 * first syntax error, duplicate keys and integers that lose precision in
 * JavaScript. Actual parsing is always done by the native JSON.parse.
 * The scanner is iterative, so deeply nested input cannot overflow the stack.
 */

export interface JsonSyntaxError {
  offset: number;
  message: string;
}

export interface JsonScanResult {
  error?: JsonSyntaxError;
  duplicateKeys: { key: string; offset: number }[];
  unsafeIntegers: { literal: string; offset: number }[];
  /** Numbers too large for a double; JSON.parse turns them into Infinity. */
  overflowNumbers: { literal: string; offset: number }[];
}

type Frame = { kind: "object"; keys: Set<string> } | { kind: "array" };

const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const WORD_PATTERN = /[A-Za-z_$][\w$]*/y;
const HEX = /^[0-9a-fA-F]{4}$/;

function describeChar(ch: string): string {
  if (ch === "\n") return "line break";
  if (ch === "\t") return "tab";
  if (ch === "\uFEFF") return "byte order mark";
  return `'${ch}'`;
}

export function scanJson(text: string): JsonScanResult {
  const n = text.length;
  const stack: Frame[] = [];
  const duplicateKeys: JsonScanResult["duplicateKeys"] = [];
  const unsafeIntegers: JsonScanResult["unsafeIntegers"] = [];
  const overflowNumbers: JsonScanResult["overflowNumbers"] = [];
  let i = 0;

  const fail = (offset: number, message: string): JsonScanResult => ({
    error: { offset: Math.min(offset, n), message },
    duplicateKeys,
    unsafeIntegers,
    overflowNumbers,
  });

  const skipWhitespace = () => {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else break;
    }
  };

  /** Reads a string starting at `i` (which must be '"'); returns an error or null. */
  const readString = (): JsonSyntaxError | null => {
    const start = i;
    i++;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 34) {
        i++;
        return null;
      }
      if (c === 92) {
        const next = text[i + 1];
        if (next === "u") {
          if (!HEX.test(text.slice(i + 2, i + 6))) {
            return { offset: i, message: "Invalid unicode escape: expected \\u followed by 4 hex digits" };
          }
          i += 6;
          continue;
        }
        if (next !== undefined && '"\\/bfnrt'.includes(next)) {
          i += 2;
          continue;
        }
        return { offset: i, message: `Invalid escape sequence '\\${next ?? ""}' in string` };
      }
      if (c === 10 || c === 13) {
        return {
          offset: start,
          message: "Unterminated string: line breaks are not allowed inside JSON strings (use \\n)",
        };
      }
      if (c < 0x20) {
        return { offset: i, message: "Control characters must be escaped inside JSON strings" };
      }
      i++;
    }
    return { offset: start, message: "Unterminated string: missing closing double quote" };
  };

  const readKey = (frame: { keys: Set<string> }): JsonSyntaxError | null => {
    skipWhitespace();
    if (i >= n) return { offset: n, message: "Unexpected end of input: expected a property name" };
    const ch = text[i];
    if (ch !== '"') {
      if (ch === "'") return { offset: i, message: "Property names must use double quotes, not single quotes" };
      if (ch === "}") return { offset: i, message: "Trailing comma is not allowed before '}'" };
      WORD_PATTERN.lastIndex = i;
      if (WORD_PATTERN.test(text)) {
        return { offset: i, message: "Property names must be wrapped in double quotes" };
      }
      return { offset: i, message: `Unexpected ${describeChar(ch)}: expected a property name in double quotes` };
    }
    const keyStart = i;
    const error = readString();
    if (error) return error;
    const key = JSON.parse(text.slice(keyStart, i)) as string;
    if (frame.keys.has(key)) duplicateKeys.push({ key, offset: keyStart });
    else frame.keys.add(key);
    skipWhitespace();
    if (text[i] !== ":") {
      return i >= n
        ? { offset: n, message: "Unexpected end of input: expected ':' after property name" }
        : { offset: i, message: `Expected ':' after property name "${key}"` };
    }
    i++;
    return null;
  };

  let expectingValue = true;

  while (true) {
    skipWhitespace();
    if (expectingValue) {
      if (i >= n) {
        return fail(n, stack.length === 0 ? "Empty input: expected a JSON value" : "Unexpected end of input: expected a value");
      }
      const ch = text[i];
      if (ch === "{") {
        i++;
        const frame: Frame = { kind: "object", keys: new Set() };
        stack.push(frame);
        skipWhitespace();
        if (text[i] === "}") {
          i++;
          stack.pop();
          expectingValue = false;
          continue;
        }
        const error = readKey(frame);
        if (error) return fail(error.offset, error.message);
        continue;
      }
      if (ch === "[") {
        i++;
        stack.push({ kind: "array" });
        skipWhitespace();
        if (text[i] === "]") {
          i++;
          stack.pop();
          expectingValue = false;
        }
        continue;
      }
      if (ch === '"') {
        const error = readString();
        if (error) return fail(error.offset, error.message);
        expectingValue = false;
        continue;
      }
      if (ch === "-" || (ch >= "0" && ch <= "9")) {
        NUMBER_PATTERN.lastIndex = i;
        const match = NUMBER_PATTERN.exec(text);
        if (!match) return fail(i, "Invalid number");
        const literal = match[0];
        const after = text[i + literal.length];
        if (/^-?0$/.test(literal) && after !== undefined && after >= "0" && after <= "9") {
          return fail(i, "Numbers cannot have leading zeros");
        }
        if (after === "." || after === "e" || after === "E" || (after !== undefined && after >= "0" && after <= "9")) {
          return fail(i, `Invalid number '${literal}${after}'`);
        }
        if (!/[.eE]/.test(literal)) {
          if (!Number.isSafeInteger(Number(literal))) unsafeIntegers.push({ literal, offset: i });
        } else if (!Number.isFinite(Number(literal))) {
          overflowNumbers.push({ literal, offset: i });
        }
        i += literal.length;
        expectingValue = false;
        continue;
      }
      WORD_PATTERN.lastIndex = i;
      const word = WORD_PATTERN.exec(text)?.[0];
      if (word === "true" || word === "false" || word === "null") {
        i += word.length;
        expectingValue = false;
        continue;
      }
      if (word === "NaN" || word === "Infinity" || word === "undefined") {
        return fail(i, `${word} is not a valid JSON value`);
      }
      if (word) return fail(i, `Unexpected token '${word}': strings must be wrapped in double quotes`);
      if (ch === "'") return fail(i, "Strings must use double quotes, not single quotes");
      if (ch === "/") return fail(i, "Comments are not allowed in JSON");
      if (ch === "+") return fail(i, "Numbers cannot start with '+'");
      if (ch === ".") return fail(i, "Numbers must have a digit before the decimal point");
      if (ch === "]" && stack[stack.length - 1]?.kind === "array") {
        return fail(i, "Trailing comma is not allowed before ']'");
      }
      return fail(i, `Unexpected ${describeChar(ch)}: expected a value`);
    }

    const top = stack[stack.length - 1];
    if (!top) {
      if (i < n) {
        const ch = text[i];
        if (ch === "/") return fail(i, "Comments are not allowed in JSON");
        return fail(i, `Unexpected ${describeChar(ch)} after the end of the JSON value`);
      }
      return { duplicateKeys, unsafeIntegers, overflowNumbers };
    }
    const closer = top.kind === "object" ? "}" : "]";
    if (i >= n) return fail(n, `Unexpected end of input: expected ',' or '${closer}'`);
    const ch = text[i];
    if (ch === ",") {
      i++;
      if (top.kind === "object") {
        const error = readKey(top);
        if (error) return fail(error.offset, error.message);
      }
      expectingValue = true;
      continue;
    }
    if (ch === closer) {
      i++;
      stack.pop();
      continue;
    }
    if (ch === "/") return fail(i, "Comments are not allowed in JSON");
    return fail(
      i,
      top.kind === "object"
        ? `Expected ',' or '}' after a property value but found ${describeChar(ch)}`
        : `Expected ',' or ']' after an array element but found ${describeChar(ch)}`,
    );
  }
}

/**
 * Best-effort position extraction from a native JSON.parse error message.
 * Different engines report positions differently (or not at all).
 */
export function positionFromNativeJsonError(
  message: string,
): { offset: number } | { line: number; column: number } | undefined {
  const lineColumn = /line (\d+) column (\d+)/i.exec(message);
  if (lineColumn) return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
  const position = /at position (\d+)/i.exec(message);
  if (position) return { offset: Number(position[1]) };
  return undefined;
}
