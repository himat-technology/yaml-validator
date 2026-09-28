import { formatBytes, formatCount } from "@/lib/text-stats";
import type { SourceLanguage, TextStats } from "@/lib/types";

interface ToolStatsProps {
  input: TextStats;
  output: TextStats | null;
  inputLanguage: SourceLanguage;
  outputLanguage: SourceLanguage;
  keyCount: number | null;
  documentCount: number | null;
}

function Stat({ label, value, sub, testId }: { label: string; value: string; sub?: string; testId?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg font-semibold" data-testid={testId}>
        {value}
      </dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  );
}

export function ToolStats({ input, output, inputLanguage, outputLanguage, keyCount, documentCount }: ToolStatsProps) {
  const inLabel = inputLanguage.toUpperCase();
  const outLabel = outputLanguage.toUpperCase();
  return (
    <section aria-labelledby="stats-heading" className="flex flex-col gap-2">
      <h2 id="stats-heading" className="text-sm font-semibold">
        Statistics
      </h2>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Payload Size"
          value={formatBytes(input.bytes)}
          sub={`${inLabel} input · ${formatCount(input.bytes)} B`}
          testId="stat-input-size"
        />
        <Stat label="Total Lines" value={formatCount(input.lines)} sub={`${inLabel} input`} testId="stat-input-lines" />
        <Stat
          label="Characters"
          value={formatCount(input.characters)}
          sub={`${inLabel} input`}
          testId="stat-input-chars"
        />
        <Stat
          label="Mapping Keys"
          value={keyCount === null ? "—" : formatCount(keyCount)}
          sub={keyCount === null ? "available when valid" : inputLanguage === "json" ? "object keys" : "all nesting levels"}
          testId="stat-keys"
        />
        <Stat
          label="Documents"
          value={documentCount === null ? "—" : formatCount(documentCount)}
          sub={inputLanguage === "yaml" ? "separated by ---" : "JSON value"}
          testId="stat-documents"
        />
        <Stat
          label="Output Size"
          value={output ? formatBytes(output.bytes) : "—"}
          sub={output ? `${outLabel} · ${formatCount(output.lines)} lines` : "no output yet"}
          testId="stat-output-size"
        />
      </dl>
    </section>
  );
}
