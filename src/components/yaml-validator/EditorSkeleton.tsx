export function EditorSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex h-full items-center justify-center bg-[var(--editor-bg)] font-mono text-sm text-muted"
      role="status"
    >
      Loading {label}…
    </div>
  );
}
