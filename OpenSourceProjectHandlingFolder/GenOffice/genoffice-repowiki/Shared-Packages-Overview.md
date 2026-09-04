# Shared Packages Overview

> **Relevant source files**
> * [apps/docs/package.json](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json)

This page provides a survey of the shared packages located in the `packages/*` directory of the GenOffice monorepo. These packages encapsulate core functionalities, engines, and utilities that are leveraged across all applications in the suite (Docs, Sheets, Slides, PDF, Markdown, Shell), promoting code reuse and a consistent architectural approach.

The `packages/*` directory contains pure TypeScript engine and shared packages, meaning they generally have no direct Electron dependency and are unit-tested independently.

## Package Architecture

The shared packages are categorized by their primary domain. Applications consume these packages via npm workspaces, allowing for modular development and shared logic for complex tasks like OOXML parsing or AI agent orchestration.

```mermaid
flowchart TD

DOCS["apps/docs"]
SHEETS["apps/sheets"]
SLIDES["apps/slides"]
PDF["apps/pdf"]
MD["apps/markdown"]
SHELL["apps/shell"]
DXE["docx-engine"]
PXE["pptx-engine"]
PXR["pptx-render"]
FP["file-parse"]
FM["font-metrics"]
AC["agent-core"]
AP["ai-provider"]
AS["ai-search"]
UI["ui (React Kit)"]
I18N["i18n"]
PS["project-store"]
EU["electron-utils"]

DOCS --> DXE
DOCS --> FM
SLIDES --> PXE
SLIDES --> PXR
SHEETS --> FP
MD --> DXE
DOCS --> AC
SHEETS --> AC
SLIDES --> AC
PDF --> AC
MD --> AC
DOCS --> UI
SHEETS --> UI
SLIDES --> UI
PDF --> UI
MD --> UI
SHELL --> UI
DOCS --> I18N
SHEETS --> I18N
SLIDES --> I18N
PDF --> I18N
MD --> I18N
SHELL --> I18N
DOCS --> PS
SHEETS --> PS
SLIDES --> PS
PDF --> PS
MD --> PS
SHELL --> PS
DOCS --> EU
SHEETS --> EU
SLIDES --> EU
PDF --> EU
MD --> EU
SHELL --> EU

subgraph subGraph3 ["Core Utilities"]
    UI
    I18N
    PS
    EU
end

subgraph subGraph2 ["AI System"]
    AC
    AP
    AS
    AC --> AP
    AP --> AS
end

subgraph subGraph1 ["Document Engines"]
    DXE
    PXE
    PXR
    FP
    FM
end

subgraph subGraph0 ["Application Layer"]
    DOCS
    SHEETS
    SLIDES
    PDF
    MD
    SHELL
end
```

Sources: [apps/docs/package.json L21-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L21-L28)

 [apps/docs/package.json L93-L97](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L93-L97)

## Package Breakdown

### Document Engines & Metrics

These packages provide the core logic for parsing, manipulating, and rendering standard document formats with high fidelity.

* **`docx-engine`**: A pure-TypeScript engine for `.docx` files. It parses `word/document.xml` into a `Block` tree and implements byte-level paragraph patching for round-trip fidelity. Used by `apps/docs` and `apps/markdown` (for export).
* **`pptx-engine`**: Handles parsing and generation of `.pptx` files, including masters, themes, and placeholder resolution.
* **`pptx-render`**: The rendering layer for presentations. It builds the render tree, handles text layout, and coordinate transformations. `apps/docs` also depends on this for rendering embedded presentation elements [apps/docs/package.json L97](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L97-L97)
* **`font-metrics`**: Provides critical typography data, including `familyVerticalMetrics` and `sfnt` table parsing. This ensures that line-heights and cursor positions match between the editor and the printed output [apps/docs/package.json L94](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L94-L94)
* **`file-parse`**: Extracts text content from `.docx`, `.pptx`, `.xlsx`, and `.pdf` for use as AI context or search indexing [apps/docs/package.json L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L26-L26)

### AI System Components

These packages form the "Brain" of GenOffice, abstracting LLM interactions and agentic behavior.

* **`agent-core`**: Implements the `AgentLoop` for multi-turn tool-calling. It handles context compaction, history trimming, and provides the `AgentSkill` interface used by app-specific AI features [apps/docs/package.json L21](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L21-L21)
* **`ai-provider`**: An abstraction layer for LLM providers (Genspark, Anthropic, OpenAI, etc.). It manages streaming responses and unified settings [apps/docs/package.json L23](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L23-L23)
* **`ai-search`**: Provides tools for web and image search, including authentication for the Genspark search API [apps/docs/package.json L24](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L24-L24)

### Core Utilities & UI

* **`ui`**: The shared React component library. It contains design tokens (`tokens.css`), icons, and complex components like `AiComposer` and `AiTypingIndicator` [apps/docs/package.json L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L28-L28)
* **`i18n`**: Manages the locale key system and translations across the suite [apps/docs/package.json L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L22-L22)
* **`project-store`**: A shared persistence layer for "Recent Files" and application state, synchronized via Electron IPC [apps/docs/package.json L27](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L27-L27)
* **`electron-utils`**: Security-focused utilities including `safeExternalUrl` gates and navigation guards [apps/docs/package.json L93](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L93-L93)

## AI Agent Data Flow

The following diagram bridges the "Natural Language Space" (User Input) to the "Code Entity Space" (Classes and Interfaces) within the shared packages.

```mermaid
flowchart TD

UI["AiComposer (packages/ui)"]
TRANS["ElectronTransport (packages/agent-core)"]
LOOP["AgentLoop (packages/agent-core)"]
SKILL["AgentSkill (app-specific)"]
PROV["AiProvider (packages/ai-provider)"]

TRANS --> LOOP
LOOP --> TRANS

subgraph subGraph1 ["Main Process"]
    LOOP
    SKILL
    PROV
    LOOP --> SKILL
    SKILL --> LOOP
    LOOP --> PROV
    PROV --> LOOP
end

subgraph subGraph0 ["Renderer Process"]
    UI
    TRANS
    UI --> TRANS
    TRANS --> UI
end
```

Sources: [apps/docs/package.json L21-L23](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L21-L23)

## Font Resolution Logic

Accurate rendering across different operating systems requires a robust font substitution system. While `font-metrics` provides raw data, `apps/docs` implements the resolution logic.

```mermaid
flowchart TD

CHECK["checkMissingFonts()"]
START["ParsedDoc"]
COLL["collectDocFonts()"]
LIST["Declared Font List"]
CANVAS["Canvas Context"]
MEASURE["fontAvailableIn()"]
RESULT["Is Available?"]
SUB["Find Substitute (Carlito, Caladea, etc.)"]
DONE["Use System Font"]

subgraph subGraph1 ["Font Resolution (apps/docs/src/renderer/font-check.ts)"]
    START
    COLL
    LIST
    SUB
    DONE
    START --> COLL
    COLL --> LIST
    LIST --> CHECK
    RESULT --> SUB
    RESULT --> DONE
    SUB --> DONE

subgraph subGraph0 ["Availability Check"]
    CHECK
    CANVAS
    MEASURE
    RESULT
    CHECK --> CANVAS
    CANVAS --> MEASURE
    MEASURE --> RESULT
end
end
```

Sources: [apps/docs/package.json L94](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L94-L94)

 [apps/docs/src/renderer/font-check.ts L19-L34](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L19-L34)

 [apps/docs/src/renderer/font-check.ts L71-L86](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L71-L86)