import type { ToolMode } from "@/lib/types";
import { buttonStyles, cx, toggleStyles } from "./ui";

interface ActionButtonsProps {
  mode: ToolMode;
  busy: boolean;
  onValidate: () => void;
  onModeChange: (mode: ToolMode) => void;
  className?: string;
}

const MODES: { mode: ToolMode; label: string; description: string }[] = [
  { mode: "format", label: "Format", description: "Validate YAML and output it re-indented" },
  { mode: "yaml-to-json", label: "YAML → JSON", description: "Convert YAML input to formatted JSON" },
  { mode: "json-to-yaml", label: "JSON → YAML", description: "Convert JSON input to YAML" },
];

export function ActionButtons({ mode, busy, onValidate, onModeChange, className }: ActionButtonsProps) {
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <button
        type="button"
        className={cx(buttonStyles.primary, "w-full text-base")}
        onClick={onValidate}
        aria-describedby="validate-shortcut"
        aria-busy={busy}
      >
        {busy ? "Validating…" : "Validate"}
      </button>
      <span id="validate-shortcut" className="sr-only">
        Shortcut: Control or Command plus Enter inside the editor.
      </span>
      <div className="flex flex-col gap-1.5">
        <span id="mode-label" className="text-xs font-semibold uppercase tracking-wide text-muted">
          Output mode
        </span>
        <div role="group" aria-labelledby="mode-label" className="grid grid-cols-3 gap-2 xl:grid-cols-1">
          {MODES.map((item) => (
            <button
              key={item.mode}
              type="button"
              title={item.description}
              aria-pressed={mode === item.mode}
              onClick={() => onModeChange(item.mode)}
              className={cx(toggleStyles(mode === item.mode), "px-2")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
