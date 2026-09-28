import { describe, expect, it } from "vitest";
import { detectFileLanguage, MAX_FILE_BYTES, normalizeText, readLocalFile } from "./file-utils";
import { compareKeys, sortKeysDeep } from "./key-sort";
import { processInput } from "./processor";
import { PRESETS } from "./presets";
import {
  computeTextStats,
  countLines,
  countObjectKeys,
  createLineIndex,
  formatBytes,
  lineColumnToOffset,
  utf8ByteLength,
} from "./text-stats";

describe("text statistics", () => {
  it("counts lines like an editor", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("a")).toBe(1);
    expect(countLines("a\n")).toBe(1);
    expect(countLines("a\nb")).toBe(2);
    expect(countLines("a\n\n")).toBe(2);
  });

  it("measures UTF-8 size and code points", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("€")).toBe(3);
    expect(utf8ByteLength("😀")).toBe(4);
    expect(utf8ByteLength("😀")).toBe(new TextEncoder().encode("😀").length);
    expect(computeTextStats("a😀\nb")).toEqual({ characters: 4, lines: 2, bytes: 7 });
  });

  it("formats byte sizes", () => {
    expect(formatBytes(808)).toBe("808 B");
    expect(formatBytes(2048)).toBe("2.00 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.00 MB");
  });

  it("counts object keys recursively", () => {
    expect(countObjectKeys({ a: 1, b: { c: [{ d: 1 }, 2] } })).toBe(4);
    expect(countObjectKeys([1, 2])).toBe(0);
    expect(countObjectKeys(null)).toBe(0);
  });

  it("maps offsets to line/column and back", () => {
    const text = "ab\ncde\n\nf";
    const lookup = createLineIndex(text);
    expect(lookup(0)).toEqual({ line: 1, column: 1 });
    expect(lookup(4)).toEqual({ line: 2, column: 2 });
    expect(lookup(8)).toEqual({ line: 4, column: 1 });
    expect(lineColumnToOffset(text, 2, 2)).toBe(4);
    expect(lineColumnToOffset(text, 4, 1)).toBe(8);
  });
});

describe("key sorting", () => {
  it("sorts case-insensitively, keeps merge keys first", () => {
    expect(["b", "A", "<<", "a", "C"].sort(compareKeys)).toEqual(["<<", "A", "a", "b", "C"]);
  });

  it("does not reorder arrays or mutate the input", () => {
    const input = { z: [3, 1, 2], a: { y: 1, b: 2 } };
    const sorted = sortKeysDeep(input);
    expect(Object.keys(sorted)).toEqual(["a", "z"]);
    expect(Object.keys(sorted.a)).toEqual(["b", "y"]);
    expect(sorted.z).toEqual([3, 1, 2]);
    expect(Object.keys(input)).toEqual(["z", "a"]);
  });
});

describe("file utilities", () => {
  const fakeFile = (name: string, content: string, size = content.length) => ({
    name,
    size,
    text: async () => content,
  });

  it("detects languages from extensions", () => {
    expect(detectFileLanguage("deploy.yaml")).toBe("yaml");
    expect(detectFileLanguage("compose.YML")).toBe("yaml");
    expect(detectFileLanguage("spec.json")).toBe("json");
    expect(detectFileLanguage("notes.txt")).toBeNull();
  });

  it("normalises BOM and line endings", () => {
    expect(normalizeText("\uFEFFa: 1\r\nb: 2\r")).toBe("a: 1\nb: 2\n");
  });

  it("reads YAML and JSON files locally", async () => {
    await expect(readLocalFile(fakeFile("a.yml", "a: 1\r\n"))).resolves.toEqual({
      ok: true,
      name: "a.yml",
      size: 6,
      language: "yaml",
      content: "a: 1\n",
    });
    await expect(readLocalFile(fakeFile("a.json", "{}"))).resolves.toMatchObject({ ok: true, language: "json" });
  });

  it("works with real File objects", async () => {
    const file = new File(["kind: Pod\n"], "pod.yaml", { type: "application/yaml" });
    await expect(readLocalFile(file)).resolves.toMatchObject({ ok: true, content: "kind: Pod\n" });
  });

  it("rejects unsupported, oversized and binary files", async () => {
    await expect(readLocalFile(fakeFile("a.txt", "x"))).resolves.toMatchObject({ ok: false });
    await expect(readLocalFile(fakeFile("a.yaml", "x", MAX_FILE_BYTES + 1))).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/too large/),
    });
    await expect(readLocalFile(fakeFile("a.yaml", "a\u0000b"))).resolves.toMatchObject({ ok: false });
  });
});

describe("processInput", () => {
  it("returns an empty status for blank input", () => {
    for (const mode of ["format", "yaml-to-json", "json-to-yaml"] as const) {
      expect(processInput({ mode, input: "  \n ", indent: 2, sortKeys: false }).status).toBe("empty");
    }
  });

  it("validates every preset and produces output in all YAML modes", () => {
    for (const preset of PRESETS) {
      const formatted = processInput({ mode: "format", input: preset.content, indent: 2, sortKeys: false });
      expect(formatted.status, preset.id).toBe("valid");
      expect(formatted.errors).toEqual([]);
      expect(formatted.output.length).toBeGreaterThan(0);
      const json = processInput({ mode: "yaml-to-json", input: preset.content, indent: 2, sortKeys: false });
      expect(json.status).toBe("valid");
      expect(() => JSON.parse(json.output)).not.toThrow();
    }
  });

  it("formats the Kubernetes preset without changing it", () => {
    const k8s = PRESETS.find((p) => p.id === "kubernetes")!;
    const result = processInput({ mode: "format", input: k8s.content, indent: 2, sortKeys: false });
    expect(result.output).toBe(k8s.content);
    expect(result.warnings).toEqual([]);
  });

  it("marks invalid input and never throws", () => {
    const inputs = ["a: [", "key: value: x", "\t- a", '{"a":', "? - : ]", "---\n- a\nb: 1", "*"];
    for (const input of inputs) {
      for (const mode of ["format", "yaml-to-json", "json-to-yaml"] as const) {
        const result = processInput({ mode, input, indent: 2, sortKeys: true });
        expect(["valid", "invalid"]).toContain(result.status);
      }
    }
  });

  it("handles large YAML input", () => {
    const lines: string[] = ["items:"];
    for (let i = 0; i < 20000; i++) {
      lines.push(`  - id: ${i}`, `    name: item-${i}`, `    enabled: ${i % 2 === 0}`);
    }
    const input = lines.join("\n") + "\n";
    const started = performance.now();
    const result = processInput({ mode: "yaml-to-json", input, indent: 2, sortKeys: false });
    const elapsed = performance.now() - started;
    expect(result.status).toBe("valid");
    expect(result.keyCount).toBe(1 + 20000 * 3);
    expect(JSON.parse(result.output).items).toHaveLength(20000);
    expect(elapsed).toBeLessThan(15000);
  });
});
