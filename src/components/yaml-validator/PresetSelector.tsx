import { PRESETS, type Preset } from "@/lib/presets";
import { toggleStyles } from "./ui";

interface PresetSelectorProps {
  activePresetId: Preset["id"] | null;
  onSelect: (preset: Preset) => void;
}

export function PresetSelector({ activePresetId, onSelect }: PresetSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id="preset-label" className="text-xs font-semibold uppercase tracking-wide text-muted">
        Presets
      </span>
      <div role="group" aria-labelledby="preset-label" className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={toggleStyles(activePresetId === preset.id)}
            aria-pressed={activePresetId === preset.id}
            title={preset.description}
            onClick={() => onSelect(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
