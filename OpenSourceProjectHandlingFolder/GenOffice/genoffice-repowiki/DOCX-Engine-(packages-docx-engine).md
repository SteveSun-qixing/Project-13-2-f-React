# DOCX Engine (packages/docx-engine)

> **Relevant source files**
> * [apps/docs/scripts/generate-corpus.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts)
> * [apps/docs/src/renderer/doc-style-css.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts)

The `docx-engine` package is a pure-TypeScript library responsible for parsing, manipulating, and generating `.docx` files within GenOffice Docs. It implements the byte-preserving round-trip philosophy by focusing on parsing `word/document.xml` into a structured Block tree, generating OOXML fragments, and performing byte-level paragraph patching.

## Purpose and Scope

The primary purpose of `docx-engine` is to provide a robust and efficient mechanism for interacting with the Open XML (OOXML) format for Word documents. It acts as the bridge between the raw XML structure of a `.docx` file and the structured data model used by the GenOffice Docs editor. The scope covers both reading existing `.docx` files and writing modifications back to them, ensuring fidelity to the original document structure and content.

## Core Parsing and Block Tree

The engine's parsing process begins by extracting `word/document.xml` from the `.docx` archive. This XML is then transformed into a hierarchical Block tree representation. Each node in this tree corresponds to a logical document element, such as a paragraph, table, or image.

### docxIndex Anchors

A crucial aspect of the Block tree is the inclusion of `docxIndex` anchors. These anchors are metadata attached to blocks, providing a stable reference back to their original position within the `word/document.xml` file. This is essential for the byte-preserving round-trip mechanism, allowing the engine to identify and patch specific parts of the XML without re-writing the entire document.

Sources:

* [apps/docs/scripts/generate-corpus.ts L137-L138](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L137-L138)

## OOXML Fragment Generation

When modifications are made in the editor, `docx-engine` is responsible for generating the corresponding OOXML fragments. These fragments represent the changes in a format that can be inserted back into the `word/document.xml`. This approach minimizes the amount of XML that needs to be rewritten, contributing to the byte-preserving nature of the save operation.

## Byte-Level Paragraph Patching (patch.ts)

The `patch.ts` module is central to the byte-preserving round-trip. Instead of regenerating the entire `word/document.xml` file, `patch.ts` intelligently identifies the minimal changes required and applies them directly to the byte stream of the XML. This is particularly effective for paragraph-level modifications, where only a small portion of the XML might need updating. This technique helps preserve non-semantic XML attributes and formatting that might otherwise be lost in a full re-serialization.

## Styles and Numbering

`docx-engine` handles the parsing and application of styles defined in `word/styles.xml`. It extracts information about paragraph styles, character styles, and table styles, making them available to the editor for rendering and modification.

### Style Application

The `docStyleCss` function [apps/docs/src/renderer/doc-style-css.ts L118-L123](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L118-L123)

 generates CSS rules based on the parsed styles. This CSS is then applied to the rendered document in the editor, ensuring that the visual presentation matches the document's defined styles. This includes properties like font size, color, bold/italic, underline, strike-through, font family, character spacing, line height, and paragraph spacing/indentation.

The engine also processes `docDefaults` [apps/docs/src/renderer/doc-style-css.ts L89-L91](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L89-L91)

 and the "Normal" paragraph style [apps/docs/src/renderer/doc-style-css.ts L102-L108](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L102-L108)

 to establish the document's baseline rendering.

### Line Metrics and CJK Handling

The engine contains sophisticated logic for document-level line-height calculation, especially for CJK (Chinese, Japanese, Korean) text. The `docLineFactor` [apps/docs/src/renderer/doc-style-css.ts L70-L72](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L70-L72)

 and `docCjkFactor` [apps/docs/src/renderer/doc-style-css.ts L76-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L76-L100)

 functions determine the appropriate line-height multipliers based on the fonts declared in the document's styles and the actual content present in the blocks.

Sources:

* [apps/docs/src/renderer/doc-style-css.ts L1-L123](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L1-L123)

## Themes

Themes in DOCX documents define a consistent look and feel through color palettes and font schemes. `docx-engine` parses these theme definitions and applies them to the document's rendering.

### Theme CSS Generation

The `docThemeCss` function [apps/docs/src/renderer/doc-theme-css.ts L30-L52](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-theme-css.ts#L30-L52)

 generates CSS rules specifically for document themes. This allows the editor to immediately reflect theme changes (e.g., font changes, accent colors) without a full re-parse.

```

```

Sources:

* [apps/docs/src/renderer/doc-style-css.ts L30-L52](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L30-L52)

## Charts, Ink, and Math

The engine supports parsing and rendering specialized objects embedded within DOCX files:

* **Charts:** Interprets chart data and presentation properties from OOXML.
* **Ink:** Parses digital handwriting or drawing annotations.
* **Math/Equations:** Processes MathML representations within OOXML to ensure complex equations display correctly.
* **Watermarks:** Parses text or image-based watermark definitions.

## Round-Trip Save Pipeline

The round-trip save pipeline ensures that documents can be opened, edited, and saved without losing data or formatting, even for features not fully supported by the editor.

### Pipeline Overview

The save pipeline generally follows these steps:

1. **Editor State to Block Tree:** The editor's internal representation is converted into the `docx-engine` Block tree.
2. **OOXML Fragment Generation:** New OOXML fragments are generated for modified blocks.
3. **Byte-Level Patching:** The `patch.ts` module applies these fragments to the original `word/document.xml` byte stream.
4. **Re-packaging:** The modified XML and other changed parts are re-packaged into a new `.docx` archive.

## Diagram: DOCX Engine Architecture

This diagram maps the natural language concepts of the DOCX engine to specific code entities and data flows.

```

```

Sources:

* [apps/docs/src/renderer/doc-style-css.ts L1-L7](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L1-L7)
* [apps/docs/scripts/generate-corpus.ts L91-L140](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L91-L140)

## Diagram: Style Resolution Pipeline

How the engine resolves raw OOXML styles into CSS variables used by the TipTap renderer.

```

```

Sources:

* [apps/docs/src/renderer/doc-style-css.ts L70-L116](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L70-L116)
* [apps/docs/src/renderer/doc-style-css.ts L137-L160](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L137-L160)