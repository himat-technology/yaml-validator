"use client";

import { useEffect, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard-utils";
import { CheckIcon, CopyIcon } from "./Icons";
import { buttonStyles } from "./ui";

interface CopyButtonProps {
  label: string;
  getText: () => string;
  disabled?: boolean;
  ariaLabel?: string;
  onResult?: (message: string, ok: boolean) => void;
}

type CopyState = "idle" | "copied" | "failed";

export function CopyButton({ label, getText, disabled, ariaLabel, onResult }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const handle = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(handle);
  }, [state]);

  async function handleClick() {
    const result = await copyToClipboard(getText());
    if (result.ok) {
      setState("copied");
      onResult?.(`${label}: copied to clipboard.`, true);
    } else {
      setState("failed");
      onResult?.(result.error, false);
    }
  }

  return (
    <button
      type="button"
      className={buttonStyles.secondary}
      onClick={handleClick}
      disabled={disabled}
      aria-label={state === "idle" ? (ariaLabel ?? label) : undefined}
      data-copy-state={state}
    >
      {state === "copied" ? <CheckIcon /> : <CopyIcon />}
      <span>{state === "copied" ? "Copied!" : state === "failed" ? "Copy failed" : label}</span>
    </button>
  );
}
