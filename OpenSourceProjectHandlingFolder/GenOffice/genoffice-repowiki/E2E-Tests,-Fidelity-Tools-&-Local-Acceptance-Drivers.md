# E2E Tests, Fidelity Tools & Local Acceptance Drivers

> **Relevant source files**
> * [.github/workflows/ci.yml](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml)
> * [.gitignore](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.gitignore)

This page covers the End-to-End (E2E) testing infrastructure, specialized fidelity comparison tools, and local-only acceptance drivers used to validate the GenOffice suite. The testing strategy combines Playwright for UI automation with heavy-duty scripts for document fidelity and pagination analysis.

## E2E Testing with Playwright

GenOffice uses Playwright to drive the Electron shell and its hosted tabs. These tests validate the high-level integration between the `TabManager`, the onboarding flow, and the core application launchers.

### The launchShell Helper

The core of the E2E suite is the `launchShell` helper. This utility initializes the Electron application, configures the environment for testing, and provides access to the `ElectronApplication` instance.

* **Executable Path**: It locates the Electron binary by looking for `electron` in `node_modules` or using `process.env.ELECTRON_PATH`.
* **Isolation**: Tests typically run with a clean user data directory to ensure reproducibility across runs.
* **Window Management**: It waits for the main window to be ready and returns a handle to the Playwright `Page` object representing the shell UI.

### Test Suites

The E2E tests are located in the `e2e/` directory and focus on critical user paths:

| Test File | Focus Area | Key Validations |
| --- | --- | --- |
| `home.spec.ts` | Home Screen | Validates the "Recent Files" list, "New File" buttons, and navigation. |
| `onboarding.spec.ts` | First-run Flow | Tests the multi-step onboarding wizard and license agreement. |
| `new-file-tab.spec.ts` | Tab Management | Verifies `WebContentsView` tab spawning via `TabManager`. |
| `markdown-tab.spec.ts` | Markdown Editor | Validates GFM editing and round-trip in the shell. |
| `sheets-edit-*.spec.ts` | Sheets Engine | Validates Univer-based editing and Rust sidecar interaction. |
| `theme-pipeline.spec.ts` | Visual Consistency | Ensures CSS design tokens and theme colors are applied correctly. |

### CI Execution Environment

The CI pipeline (`.github/workflows/ci.yml`) executes these tests on Ubuntu 22.04 runners [.github/workflows/ci.yml:113]. Because Electron requires a display server on Linux, tests are wrapped in `xvfb-run` [.github/workflows/ci.yml:164]. To prevent renderer crashes on modern kernels, the CI explicitly allows unprivileged user namespaces [.github/workflows/ci.yml:150-156].

**E2E Interaction Model**

```

```

**Sources:**

* [.github/workflows/ci.yml L113-L164](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L113-L164)  (CI E2E configuration)
* [e2e/home.spec.ts L1-L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/e2e/home.spec.ts#L1-L10)  (Home screen tests)
* [e2e/onboarding.spec.ts L1-L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/e2e/onboarding.spec.ts#L1-L10)  (Onboarding flow)

---

## Fidelity Comparison Tools

GenOffice includes specialized tools in the `tools/` directory to ensure high-fidelity rendering and byte-preserving saves compared to industry standards like Microsoft Office and LibreOffice.

### 1. pptx-fidelity-compare (tools/fidelity-compare.mjs)

This tool compares GenOffice Slides (`pptx-render`) output against LibreOffice or PowerPoint renders.

* **Mechanism**: It takes a `.pptx`, renders a slide to a PNG using GenOffice, renders the same slide via a headless LibreOffice instance, and performs a pixel-diff.
* **Goal**: Ensure `pptx-engine` and `pptx-render` correctly interpret OOXML masters, placeholders, and shapes.

### 2. sheets-fidelity-compare (tools/sheets-fidelity-compare.mjs)

Compares `.xlsx` files processed by the Rust `xlsx-engine` sidecar against Excel.

* **Mechanism**: It validates that the JSON-lines IPC protocol between the Electron main process and the Rust sidecar correctly preserves cell values, formulas, and formatting [.github/workflows/ci.yml:105-108].

### 3. Slide Copy Verification (tools/verify-slide-copy-across-decks.mjs)

Validates the clipboard and "Insert Slide" logic. It ensures that when a slide is copied from one deck to another, all dependent assets (images, theme colors, layout definitions) are correctly re-mapped to the new deck's `[Content_Types].xml` and relationship files.

---

## Local Acceptance Drivers

Local acceptance drivers are specialized scripts located in `scripts/drivers/`. These are intentionally excluded from Prettier and CI checks via `.gitignore` [.gitignore:14] as they are for ad-hoc developer validation.

### Key Driver Patterns

* **docs-word-fidelity**: Focuses on the "byte-preserving round-trip" philosophy. It opens a document, triggers a save without modification, and compares the resulting XML structure via `docx-engine`.
* **pagination-baseline**: Validates the custom pagination engine in `apps/docs`. It renders documents and compares calculated page breaks against Word-generated output.

**Acceptance Driver Architecture**

```

```

**Sources:**

* [.gitignore L14-L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.gitignore#L14-L15)  (Driver script exclusion)
* [.github/workflows/ci.yml L105-L108](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L105-L108)  (Sheets compatibility gate)

---

## Validation Gates

The CI pipeline enforces strict quality gates before any code is merged.

### Byte-Deterministic Fixtures

GenOffice uses a fixture generation system where `npm run fixtures` creates a set of standard `.docx`, `.pptx`, and `.xlsx` files. The CI ensures that the generator remains byte-deterministic by checking for git diffs in `fixtures/generated` after running the generator [.github/workflows/ci.yml:91-98].

### Sheets Compatibility Gate

A specific gate for the spreadsheet app ensures that a no-op edit through the OOXML gateway leaves untouched package entries byte-identical [.github/workflows/ci.yml:103-108].

| Gate | Command | Purpose |
| --- | --- | --- |
| **Theme Check** | `npm run check:theme-colors` | Prevents hardcoded hex values; enforces design tokens [.github/workflows/ci.yml:83]. |
| **License Check** | `npm run licenses` / `cargo-deny` | Validates Node and Rust dependencies against legal policies [.github/workflows/ci.yml:54-61]. |
| **Typecheck** | `npm run typecheck` | Full TypeScript validation across all 6 apps and 12+ packages [.github/workflows/ci.yml:89]. |

**Sources:**

* [.github/workflows/ci.yml L54-L108](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L54-L108)  (CI Job Steps)
* [.gitignore L29-L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.gitignore#L29-L30)  (Test result management)