# Licensing & Third-Party Notices

> **Relevant source files**
> * [.github/CODEOWNERS](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS)
> * [LICENSE](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE)
> * [LICENSE-UNICODE.txt](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE-UNICODE.txt)
> * [NOTICE](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE)

This page details the licensing structure of the GenOffice monorepo, the enforcement mechanisms for dependency compliance, and the automated generation of attribution notices. GenOffice utilizes a dual-licensing model to separate core open-source functionality from proprietary enterprise features.

## 1. Licensing Model

GenOffice is primarily an open-source project, but it maintains a strict boundary for enterprise-only components.

### 1.1 Apache License 2.0 (Core)

The vast majority of the codebase, including the shared engines (`docx-engine`, `pptx-engine`), the Electron shell, and the core AI agent framework, is licensed under the **Apache License, Version 2.0** [LICENSE L2-L5](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE#L2-L5)

 This license allows for broad use, reproduction, and distribution, provided that the terms regarding attribution and the `NOTICE` file are met [LICENSE L90-L123](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE#L90-L123)

### 1.2 GenOffice Enterprise License (ee/)

The `ee/` directory contains proprietary features and is subject to the **GenOffice Enterprise License**. As specified in the repository's ownership configuration, the `ee/` boundary is restricted and does not accept external contributions [.github/CODEOWNERS L1-L3](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L3)

### 1.3 Font Licensing (SIL OFL & Apache)

GenOffice bundles several font families (e.g., Liberation, Carlito, Caladea) to ensure consistent rendering across platforms. These fonts and their specific licenses are documented within the documentation renderer's font directory [NOTICE L13-L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE#L13-L15)

### 1.4 Unicode Character Database License

Specific components, such as the PDF radical mapping in `apps/pdf/src/shared/radicals.ts`, are derived from the **Unicode Character Database 17.0.0** [NOTICE L18-L21](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE#L18-L21)

 This data is distributed under the **Unicode License v3**, the full text of which is maintained in the repository root [LICENSE-UNICODE.txt L1-L39](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE-UNICODE.txt#L1-L39)

**Sources:**

* [LICENSE L1-L135](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE#L1-L135)
* [.github/CODEOWNERS L1-L7](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L7)
* [NOTICE L1-L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE#L1-L26)
* [LICENSE-UNICODE.txt L1-L40](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE-UNICODE.txt#L1-L40)

---

## 2. Dependency Compliance & Enforcement

To ensure that no incompatible licenses (e.g., GPL-3.0) are introduced into the project, GenOffice employs automated scanning tools for both Node.js and Rust dependencies.

### 2.1 Rust Dependency Auditing (cargo-deny)

The `xlsx-engine` (located in `apps/sheets/native`) and other Rust components are audited using `cargo-deny`. This tool uses a `deny.toml` configuration to whitelist specific licenses and ban others. This check is a mandatory gate in the CI pipeline.

### 2.2 License Validation Workflow

The following diagram illustrates how licenses are validated during the development and CI lifecycle.

**License Verification Flow**

```

```

**Sources:**

* [NOTICE L6-L11](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE#L6-L11)
* [.github/CODEOWNERS L4-L6](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L4-L6)

---

## 3. Third-Party Notices Generation

GenOffice automates the generation of attribution notices to comply with Section 4(d) of the Apache-2.0 license [LICENSE L107-L123](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE#L107-L123)

### 3.1 gen-third-party-notices.mjs

This script is responsible for aggregating license text from all dependencies across the npm workspaces.

* **Execution**: It is typically run at packaging time [NOTICE L7-L8](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE#L7-L8)
* **Output**: It produces a file named `THIRD-PARTY-NOTICES.txt` [NOTICE L6-L7](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE#L6-L7)
* **Distribution**: In production builds, this file is placed in `Contents/Resources` (macOS) or `resources/` (Windows) [NOTICE L8-L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE#L8-L9)

### 3.2 Attribution Data Flow

The following diagram maps the relationship between the generation script and the resulting artifacts in the application bundle.

**Attribution Generation Entity Map**

```

```

**Sources:**

* [NOTICE L1-L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE#L1-L26)
* [LICENSE L107-L117](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE#L107-L117)

---

## 4. Code Ownership & Maintenance

License-related files are strictly controlled to prevent accidental modification of the project's legal posture. The `.github/CODEOWNERS` file designates specific maintainers for these files:

| File/Path | Owner | Purpose |
| --- | --- | --- |
| `/ee/` | `@merrick-2002` | Enterprise boundary protection [.github/CODEOWNERS L3](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L3-L3) |
| `/LICENSE` | `@merrick-2002` | Main Apache-2.0 text [.github/CODEOWNERS L4](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L4-L4) |
| `/NOTICE` | `@merrick-2002` | Primary attribution header [.github/CODEOWNERS L5](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L5-L5) |
| `/.github/CODEOWNERS` | `@merrick-2002` | Ownership rules [.github/CODEOWNERS L6](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L6-L6) |

**Sources:**

* [.github/CODEOWNERS L1-L7](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L7)