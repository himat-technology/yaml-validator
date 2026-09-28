import { describe, expect, it } from "vitest";
import { buildErrorSnippet } from "./error-snippet";

describe("buildErrorSnippet", () => {
  it("places the caret under the column", () => {
    expect(buildErrorSnippet("key: value: other", 6)).toEqual({ text: "key: value: other", caret: "     ^" });
  });

  it("makes tabs visible", () => {
    expect(buildErrorSnippet("\tb: 1", 1)).toEqual({ text: "→b: 1", caret: "^" });
  });

  it("windows long lines around the column", () => {
    const line = "x".repeat(200);
    const snippet = buildErrorSnippet(line, 150, 40);
    expect(snippet.text.startsWith("…")).toBe(true);
    expect(snippet.text.endsWith("…")).toBe(true);
    // window starts 20 characters before index 149; +1 for the leading ellipsis
    expect(snippet.caret.indexOf("^")).toBe(1 + 20);
    expect(snippet.text[snippet.caret.indexOf("^")]).toBe("x");
  });

  it("clamps columns past the end of the line", () => {
    expect(buildErrorSnippet("ab", 10).caret).toBe("  ^");
  });
});
