const steps = [
  {
    title: "Paste, upload or pick a preset",
    body: "Paste YAML or JSON into the editor, upload a .yaml, .yml or .json file, or load the Kubernetes, OpenAPI 3.0 or Docker Compose sample.",
  },
  {
    title: "Validate, format or convert",
    body: "Syntax is checked as you type. Errors show the line, column and an excerpt. Choose Format, YAML → JSON or JSON → YAML with 2- or 4-space indentation and optional key sorting.",
  },
  {
    title: "Copy or download",
    body: "Copy the result to your clipboard or download it as validated.yaml or converted.json. Files are generated in your browser.",
  },
];

const faqs = [
  {
    q: "Is my YAML uploaded to a server?",
    a: "No. Parsing, validation, formatting and conversion run in your browser (in a Web Worker when available). Uploaded files are read with the browser File API, and downloads are created from in-memory Blobs. The page does not send your content anywhere.",
  },
  {
    q: "How are line and column numbers determined?",
    a: "They come directly from the YAML parser (the open-source yaml library) and from a strict JSON syntax scanner. When a parser cannot report a position, none is shown rather than a guessed one.",
  },
  {
    q: "Which YAML features are supported?",
    a: "YAML 1.2 including multi-document streams (---), anchors and aliases, merge keys (<<), block and flow collections, and literal/folded multiline strings. Duplicate keys are reported as errors. Custom tags such as CloudFormation's !Ref produce a warning and are treated as plain strings.",
  },
  {
    q: "Does formatting change my data?",
    a: "No. Formatting re-indents the document and keeps comments, anchors, quoting style and values. A few number notations are normalised (for example 0x1F becomes 0x1f), which does not change their value. Key sorting only happens when Sort Keys is enabled and never reorders arrays.",
  },
  {
    q: "Are there size limits?",
    a: "Uploads are limited to 20 MB to keep the tab responsive. Live validation pauses automatically above about 1 MB of input; press Validate to check larger documents.",
  },
];

export function ToolInfoSections() {
  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-2">
      <section aria-labelledby="how-heading" className="flex flex-col gap-3">
        <h2 id="how-heading" className="text-xl font-semibold">
          How to validate and convert YAML
        </h2>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-sm font-bold text-accent"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="faq-heading" className="flex flex-col gap-3">
        <h2 id="faq-heading" className="text-xl font-semibold">
          Frequently asked questions
        </h2>
        <div className="flex flex-col gap-2">
          {faqs.map((faq) => (
            <details key={faq.q} className="group rounded-lg border border-line bg-surface p-4">
              <summary className="cursor-pointer font-semibold marker:text-muted">{faq.q}</summary>
              <p className="mt-2 text-sm text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
