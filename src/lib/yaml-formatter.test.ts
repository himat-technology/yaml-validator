import { describe, expect, it } from "vitest";
import { parseAllDocuments } from "yaml";
import { sortKeysDeep } from "./key-sort";
import { PRESETS } from "./presets";
import { formatYaml } from "./yaml-formatter";

const messy = `apiVersion: apps/v1
kind: Deployment
metadata:
      name: example
      labels:
            app: example
spec:
   replicas: 2
   containers:
   - name: api
     image: example/api:1.0.0
`;

describe("formatYaml", () => {
  it("re-indents with 2 spaces", () => {
    const result = formatYaml(messy, { indent: 2, sortKeys: false });
    expect(result.ok).toBe(true);
    expect(result.output).toBe(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: example
  labels:
    app: example
spec:
  replicas: 2
  containers:
    - name: api
      image: example/api:1.0.0
`);
  });

  it("re-indents with 4 spaces", () => {
    const result = formatYaml(messy, { indent: 4, sortKeys: false });
    expect(result.output).toContain("metadata:\n    name: example\n    labels:\n        app: example\n");
    expect(result.output).toContain("    containers:\n        - name: api\n          image: example/api:1.0.0\n");
  });

  it("leaves already formatted YAML unchanged", () => {
    const formatted = "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: example\n";
    expect(formatYaml(formatted, { indent: 2, sortKeys: false }).output).toBe(formatted);
  });

  it("does not sort keys unless asked", () => {
    const result = formatYaml("b: 1\na: 2\n", { indent: 2, sortKeys: false });
    expect(result.output).toBe("b: 1\na: 2\n");
  });

  it("sorts keys recursively but keeps array order", () => {
    const source = "zeta: 1\nalpha:\n  d: 1\n  c: 2\nlist:\n  - z\n  - a\n  - { y: 1, x: 2 }\n";
    const result = formatYaml(source, { indent: 2, sortKeys: true });
    expect(result.output).toBe("alpha:\n  c: 2\n  d: 1\nlist:\n  - z\n  - a\n  - { x: 2, y: 1 }\nzeta: 1\n");
  });

  it("preserves comments, anchors and block scalars", () => {
    const source = "# header\nbase: &b\n  x: 1 # inline\nref: *b\ntext: |\n  keep\n  lines\n";
    const result = formatYaml(source, { indent: 4, sortKeys: false });
    expect(result.output).toContain("# header");
    expect(result.output).toContain("# inline");
    expect(result.output).toContain("base: &b\n    x: 1");
    expect(result.output).toContain("ref: *b");
    expect(result.output).toContain("text: |\n    keep\n    lines\n");
  });

  it("preserves scalar types and quoting", () => {
    const source = 'a: "123"\nb: 123\nc: true\nd: "true"\ne: null\nf: 1.10\nbig: 12345678901234567890\n';
    const result = formatYaml(source, { indent: 2, sortKeys: false });
    expect(result.output).toBe(source);
  });

  it("formats multi-document streams", () => {
    const result = formatYaml("a:    1\n---\nb:\n    c: 2\n", { indent: 2, sortKeys: false });
    expect(result.output).toBe("a: 1\n---\nb:\n  c: 2\n");
  });

  it("returns errors instead of output for invalid YAML", () => {
    const result = formatYaml("a: [1, 2\n", { indent: 2, sortKeys: false });
    expect(result.ok).toBe(false);
    expect(result.output).toBe("");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  describe("sorting documents that use anchors", () => {
    const sorted = (source: string) => formatYaml(source, { indent: 2, sortKeys: true });
    const data = (source: string) => {
      const docs = parseAllDocuments(source, { merge: true });
      return Array.isArray(docs) ? sortKeysDeep(docs.map((d) => d.toJS())) : null;
    };

    it.each([
      ["mapping", "b: &x\n  k: 1\na: *x\n", "a: &x\n  k: 1\nb: *x\n"],
      ["merge key", "base: &b { x: 1 }\nzeta:\n  <<: *b\n  y: 2\nalpha: *b\n", null],
      ["nested anchors", "z: &outer\n  inner: &in [ 1, 2 ]\n  q: 1\nb: *in\na: *outer\n", null],
      ["sequence item", "z:\n  - &item { n: 1 }\n  - 2\na: [ *item, *item ]\n", null],
      ["multi-document", "b: &x 1\na: *x\n---\nd: &y 2\nc: *y\n", "a: &x 1\nb: *x\n---\nc: &y 2\nd: *y\n"],
    ])("moves the anchor before its first alias (%s)", (_, source, expected) => {
      const result = sorted(source);
      expect(result.errors).toEqual([]);
      if (expected) expect(result.output).toBe(expected);
      expect(data(result.output)).toEqual(data(source));
    });

    it("sorts the Docker Compose preset without breaking its logging anchor", () => {
      const compose = PRESETS.find((preset) => preset.id === "docker-compose")!.content;
      const result = sorted(compose);
      expect(result.ok).toBe(true);
      expect(result.output.indexOf("&default-logging")).toBeLessThan(result.output.indexOf("*default-logging"));
      expect(data(result.output)).toEqual(data(compose));
    });

    it("explains why a document with a reused anchor name cannot be sorted", () => {
      const result = sorted("z: &x 1\ny: *x\nm: &x 2\na: *x\n");
      expect(result.ok).toBe(false);
      expect(result.errors[0].message).toMatch(/same anchor name is defined more than once/);
    });
  });

  it("keeps blank-line separators consistent after sorting and never leaves trailing spaces", () => {
    const source = "services:\n  web:\n    image: a\n\n  api:\n    image: b\n\n  db:\n    image: c\n";
    const result = formatYaml(source, { indent: 2, sortKeys: true });
    expect(result.output).toBe(
      "services:\n  api:\n    image: b\n\n  db:\n    image: c\n\n  web:\n    image: a\n",
    );
  });

  it("warns about YAML 1.1 boolean-like strings", () => {
    const result = formatYaml("enabled: yes\nquoted: \"yes\"\n", { indent: 2, sortKeys: false });
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ code: "YAML11_BOOLEAN", line: 1, column: 10 });
  });
});
