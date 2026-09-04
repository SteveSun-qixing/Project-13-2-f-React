# CI Pipeline & Automated Checks

> **Relevant source files**
> * [.gitattributes](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.gitattributes)
> * [.github/workflows/ci.yml](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml)
> * [.prettierignore](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.prettierignore)

The GenOffice CI pipeline is a multi-stage verification system designed to ensure code quality, type safety, and functional regression testing across the monorepo's six-app suite and shared engine packages. The pipeline executes on every push and pull request to maintain a "green" state for the `main` branch, enforcing strict formatting, linting, and byte-deterministic fixture validation.

## Pipeline Lifecycle & Triggers

The CI workflow is defined in `.github/workflows/ci.yml` and is split into two primary jobs: `test` (unit/static analysis) and `e2e` (Electron integration) [.github/workflows/ci.yml:23-23], [.github/workflows/ci.yml:110-110].

The workflow is triggered by:

1. **Push**: To `main`, `dev_*`, and `release_*` branches [.github/workflows/ci.yml:9-10].
2. **Pull Request**: Targeting the `main` branch [.github/workflows/ci.yml:11-12].
3. **Manual Trigger**: Via `workflow_dispatch` [.github/workflows/ci.yml:13-13].

To optimize resource usage, the pipeline utilizes **concurrency cancellation**. If a new commit is pushed to the same branch while a previous run is still active, the older run is automatically canceled [.github/workflows/ci.yml:15-17]. Both jobs are configured with a **45-minute timeout** [.github/workflows/ci.yml:25-25], [.github/workflows/ci.yml:114-114].

### CI Trigger to Job Flow

This diagram maps the GitHub Action events to the internal job execution environment.

```

```

**Sources:** [.github/workflows/ci.yml:8-52], [.github/workflows/ci.yml:110-137]

---

## Automated Check Sequence (Test Job)

The `test` job executes a series of sequential gates. Failure in any step halts the remaining checks.

### 1. License Compliance

The pipeline verifies that all third-party dependencies comply with project licensing standards:

* **Node.js**: Runs `npm run licenses` to check packages in `node_modules` [.github/workflows/ci.yml:54-55].
* **Rust (xlsx-sidecar)**: Uses `EmbarkStudios/cargo-deny-action` to check the `Cargo.toml` of the `xlsx-engine` [.github/workflows/ci.yml:57-61].

### 2. Formatting & Theme Verification

GenOffice enforces Prettier formatting with a specific focus on avoiding line-ending conflicts. The `.gitattributes` file forces `eol=lf` for all text files to ensure Windows clones don't fail the incremental check [.gitattributes:1-4].

For Pull Requests, the pipeline calculates a `FORMAT_BASE_REF` to ensure only changed files are checked, preventing unrelated failures from a fast-moving `main` branch:

* It identifies the merge base using `git rev-parse HEAD^1` [.github/workflows/ci.yml:71-73].
* It executes `npm run format:check` [.github/workflows/ci.yml:74-74].
* It executes `npm run check:theme-colors` to ensure CSS variables and design tokens adhere to the theme schema [.github/workflows/ci.yml:83-83].

### 3. Static Analysis (Lint & Typecheck)

* **Linting**: Runs `npm run lint` across all workspaces [.github/workflows/ci.yml:85-86].
* **Typechecking**: Runs `npm run typecheck` to validate TypeScript integrity across the entire monorepo [.github/workflows/ci.yml:88-89].

### 4. Fixture Determinism & Sheets Compatibility

GenOffice relies on byte-deterministic document generation. The CI ensures that the committed test fixtures in `fixtures/generated` match exactly what the current code produces:

1. **Regenerate**: Executes `npm run fixtures` [.github/workflows/ci.yml:91-92].
2. **Diff Check**: Runs `git diff --exit-code -- fixtures/generated`. A failure indicates the generator (e.g., `build-docx.ts`) and committed files have drifted [.github/workflows/ci.yml:97-98].
3. **Sheets Compatibility Gate**: A specific preservation gate for `.xlsx`. It runs `npm run compat -w @genoffice/sheets` to ensure no-op edits through the OOXML gateway leave untouched package entries byte-identical [.github/workflows/ci.yml:105-108].

### 5. Unit Tests

Executes `npm test`, which runs the full suite of Vitest tests across apps and packages [.github/workflows/ci.yml:100-101].

---

## E2E Integration Job

The `e2e` job runs on `ubuntu-22.04` to avoid AppArmor restrictions found in newer kernels that block Electron renderer spawning [.github/workflows/ci.yml:111-113].

* **Environment**: Uses `xvfb-run` to provide a virtual display for the Electron shell [.github/workflows/ci.yml:164-164].
* **Security Bypass**: It explicitly disables `kernel.apparmor_restrict_unprivileged_userns` to allow the Chromium zygote to function in the CI environment [.github/workflows/ci.yml:150-156].
* **Artifacts**: On failure, it uploads Playwright traces and screenshots from `e2e/artifacts` and `e2e/test-results` [.github/workflows/ci.yml:166-174].

---

## CI Logic to Code Entities

This diagram bridges the CI configuration to the specific scripts and tools defined in the codebase.

```

```

**Sources:** [.github/workflows/ci.yml:63-108], [.github/workflows/ci.yml:164-164], [.gitattributes:1-4]

---

## Summary Table of CI Gates

| Step | Command | Purpose |
| --- | --- | --- |
| **Node Licenses** | `npm run licenses` | Validate `package.json` licenses. |
| **Rust Licenses** | `cargo-deny check licenses` | Validate Rust dependencies via `cargo-deny`. |
| **Format Check** | `npm run format:check` | Incremental Prettier check using `FORMAT_BASE_REF`. |
| **Theme Check** | `npm run check:theme-colors` | Validate design tokens and theme consistency. |
| **Fixture Sync** | `git diff --exit-code` | Verify `fixtures/generated` are byte-deterministic. |
| **Compat Gate** | `npm run compat` | Ensure OOXML round-trip preservation in Sheets. |
| **E2E Tests** | `npm run test:e2e` | Playwright + Electron integration tests in Xvfb. |

**Sources:** [.github/workflows/ci.yml:54-108], [.github/workflows/ci.yml:164-164]