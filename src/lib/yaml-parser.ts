import {
  parseAllDocuments,
  visit,
  type Document,
  type DocumentOptions,
  type ErrorCode,
  type ParseOptions,
  type SchemaOptions,
  type YAMLError,
} from "yaml";
import { createLineIndex } from "./text-stats";
import type { Diagnostic, DiagnosticSeverity } from "./types";

export type YamlDocument = Document.Parsed;

/**
 * Integers are parsed as BigInt so values beyond Number.MAX_SAFE_INTEGER are
 * never rounded when the document is re-formatted or converted.
 */
export const YAML_PARSE_OPTIONS: ParseOptions & DocumentOptions & SchemaOptions = {
  prettyErrors: true,
  strict: true,
  uniqueKeys: true,
  merge: true,
  intAsBigInt: true,
  // The library would otherwise print warnings (which quote document content) to the console.
  logLevel: "error",
};

/** Limit on alias expansion, guarding against "billion laughs" documents. */
export const MAX_ALIAS_COUNT = 100;

const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** toJS reviver: keeps BigInt only for integers that a JS number cannot hold exactly. */
export function reviveSafeIntegers(_key: unknown, value: unknown): unknown {
  if (typeof value === "bigint" && value >= MIN_SAFE && value <= MAX_SAFE) return Number(value);
  return value;
}

const HINTS: Partial<Record<ErrorCode, string>> = {
  BAD_INDENT:
    "Items at the same level must start at the same column. Compare this line's indentation with its siblings.",
  TAB_AS_INDENT: "YAML does not allow tab characters for indentation. Replace tabs with spaces.",
  MISSING_CHAR:
    "A closing character is missing, usually an unterminated quote, bracket or brace.",
  MULTILINE_IMPLICIT_KEY:
    "A mapping key must be on a single line and followed by a colon. This line may be missing a ':' after the key.",
  BLOCK_AS_IMPLICIT_KEY:
    "Mapping values are not allowed here. If the value contains ': ', wrap it in quotes; otherwise check the indentation.",
  DUPLICATE_KEY: "Each key in a mapping must be unique. Remove or rename the repeated key.",
  BAD_DQ_ESCAPE: "Invalid escape sequence inside a double-quoted string.",
  UNEXPECTED_TOKEN:
    "Unexpected content. Check for stray characters, a missing '-' before a list item, or misaligned indentation.",
  BAD_SCALAR_START: "This value cannot start with this character unless it is quoted.",
  BLOCK_IN_FLOW: "Block-style collections cannot be nested inside flow collections ([ ] or { }).",
  MULTIPLE_ANCHORS: "A node can only have one anchor (&name).",
  MULTIPLE_TAGS: "A node can only have one tag.",
  BAD_ALIAS: "An alias (*name) must refer to an anchor (&name) defined earlier in the document.",
  KEY_OVER_1024_CHARS: "Implicit keys must be shorter than 1024 characters.",
  TAG_RESOLVE_FAILED:
    "Custom tags (for example CloudFormation's !Ref) are valid YAML but are not understood by this tool; the value is treated as a plain string.",
  RESOURCE_EXHAUSTION: "The document expands too many aliases and was rejected as a safety measure.",
};

const NESTING_TOO_DEEP = "NESTING_TOO_DEEP";

const MISSING_COLON_HINT =
  "This line looks like a key without a value. Add ': ' after the key (for example \"image: example/api:1.0.0\"), or turn it into a list item with '- '.";

function hintFor(error: YAMLError): string | undefined {
  if (error.code === "MISSING_CHAR" && /^Implicit map keys need to be followed by map values/.test(error.message)) {
    return MISSING_COLON_HINT;
  }
  return HINTS[error.code];
}

/** Removes the " at line X, column Y:" suffix and code excerpt the parser appends. */
export function cleanYamlErrorMessage(message: string): string {
  return message.replace(/\s+at line \d+, column \d+:[\s\S]*$/, "").trim();
}

export function yamlErrorToDiagnostic(
  error: YAMLError,
  severity: DiagnosticSeverity = error.name === "YAMLWarning" ? "warning" : "error",
): Diagnostic {
  const start = error.linePos?.[0];
  if (error.code === "RESOURCE_EXHAUSTION" && /call stack|stack overflow/i.test(error.message)) {
    return {
      severity,
      code: NESTING_TOO_DEEP,
      message: "The document is nested too deeply to process in the browser",
      hint: "Reduce the nesting depth. Real-world configuration files are rarely nested more than a few dozen levels.",
      line: start?.line,
      column: start?.col,
      from: error.pos?.[0],
      to: error.pos?.[1],
    };
  }
  return {
    severity,
    code: error.code,
    message: cleanYamlErrorMessage(error.message),
    hint: hintFor(error),
    line: start?.line,
    column: start?.col,
    from: error.pos?.[0],
    to: error.pos?.[1],
  };
}

function dedupe(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((d) => {
    // A stack overflow is reported once per affected parser stage; one report is enough.
    const key = d.code === NESTING_TOO_DEEP ? d.code : `${d.line ?? ""}:${d.column ?? ""}:${d.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort(
    (a, b) =>
      (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER) ||
      (a.column ?? 0) - (b.column ?? 0),
  );
}

export function countYamlMappingKeys(documents: readonly YamlDocument[]): number {
  let count = 0;
  for (const doc of documents) {
    visit(doc, {
      Map(_, map) {
        count += map.items.length;
      },
    });
  }
  return count;
}

function findUnresolvedAliases(doc: YamlDocument, source: string): Diagnostic[] {
  const found: Diagnostic[] = [];
  const lookup = createLineIndex(source);
  visit(doc, {
    Alias(_, alias) {
      if (alias.resolve(doc) === undefined) {
        const from = alias.range?.[0];
        const position = from === undefined ? undefined : lookup(from);
        found.push({
          severity: "error",
          code: "UNRESOLVED_ALIAS",
          message: `Unresolved alias *${alias.source}: no anchor &${alias.source} is defined before it`,
          hint: HINTS.BAD_ALIAS,
          line: position?.line,
          column: position?.column,
          from,
          to: alias.range?.[1],
        });
      }
    },
  });
  return found;
}

export interface ParsedYaml {
  documents: YamlDocument[];
  /** Plain JavaScript values, one per document; only set when there are no errors. */
  values: unknown[];
  errors: Diagnostic[];
  warnings: Diagnostic[];
  keyCount: number;
}

/**
 * Parses a (possibly multi-document) YAML stream. Never throws: every failure
 * is reported through `errors`.
 */
export function parseYaml(source: string): ParsedYaml {
  let stream: ReturnType<typeof parseAllDocuments>;
  try {
    stream = parseAllDocuments(source, YAML_PARSE_OPTIONS);
  } catch (error) {
    return {
      documents: [],
      values: [],
      errors: [{ severity: "error", message: `YAML parser failure: ${describeError(error)}` }],
      warnings: [],
      keyCount: 0,
    };
  }

  const documents = [...stream] as YamlDocument[];
  const rawErrors: YAMLError[] = [];
  const rawWarnings: YAMLError[] = [];
  if ("empty" in stream) {
    rawErrors.push(...stream.errors);
    rawWarnings.push(...stream.warnings);
  }
  for (const doc of documents) {
    rawErrors.push(...doc.errors);
    rawWarnings.push(...doc.warnings);
  }

  const errors = rawErrors.map((e) => yamlErrorToDiagnostic(e, "error"));
  const warnings = rawWarnings.map((e) => yamlErrorToDiagnostic(e, "warning"));
  const values: unknown[] = [];

  if (errors.length === 0) {
    for (const doc of documents) {
      try {
        values.push(doc.toJS({ maxAliasCount: MAX_ALIAS_COUNT, reviver: reviveSafeIntegers }));
      } catch (error) {
        const aliasErrors = findUnresolvedAliases(doc, source);
        if (aliasErrors.length > 0) {
          errors.push(...aliasErrors);
        } else {
          const message = describeError(error);
          const aliasProblem = /alias/i.test(message);
          errors.push({
            severity: "error",
            code: aliasProblem ? "RESOURCE_EXHAUSTION" : undefined,
            message: message.charAt(0).toUpperCase() + message.slice(1),
            hint: aliasProblem ? HINTS.RESOURCE_EXHAUSTION : undefined,
          });
        }
      }
    }
  }

  return {
    documents,
    values: errors.length === 0 ? values : [],
    errors: sortDiagnostics(dedupe(errors)),
    warnings: sortDiagnostics(dedupe(warnings)),
    keyCount: countYamlMappingKeys(documents),
  };
}

export function describeError(error: unknown): string {
  if (error instanceof RangeError && /call stack/i.test(error.message)) {
    return "the document is nested too deeply to process in the browser. Reduce the nesting depth and try again.";
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
