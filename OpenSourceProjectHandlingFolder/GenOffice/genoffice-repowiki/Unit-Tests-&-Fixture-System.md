# Unit Tests & Fixture System

> **Relevant source files**
> * [LICENSE-UNICODE.txt](https://github.com/genspark-ai/genoffice/blob/d5558b6b/LICENSE-UNICODE.txt)
> * [apps/docs/scripts/generate-corpus.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts)

This page details the testing infrastructure and automated quality gates for GenOffice. The system relies on a combination of workspace-specific unit tests, a byte-deterministic fixture generation system, and specialized corpus tests to ensure document fidelity and pagination accuracy across the six-app suite.

## Testing Strategy Overview

GenOffice employs a multi-layered testing strategy to maintain high reliability across its applications and shared engine packages.

1. **Workspace Unit Tests**: Every package and app contains a `tests/` directory. These are executed via Vitest and cover logic isolation, parsing accuracy, and state management.
2. **Fixture-Driven Testing**: The `fixtures/generated` directory contains a suite of OOXML documents (DOCX, PPTX, XLSX) and their expected JSON representations. These are used for "round-trip" fidelity testing.
3. **Pagination Corpus**: A specialized set of documents used by `apps/docs` to verify that the custom pagination engine matches Word's layout behavior.
4. **CI Enforcement**: The GitHub Actions pipeline enforces that all tests pass, formatting is correct, and that committed fixtures have not drifted from the generator scripts.

### Test Execution Flow

The following diagram illustrates how the `npm test` command triggers various test suites across the monorepo workspaces.

**System Test Distribution**

```

```

**Sources:** [.github/workflows/ci.yml L91-L92](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L91-L92)

 [package.json](https://github.com/genspark-ai/genoffice/blob/d5558b6b/package.json)

---

## Fixture Generation System

To ensure byte-preserving round-trip fidelity, GenOffice uses a deterministic fixture generation system. Instead of manually creating test files in Word or Excel, which can introduce non-deterministic metadata (like unique machine IDs or varying timestamps), fixtures are generated via scripts.

### Fixture Determinism

The generation process is designed to be byte-deterministic. This allows the CI pipeline to verify that the `fixtures/generated` directory matches the output of the generation scripts exactly. If a developer modifies an engine that changes the output XML structure, they must run the fixture generator and commit the updated binary files [.github/workflows/ci.yml L85-L89](https://github.com/genspark-ai/genoffice/blob/d5558b6b/ .github/workflows/ci.yml#L85-L89)

### Core Components

* **`npm run fixtures`**: The top-level command that triggers regeneration of all test assets.
* **`fixtures/generated`**: The source of truth for integration tests.
* **`apps/docs/scripts/generate-corpus.ts`**: A specialized script for generating the pagination test suite [apps/docs/scripts/generate-corpus.ts L1-L6](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L1-L6)

**Fixture Validation Pipeline**

```

```

**Sources:** [.github/workflows/ci.yml L82-L90](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L82-L90)

 [apps/docs/scripts/generate-corpus.ts L1-L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L1-L10)

---

## Pagination Corpus (apps/docs)

The `apps/docs` application utilizes a specialized "Pagination Corpus" to validate its layout engine. This corpus consists of various DOCX files designed to test edge cases in document flow.

### Corpus Components

The script `apps/docs/scripts/generate-corpus.ts` programmatically builds these documents using `JSZip` [apps/docs/scripts/generate-corpus.ts L91-L140](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L91-L140)

 It defines a `DocSpec` interface to describe the body XML, styles, and section properties [apps/docs/scripts/generate-corpus.ts L78-L89](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L78-L89)

* **Standard Layouts**: Includes A4 [apps/docs/scripts/generate-corpus.ts L57-L61](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L57-L61)  and US Letter Landscape [apps/docs/scripts/generate-corpus.ts L72-L76](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L72-L76)
* **Chinese Document Grids**: Implements `w:docGrid` with `linePitch` settings for standard Chinese typesetting [apps/docs/scripts/generate-corpus.ts L63-L69](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L63-L69)
* **Style Definitions**: Includes default paragraph properties (`w:pPrDefault`), spacing, and heading hierarchies (Heading 1-3) [apps/docs/scripts/generate-corpus.ts L29-L54](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L29-L54)
* **Footnotes**: Generates the necessary `word/footnotes.xml` and relationships to test footnote placement during pagination [apps/docs/scripts/generate-corpus.ts L104-L106](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L104-L106)  [apps/docs/scripts/generate-corpus.ts L134](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L134-L134)

| Output Directory | Content Type | Purpose |
| --- | --- | --- |
| `apps/docs/tests/pagination-corpus/docx/` | `.docx` files | Test input for the pagination engine [apps/docs/scripts/generate-corpus.ts L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L15-L15) |
| `apps/docs/tests/pagination-corpus/meta/` | `.json` files | Metadata (tags, descriptions) for test runners [apps/docs/scripts/generate-corpus.ts L16](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L16-L16) |

**Sources:** [apps/docs/scripts/generate-corpus.ts L1-L140](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L1-L140)

 [apps/docs/scripts/generate-corpus.ts L142-L153](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L142-L153)

---

## Round-Trip Fidelity Tests

A core requirement of GenOffice is "byte-preserving round-trips." This means that opening a file and saving it without changes should result in a document that is logically identical to the original.

### Implementation Logic

The engine packages (e.g., `packages/docx-engine`) use the generated fixtures to:

1. **Parse**: Convert the fixture into an internal tree (e.g., the `Block` tree).
2. **Verify**: Assert that the internal model matches expected JSON snapshots.
3. **Generate**: Convert the model back into OOXML using the `docxIndex` anchors to ensure that unchanged parts of the XML are preserved exactly as they were in the original source.

---

## CI Pipeline Integration

The CI pipeline in `.github/workflows/ci.yml` acts as the final gate. It performs the following sequence:

1. **Environment Setup**: Configures Node 22 and the Rust stable toolchain [.github/workflows/ci.yml L32-L45](https://github.com/genspark-ai/genoffice/blob/d5558b6b/ .github/workflows/ci.yml#L32-L45)
2. **Dependency Audit**: Runs `npm run licenses` and `cargo-deny` to ensure all dependencies meet legal requirements [.github/workflows/ci.yml L54-L61](https://github.com/genspark-ai/genoffice/blob/d5558b6b/ .github/workflows/ci.yml#L54-L61)
3. **Formatting & Linting**: Uses `FORMAT_BASE_REF` to check only changed files in PRs, ensuring fast feedback loops [.github/workflows/ci.yml L63-L77](https://github.com/genspark-ai/genoffice/blob/d5558b6b/ .github/workflows/ci.yml#L63-L77)
4. **Fixture Check**: Regenerates fixtures and fails if `git diff` shows any changes [.github/workflows/ci.yml L82-L90](https://github.com/genspark-ai/genoffice/blob/d5558b6b/ .github/workflows/ci.yml#L82-L90)
5. **Test Execution**: Runs the full suite via `npm test` [.github/workflows/ci.yml L92](https://github.com/genspark-ai/genoffice/blob/d5558b6b/ .github/workflows/ci.yml#L92-L92)

**Sources:** [.github/workflows/ci.yml L1-L93](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L1-L93)

 [apps/docs/scripts/generate-corpus.ts L1-L20](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L1-L20)