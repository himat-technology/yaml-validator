import type { ProcessRequest, ProcessResult, SourceLanguage, ToolMode } from "./types";
import { convertParsedYamlToJson, jsonToYaml } from "./yaml-converter";
import { formatParsedYaml } from "./yaml-formatter";
import { describeError, parseYaml } from "./yaml-parser";

export function inputLanguageForMode(mode: ToolMode): SourceLanguage {
  return mode === "json-to-yaml" ? "json" : "yaml";
}

export function outputLanguageForMode(mode: ToolMode): SourceLanguage {
  return mode === "yaml-to-json" ? "json" : "yaml";
}

function emptyResult(mode: ToolMode): ProcessResult {
  return {
    status: "empty",
    language: inputLanguageForMode(mode),
    output: "",
    outputLanguage: null,
    errors: [],
    warnings: [],
    documentCount: 0,
    keyCount: null,
  };
}

function run(request: ProcessRequest): ProcessResult {
  const { mode, input, indent, sortKeys } = request;
  const options = { indent, sortKeys };
  const language = inputLanguageForMode(mode);
  const outputLanguage = outputLanguageForMode(mode);

  if (input.trim() === "") return emptyResult(mode);

  if (mode === "json-to-yaml") {
    const result = jsonToYaml(input, options);
    return {
      status: result.ok ? "valid" : "invalid",
      language,
      output: result.output,
      outputLanguage: result.ok ? outputLanguage : null,
      errors: result.errors,
      warnings: result.warnings,
      documentCount: result.documentCount,
      keyCount: result.keyCount,
    };
  }

  const parsed = parseYaml(input);

  if (mode === "yaml-to-json") {
    const result = convertParsedYamlToJson(parsed, input, options);
    return {
      status: result.ok ? "valid" : "invalid",
      language,
      output: result.output,
      outputLanguage: result.ok ? outputLanguage : null,
      errors: result.errors,
      warnings: result.warnings,
      documentCount: result.documentCount,
      keyCount: result.keyCount,
    };
  }

  const result = formatParsedYaml(parsed, input, options);
  const warnings = [...result.warnings];
  if (result.ok && parsed.documents.length === 0) {
    warnings.push({ severity: "info", message: "No YAML documents found: the input contains only comments or whitespace." });
  }
  return {
    status: result.ok ? "valid" : "invalid",
    language,
    output: result.output,
    outputLanguage: result.ok ? outputLanguage : null,
    errors: result.errors,
    warnings,
    documentCount: parsed.documents.length,
    keyCount: parsed.keyCount,
  };
}

/** Runs validation/formatting/conversion for a request. Never throws. */
export function processInput(request: ProcessRequest): ProcessResult {
  try {
    return run(request);
  } catch (error) {
    return {
      ...emptyResult(request.mode),
      status: "invalid",
      errors: [{ severity: "error", message: `Unexpected processing failure: ${describeError(error)}` }],
    };
  }
}
