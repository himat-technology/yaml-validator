import { isCollection, parseDocument, stringify, visit } from "yaml";
import { positionFromNativeJsonError, scanJson } from "./json-diagnostics";
import { sortKeysDeep } from "./key-sort";
import { countObjectKeys, createLineIndex, lineColumnToOffset } from "./text-stats";
import type { Diagnostic, ProcessOptions } from "./types";
import { lintYaml11Booleans } from "./yaml-formatter";
import { describeError, parseYaml, reviveSafeIntegers, type ParsedYaml } from "./yaml-parser";

export interface ConversionResult {
  ok: boolean;
  output: string;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  documentCount: number;
  keyCount: number | null;
}

/* ------------------------------------------------------------------ */
/* YAML -> JSON                                                        */
/* ------------------------------------------------------------------ */

interface NormalizeContext {
  token: string;
  bigints: string[];
  notes: Set<"non-finite" | "binary" | "set" | "map" | "date">;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function setOwn(target: Record<string, unknown>, key: string, value: unknown) {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

/**
 * Converts values produced by the YAML parser into values JSON can represent
 * without silent data loss (JSON.stringify would turn a Set into `{}`).
 */
function normalizeForJson(value: unknown, ctx: NormalizeContext): unknown {
  if (typeof value === "bigint") {
    if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
    ctx.bigints.push(value.toString());
    return `${ctx.token}${ctx.bigints.length - 1}`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      ctx.notes.add("non-finite");
      return null;
    }
    return value;
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => normalizeForJson(item, ctx));
  if (value instanceof Uint8Array) {
    ctx.notes.add("binary");
    return toBase64(value);
  }
  if (value instanceof Date) {
    ctx.notes.add("date");
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value instanceof Set) {
    ctx.notes.add("set");
    return [...value].map((item) => normalizeForJson(item, ctx));
  }
  const out: Record<string, unknown> = {};
  if (value instanceof Map) {
    ctx.notes.add("map");
    for (const [key, item] of value) setOwn(out, String(key), normalizeForJson(item, ctx));
    return out;
  }
  for (const key of Object.keys(value)) {
    setOwn(out, key, normalizeForJson((value as Record<string, unknown>)[key], ctx));
  }
  return out;
}

const NOTE_MESSAGES: Record<string, string> = {
  "non-finite": "Infinity/NaN values (.inf, .nan) cannot be represented in JSON and were converted to null.",
  binary: "Binary (!!binary) values were converted to base64 strings.",
  set: "Sets (!!set) were converted to JSON arrays.",
  map: "Ordered maps (!!omap / !!pairs) were converted to JSON objects.",
  date: "Timestamps were converted to ISO 8601 strings.",
};

function randomToken(): string {
  return `__yaml_bigint_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}_`;
}

/** JSON.stringify with exact output for integers beyond Number.MAX_SAFE_INTEGER. */
export function stringifyJson(value: unknown, indent: number, sortKeys: boolean): { text: string; notes: string[] } {
  const ctx: NormalizeContext = { token: randomToken(), bigints: [], notes: new Set() };
  let normalized = normalizeForJson(value, ctx);
  if (sortKeys) normalized = sortKeysDeep(normalized);
  let text = JSON.stringify(normalized, null, indent) ?? "null";
  if (ctx.bigints.length > 0) {
    const pattern = new RegExp(`"${ctx.token}(\\d+)"`, "g");
    text = text.replace(pattern, (_, index: string) => ctx.bigints[Number(index)]);
  }
  const notes = [...ctx.notes].map((note) => NOTE_MESSAGES[note]);
  if (ctx.bigints.length > 0) {
    notes.push(
      "Integers larger than 2^53 were written exactly, but many JSON parsers (including JavaScript's) will round them.",
    );
  }
  return { text, notes };
}

/** JSON keys must be strings, so keys that are lists or maps get stringified. */
function findCollectionKeys(documents: ParsedYaml["documents"], source: string): Diagnostic[] {
  const found: Diagnostic[] = [];
  let lookup: ReturnType<typeof createLineIndex> | undefined;
  for (const doc of documents) {
    visit(doc, {
      Pair(_, pair) {
        if (!isCollection(pair.key)) return;
        const from = pair.key.range?.[0];
        const position = from === undefined ? {} : (lookup ??= createLineIndex(source))(from);
        found.push({
          severity: "warning",
          code: "COLLECTION_KEY",
          message: "A list or mapping is used as a key; JSON only allows string keys, so it was converted to text",
          ...position,
          from,
          to: pair.key.range?.[1],
        });
      },
    });
  }
  return found;
}

export function convertParsedYamlToJson(
  parsed: ParsedYaml,
  source: string,
  { indent, sortKeys }: ProcessOptions,
): ConversionResult {
  const warnings = [...parsed.warnings, ...lintYaml11Booleans(parsed.documents, source)];
  const base = { documentCount: parsed.documents.length, keyCount: parsed.keyCount };
  if (parsed.errors.length > 0) {
    return { ok: false, output: "", errors: parsed.errors, warnings, ...base };
  }
  if (parsed.documents.length === 0) {
    warnings.push({ severity: "info", message: "The YAML contains no documents (only comments or whitespace)." });
    return { ok: true, output: "", errors: [], warnings, ...base };
  }
  warnings.push(...findCollectionKeys(parsed.documents, source));
  const data = parsed.values.length === 1 ? parsed.values[0] : parsed.values;
  if (parsed.values.length > 1) {
    warnings.push({
      severity: "info",
      message: `The YAML stream contains ${parsed.values.length} documents; they were converted into a JSON array (one element per document).`,
    });
  }
  try {
    const { text, notes } = stringifyJson(data, indent, sortKeys);
    for (const message of notes) warnings.push({ severity: "info", message });
    return { ok: true, output: `${text}\n`, errors: [], warnings, ...base };
  } catch (error) {
    return {
      ok: false,
      output: "",
      errors: [{ severity: "error", message: `Could not convert to JSON: ${describeError(error)}` }],
      warnings,
      ...base,
    };
  }
}

/** Parses YAML and converts it into formatted JSON. Never throws. */
export function yamlToJson(source: string, options: ProcessOptions): ConversionResult {
  return convertParsedYamlToJson(parseYaml(source), source, options);
}

/* ------------------------------------------------------------------ */
/* JSON parsing                                                        */
/* ------------------------------------------------------------------ */

export type JsonParseResult =
  | { ok: true; value: unknown; warnings: Diagnostic[] }
  | { ok: false; errors: Diagnostic[] };

function diagnosticAt(source: string, offset: number, message: string, code: string): Diagnostic {
  const { line, column } = createLineIndex(source)(offset);
  return { severity: "error", code, message, line, column, from: offset, to: Math.min(offset + 1, source.length) };
}

/**
 * Parses JSON with the native parser. On failure, the diagnostic scanner is
 * used to pinpoint the problem consistently across browsers.
 */
export function parseJson(source: string): JsonParseResult {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    const scan = scanJson(source);
    if (scan.error) {
      return { ok: false, errors: [diagnosticAt(source, scan.error.offset, scan.error.message, "JSON_SYNTAX")] };
    }
    const nativeMessage = describeError(error);
    const position = positionFromNativeJsonError(nativeMessage);
    if (position) {
      const offset =
        "offset" in position ? position.offset : lineColumnToOffset(source, position.line, position.column);
      return { ok: false, errors: [diagnosticAt(source, offset, nativeMessage, "JSON_SYNTAX")] };
    }
    return { ok: false, errors: [{ severity: "error", code: "JSON_SYNTAX", message: nativeMessage }] };
  }

  const warnings: Diagnostic[] = [];
  const scan = scanJson(source);
  const lookup = createLineIndex(source);
  for (const dup of scan.duplicateKeys) {
    const { line, column } = lookup(dup.offset);
    warnings.push({
      severity: "warning",
      code: "DUPLICATE_KEY",
      message: `Duplicate key "${dup.key}": only the last value is kept`,
      hint: "JSON parsers disagree on duplicate keys. Remove or rename the repeated key.",
      line,
      column,
      from: dup.offset,
      to: dup.offset + dup.key.length + 2,
    });
  }

  for (const item of scan.overflowNumbers) {
    const { line, column } = lookup(item.offset);
    warnings.push({
      severity: "warning",
      code: "NUMBER_OVERFLOW",
      message: `Number ${item.literal} is too large for a 64-bit float and becomes ${item.literal.startsWith("-") ? "-.inf" : ".inf"} (infinity)`,
      hint: "Quote the value if the exact digits matter.",
      line,
      column,
      from: item.offset,
      to: item.offset + item.literal.length,
    });
  }

  if (scan.unsafeIntegers.length > 0) {
    // Valid JSON is valid YAML 1.2; re-reading it with BigInt integers keeps them exact.
    const exact = readJsonWithBigInts(source);
    if (exact.ok) {
      value = exact.value;
    } else {
      for (const item of scan.unsafeIntegers) {
        const { line, column } = lookup(item.offset);
        warnings.push({
          severity: "warning",
          code: "UNSAFE_INTEGER",
          message: `Integer ${item.literal} exceeds JavaScript's safe range and was rounded to ${Number(item.literal)}`,
          line,
          column,
          from: item.offset,
          to: item.offset + item.literal.length,
        });
      }
    }
  }
  return { ok: true, value, warnings };
}

function readJsonWithBigInts(source: string): { ok: true; value: unknown } | { ok: false } {
  try {
    const doc = parseDocument(source, { schema: "json", intAsBigInt: true, uniqueKeys: false, logLevel: "error" });
    if (doc.errors.length > 0) return { ok: false };
    return { ok: true, value: doc.toJS({ reviver: reviveSafeIntegers }) };
  } catch {
    return { ok: false };
  }
}

/* ------------------------------------------------------------------ */
/* JSON -> YAML                                                        */
/* ------------------------------------------------------------------ */

export function stringifyYamlValue(value: unknown, indent: number, sortKeys: boolean): string {
  const data = sortKeys ? sortKeysDeep(value) : value;
  // compat: quote strings such as "yes" or "on" so YAML 1.1 parsers read them as strings too.
  return stringify(data, {
    indent,
    lineWidth: 0,
    compat: "yaml-1.1",
    aliasDuplicateObjects: false,
    logLevel: "error",
  });
}

function looksLikeYaml(source: string): boolean {
  const trimmed = source.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
  const parsed = parseYaml(source);
  return (
    parsed.errors.length === 0 &&
    parsed.values.some((v) => v !== null && typeof v === "object")
  );
}

/** Parses JSON and converts it into YAML. Never throws. */
export function jsonToYaml(source: string, { indent, sortKeys }: ProcessOptions): ConversionResult {
  const parsed = parseJson(source);
  if (!parsed.ok) {
    const errors = parsed.errors;
    if (looksLikeYaml(source)) {
      errors[0] = {
        ...errors[0],
        hint: "This input looks like YAML rather than JSON. Use Format or YAML → JSON instead.",
      };
    }
    return { ok: false, output: "", errors, warnings: [], documentCount: 0, keyCount: null };
  }
  try {
    const output = stringifyYamlValue(parsed.value, indent, sortKeys);
    return {
      ok: true,
      output,
      errors: [],
      warnings: parsed.warnings,
      documentCount: 1,
      keyCount: countObjectKeys(parsed.value),
    };
  } catch (error) {
    return {
      ok: false,
      output: "",
      errors: [{ severity: "error", message: `Could not convert to YAML: ${describeError(error)}` }],
      warnings: parsed.warnings,
      documentCount: 1,
      keyCount: countObjectKeys(parsed.value),
    };
  }
}
