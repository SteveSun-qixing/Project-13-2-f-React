# File Parsing, Font Subsystem & Font Metrics

> **Relevant source files**
> * [apps/docs/src/renderer/assets/app-icon.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/app-icon.png)
> * [apps/docs/src/renderer/assets/attach-icon.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/attach-icon.png)

The File Parsing, Font Subsystem, and Font Metrics infrastructure provides critical support for document fidelity, high-accuracy text rendering, and AI context ingestion. It handles text extraction from various office formats and manages a robust font fallback and metrics system to ensure documents render consistently across different operating systems.

## 1. File Parsing (packages/file-parse)

The `file-parse` package is a utility layer used primarily by the AI subsystem to ingest document attachments. It provides standardized text extraction for office formats, bridging the gap between complex binary/XML structures and the "Natural Language Space" required by the `AgentLoop` in `packages/agent-core`.

| Format | Parsing Strategy |
| --- | --- |
| **DOCX** | Extracts text content from `word/document.xml` while maintaining paragraph structure and block order. |
| **PPTX** | Iterates through slide XML files to extract text shapes, tables, and slide notes. |
| **XLSX** | Extracts cell values and formulas across all worksheets, often utilizing the `xlsx-engine` sidecar for large files. |
| **PDF** | Uses a headless parser to extract text layers and metadata for RAG (Retrieval-Augmented Generation). |

## 2. Font Subsystem & Metrics

The font subsystem ensures that documents created in GenOffice—or imported from Microsoft Office—maintain visual fidelity even when specific proprietary fonts (like Calibri or Arial) are missing from the host system.

### 2.1 Bundled OFL Fonts

GenOffice bundles several font families under the SIL Open Font License (OFL) and Apache 2.0 to serve as metric-compatible fallbacks:

* **Carlito**: A metric-compatible replacement for Calibri [apps/docs/src/renderer/font-check.ts L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L9-L9)
* **Caladea**: A metric-compatible replacement for Cambria [apps/docs/src/renderer/font-check.ts L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L10-L10)
* **Liberation Family**: Includes Liberation Sans (Arial replacement), Liberation Serif (Times New Roman replacement), and Liberation Mono (Courier New replacement) [apps/docs/src/renderer/font-check.ts L11-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L11-L13)
* **Noto Sans/Serif CJK**: Used for high-quality East Asian text rendering [apps/docs/src/renderer/font-check.ts L7-L8](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L7-L8)

### 2.2 Font Availability & Substitution (font-check.ts)

Because `document.fonts.check` in Chromium returns `true` if a system-fallback font is used, GenOffice implements a measurement-based detection strategy.

**Measurement-Based Detection Logic:**

1. A sample string containing CJK and Latin characters (`永体宋黑Wmg10`) is rendered to a hidden canvas [apps/docs/src/renderer/font-check.ts L39-L47](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L39-L47)
2. The system measures the width of this string using the target font family vs. generic fallbacks (monospace, sans-serif) [apps/docs/src/renderer/font-check.ts L51-L59](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L51-L59)
3. If the widths are identical to the generic fallback, the target font is considered "missing" and a substitute from the `BUNDLED` set is used [apps/docs/src/renderer/font-check.ts L76-L85](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L76-L85)

### 2.3 Font Metrics & Line-Height Accuracy (packages/font-metrics)

For high-fidelity rendering (especially in Slides and Docs pagination), standard CSS line-height is insufficient. The `font-metrics` package parses `sfnt` tables (TrueType/OpenType) to extract exact vertical metrics.

* **`findSystemFont`**: Locates the font file on the user's OS (Windows/macOS/Linux).
* **`familyVerticalMetrics`**: Calculates the `ascent`, `descent`, and `lineGap` from the `hhea` and `OS/2` tables to determine the "Natural Line Height" used by the rendering engines.

### 2.4 Localization-Aware Font Selection (font-list.ts)

The `font-list.ts` utility provides smart defaults and dropdown ordering based on the user's UI language.

* **Dropdown Ordering**: `fontFamiliesFor(lang)` reorders font lists so that script-appropriate fonts (e.g., Simplified Chinese fonts for `zh`) appear at the top [apps/docs/src/renderer/font-list.ts L39-L52](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-list.ts#L39-L52)
* **East Asian Defaults**: `defaultEastAsiaFontFor(lang)` maps UI languages to standard document defaults (e.g., `zh` defaults to `宋体`, `ja` to `Yu Mincho`) [apps/docs/src/renderer/font-list.ts L62-L75](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-list.ts#L62-L75)

## 3. Implementation Diagrams

### Font Substitution Data Flow

This diagram illustrates how the system moves from a requested font in a `.docx` file to a rendered font on screen, incorporating the check logic.

Title: Font Substitution Flow

```

```

Sources: [apps/docs/src/renderer/font-check.ts L19-L86](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L19-L86)

 [apps/docs/src/renderer/font-list.ts L39-L52](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-list.ts#L39-L52)

### Font Metrics and OS Interaction

This diagram bridges the OS-level font files to the high-level rendering metrics used by the Docs and Slides engines.

Title: Font Metrics Extraction Bridge

```

```

Sources: [apps/docs/src/renderer/font-check.ts L49-L59](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L49-L59)

 [apps/docs/src/renderer/font-list.ts L62-L75](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-list.ts#L62-L75)

## 4. Key Functions & Classes

| Entity | Location | Purpose |
| --- | --- | --- |
| `collectDocFonts` | `font-check.ts` | Iterates through a `ParsedDoc` to extract all unique font family names from runs, textboxes, and styles [apps/docs/src/renderer/font-check.ts L19-L34](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L19-L34) |
| `fontAvailableIn` | `font-check.ts` | Uses `CanvasRenderingContext2D.measureText` to detect if a font is truly installed on the OS [apps/docs/src/renderer/font-check.ts L49-L59](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L49-L59) |
| `checkMissingFonts` | `font-check.ts` | Returns a list of `FontSubstitution` objects for fonts that failed the availability check [apps/docs/src/renderer/font-check.ts L71-L86](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L71-L86) |
| `fontFamiliesFor` | `font-list.ts` | Provides an ordered list of font families for the UI font picker based on the user's language [apps/docs/src/renderer/font-list.ts L39-L52](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-list.ts#L39-L52) |
| `defaultEastAsiaFontFor` | `font-list.ts` | Determines the default `w:eastAsia` font for new documents based on market standards [apps/docs/src/renderer/font-list.ts L62-L75](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-list.ts#L62-L75) |
| `findSystemFont` | `font-metrics` | Internal package utility to locate binary font files on the local filesystem. |
| `familyVerticalMetrics` | `font-metrics` | Computes ascent, descent, and line-gap for pixel-perfect text placement. |

Sources:

* `apps/docs/src/renderer/font-check.ts`
* `apps/docs/src/renderer/font-list.ts`
* `packages/font-metrics` (implied by wiki structure)
* `packages/file-parse` (implied by wiki structure)