# Contributing & Community

> **Relevant source files**
> * [.github/CODEOWNERS](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS)
> * [.github/ISSUE_TEMPLATE/config.yml](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/ISSUE_TEMPLATE/config.yml)
> * [.github/pull_request_template.md](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/pull_request_template.md?plain=1)
> * [CODE_OF_CONDUCT.md](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CODE_OF_CONDUCT.md?plain=1)
> * [CONTRIBUTING.md](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1)
> * [SECURITY.md](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1)

This page provides a guide for contributors to the GenOffice suite. It covers the repository's unique "snapshot-commit" workflow, the process for submitting Pull Requests, code ownership, security reporting, and community standards.

## Development Workflow

GenOffice uses a **private-tree-to-public-mirror** workflow. The GitHub repository is a public mirror of a private development tree. Consequently, the `main` branch advances through single squashed snapshot commits, typically titled `Sync snapshot (<date>)` [CONTRIBUTING.md L7-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L7-L13)

### Snapshot Synchronization Flow

The following diagram illustrates how external contributions move from the public GitHub space into the private development tree and back to the public mirror.

**Contribution Lifecycle**

```

```

Sources: [CONTRIBUTING.md L7-L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L7-L22)

## Submitting Changes

External pull requests are welcome and reviewed on GitHub. When a PR is accepted, a maintainer imports it into the private tree. While the PR is technically "closed" rather than "merged" on GitHub, your authorship is preserved via `Co-authored-by:` git trailers [CONTRIBUTING.md L15-L21](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L15-L21)

### Contributor Checklist

Every PR must pass several automated gates before being considered for import. These are enforced in the CI pipeline but should be run locally first [CONTRIBUTING.md L45-L55](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L45-L55)

 The PR template [.github/pull_request_template.md L1-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/pull_request_template.md?plain=1#L1-L28)

 requires confirmation of these checks:

| Command | Purpose |
| --- | --- |
| `npm run format:check` | Verifies Prettier formatting on changed files [CONTRIBUTING.md L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L50-L50) |
| `npm run lint` | Runs ESLint across the monorepo [CONTRIBUTING.md L51](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L51-L51) |
| `npm run typecheck` | Executes `tsc --noEmit` for all workspaces [CONTRIBUTING.md L52](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L52-L52) |
| `npm test` | Runs Vitest unit tests and Rust sidecar tests [CONTRIBUTING.md L53](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L53-L53) |
| `npm run licenses` | Validates production dependencies against the allowlist [CONTRIBUTING.md L54](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L54-L54) |

### Code Ownership

The `.github/CODEOWNERS` file defines maintainer responsibility for critical areas of the repository, particularly the enterprise boundary [.github/CODEOWNERS L1-L7](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L7)

| Path | Owner |
| --- | --- |
| `/ee/` | `@merrick-2002` |
| `/LICENSE` | `@merrick-2002` |
| `/NOTICE` | `@merrick-2002` |
| `/.github/CODEOWNERS` | `@merrick-2002` |

Sources: [CONTRIBUTING.md L45-L68](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L45-L68)

 [.github/CODEOWNERS L1-L7](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L7)

 [.github/pull_request_template.md L12-L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/pull_request_template.md?plain=1#L12-L15)

## Issue Reporting & Community

GenOffice uses GitHub Issues for bug reports and feature requests. Contributors should use the provided templates to ensure all necessary technical context is captured [CONTRIBUTING.md L143-L145](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L143-L145)

### Security Reporting

Security vulnerabilities should **never** be reported via public issues. Instead, use GitHub's private vulnerability reporting feature [SECURITY.md L3-L8](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L3-L8)

**Security Gateways in Code**

```

```

Sources: [SECURITY.md L18-L21](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L18-L21)

 [.github/ISSUE_TEMPLATE/config.yml L3-L6](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/ISSUE_TEMPLATE/config.yml#L3-L6)

### Code of Conduct

Participation in the GenOffice community is governed by the **Contributor Covenant Code of Conduct**. We pledge to make participation a harassment-free experience for everyone [CODE_OF_CONDUCT.md L1-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CODE_OF_CONDUCT.md?plain=1#L1-L13)

 Instances of abusive or unacceptable behavior may be reported through the repository's private contact channel [CODE_OF_CONDUCT.md L58-L64](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CODE_OF_CONDUCT.md?plain=1#L58-L64)

## Licensing

GenOffice is primarily licensed under the **Apache License, Version 2.0**. However, the repository contains a strict boundary for enterprise features and specific licenses for bundled assets:

* **Main Codebase:** Apache-2.0.
* **Enterprise Directory (`ee/`):** Governed by the GenOffice Enterprise License [.github/CODEOWNERS L1-L3](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L3)
* **Fonts:** Various Open Font Licenses (OFL) [CONTRIBUTING.md L153-L155](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L153-L155)

For a detailed breakdown of licensing, third-party notices, and how to audit dependencies using `tools/check-licenses.mjs` or `cargo-deny`, see **[Licensing & Third-Party Notices](/genspark-ai/genoffice/11.1-licensing-and-third-party-notices)**.

Sources: [CONTRIBUTING.md L153-L155](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CONTRIBUTING.md?plain=1#L153-L155)

 [.github/CODEOWNERS L1-L7](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/CODEOWNERS#L1-L7)

 [CODE_OF_CONDUCT.md L1-L77](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CODE_OF_CONDUCT.md?plain=1#L1-L77)