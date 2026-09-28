export type ToolMode = "format" | "yaml-to-json" | "json-to-yaml";

export type IndentSize = 2 | 4;

export type SourceLanguage = "yaml" | "json";

export interface ProcessOptions {
  indent: IndentSize;
  sortKeys: boolean;
}

export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * A problem found in the user's input. Positions are only present when the
 * underlying parser actually reported them; they are never estimated.
 * `line` and `column` are 1-based, `from`/`to` are 0-based string offsets.
 */
export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  code?: string;
  hint?: string;
  line?: number;
  column?: number;
  from?: number;
  to?: number;
}

export interface TextStats {
  characters: number;
  lines: number;
  bytes: number;
}

export type ProcessStatus = "empty" | "valid" | "invalid";

export interface ProcessResult {
  status: ProcessStatus;
  language: SourceLanguage;
  output: string;
  outputLanguage: SourceLanguage | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  documentCount: number;
  /** Number of mapping/object keys in the parsed input, or null when unparsable. */
  keyCount: number | null;
}

export interface ProcessRequest extends ProcessOptions {
  mode: ToolMode;
  input: string;
}
