import type { SourceLanguage } from "./types";

export const ACCEPTED_EXTENSIONS = [".yaml", ".yml", ".json"] as const;
export const ACCEPT_ATTRIBUTE = ".yaml,.yml,.json,application/json,application/yaml,application/x-yaml,text/yaml";

/** Files above this size are refused to keep the browser tab responsive. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function detectFileLanguage(fileName: string): SourceLanguage | null {
  const extension = getFileExtension(fileName);
  if (extension === ".json") return "json";
  if (extension === ".yaml" || extension === ".yml") return "yaml";
  return null;
}

/** Strips a UTF-8 byte order mark and normalises CRLF / CR line endings to LF. */
export function normalizeText(text: string): string {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom.replace(/\r\n?/g, "\n");
}

export type LoadedFile =
  | { ok: true; name: string; size: number; language: SourceLanguage; content: string }
  | { ok: false; name: string; error: string };

/** Minimal shape of a browser File that this module relies on. */
export interface TextFileLike {
  name: string;
  size: number;
  text(): Promise<string>;
}

/**
 * Reads a user-selected file entirely in the browser (File.text()); the file
 * is never sent anywhere.
 */
export async function readLocalFile(file: TextFileLike): Promise<LoadedFile> {
  const language = detectFileLanguage(file.name);
  if (!language) {
    return {
      ok: false,
      name: file.name,
      error: `Unsupported file type. Choose a ${ACCEPTED_EXTENSIONS.join(", ")} file.`,
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      name: file.name,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). The limit is ${MAX_FILE_BYTES / (1024 * 1024)} MB.`,
    };
  }
  try {
    const content = normalizeText(await file.text());
    if (content.includes("\u0000")) {
      return { ok: false, name: file.name, error: "The file appears to be binary, not text." };
    }
    return { ok: true, name: file.name, size: file.size, language, content };
  } catch (error) {
    return {
      ok: false,
      name: file.name,
      error: `Could not read the file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
