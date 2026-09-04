# Text & Code Plugin

> **Relevant source files**
> * [packages/core/src/detect.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/detect.ts)
> * [packages/core/src/plugins/text.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.test.ts)
> * [packages/core/src/plugins/text.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts)

The `textPlugin` is a versatile component designed to handle plain text, source code, Markdown, and delimited data (CSV/TSV). It leverages **Prism.js** for syntax highlighting and **marked** for Markdown rendering, providing a rich reading experience for developer-centric file formats.

## File Detection & Language Matching

The plugin identifies compatible files using the `isTextLike` utility. This utility checks for known text-based MIME types or extensions. Once matched, the plugin determines the specific programming language for syntax highlighting using a hierarchical lookup strategy.

### Language Lookup Tables

The plugin uses three primary maps to resolve the language for Prism.js:

1. **`langMap`**: Maps common file extensions (e.g., `.ts`, `.py`) to Prism language identifiers [packages/core/src/plugins/text.ts L5-L87](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L5-L87)
2. **`filenameLangMap`**: Maps specific filenames that lack extensions (e.g., `Dockerfile`, `Makefile`, `.gitignore`) to their respective languages [packages/core/src/plugins/text.ts L88-L123](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L88-L123)
3. **`mimeLangMap`**: Maps MIME types (e.g., `application/json`, `text/x-python`) to Prism languages [packages/core/src/plugins/text.ts L124-L158](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L124-L158)

### Detection Logic Flow

The following diagram illustrates how `textPlugin` determines if it can handle a file and which language to apply.

**Figure 1: Text & Language Detection Logic**

```

```

Sources: [packages/core/src/plugins/text.ts L195-L200](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L195-L200)

 [packages/core/src/detect.ts L1-L170](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/detect.ts#L1-L170)

## Rendering Pipeline

The `render` function handles three distinct paths based on the detected language and file content: **Markdown**, **Tabular Data (CSV/TSV)**, and **Source Code**.

### 1. Markdown Rendering

Markdown files (`.md`, `.markdown`) are processed using `marked` and sanitized via `DOMPurify` to prevent XSS attacks [packages/core/src/plugins/text.ts L224-L243](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L224-L243)

* **Security**: Links are processed by `secureMarkdownLinks` to ensure `target="_blank"` and `rel="noopener noreferrer"` are added, and dangerous protocols like `javascript:` are stripped [packages/core/src/plugins/text.ts L242-L619](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L242-L619)
* **Syntax Highlighting**: Code blocks within the Markdown are highlighted post-render using Prism.js [packages/core/src/plugins/text.ts L246-L261](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L246-L261)

### 2. Tabular Data (CSV/TSV)

If the extension is `.csv` or `.tsv`, the plugin renders the content as an HTML table [packages/core/src/plugins/text.ts L316-L339](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L316-L339)

* **Parsing**: It splits content by lines and then by commas or tabs [packages/core/src/plugins/text.ts L581-L594](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L581-L594)
* **UI**: The table is wrapped in a scrollable container (`ofv-text-table-wrapper`) [packages/core/src/plugins/text.ts L333](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L333-L333)

### 3. Source Code & Plain Text

For code files, the plugin constructs a "Code Shell" UI including a header with the filename/language and a line-numbered gutter.

**Figure 2: Code Rendering Data Flow**

```

```

Sources: [packages/core/src/plugins/text.ts L275-L314](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L275-L314)

 [packages/core/src/plugins/text.ts L534-L579](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L534-L579)

## Technical Constraints & Performance

To maintain browser responsiveness, the plugin enforces limits on text processing:

* **`MAX_HIGHLIGHT_CHARS` (180,000)**: If a file exceeds this size, syntax highlighting is disabled, and it is rendered as plain text [packages/core/src/plugins/text.ts L160-L280](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L160-L280)
* **`MAX_RENDER_CHARS` (600,000)**: If a file exceeds this size, the plugin provides a download fallback instead of attempting to render the full text to prevent DOM bloat [packages/core/src/plugins/text.ts L161-L295](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L161-L295)

## Structure Summaries

For structured formats like JSON, NDJSON, and Jupyter Notebooks (`.ipynb`), the plugin generates a summary header (`ofv-text-structure`) before the code block [packages/core/src/plugins/text.ts L354-L383](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L354-L383)

* **JSON**: Shows key counts and top-level keys [packages/core/src/plugins/text.ts L403-L417](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L403-L417)
* **IPYNB**: Summarizes cell types (markdown vs code) and kernel information [packages/core/src/plugins/text.ts L419-L444](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L419-L444)
* **NDJSON**: Counts total lines and identifies parseable JSON records [packages/core/src/plugins/text.ts L446-L470](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L446-L470)

## CSS and Theming

The plugin dynamically loads Prism.js themes from a CDN based on the viewer's active theme:

* **Light**: `prism.min.css` [packages/core/src/plugins/text.ts L179](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L179-L179)
* **Dark**: `prism-tomorrow.min.css` [packages/core/src/plugins/text.ts L178](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L178-L178)

The CSS is injected with specific IDs (`ofv-prism-css-light`/`dark`) to allow easy swapping when the theme changes [packages/core/src/plugins/text.ts L164-L188](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.ts#L164-L188)

Sources:

* Language Mapping: `packages/core/src/plugins/text.ts:5-158`
* Plugin Implementation: `packages/core/src/plugins/text.ts:192-390`
* Helper Functions: `packages/core/src/plugins/text.ts:401-619`
* Detection Logic: `packages/core/src/detect.ts:63-166`
* Testing/Validation: `packages/core/src/plugins/text.test.ts:11-194`