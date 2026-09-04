# Testing & Quality Infrastructure

> **Relevant source files**
> * [.github/pull_request_template.md](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/pull_request_template.md?plain=1)
> * [.github/workflows/ci.yml](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml)

GenOffice employs a multi-layered testing strategy to ensure high fidelity in office document processing, secure AI interactions, and a stable Electron shell experience. The infrastructure is designed to enforce byte-deterministic round-trips for OOXML files while maintaining strict linting, type-safety, and theme-color gates across the monorepo.

### Quality Assurance Overview

The quality pipeline consists of static analysis (ESLint, TypeScript), unit and integration tests (Vitest), end-to-end shell automation (Playwright), and a specialized fixture generation system to prevent regression in document parsing engines.

```

```

**Sources:** [.github/workflows/ci.yml L1-L109](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L1-L109)

 [.github/pull_request_template.md L10-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/pull_request_template.md?plain=1#L10-L28)

---

### CI Pipeline & Automated Checks

The project uses GitHub Actions to gate all pull requests and pushes to core branches. The CI environment is standardized on Node 22 and the Stable Rust toolchain to accommodate the `xlsx-engine` sidecar [.github/workflows/ci.yml:32-45].

* **Concurrency & Timeouts:** The pipeline uses `cancel-in-progress: true` to save resources [.github/workflows/ci.yml:15-17] and enforces a 45-minute timeout per job [.github/workflows/ci.yml:25,114].
* **Formatting & Theme Gates:** Uses `FORMAT_BASE_REF` to check only changed files [.github/workflows/ci.yml:64-75]. It also runs a specialized `check:theme-colors` script to ensure UI components adhere to the design system [.github/workflows/ci.yml:76-84].
* **License & Compatibility:** JS dependencies are audited via `npm run licenses`, while Rust dependencies use `cargo-deny` [.github/workflows/ci.yml:54-62]. A "Sheets compatibility gate" ensures that no-op edits through the OOXML gateway remain byte-identical [.github/workflows/ci.yml:105-109].

For details, see [CI Pipeline & Automated Checks](/genspark-ai/genoffice/10.1-ci-pipeline-and-automated-checks).

**Sources:** [.github/workflows/ci.yml L1-L109](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L1-L109)

---

### Unit Testing & Fixture System

Unit tests are distributed across the `apps/` and `packages/` directories, executed via Vitest. A critical component of the engine testing is the **Fixture System**, which ensures that document engines produce byte-deterministic outputs.

| Component | Test Location | Purpose |
| --- | --- | --- |
| **DOCX Engine** | `packages/docx-engine/tests` | Round-trip fidelity and OOXML fragment generation. |
| **XLSX Sidecar** | `apps/sheets/native/xlsx-engine` | Rust unit tests for `calamine` and `IronCalc` logic. |
| **Markdown** | `apps/markdown/tests` | GFM and Frontmatter preservation tests. |
| **Fixture Gen** | `fixtures/generated` | Committed binary artifacts used for regression testing. |

The CI job runs `npm run fixtures` and executes a `git diff --exit-code` to ensure that the committed fixtures match what the current code generates [.github/workflows/ci.yml:91-99].

For details, see [Unit Tests & Fixture System](/genspark-ai/genoffice/10.2-unit-tests-and-fixture-system).

**Sources:** [.github/workflows/ci.yml L91-L102](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L91-L102)

 [.github/pull_request_template.md L27-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/pull_request_template.md?plain=1#L27-L28)

---

### E2E & Local Acceptance Drivers

End-to-end (E2E) testing validates the integration between the Electron main process and the various renderer applications using Playwright.

* **Shell Automation:** The `e2e` job runs on `ubuntu-22.04` to avoid AppArmor restrictions found in newer kernels [.github/workflows/ci.yml:111-113]. It uses `xvfb-run` to provide a display server for Electron [.github/workflows/ci.yml:161-164].
* **Fidelity Tools:** The codebase includes specialized tools like `fidelity-compare.mjs` (for PPTX vs PowerPoint) and `sheets-fidelity-compare.mjs` (for XLSX vs Excel) to measure visual regression.
* **Local Drivers:** Located in `scripts/drivers/`, these scripts allow developers to run targeted acceptance tests for specific apps (e.g., `docs`, `sheets`) outside of the full E2E suite.

```

```

For details, see [E2E Tests, Fidelity Tools & Local Acceptance Drivers](/genspark-ai/genoffice/10.3-e2e-tests-fidelity-tools-and-local-acceptance-drivers).

**Sources:** [.github/workflows/ci.yml L110-L175](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L110-L175)

 [.github/pull_request_template.md L19-L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/pull_request_template.md?plain=1#L19-L22)

---

### Coding Standards & Linting

The codebase enforces strict stylistic consistency to minimize merge conflicts and maintain readability.

* **Prettier & Linting:** Standardized formatting is enforced via `npm run format:check` and `npm run lint` [.github/pull_request_template.md:12-13].
* **Line Endings:** The `.gitattributes` file enforces `eol=lf` across all platforms to prevent CRLF issues on Windows developer machines.
* **Binary Protection:** Document formats (`.docx`, `.pptx`, `.pdf`) are explicitly marked as binary in git configuration to prevent accidental corruption during text normalization.

For details, see [CI Pipeline & Automated Checks](/genspark-ai/genoffice/10.1-ci-pipeline-and-automated-checks).

**Sources:** [.github/pull_request_template.md L12-L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/pull_request_template.md?plain=1#L12-L15)

 [.github/workflows/ci.yml L85-L90](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L85-L90)