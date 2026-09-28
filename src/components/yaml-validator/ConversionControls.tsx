import type { IndentSize } from "@/lib/types";
import { segmentStyles } from "./ui";

interface ConversionControlsProps {
  indent: IndentSize;
  sortKeys: boolean;
  liveValidation: boolean;
  onIndentChange: (indent: IndentSize) => void;
  onSortKeysChange: (sortKeys: boolean) => void;
  onLiveValidationChange: (live: boolean) => void;
}

function Switch({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-surface-muted sm:min-h-9"
      title={description}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        aria-describedby={`${id}-description`}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative inline-block h-5 w-9 shrink-0 rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] ${
          checked ? "border-accent bg-accent" : "border-line-strong bg-surface-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-transform ${
            checked ? "translate-x-4 bg-accent-contrast" : "translate-x-0.5 bg-muted"
          }`}
        />
      </span>
      <span>{label}</span>
      <span id={`${id}-description`} className="sr-only">
        {description}
      </span>
    </label>
  );
}

export function ConversionControls({
  indent,
  sortKeys,
  liveValidation,
  onIndentChange,
  onSortKeysChange,
  onLiveValidationChange,
}: ConversionControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex flex-col gap-1.5">
        <span id="indent-label" className="text-xs font-semibold uppercase tracking-wide text-muted">
          Indentation
        </span>
        <div role="group" aria-labelledby="indent-label" className="flex">
          {([2, 4] as const).map((size) => (
            <button
              key={size}
              type="button"
              className={segmentStyles(indent === size)}
              aria-pressed={indent === size}
              onClick={() => onIndentChange(size)}
            >
              {size} Spaces
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Options</span>
        <div className="flex flex-wrap gap-2">
          <Switch
            id="sort-keys"
            label="Sort Keys"
            description="Recursively sort mapping keys alphabetically in the output. Array order and the input are never changed."
            checked={sortKeys}
            onChange={onSortKeysChange}
          />
          <Switch
            id="live-validation"
            label="Live validation"
            description="Validate automatically while typing."
            checked={liveValidation}
            onChange={onLiveValidationChange}
          />
        </div>
      </div>
    </div>
  );
}
