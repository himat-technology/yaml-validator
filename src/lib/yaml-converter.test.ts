import { describe, expect, it, vi } from "vitest";
import { jsonToYaml, parseJson, stringifyJson, yamlToJson } from "./yaml-converter";

const opts2 = { indent: 2 as const, sortKeys: false };
const opts4 = { indent: 4 as const, sortKeys: false };

describe("yamlToJson", () => {
  it("converts nested YAML preserving all scalar types", () => {
    const yaml = [
      "string: hello",
      'quotedNumber: "42"',
      "integer: 42",
      "float: 3.14",
      "negative: -7",
      "yes: true",
      "no: false",
      "empty: null",
      "tilde: ~",
      "list:",
      "  - a",
      "  - 1",
      "  - nested:",
      "      deep: [x, y]",
      "multiline: |",
      "  first",
      "  second",
      "",
    ].join("\n");
    const result = yamlToJson(yaml, opts2);
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.output)).toEqual({
      string: "hello",
      quotedNumber: "42",
      integer: 42,
      float: 3.14,
      negative: -7,
      yes: true,
      no: false,
      empty: null,
      tilde: null,
      list: ["a", 1, { nested: { deep: ["x", "y"] } }],
      multiline: "first\nsecond\n",
    });
  });

  it("respects the selected indentation", () => {
    expect(yamlToJson("a:\n  b: 1\n", opts2).output).toBe('{\n  "a": {\n    "b": 1\n  }\n}\n');
    expect(yamlToJson("a:\n  b: 1\n", opts4).output).toBe('{\n    "a": {\n        "b": 1\n    }\n}\n');
  });

  it("sorts keys only when enabled and keeps array order", () => {
    const yaml = "b: 1\na:\n  z: [3, 1, 2]\n  y: true\n";
    expect(yamlToJson(yaml, opts2).output).toBe(
      '{\n  "b": 1,\n  "a": {\n    "z": [\n      3,\n      1,\n      2\n    ],\n    "y": true\n  }\n}\n',
    );
    const sorted = yamlToJson(yaml, { indent: 2, sortKeys: true });
    expect(Object.keys(JSON.parse(sorted.output))).toEqual(["a", "b"]);
    expect(JSON.parse(sorted.output).a).toEqual({ y: true, z: [3, 1, 2] });
    expect(Object.keys(JSON.parse(sorted.output).a)).toEqual(["y", "z"]);
  });

  it("resolves anchors and aliases", () => {
    const result = yamlToJson("defaults: &d\n  retries: 3\njob:\n  <<: *d\n  name: build\n", opts2);
    expect(JSON.parse(result.output)).toEqual({ defaults: { retries: 3 }, job: { retries: 3, name: "build" } });
  });

  it("converts multi-document streams into an array", () => {
    const result = yamlToJson("a: 1\n---\nb: 2\n", opts2);
    expect(JSON.parse(result.output)).toEqual([{ a: 1 }, { b: 2 }]);
    expect(result.warnings.some((w) => w.message.includes("2 documents"))).toBe(true);
  });

  it("converts top-level scalars and arrays", () => {
    expect(JSON.parse(yamlToJson("- 1\n- two\n- null\n", opts2).output)).toEqual([1, "two", null]);
    expect(JSON.parse(yamlToJson("just a string\n", opts2).output)).toBe("just a string");
  });

  it("writes big integers exactly", () => {
    const result = yamlToJson("id: 12345678901234567890\nsmall: 5\n", opts2);
    expect(result.output).toBe('{\n  "id": 12345678901234567890,\n  "small": 5\n}\n');
  });

  it("converts non-finite numbers to null with a notice", () => {
    const result = yamlToJson("a: .inf\nb: .nan\n", opts2);
    expect(JSON.parse(result.output)).toEqual({ a: null, b: null });
    expect(result.warnings.some((w) => w.message.includes("Infinity/NaN"))).toBe(true);
  });

  it("warns when a list or mapping is used as a key", () => {
    const result = yamlToJson("? [a, b]\n: 1\n", opts2);
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.output)).toEqual({ "[ a, b ]": 1 });
    expect(result.warnings[0]).toMatchObject({ code: "COLLECTION_KEY", line: 1, column: 3 });
  });

  it("never prints library warnings (which quote document content) to the console", () => {
    const emitWarning = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      yamlToJson("? [secret-key, other]\n: 1\n", opts2);
      jsonToYaml('{"a": 1}', opts2);
      expect(emitWarning).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
    } finally {
      emitWarning.mockRestore();
      consoleWarn.mockRestore();
    }
  });

  it("reports excessive nesting clearly instead of crashing", () => {
    const deep = "[".repeat(5000) + "]".repeat(5000);
    const result = yamlToJson(deep, opts2);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ code: "NESTING_TOO_DEEP", line: 1 });
    expect(jsonToYaml(deep, opts2).errors[0].message).toMatch(/nested too deeply/);
  });

  it("handles realistic nesting depth", () => {
    const deep = "[".repeat(200) + "]".repeat(200);
    expect(yamlToJson(deep, opts2).ok).toBe(true);
    expect(jsonToYaml(deep, opts2).ok).toBe(true);
  });

  it("returns errors for invalid YAML", () => {
    const result = yamlToJson("a: 1\n  b: 2\n", opts2);
    expect(result.ok).toBe(false);
    expect(result.output).toBe("");
    expect(result.errors[0].line).toBeDefined();
  });
});

describe("parseJson", () => {
  const cases: [string, string, number, number, RegExp][] = [
    ["trailing comma in object", '{\n  "a": 1,\n}', 3, 1, /Trailing comma/],
    ["trailing comma in array", "[1, 2,]", 1, 7, /Trailing comma/],
    ["missing comma", '{\n  "a": 1\n  "b": 2\n}', 3, 3, /Expected ','/],
    ["single quotes", "{'a': 1}", 1, 2, /double quotes/],
    ["unquoted key", "{a: 1}", 1, 2, /double quotes/],
    ["unterminated string", '{"a": "oops}', 1, 7, /Unterminated string/],
    ["comment", '{"a": 1 // note\n}', 1, 9, /Comments/],
    ["leading zero", '{"a": 01}', 1, 7, /leading zeros/],
    ["missing colon", '{"a" 1}', 1, 6, /Expected ':'/],
    ["unexpected end", '{"a": [1, 2', 1, 12, /end of input/],
    ["NaN", '{"a": NaN}', 1, 7, /NaN is not a valid JSON value/],
    ["extra content", '{"a": 1} {"b": 2}', 1, 10, /after the end/],
  ];

  it.each(cases)("locates %s", (_, source, line, column, message) => {
    const result = parseJson(source);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ line, column });
    expect(result.errors[0].message).toMatch(message);
  });

  it("parses valid JSON", () => {
    const result = parseJson('{"a": [1, true, null, "x", {"b": -1.5e3}]}');
    expect(result).toMatchObject({ ok: true, value: { a: [1, true, null, "x", { b: -1500 }] } });
  });

  it("warns about duplicate keys", () => {
    const result = parseJson('{\n  "a": 1,\n  "a": 2\n}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings[0]).toMatchObject({ code: "DUPLICATE_KEY", line: 3, column: 3 });
  });

  it("keeps big integers exact", () => {
    const result = parseJson('{"id": 12345678901234567890}');
    expect(result).toMatchObject({ ok: true, value: { id: 12345678901234567890n } });
  });

  it("warns when a number overflows to infinity", () => {
    const result = parseJson('{"a": 1e400, "b": -2E999, "c": 1.5}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map((w) => [w.code, w.line, w.column])).toEqual([
      ["NUMBER_OVERFLOW", 1, 7],
      ["NUMBER_OVERFLOW", 1, 19],
    ]);
    expect(result.warnings[1].message).toMatch(/-\.inf/);
  });
});

describe("jsonToYaml", () => {
  const json = JSON.stringify({
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: { name: "settings", labels: { tier: "backend" } },
    data: { retries: 3, ratio: 0.25, debug: false, owner: null, tags: ["a", "b"], answer: "yes", zip: "007" },
  });

  it("converts JSON into YAML with 2-space indentation", () => {
    const result = jsonToYaml(json, opts2);
    expect(result.ok).toBe(true);
    expect(result.output).toBe(`apiVersion: v1
kind: ConfigMap
metadata:
  name: settings
  labels:
    tier: backend
data:
  retries: 3
  ratio: 0.25
  debug: false
  owner: null
  tags:
    - a
    - b
  answer: "yes"
  zip: "007"
`);
    expect(result.keyCount).toBe(14);
  });

  it("applies 4-space indentation", () => {
    const result = jsonToYaml(json, opts4);
    expect(result.output).toContain("metadata:\n    name: settings\n    labels:\n        tier: backend\n");
    expect(result.output).toContain("    tags:\n        - a\n        - b\n");
  });

  it("sorts keys when enabled", () => {
    const result = jsonToYaml('{"b": {"d": 1, "c": 2}, "a": [3, 2, 1]}', { indent: 2, sortKeys: true });
    expect(result.output).toBe("a:\n  - 3\n  - 2\n  - 1\nb:\n  c: 2\n  d: 1\n");
  });

  it("round-trips back to identical data", () => {
    const yaml = jsonToYaml(json, opts2).output;
    const back = yamlToJson(yaml, opts2).output;
    expect(JSON.parse(back)).toEqual(JSON.parse(json));
  });

  it("keeps __proto__ keys as data", () => {
    const result = jsonToYaml('{"__proto__": {"x": 1}, "a": 1}', { indent: 2, sortKeys: true });
    expect(result.output).toBe("__proto__:\n  x: 1\na: 1\n");
  });

  it("reports invalid JSON and hints when the input is YAML", () => {
    const result = jsonToYaml("name: demo\nitems:\n  - 1\n", opts2);
    expect(result.ok).toBe(false);
    expect(result.errors[0].hint).toMatch(/looks like YAML/);
  });

  it("writes big integers exactly", () => {
    expect(jsonToYaml('{"id": 12345678901234567890}', opts2).output).toBe("id: 12345678901234567890\n");
  });
});

describe("stringifyJson", () => {
  it("converts sets, maps and binary values explicitly", () => {
    const value = { s: new Set([1, 2]), m: new Map([["k", "v"]]), b: new Uint8Array([104, 105]) };
    const { text, notes } = stringifyJson(value, 2, false);
    expect(JSON.parse(text)).toEqual({ s: [1, 2], m: { k: "v" }, b: "aGk=" });
    expect(notes).toHaveLength(3);
  });
});
