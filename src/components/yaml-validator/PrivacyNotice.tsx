import { ShieldIcon } from "./Icons";

export function PrivacyNotice() {
  return (
    <aside
      aria-labelledby="privacy-heading"
      className="flex items-start gap-3 rounded-lg border border-valid/40 bg-valid-soft px-4 py-3 text-sm"
    >
      <span className="mt-0.5 text-valid">
        <ShieldIcon />
      </span>
      <div>
        <h2 id="privacy-heading" className="font-semibold text-valid">
          100% Client-Side Privacy
        </h2>
        <p className="text-foreground">
          Your YAML configurations never leave your browser. Parsing, validation, formatting and conversion run
          locally in this tab. Uploaded files are read with the browser&apos;s File API and are never sent to a server.
        </p>
      </div>
    </aside>
  );
}
