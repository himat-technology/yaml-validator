export type CopyResult = { ok: true } | { ok: false; error: string };

function legacyCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  const previousFocus = document.activeElement as HTMLElement | null;
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  previousFocus?.focus();
  return copied;
}

/**
 * Copies text with the async Clipboard API, falling back to the legacy
 * selection-based copy for non-secure contexts (e.g. plain http on a LAN IP).
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  if (text.length === 0) return { ok: false, error: "Nothing to copy." };
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (error) {
      if (legacyCopy(text)) return { ok: true };
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      return {
        ok: false,
        error: denied
          ? "Clipboard access was blocked by the browser. Select the text and press Ctrl+C (Cmd+C on macOS)."
          : "Could not copy to the clipboard. Select the text and copy it manually.",
      };
    }
  }
  if (typeof document !== "undefined" && legacyCopy(text)) return { ok: true };
  return {
    ok: false,
    error: "Clipboard is not available in this browser. Select the text and copy it manually.",
  };
}
