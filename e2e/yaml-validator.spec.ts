import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const URL_PATH = "/free-tools/yaml-validator";

const status = (page: Page) => page.getByTestId("validation-status");
const inputEditor = (page: Page, lang = "YAML") => page.locator(`[aria-label="${lang} input editor"]`);

async function setInput(page: Page, text: string, lang = "YAML") {
  const editor = inputEditor(page, lang);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  if (text) await page.keyboard.insertText(text);
}

/** Clicks the visible switch label, as a user would, and checks the resulting state. */
async function toggleSwitch(page: Page, id: string, checked: boolean) {
  await page.locator(`label[for="${id}"]`).click();
  await expect(page.locator(`#${id}`)).toBeChecked({ checked });
}

/** The OS clipboard may convert line endings (CRLF on Windows). */
async function readClipboard(page: Page) {
  const text = await page.evaluate(() => navigator.clipboard.readText());
  return text.replace(/\r\n/g, "\n");
}

async function downloadOutput(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^Download output as/ }).click(),
  ]);
  const path = await download.path();
  return { name: download.suggestedFilename(), content: await readFile(path!, "utf8") };
}

test.beforeEach(async ({ page }) => {
  await page.goto(URL_PATH);
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
});

test("renders the page with metadata, privacy messaging and a validated default preset", async ({ page }) => {
  await expect(page).toHaveTitle("YAML Validator, Formatter & JSON Converter | HIMAT Technology");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Free browser-based YAML validator, formatter and YAML to JSON / JSON to YAML converter for Kubernetes, OpenAPI and Docker Compose files.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("YAML Validator, Formatter & JSON Converter");
  await expect(page.getByText("100% Client-Side Privacy")).toBeVisible();
  await expect(page.getByText(/Your YAML configurations never leave your browser/)).toBeVisible();
  await expect(page.getByText("Your YAML stays in your browser. Nothing is uploaded.")).toBeVisible();

  await expect(status(page)).toContainText("VALID YAML");
  // Processing really happened inside the Web Worker bundle.
  await expect(status(page)).toHaveAttribute("data-engine", "worker");
  await expect(page.getByRole("button", { name: "Kubernetes" })).toHaveAttribute("aria-pressed", "true");

  // Stats are derived from the actual preset text.
  await expect(page.getByTestId("stat-input-lines")).toHaveText("42");
  await expect(page.getByTestId("stat-keys")).toHaveText("42");
  await expect(page.getByTestId("stat-input-size")).toHaveText("952 B");
  await expect(page.getByTestId("stat-documents")).toHaveText("1");
});

test("reports invalid YAML with line and column, highlights it and jumps to it", async ({ page }) => {
  await setInput(page, "apiVersion: v1\nkind: Pod\nmetadata:\n  name: demo\n  labels\n    app: demo\n");
  await expect(status(page)).toHaveAttribute("data-phase", "invalid");
  await expect(status(page)).toContainText("INVALID YAML");
  const errors = page.getByRole("list", { name: "Errors" });
  await expect(errors).toContainText("Line 5, Column 3:");
  await expect(errors).toContainText("missing a ':'");
  await expect(page.locator(".cm-lintRange-error").first()).toBeVisible();
  await expect(page.getByText("Fix the errors listed above to see the output.")).toBeVisible();

  await page.getByRole("button", { name: "Go to Line 5, Column 3 in the editor" }).click();
  await expect(page.locator(".cm-activeLine")).toHaveText("  labels");
});

test("detects the required malformed-input cases without crashing", async ({ page }) => {
  const cases: [string, RegExp][] = [
    ["a:\n  b: 1\n   c: 2\n", /Line 2/],
    ['a: "unterminated\nb: 2\n', /quote/i],
    ["items:\n  - a\n  b: 2\n", /All mapping items must start at the same column/],
    ["a: 1\na: 2\n", /Map keys must be unique/],
    ["key: value: other\n", /Line 1, Column 6/],
  ];
  for (const [yaml, message] of cases) {
    await setInput(page, yaml);
    await expect(status(page)).toHaveAttribute("data-phase", "invalid");
    await expect(page.getByRole("list", { name: "Errors" })).toContainText(message);
  }
  await setInput(page, "");
  await expect(status(page)).toHaveAttribute("data-phase", "empty");
  await expect(status(page)).toContainText("NO INPUT");
});

test("converts YAML to JSON, copies it and downloads converted.json", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const yaml =
    "name: demo\ncount: 3\nratio: 0.5\nenabled: true\nnothing: null\nlist:\n  - a\n  - b: 1\ntext: |\n  line1\n  line2\n";
  await setInput(page, yaml);
  await page.getByRole("button", { name: "YAML → JSON" }).click();
  await expect(page.getByRole("heading", { name: "JSON Output" })).toBeVisible();
  await expect(status(page)).toHaveAttribute("data-phase", "valid");

  const expected = {
    name: "demo",
    count: 3,
    ratio: 0.5,
    enabled: true,
    nothing: null,
    list: ["a", { b: 1 }],
    text: "line1\nline2\n",
  };

  const copyButton = page.getByRole("button", { name: "Copy JSON output" });
  await expect(copyButton).toBeEnabled();
  await copyButton.click();
  await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
  const clipboard = await readClipboard(page);
  expect(JSON.parse(clipboard)).toEqual(expected);
  expect(clipboard).toContain('\n  "name": "demo"');

  const file = await downloadOutput(page);
  expect(file.name).toBe("converted.json");
  expect(JSON.parse(file.content)).toEqual(expected);

  await page.getByRole("button", { name: "4 Spaces" }).click();
  const indented = await downloadOutput(page);
  expect(indented.content).toContain('\n    "name": "demo"');
});

test("converts JSON to YAML with indentation, sort keys and validated.yaml download", async ({ page }) => {
  await page.getByRole("button", { name: "JSON → YAML" }).click();
  await setInput(page, '{"zeta": 1, "alpha": {"d": [3, 1, 2], "c": "yes"}, "on": false}', "JSON");
  await expect(status(page)).toContainText("VALID JSON");

  let file = await downloadOutput(page);
  expect(file.name).toBe("validated.yaml");
  expect(file.content).toBe('zeta: 1\nalpha:\n  d:\n    - 3\n    - 1\n    - 2\n  c: "yes"\n"on": false\n');

  await toggleSwitch(page, "sort-keys", true);
  await expect(page.getByTestId("sorted-badge")).toBeVisible();
  await page.getByRole("button", { name: "4 Spaces" }).click();
  file = await downloadOutput(page);
  expect(file.content).toBe('alpha:\n    c: "yes"\n    d:\n        - 3\n        - 1\n        - 2\n"on": false\nzeta: 1\n');
});

test("shows a useful error for invalid JSON", async ({ page }) => {
  await page.getByRole("button", { name: "JSON → YAML" }).click();
  await setInput(page, '{\n  "a": 1,\n}', "JSON");
  await expect(status(page)).toContainText("INVALID JSON");
  await expect(page.getByRole("list", { name: "Errors" })).toContainText("Line 3, Column 1:");
  await expect(page.getByRole("list", { name: "Errors" })).toContainText("Trailing comma");
});

test("formats YAML with 2 or 4 spaces and only sorts keys when enabled", async ({ page }) => {
  await setInput(page, "b:\n      y: 1\n      x: 2\na: [3, 1]\n");
  await page.getByRole("button", { name: "Format", exact: true }).click();
  let file = await downloadOutput(page);
  expect(file.name).toBe("validated.yaml");
  expect(file.content).toBe("b:\n  y: 1\n  x: 2\na: [ 3, 1 ]\n");

  await page.getByRole("button", { name: "4 Spaces" }).click();
  file = await downloadOutput(page);
  expect(file.content).toBe("b:\n    y: 1\n    x: 2\na: [ 3, 1 ]\n");

  await toggleSwitch(page, "sort-keys", true);
  file = await downloadOutput(page);
  expect(file.content).toBe("a: [ 3, 1 ]\nb:\n    x: 2\n    y: 1\n");
});

test("uploads YAML and JSON files locally", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles({
    name: "service.yml",
    mimeType: "application/yaml",
    buffer: Buffer.from("apiVersion: v1\r\nkind: Service\r\nmetadata:\r\n  name: web\r\n"),
  });
  await expect(page.getByTestId("input-meta")).toContainText("service.yml");
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  await expect(page.getByTestId("stat-keys")).toHaveText("4");
  await expect(inputEditor(page)).toContainText("kind: Service");

  await page.getByTestId("file-input").setInputFiles({
    name: "config.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"server": {"port": 8080}}'),
  });
  await expect(page.getByRole("button", { name: "JSON → YAML" })).toHaveAttribute("aria-pressed", "true");
  await expect(status(page)).toContainText("VALID JSON");
  const file = await downloadOutput(page);
  expect(file.content).toBe("server:\n  port: 8080\n");

  await page.getByTestId("file-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByText(/notes\.txt: Unsupported file type/)).toBeVisible();
});

test("loads every preset and validates it", async ({ page }) => {
  for (const name of ["OpenAPI 3.0", "Docker Compose", "Kubernetes"]) {
    await page.getByRole("button", { name }).click();
    await expect(page.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    await expect(status(page)).toHaveAttribute("data-phase", "valid");
    await expect(page.getByRole("heading", { name: "Validated YAML Output" })).toBeVisible();
  }
});

test("copies the input and clears it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy YAML input" }).click();
  const clipboard = await readClipboard(page);
  expect(clipboard.startsWith("apiVersion: apps/v1\nkind: Deployment\n")).toBe(true);

  await page.getByRole("button", { name: "Clear input" }).click();
  await expect(status(page)).toHaveAttribute("data-phase", "empty");
  await expect(page.getByTestId("stat-input-lines")).toHaveText("0");
});

test("reports clipboard failures instead of pretending to copy", async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
    });
    document.execCommand = () => false;
  });
  await page.getByRole("button", { name: "Copy YAML input" }).click();
  await expect(page.getByText("Copy failed")).toBeVisible();
  await expect(page.getByTestId("announcer")).toContainText("Clipboard access was blocked");
});

test("validates with Ctrl+Enter when live validation is off", async ({ page }) => {
  await toggleSwitch(page, "live-validation", false);
  await setInput(page, "a: [1, 2\n");
  await expect(status(page)).toHaveAttribute("data-phase", "stale");
  await inputEditor(page).press("Control+Enter");
  await expect(status(page)).toHaveAttribute("data-phase", "invalid");
});

test("handles a large YAML document without freezing", async ({ page }) => {
  const lines = ["items:"];
  for (let i = 0; i < 25000; i++) lines.push(`  - id: ${i}`, `    name: item-${i}`);
  const big = lines.join("\n") + "\n";
  await page.getByTestId("file-input").setInputFiles({ name: "big.yaml", mimeType: "application/yaml", buffer: Buffer.from(big) });
  await expect(status(page)).toHaveAttribute("data-phase", "valid", { timeout: 30_000 });
  await expect(page.getByTestId("stat-keys")).toHaveText("50,001");
  // The page stays interactive.
  await page.getByRole("button", { name: "4 Spaces" }).click();
  await expect(page.getByRole("button", { name: "4 Spaces" })).toHaveAttribute("aria-pressed", "true");
});

test("sends no request to other origins and never transmits editor content", async ({ page }) => {
  const requests: { url: string; method: string; body: string | null }[] = [];
  page.on("request", (request) =>
    requests.push({ url: request.url(), method: request.method(), body: request.postData() }),
  );
  const response = await page.goto(URL_PATH);
  expect(response?.headers()["content-security-policy"]).toContain("connect-src 'self'");
  await expect(status(page)).toHaveAttribute("data-phase", "valid");

  const secret = "super-secret-token-9f3a1c";
  await setInput(page, `apiVersion: v1\nkind: Secret\nstringData:\n  token: ${secret}\n`);
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  await page.getByRole("button", { name: "YAML → JSON" }).click();
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  await page.getByTestId("file-input").setInputFiles({
    name: "secret.yaml",
    mimeType: "application/yaml",
    buffer: Buffer.from(`password: ${secret}\n`),
  });
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  await downloadOutput(page);

  const origin = new URL(page.url()).origin;
  const foreign = requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith("blob:") && !r.url.startsWith("data:"));
  expect(foreign).toEqual([]);
  expect(requests.filter((r) => r.method !== "GET")).toEqual([]);
  expect(requests.filter((r) => r.url.includes(secret) || (r.body ?? "").includes(secret))).toEqual([]);
});

test("has no horizontal overflow on a phone-sized screen", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(URL_PATH);
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const validate = page.getByRole("button", { name: "Validate", exact: true });
  const box = await validate.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await context.close();
});

test("runs a full workflow without console errors or hydration warnings", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto(URL_PATH);
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  await setInput(page, "a: [1\n");
  await expect(status(page)).toHaveAttribute("data-phase", "invalid");
  await page.getByRole("button", { name: "Docker Compose" }).click();
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  await page.getByRole("button", { name: "YAML → JSON" }).click();
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  await page.getByRole("button", { name: "Use output as input" }).click();
  await expect(page.getByRole("button", { name: "JSON → YAML" })).toHaveAttribute("aria-pressed", "true");
  await expect(status(page)).toContainText("VALID JSON");
  expect(problems).toEqual([]);
  await context.close();
});

test("marks an edited preset or file as edited", async ({ page }) => {
  await expect(page.getByTestId("input-meta")).toContainText("Kubernetes preset");
  await inputEditor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("# note\n");
  await expect(page.getByTestId("input-meta")).toContainText("Kubernetes preset (edited)");
  await expect(page.getByRole("button", { name: "Kubernetes" })).toHaveAttribute("aria-pressed", "false");
});

test("sorts keys of the Docker Compose preset without breaking its anchor", async ({ page }) => {
  await page.getByRole("button", { name: "Docker Compose" }).click();
  await toggleSwitch(page, "sort-keys", true);
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  await expect(page.getByTestId("sorted-badge")).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy YAML output" }).click();
  const output = await readClipboard(page);
  expect(output.indexOf("&default-logging")).toBeGreaterThan(-1);
  expect(output.indexOf("&default-logging")).toBeLessThan(output.indexOf("*default-logging"));
  expect(output).not.toMatch(/[ \t]$/m);
});

test("keeps YAML → JSON mode when a preset is picked", async ({ page }) => {
  await page.getByRole("button", { name: "YAML → JSON" }).click();
  await page.getByRole("button", { name: "OpenAPI 3.0" }).click();
  await expect(page.getByRole("button", { name: "YAML → JSON" })).toHaveAttribute("aria-pressed", "true");
  await expect(status(page)).toHaveAttribute("data-phase", "valid");
  await expect(page.getByRole("heading", { name: "JSON Output" })).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`has no detectable accessibility violations (${colorScheme})`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    await page.goto(URL_PATH);
    await expect(status(page)).toHaveAttribute("data-phase", "valid");
    const scan = () =>
      new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze()
        .then((r) => r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`));
    expect(await scan()).toEqual([]);
    await setInput(page, "a: 1\nb: [1, 2\n");
    await expect(status(page)).toHaveAttribute("data-phase", "invalid");
    expect(await scan()).toEqual([]);
    await context.close();
  });
}

test("redirects the root URL to the tool", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`${URL_PATH}$`));
});
