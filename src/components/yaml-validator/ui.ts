export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md border text-sm font-medium whitespace-nowrap min-h-11 sm:min-h-9 px-3 transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const buttonStyles = {
  primary: cx(base, "border-accent bg-accent text-accent-contrast hover:bg-accent-hover hover:border-accent-hover"),
  secondary: cx(base, "border-line-strong bg-surface text-foreground hover:bg-surface-muted"),
  subtle: cx(base, "border-transparent bg-transparent text-foreground hover:bg-surface-muted"),
};

/** Standalone toggle button styling for aria-pressed buttons. */
export function toggleStyles(pressed: boolean): string {
  return cx(
    base,
    pressed
      ? "border-accent bg-accent-soft text-accent font-semibold ring-1 ring-accent"
      : "border-line-strong bg-surface text-foreground hover:bg-surface-muted",
  );
}

/** Toggle button styling for aria-pressed segmented controls. */
export function segmentStyles(pressed: boolean): string {
  return cx(
    base,
    "rounded-none first:rounded-l-md last:rounded-r-md -ml-px first:ml-0",
    pressed
      ? "relative z-10 border-accent bg-accent-soft text-accent font-semibold"
      : "border-line-strong bg-surface text-foreground hover:bg-surface-muted",
  );
}
