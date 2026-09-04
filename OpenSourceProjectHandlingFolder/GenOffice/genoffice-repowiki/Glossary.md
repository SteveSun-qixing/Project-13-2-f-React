# Glossary

> **Relevant source files**
> * [.github/ISSUE_TEMPLATE/bug_report.yml](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/ISSUE_TEMPLATE/bug_report.yml)
> * [.github/workflows/ci.yml](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml)
> * [CLAUDE.md](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CLAUDE.md?plain=1)
> * [README.md](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1)

This page provides definitions for codebase-specific terms, abbreviations, and domain concepts used throughout GenOffice. It serves as a technical reference for onboarding engineers and a guide to the underlying data models.

## Document Modeling & Engines

### Block Tree

The intermediate representation used by `docx-engine` to bridge OOXML and the editor. Instead of a flat XML string, the document is parsed into a tree of "Blocks" (paragraphs, tables, images).

* **Implementation:** Each block in the tree maintains a reference to its original XML slice to enable [passthrough](https://github.com/genspark-ai/genoffice/blob/d5558b6b/passthrough)
* **Data Flow:** `docx-engine` parses `word/document.xml` into this tree, which is then converted into a TipTap-compatible JSON schema for the renderer.
* **Sources:** [README.md L80](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L80-L80)  [README.md L120](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L120-L120)

### docxIndex

A unique numeric identifier assigned to every top-level block during the initial parse of a `.docx` file.

* **Purpose:** It acts as a stable anchor for the [paragraph patch](https://github.com/genspark-ai/genoffice/blob/d5558b6b/paragraph patch)  system. If a block's `docxIndex` exists in the original file, the engine can decide whether to reuse the original bytes or regenerate them.
* **Sources:** [README.md L80](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L80-L80)

### Paragraph Patch

A byte-level saving strategy where only "dirty" (edited) paragraphs are regenerated as new OOXML.

* **Mechanism:** The engine splices new XML fragments into the original `word/document.xml` stream, using `docxIndex` to locate the correct insertion points. This ensures that untouched content (like complex formatting or macros GenOffice doesn't yet support) remains byte-for-byte identical.
* **Sources:** [README.md L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L26-L26)  [README.md L80](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L80-L80)

### Round-Trip Fidelity

The core product promise that opening and saving a file in GenOffice will not alter any data or layout that the user did not explicitly touch.

* **Verification:** CI runs "fidelity tests" that compare the bytes of a saved file against the original for unedited regions. A preservation gate ensures no-op edits leave untouched package entries byte-identical.
* **Sources:** [README.md L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L26-L26)  [.github/workflows/ci.yml L103-L109](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L103-L109)

### Passthrough

The capability of the engines to preserve XML elements or attributes that are not explicitly modeled in the editor's internal state.

* **Sources:** [README.md L80](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L80-L80)

---

## Spreadsheet Architecture (Sheets)

### xlsx-sidecar

A standalone background process written in Rust that handles the heavy lifting of `.xlsx` parsing and generation.

* **Crates:** Uses `calamine` for reading and `IronCalc` for calculation logic.
* **Communication:** The Electron main process communicates with it via a JSON-lines IPC protocol using the `XlsxSidecarClient`.
* **Sources:** [README.md L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L28-L28)  [README.md L81](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L81-L81)

### Univer

The open-source spreadsheet UI framework (Apache-2.0) used as the foundation for GenOffice Sheets. GenOffice extends it with custom plugins for charts, pivot tables, and formula tracing.

* **Sources:** [README.md L81](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L81-L81)

### Konva

A 2D canvas library used in GenOffice Sheets for rendering high-performance, interactive charts and shapes that are not natively handled by the Univer core.

* **Sources:** [README.md L81](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L81-L81)

---

## AI & Agent System

### AgentLoop

The core multi-turn execution engine for AI interactions. It manages the state machine that handles user prompts, tool-calling, and response streaming.

* **Location:** Defined in `packages/agent-core`.
* **Sources:** [README.md L107-L108](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L107-L108)

### AgentSkill

A modular interface that allows different apps (Docs, Sheets, Slides) to register their specific capabilities with the `AgentLoop`.

* **Structure:** Includes a `systemPrompt`, a set of `tools`, and a `buildContext` function to provide the AI with the current file's state.
* **Sources:** [README.md L107-L108](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L107-L108)

### AgentTransport

An abstraction layer that allows the `AgentLoop` to communicate across the Electron IPC boundary. It ensures that the UI (renderer) can send requests to the AI logic securely.

* **Sources:** [README.md L107-L108](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L107-L108)

### Context Compaction

A technique used by the `AgentLoop` to manage LLM context limits. It trims or summarizes older conversation history and "compacts" large document skeletons to ensure the most relevant information is sent to the model.

* **Sources:** [README.md L107-L108](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L107-L108)

### Genspark Proxy

The default AI provider that routes model calls through Genspark's cloud infrastructure. This allows GenOffice to provide AI features without requiring users to supply their own API keys.

* **Sources:** [README.md L109-L110](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L109-L110)

---

## Presentation & Graphics (Slides)

### pptx-engine & pptx-render

* **pptx-engine:** Handles the parsing of `.pptx` (OOXML) into a logical model of slides, shapes, and masters.
* **pptx-render:** Converts that model into visual elements on the screen, handling coordinate transformations and geometry.
* **Sources:** [README.md L82](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L82-L82)

### Layout Script Interpreter

A sandboxed, AST-based interpreter that executes AI-generated scripts to modify slide layouts.

* **Security:** It does not use `eval()`. Instead, it uses `Acorn` to parse a safe subset of JavaScript and executes it against a restricted set of slide primitives.
* **Sources:** [README.md L82](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L82-L82)

### HarfBuzz

A text-shaping engine used in GenOffice Slides to calculate precise glyph positioning and metrics, ensuring that complex scripts and kerning match professional presentation software.

* **Sources:** [README.md L29](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L29-L29)  [README.md L82](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L82-L82)

### SpElement

Short for "Shape Element." The internal base class/interface for all visual objects on a slide (rectangles, text boxes, images, charts).

---

## Shell & UI Infrastructure

### TabManager

The component in the `shell` app responsible for managing multiple open documents. It handles the lifecycle of `WebContentsView` instances, allowing users to switch between different editors (Docs, Sheets, etc.) within a single window.

* **Sources:** [README.md L100-L101](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L100-L101)

### WebContentsView

The Electron primitive used to host individual document editors. Unlike `Webview` tags, `WebContentsView` allows for better security isolation and native-feeling tab management.

* **Sources:** [README.md L100-L101](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L100-L101)

### safeExternalUrl

A security gate in `@genoffice/electron-utils` that validates all outgoing URLs before allowing the OS to open them. It enforces a strict protocol allowlist (e.g., `https:`, `mailto:`) to prevent local file execution or XSS attacks.

* **Sources:** [README.md L113-L114](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L113-L114)

### FORMAT_BASE_REF

An environment variable used in the CI pipeline to determine the base git commit for incremental formatting checks. It ensures that only files touched in a PR are checked for Prettier compliance.

* **Sources:** [.github/workflows/ci.yml L64-L74](https://github.com/genspark-ai/genoffice/blob/d5558b6b/.github/workflows/ci.yml#L64-L74)

---

## Markdown & Styling

### DocEnvelope

A wrapper structure used in the Markdown editor to preserve file metadata (BOM, EOL characters) and frontmatter during the round-trip process.

* **Sources:** [README.md L89-L91](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L89-L91)

### GFM

GitHub Flavored Markdown. The specific dialect of Markdown supported by GenOffice, including support for tables, task lists, and strikethroughs.

* **Sources:** [README.md L89-L91](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L89-L91)

### Design Tokens

Semantic CSS custom properties (e.g., `--surface`, `--text`) defined in `packages/ui/src/tokens.css`. These allow for consistent light/dark theme switching across the suite chrome.

* **Sources:** [CLAUDE.md L8-L19](https://github.com/genspark-ai/genoffice/blob/d5558b6b/CLAUDE.md?plain=1#L8-L19)

### Font Metrics

A subsystem (`packages/font-metrics`) that parses SFNT tables to extract `FaceVerticalMetrics` (ascent, descent, line gap). This is critical for Docs to achieve Word-faithful pagination.

* **Sources:** [README.md L111-L112](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L111-L112)

---

## Domain Concepts

### OOXML

Office Open XML. The ZIP-based XML file formats used by Microsoft Office (`.docx`, `.xlsx`, `.pptx`). GenOffice's engines are designed to be "OOXML-native."

* **Sources:** [README.md L13-L17](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L13-L17)  [README.md L80-L82](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L80-L82)

### EMU

English Metric Unit. A high-precision unit of measurement used in OOXML (1 inch = 914,400 EMUs). GenOffice uses EMUs internally for slides and sheets to avoid floating-point rounding errors during layout.

### ee/

The "Enterprise Edition" directory. It contains code covered by the GenOffice Enterprise License rather than the Apache-2.0 license.

* **Sources:** [README.md L143-L145](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L143-L145)

---

## Architecture Diagrams

### From Natural Language to AI Skill Execution

This diagram maps how a user's natural language request travels from the UI through the AI core and eventually executes a specific code tool in the Docs editor.

```

```

**Sources:** [README.md L43-L44](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L43-L44)

 [README.md L107-L108](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L107-L108)

### Document Loading and Block Anchoring

This diagram shows how a raw `.docx` file is transformed into anchored code entities that support byte-preserving saves.

```

```

**Sources:** [README.md L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L26-L26)

 [README.md L80](https://github.com/genspark-ai/genoffice/blob/d5558b6b/README.md?plain=1#L80-L80)