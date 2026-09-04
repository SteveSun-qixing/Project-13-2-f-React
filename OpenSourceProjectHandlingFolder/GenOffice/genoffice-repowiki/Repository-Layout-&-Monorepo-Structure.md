# Repository Layout & Monorepo Structure

> **Relevant source files**
> * [.github/CODEOWNERS](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS)
> * [.gitignore](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.gitignore)
> * [LICENSE](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE)
> * [NOTICE](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE)

This page details the directory structure of the GenOffice monorepo, explaining the purpose of each top-level directory and how different components interact. Understanding this layout is crucial for navigating the codebase, identifying ownership, and contributing effectively.

The GenOffice project is structured as a monorepo, hosting multiple applications and shared libraries within a single Git repository. This approach facilitates code sharing, consistent tooling, and simplified dependency management across the suite of applications.

## Top-Level Directories

The repository is organized into several key top-level directories:

* `apps/`: Contains the six Electron-based desktop applications, including the shell and five specialized editors.
* `packages/`: Houses shared TypeScript/JavaScript libraries used by the applications.
* `ee/`: Holds enterprise-specific features and code under a separate license boundary [.github/CODEOWNERS L1-L3](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L3)
* `e2e/`: Contains end-to-end tests for the applications.
* `scripts/`: Stores various utility scripts for development and maintenance.
* `tools/`: Contains tools for build processes, license generation, and other development tasks.
* `.github/`: Configuration for GitHub Actions, issue templates, and CODEOWNERS [.github/CODEOWNERS L6](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L6-L6)

### apps/ - Electron Applications

The `apps/` directory is the home for the six Electron applications that constitute the GenOffice suite. Each application resides in its own subdirectory, following a consistent structure.

```

```

Sources: `.github/CODEOWNERS`(), `NOTICE`()

Each application directory typically contains:

* `src/`: Source code for the Electron main process, preload scripts, and renderer process.
* `electron.vite.config.ts`: Configuration for `electron-vite`, handling bundling for main, preload, and renderer processes.
* `package.json`: Application-specific dependencies and scripts.

A notable exception is `apps/sheets/native/`, which contains the Rust-based `xlsx-engine` sidecar.

#### apps/sheets/native/xlsx-engine - Rust Sidecar

The `apps/sheets/native/xlsx-engine` directory contains the Rust project responsible for handling `.xlsx` file import and export operations for the Sheets application. This component runs as a separate process and communicates with the Electron main process via an IPC protocol.

Sources: `apps/sheets/native/xlsx-engine/`()

### packages/ - Shared Engine Packages

The `packages/` directory is a crucial part of the monorepo, containing shared TypeScript/JavaScript libraries that are consumed by one or more of the Electron applications. This promotes code reuse and maintains consistency across the suite.

```

```

Key shared packages include:

* `@genoffice/docx-engine`: Handles `.docx` file parsing and generation.
* `@genoffice/pptx-engine`: Manages `.pptx` file parsing and generation.
* `@genoffice/pptx-render`: Provides rendering capabilities for presentations.
* `@genoffice/agent-core`: Core logic for the AI agent loop and skill composition.
* `@genoffice/ai-provider`: Abstraction layer for various AI service providers.
* `@genoffice/ai-search`: Functionality for AI-driven web and image search.
* `@genoffice/file-parse`: Utilities for text extraction from various file formats for AI attachments.
* `@genoffice/font-metrics`: SFNT table parsing and line-height accuracy logic.
* `@genoffice/i18n`: Internationalization locale key system.
* `@genoffice/ui`: A shared React component library including `AiComposer` and `Markdown` components.
* `@genoffice/project-store`: Manages recent files and project-related data via IPC.
* `@genoffice/electron-utils`: Utility functions for Electron security like `safeExternalUrl`.

Sources: `NOTICE`()

### ee/ - Enterprise Boundary

The `ee/` directory represents the enterprise-licensed boundary of the GenOffice codebase. Code within this directory is subject to the GenOffice Enterprise License, which differs from the Apache-2.0 license covering the main codebase [LICENSE L1-L131](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE#L1-L131)

This directory is explicitly marked in `.github/CODEOWNERS` as taking no external contributions and requiring review from `@merrick-2002` [.github/CODEOWNERS L1-L3](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L3)

 This separation allows for distinct licensing and contribution policies for enterprise-specific features.

Sources: `.github/CODEOWNERS:1-3`(), `LICENSE:1-5`()

### e2e/ - End-to-End Tests

The `e2e/` directory contains end-to-end tests for the GenOffice applications, primarily using Playwright. These tests simulate user interactions across the shell and individual apps, such as `home.spec.ts` and `markdown-tab.spec.ts`.

Sources: `.gitignore:29-30`()

### scripts/ - Utility Scripts

This directory holds various utility scripts used for development, build processes, and other maintenance tasks. This includes local ad-hoc e2e driver scripts in `scripts/drivers/` which are excluded from version control [.gitignore L13-L14](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.gitignore#L13-L14)

Sources: `.gitignore:13-14`()

### tools/ - Build and Development Tools

The `tools/` directory contains specialized tools that support the build system, license generation, and other development infrastructure.

A key tool here is `tools/gen-third-party-notices.mjs`, which generates the `THIRD-PARTY-NOTICES.txt` file at packaging time, listing all bundled third-party components and their licenses [NOTICE L6-L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/NOTICE#L6-L9)

 This file is included in release builds but not checked into the repository [.gitignore L16](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.gitignore#L16-L16)

Sources: `NOTICE:6-11`(), `.gitignore:16-16`()

### .github/ - GitHub Configuration

This directory contains configuration files for GitHub-specific features, including:

* `CODEOWNERS`: Defines code ownership for different parts of the repository, specifying who is responsible for reviewing changes [.github/CODEOWNERS L1-L7](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L7)
* `workflows/`: Contains GitHub Actions workflow definitions for continuous integration (CI), such as `ci.yml`.

Sources: `.github/CODEOWNERS:1-7`()

## Monorepo Structure & Data Flow

The following diagram illustrates how the different components of the monorepo relate to one another, specifically highlighting the relationship between the Shell, the Editors, and the shared packages.

```

```

Sources: `.github/CODEOWNERS`(), `NOTICE`(), `LICENSE`()

### Repository Layout Summary Table

| Directory | Content Type | Key Entities | License |
| --- | --- | --- | --- |
| `apps/` | Electron Apps | `shell`, `docs`, `sheets`, `slides`, `pdf`, `markdown` | Apache-2.0 |
| `packages/` | TS Libraries | `docx-engine`, `pptx-engine`, `agent-core`, `ui` | Apache-2.0 |
| `ee/` | Enterprise | Restricted Features | Enterprise License |
| `tools/` | Build Tools | `gen-third-party-notices.mjs` | Apache-2.0 |
| `native/` | Rust Sidecar | `xlsx-engine` (inside `apps/sheets/`) | Apache-2.0 |

Sources: `.github/CODEOWNERS:1-6`(), `LICENSE:1-5`(), `NOTICE:6-11`()