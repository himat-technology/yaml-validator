import { describe, expect, it } from "vitest";
import { cleanYamlErrorMessage, parseYaml } from "./yaml-parser";

describe("parseYaml", () => {
  it("parses valid YAML with nested objects, arrays and scalars", () => {
    const result = parseYaml(
      [
        "name: demo",
        "count: 3",
        "ratio: 0.5",
        "enabled: true",
        "disabled: false",
        "nothing: null",
        "tilde: ~",
        "nested:",
        "  deeper:",
        "    list:",
        "      - 1",
        "      - two",
        "      - key: value",
        "",
      ].join("\n"),
    );
    expect(result.errors).toEqual([]);
    expect(result.values).toEqual([
      {
        name: "demo",
        count: 3,
        ratio: 0.5,
        enabled: true,
        disabled: false,
        nothing: null,
        tilde: null,
        nested: { deeper: { list: [1, "two", { key: "value" }] } },
      },
    ]);
    // name,count,ratio,enabled,disabled,nothing,tilde,nested,deeper,list,key
    expect(result.keyCount).toBe(11);
  });

  it("treats empty input as zero documents without errors", () => {
    const result = parseYaml("");
    expect(result.documents).toHaveLength(0);
    expect(result.errors).toEqual([]);
  });

  it("reports a missing colon with the real line and column", () => {
    const result = parseYaml("apiVersion: v1\nkind: Pod\nmetadata:\n  name: x\n  labels\n    app: y\n");
    expect(result.errors.length).toBeGreaterThan(0);
    const [first] = result.errors;
    expect(first.line).toBe(5);
    expect(first.column).toBe(3);
    expect(first.code).toBe("MULTILINE_IMPLICIT_KEY");
    expect(first.hint).toMatch(/missing a ':'/);
  });

  it("gives a missing-colon hint for a key without a value, not an unclosed-quote hint", () => {
    const result = parseYaml("service:\n  name: api\n  image example/api:1.0.0\n");
    expect(result.errors[0]).toMatchObject({ line: 3, column: 3, code: "MISSING_CHAR" });
    expect(result.errors[0].hint).toMatch(/Add ': ' after the key/);

    const unclosed = parseYaml('name: "api\n');
    expect(unclosed.errors[0].hint ?? "").not.toMatch(/Add ': ' after the key/);
  });

  it("reports 'mapping values not allowed' style errors", () => {
    const result = parseYaml("key: value: other\n");
    expect(result.errors[0]).toMatchObject({ line: 1, column: 6, code: "BLOCK_AS_IMPLICIT_KEY" });
    expect(result.errors[0].hint).toMatch(/Mapping values are not allowed/);
  });

  it("reports invalid indentation", () => {
    const result = parseYaml("items:\n  - a\n  b: 2\n");
    expect(result.errors[0]).toMatchObject({ code: "BAD_INDENT", line: 3, column: 1 });
  });

  it("reports tabs used as indentation", () => {
    const result = parseYaml("a:\n\tb: 1\n");
    expect(result.errors[0]).toMatchObject({ code: "TAB_AS_INDENT", line: 2 });
  });

  it("reports broken quotes", () => {
    const result = parseYaml('a: "unterminated\nb: 2\n');
    expect(result.errors[0].code).toBe("MISSING_CHAR");
    expect(result.errors[0].message).toMatch(/quote/i);
  });

  it("reports duplicate keys", () => {
    const result = parseYaml("a: 1\na: 2\n");
    expect(result.errors[0]).toMatchObject({ code: "DUPLICATE_KEY", line: 2, column: 1 });
  });

  it("reports an unterminated flow sequence", () => {
    const result = parseYaml("list: [1, 2\nother: 3\n");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].line).toBeDefined();
  });

  it("resolves anchors, aliases and merge keys", () => {
    const result = parseYaml("base: &b\n  x: 1\nother:\n  <<: *b\n  y: 2\nref: *b\n");
    expect(result.errors).toEqual([]);
    expect(result.values[0]).toEqual({ base: { x: 1 }, other: { x: 1, y: 2 }, ref: { x: 1 } });
  });

  it("reports unresolved aliases with a position", () => {
    const result = parseYaml("a: 1\nb: *missing\n");
    expect(result.errors[0]).toMatchObject({ code: "UNRESOLVED_ALIAS", line: 2, column: 4 });
  });

  it("rejects alias expansion bombs instead of hanging", () => {
    const bomb = [
      "a: &a [x,x,x,x,x,x,x,x,x]",
      "b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]",
      "c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]",
      "d: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]",
      "",
    ].join("\n");
    const result = parseYaml(bomb);
    expect(result.errors[0].code).toBe("RESOURCE_EXHAUSTION");
  });

  it("parses multiline block scalars", () => {
    const result = parseYaml("literal: |\n  line one\n  line two\nfolded: >\n  a\n  b\n");
    expect(result.values[0]).toEqual({ literal: "line one\nline two\n", folded: "a b\n" });
  });

  it("parses multi-document streams", () => {
    const result = parseYaml("a: 1\n---\nb: 2\n");
    expect(result.documents).toHaveLength(2);
    expect(result.values).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("warns (but does not fail) on unknown custom tags", () => {
    const result = parseYaml("bucket: !Ref MyBucket\n");
    expect(result.errors).toEqual([]);
    expect(result.warnings[0].code).toBe("TAG_RESOLVE_FAILED");
  });

  it("keeps integers beyond 2^53 exact", () => {
    const result = parseYaml("id: 12345678901234567890\n");
    expect(result.values[0]).toEqual({ id: 12345678901234567890n });
  });
});

describe("cleanYamlErrorMessage", () => {
  it("strips the position suffix and code excerpt", () => {
    expect(cleanYamlErrorMessage("Map keys must be unique at line 2, column 1:\n\na: 1\n^\n")).toBe(
      "Map keys must be unique",
    );
  });
});
