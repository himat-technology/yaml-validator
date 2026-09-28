import type { SourceLanguage } from "./types";

export const DOWNLOAD_FILES: Record<SourceLanguage, { fileName: string; mimeType: string }> = {
  yaml: { fileName: "validated.yaml", mimeType: "application/yaml;charset=utf-8" },
  json: { fileName: "converted.json", mimeType: "application/json;charset=utf-8" },
};

/** Triggers a browser download from an in-memory Blob; nothing touches a server. */
export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on a later tick so the browser has started reading the Blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadOutput(content: string, language: SourceLanguage): string {
  const { fileName, mimeType } = DOWNLOAD_FILES[language];
  downloadTextFile(content, fileName, mimeType);
  return fileName;
}
