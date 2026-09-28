"use client";

import { useRef } from "react";
import { ACCEPT_ATTRIBUTE } from "@/lib/file-utils";
import { UploadIcon } from "./Icons";
import { buttonStyles } from "./ui";

interface FileUploaderProps {
  onFile: (file: File) => void;
}

/** Opens the native file picker; the chosen file is read locally by the caller. */
export function FileUploader({ onFile }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className={buttonStyles.secondary}
        onClick={() => inputRef.current?.click()}
        aria-label="Upload File (.yaml, .yml or .json, read locally)"
      >
        <UploadIcon />
        <span>Upload File</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Reset so selecting the same file again still fires onChange.
          event.target.value = "";
        }}
      />
    </>
  );
}
