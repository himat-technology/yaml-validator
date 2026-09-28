import { isScalar, visit, type ToStringOptions } from "yaml";
import { sortYamlDocumentKeys } from "./key-sort";
import { createLineIndex, type LineColumnLookup } from "./text-stats";
import type { Diagnostic, ProcessOptions } from "./types";
import { describeError, parseYaml, type ParsedYaml, type YamlDocument } from "./yaml-parser";

export function yamlToStringOptions(indent: number): ToStringOptions {
  // lineWidth 0 disables re-wrapping of long plain scalars.
  return { indent, lineWidth: 0 };
}

/** Serialises parsed documents back into a single YAML stream. */
export function stringifyYamlDocuments(
  documents: readonly YamlDocument[],
  { indent, sortKeys }: ProcessOptions,
): string {
  const options = yamlToStringOptions(indent);
  return documents
    .map((doc, index) => {
      if (sortKeys) sortYamlDocumentKeys(doc);
      const text = doc.toString(options);
      return index > 0 && !text.startsWith("---") ? `---\n${text}` : text;
    })
    .join("");
}

const YAML_11_BOOLEAN = /^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF)$/;

/**
 * Flags unquoted values such as `yes` or `off`: they are strings in YAML 1.2
 * but booleans in YAML 1.1 parsers (PyYAML, older Go/Ruby libraries).
 */
export function lintYaml11Booleans(documents: readonly YamlDocument[], source: string): Diagnostic[] {
  const found: Diagnostic[] = [];
  let lookup: LineColumnLookup | undefined;
  for (const doc of documents) {
    visit(doc, {
      Pair(_, pair) {
        const value = pair.value;
        if (
          isScalar(value) &&
          value.type === "PLAIN" &&
          typeof value.value === "string" &&
          YAML_11_BOOLEAN.test(value.value) &&
          value.range
        ) {
          const from = value.range[0];
          lookup ??= createLineIndex(source);
          const { line, column } = lookup(from);
          found.push({
            severity: "warning",
            code: "YAML11_BOOLEAN",
            message: `Unquoted "${value.value}" is a string in YAML 1.2 but a boolean in YAML 1.1 parsers`,
            hint: `Quote it ("${value.value}") if you mean a string, or use true/false if you mean a boolean.`,
            line,
            column,
            from,
            to: value.range[1],
          });
        }
      },
    });
  }
  return found;
}

export interface FormatYamlResult {
  ok: boolean;
  output: string;
  parsed: ParsedYaml;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

export function formatParsedYaml(parsed: ParsedYaml, source: string, options: ProcessOptions): FormatYamlResult {
  const warnings = [...parsed.warnings, ...lintYaml11Booleans(parsed.documents, source)];
  if (parsed.errors.length > 0) {
    return { ok: false, output: "", parsed, errors: parsed.errors, warnings };
  }
  try {
    const output = stringifyYamlDocuments(parsed.documents, options);
    return { ok: true, output, parsed, errors: [], warnings };
  } catch (error) {
    const message = describeError(error);
    const errors: Diagnostic[] = [
      options.sortKeys && /Unresolved alias/i.test(message)
        ? {
            severity: "error",
            message: "Sort Keys cannot reorder this document: the same anchor name is defined more than once.",
            hint: "Give each anchor (&name) a unique name, or turn Sort Keys off.",
          }
        : { severity: "error", message: `Could not format YAML: ${message}` },
    ];
    return { ok: false, output: "", parsed, errors, warnings };
  }
}

/** Validates and re-indents YAML (optionally sorting keys). Never throws. */
export function formatYaml(source: string, options: ProcessOptions): FormatYamlResult {
  return formatParsedYaml(parseYaml(source), source, options);
}
