<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:6366F1,50:EC4899,100:F59E0B&height=210&section=header&text=YAML%20Validator&fontSize=62&fontColor=ffffff&fontAlignY=36&desc=Formatter%20%E2%80%A2%20Linter%20%E2%80%A2%20YAML%20%E2%87%84%20JSON%20Converter&descSize=20&descAlignY=58&animation=fadeIn" alt="YAML Validator, Formatter & JSON Converter" width="100%" />

### Validate, format, lint and convert YAML manifests, Kubernetes specs, OpenAPI schemas and Docker Compose files. Everything runs in your browser.

<a href="https://himat.tech/free-tools/yaml-validator">
  <img src="https://img.shields.io/badge/%E2%96%B6%20%20TRY%20THE%20LIVE%20DEMO-himat.tech-EC4899?style=for-the-badge&labelColor=6366F1" alt="Try the live demo" height="42" />
</a>

<br /><br />

<img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
<img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
<img src="https://img.shields.io/badge/CodeMirror-6-D30707?style=flat-square&logo=codemirror&logoColor=white" alt="CodeMirror 6" />
<img src="https://img.shields.io/badge/yaml-2.9-CB171E?style=flat-square&logo=yaml&logoColor=white" alt="yaml 2.9" />
<img src="https://img.shields.io/badge/Vitest-tested-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest" />
<img src="https://img.shields.io/badge/Playwright-E2E-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright" />
<img src="https://img.shields.io/badge/Privacy-100%25_client--side-10B981?style=flat-square&logo=letsencrypt&logoColor=white" alt="100% client-side" />

<br />

**[Live Demo](https://himat.tech/free-tools/yaml-validator)** &nbsp;•&nbsp;
**[Features](#-features)** &nbsp;•&nbsp;
**[Screenshots](#-screenshots)** &nbsp;•&nbsp;
**[Quick Start](#-quick-start)** &nbsp;•&nbsp;
**[Architecture](#-architecture)** &nbsp;•&nbsp;
**[Contact](#-contact-himat-technology)**

</div>

---

## 🔒 100% Client-Side Privacy

> [!IMPORTANT]
> **Your YAML configurations never leave your browser.**
> All parsing, validation, formatting and conversion happen locally, usually inside a Web Worker. The app has no API routes, database, analytics or telemetry. Uploaded files are read with the browser's File API and are never sent to a server.

---

## ✨ Features

<table>
  <tr>
    <td width="50%" valign="top">

### ✅ Real validation
- **VALID / INVALID** status for YAML and JSON
- Real **line and column** positions reported by the parser
- A hint, a source excerpt with a caret, a red underline in the editor and a **Go to line** button for each error
- Catches duplicate keys, tabs, bad indentation, unterminated quotes, missing colons, invalid sequences, unresolved aliases and "billion laughs" alias bombs

</td>
    <td width="50%" valign="top">

### 🔁 Convert & format
- **Format YAML** keeps comments, anchors and block scalars
- **YAML → JSON** turns multi-document streams into a JSON array
- **JSON → YAML** quotes values such as `"yes"` and `"1.0"` so their types survive
- Big integers stay exact, and there's no silent float rounding
- Choose **2 or 4 spaces** of indentation

</td>
  </tr>
  <tr>
    <td width="50%" valign="top">

### 🔤 Sort Keys (opt-in)
- Recursive **A → Z** key sorting
- Array order is never changed
- A **"Keys sorted A→Z"** badge marks sorted output

</td>
    <td width="50%" valign="top">

### ⚠️ Smart warnings
- Unquoted YAML 1.1 booleans (`yes`, `on`, `off`, …)
- Unknown custom tags (`!Ref`, `!include`)
- Duplicate keys in JSON

</td>
  </tr>
  <tr>
    <td width="50%" valign="top">

### 📝 Pro editor
- CodeMirror 6 with line numbers, syntax colours and indentation guides
- Live character and line counts
- **Copy**, **Clear**, `Ctrl/Cmd + Enter` to validate
- Stays responsive with multi-MB documents

</td>
    <td width="50%" valign="top">

### 📂 Upload, copy & download
- Accepts `.yaml`, `.yml` and `.json` files (up to 20 MB), read locally with `File.text()`
- JSON uploads switch the tool to **JSON → YAML** automatically
- **Copy YAML / Copy JSON / Copy Output** buttons show "Copied!" on success
- Downloads are named `validated.yaml` or `converted.json`

</td>
  </tr>
  <tr>
    <td width="50%" valign="top">

### 🚀 Presets
- ☸️ Kubernetes Deployment
- 📘 OpenAPI 3.0
- 🐳 Docker Compose

All presets use placeholder values only.

</td>
    <td width="50%" valign="top">

### 📊 Live statistics
- Payload size (UTF-8 bytes)
- Lines, characters and mapping keys
- Document count and output size
- Light and dark themes, a responsive layout and accessible keyboard/screen-reader support

</td>
  </tr>
</table>

---

## 📸 Screenshots

<div align="center">

| ☀️ Light mode | 🌙 Dark mode · YAML → JSON |
| :---: | :---: |
| <img src="docs/screenshots/desktop-light.png" alt="YAML validator in light mode" width="100%" /> | <img src="docs/screenshots/yaml-to-json-dark.png" alt="YAML to JSON conversion in dark mode" width="100%" /> |
| **❌ Precise error diagnostics** | **📱 Mobile** |
| <img src="docs/screenshots/invalid-yaml.png" alt="Invalid YAML with line and column diagnostics" width="100%" /> | <img src="docs/screenshots/mobile.png" alt="Mobile layout" width="45%" /> |

</div>

---

## ⚡ Quick Start

> Requires **Node.js 20.9+** (developed on Node 24).

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Then open **<http://localhost:3000/free-tools/yaml-validator>**. The root URL `/` redirects there.

### 🧰 Scripts

| Command | What it does |
| --- | --- |
| 🟢 `npm run dev` | Development server (Turbopack) |
| 🏗️ `npm run build` | Production build |
| 🚀 `npm run start` | Serve the production build |
| 🧹 `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript) |
| 🔎 `npm run typecheck` | Generate route types + `tsc --noEmit` |
| 🧪 `npm run test` | Vitest unit tests for the processing library |
| 🎭 `npm run test:e2e` | Playwright browser tests against a production build (port 3100) |

> [!TIP]
> Before the first E2E run, install the browser with `npx playwright install chromium`. If you've already built the app, set `E2E_SKIP_BUILD=1` to skip the rebuild.

---

## 🏛️ Architecture

```text
src/
├─ app/
│  ├─ layout.tsx                          Root layout + default metadata
│  └─ free-tools/yaml-validator/page.tsx  Tool page: SEO metadata, JSON-LD, FAQ
├─ components/yaml-validator/
│  ├─ YamlValidatorTool.tsx               Client orchestrator (state, debounced processing)
│  ├─ YamlEditor.tsx · OutputViewer.tsx   Input and output panels
│  ├─ CodeEditor.tsx · codemirror-setup.ts  CodeMirror wrapper, theme, diagnostics
│  ├─ ValidationStatus.tsx                Status badge + diagnostics list
│  └─ ActionButtons · ConversionControls · PresetSelector · FileUploader
│     CopyButton · ToolStats · PrivacyNotice · ToolInfoSections
├─ hooks/useYamlProcessor.ts              Owns the Web Worker client
├─ workers/yaml.worker.ts                 Runs processing off the main thread
└─ lib/
   ├─ yaml-parser.ts                      parseAllDocuments → diagnostics, key counts
   ├─ yaml-formatter.ts                   Format YAML + YAML 1.1 boolean lint
   ├─ yaml-converter.ts                   YAML ⇄ JSON with exact big integers
   ├─ json-diagnostics.ts                 Locates JSON syntax errors / duplicate keys
   ├─ key-sort.ts                         Recursive key sorting (arrays untouched)
   ├─ processor.ts · processor-client.ts  Entry point, worker lifecycle, fallback
   └─ text-stats · file-utils · clipboard-utils · download-utils · presets
e2e/yaml-validator.spec.ts                Playwright tests
```

```mermaid
flowchart LR
    A[📝 Editor / 📂 File upload] -->|text stays in memory| B(⚙️ Web Worker)
    B --> C{yaml parser}
    C -->|valid| D[✅ Format / YAML → JSON / JSON → YAML]
    C -->|invalid| E[❌ Line + column diagnostics]
    D --> F[📋 Copy · 💾 Download · 📊 Stats]
    E --> G[🎯 Go to line in editor]
```

The worker is created with `new Worker(new URL("../workers/yaml.worker.ts", import.meta.url))`. If a worker can't start, the same `processInput` function runs on the main thread. When a new request arrives while the worker is still busy, the worker is terminated and a fresh one handles the new request, so a slow document can't block newer input.

---

## 🛡️ Security

- 🚫 The app has no server routes. The only network traffic is the same-origin download of the app's own JS and CSS.
- 🧱 Production responses send a **Content-Security-Policy** with `connect-src 'self'` and `form-action 'none'`, as well as `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and `nosniff`.
- 🔍 The E2E suite checks the following:
  - no request goes to a foreign origin;
  - no non-GET request is made;
  - an uploaded secret never appears in any request.
- 🤫 The parser library is configured never to print warnings (which can quote document content) to the console.
- ♿ The E2E suite runs an axe-core accessibility scan (WCAG 2.2 AA) in light and dark mode.
- 🔑 Presets use placeholder hostnames and credentials only.

---

## 📌 Known Limitations

- **Formatting may rewrite number notation.** The `yaml` library normalizes numbers when it re-emits them: `0x1F` → `0x1f`, `+12` → `12`, `1e3` → `1e+3`. Values stay the same.
- **YAML → JSON drops comments.** JSON cannot hold them.
- **Integer-like keys are reordered in JSON.** JavaScript engines put keys such as `"10"` first in objects, so they appear first in JSON output.
- **Custom tags become strings.** Values with custom tags (`!Ref`, `!include`) are kept as plain strings and a warning is shown.
- **Live validation pauses above ~1 MB.** Click **Validate** (or press `Ctrl/Cmd + Enter`) to process large inputs. Uploads are limited to 20 MB.
- **Sort Keys moves anchor definitions.** When sorting would put an alias before its anchor, the definition (`&name`) moves to the first place it's used, so the data stays identical. Documents that reuse the same anchor name can't be sorted, and the tool explains why.
- **Extremely deep nesting is rejected.** YAML nested roughly 1,000 levels deep (JSON a few thousand) exceeds the browser's stack and gets a clear "nested too deeply" error instead of a crash.
- **The CSP headers are production-only.** They are not sent by `npm run dev`.
- **Browser testing has been limited.** The E2E tests have only been run in Chromium on Windows.

---

## 📬 Contact HIMAT Technology

<div align="center">

<a href="https://himat.co.in"><img src="https://img.shields.io/badge/Website-himat.co.in-6366F1?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Website: himat.co.in" /></a>
<a href="https://himat.tech/free-tools/yaml-validator"><img src="https://img.shields.io/badge/Live_Demo-himat.tech-EC4899?style=for-the-badge&logo=rocket&logoColor=white" alt="Live demo" /></a>
<a href="mailto:info@himat.co.in"><img src="https://img.shields.io/badge/Email-info%40himat.co.in-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Email: info@himat.co.in" /></a>
<a href="tel:+919445234023"><img src="https://img.shields.io/badge/Call-%2B91_94452_34023-25D366?style=for-the-badge&logo=phone&logoColor=white" alt="Phone: +91 94452 34023" /></a>

<a href="https://www.linkedin.com/company/himat-technology"><img src="https://img.shields.io/badge/LinkedIn-HIMAT_Technology-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn" /></a>
<a href="https://www.instagram.com/himat_technology"><img src="https://img.shields.io/badge/Instagram-@himat__technology-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram" /></a>
<a href="https://www.facebook.com/people/Himat-technology/61593829197445/"><img src="https://img.shields.io/badge/Facebook-Himat_Technology-1877F2?style=for-the-badge&logo=facebook&logoColor=white" alt="Facebook" /></a>

<br /><br />

| | Channel | Link |
| :---: | --- | --- |
| 🌐 | Website | [himat.co.in](https://himat.co.in) |
| 🚀 | Live demo | [himat.tech/free-tools/yaml-validator](https://himat.tech/free-tools/yaml-validator) |
| ✉️ | Email | [info@himat.co.in](mailto:info@himat.co.in) |
| 📞 | Phone | [+91 94452 34023](tel:+919445234023) |
| 💼 | LinkedIn | [linkedin.com/company/himat-technology](https://www.linkedin.com/company/himat-technology) |
| 📸 | Instagram | [@himat_technology](https://www.instagram.com/himat_technology) |
| 👍 | Facebook | [Himat Technology](https://www.facebook.com/people/Himat-technology/61593829197445/) |

<br />

**Built with ❤️ by [HIMAT Technology](https://himat.co.in)**

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:F59E0B,50:EC4899,100:6366F1&height=120&section=footer" alt="" width="100%" />

</div>
