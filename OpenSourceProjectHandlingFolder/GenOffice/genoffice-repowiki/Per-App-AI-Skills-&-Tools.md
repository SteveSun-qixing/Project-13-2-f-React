# Per-App AI Skills & Tools

> **Relevant source files**
> * [apps/docs/src/renderer/ai/commands.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts)
> * [apps/docs/src/renderer/ai/docs-skill.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts)
> * [apps/docs/src/renderer/ai/files-skill.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts)
> * [apps/docs/src/renderer/ai/tools.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts)

This page details the implementation of AI skills and tools specific to each GenOffice application, as well as shared functionalities like file attachments. It covers `docs-skill.ts` for document-specific AI, `slides-skill.ts` for presentation AI, `sheets` AI with its deterministic planner, and `pdf-skill.ts`. Additionally, the shared `files-skill.ts` for handling file attachments is explained. The focus is on how these skills integrate with the `AgentLoop` and provide application-specific capabilities through defined tools and context building.

## Docs AI Skills (docs-skill.ts)

The `docs-skill.ts` file [apps/docs/src/renderer/ai/docs-skill.ts L1-L23](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L1-L23)

 defines the `docx` capability as an `AgentSkill` for the GenOffice Docs application. This skill provides the document skeleton context, a set of five core document tools, and a local executor to apply changes to the ProseMirror document.

### Core Components

* **`createDocsSkill` Function**: This function [apps/docs/src/renderer/ai/docs-skill.ts L11-L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L11-L22)  is responsible for creating and returning the `AgentSkill` object for Docs. It takes an `Editor` instance, `NumIds` for numbering context, and an optional `AiTrack` for revision tracking. * `id: 'docx'`: Identifies this skill as pertaining to DOCX documents [apps/docs/src/renderer/ai/docs-skill.ts L16](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L16-L16) * `systemPrompt`: Uses `AGENT_SYSTEM_PROMPT` [apps/docs/src/renderer/ai/docs-skill.ts L17](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L17-L17)  to guide the AI's behavior within the document context. * `tools`: Exposes `AGENT_TOOLS` [apps/docs/src/renderer/ai/docs-skill.ts L18](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L18-L18)  which are the document-specific tools the AI can use. * `buildContext`: Calls `buildDocContext(getEditor())` [apps/docs/src/renderer/ai/docs-skill.ts L19](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L19-L19)  to generate the current document's context for the AI. It also calls `markDocSeen(editor)` [apps/docs/src/renderer/ai/docs-skill.ts L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L22-L22)  to establish a freshness baseline for index-addressed writes. * `executeTool`: Delegates tool execution to `executeTool(getEditor(), call, getNumIds(), getTrack?.(), signal)` [apps/docs/src/renderer/ai/docs-skill.ts L25-L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L25-L26)

### Document Tools (AGENT_TOOLS)

The `AGENT_TOOLS` array [apps/docs/src/renderer/ai/tools.ts L28-L189](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L28-L189)

 defines the capabilities the AI agent has to interact with the document. These tools allow the AI to read, insert, replace, and format document content, as well as perform web and image searches and insert charts.

#### Tool Definitions

1. **`get_document_context`**: * **Description**: Retrieves the latest state of the current document, including block list (index, type, content preview), full-text stats (word/character counts), and the current selection [apps/docs/src/renderer/ai/tools.ts L30-L32](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L30-L32) * **Execution**: Calls `buildDocumentContext(editor)` [apps/docs/src/renderer/ai/tools.ts L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L9-L9)
2. **`read_blocks`**: * **Description**: Reads the full content of a specified block range as restricted HTML. Supports paging via `offset` for long ranges [apps/docs/src/renderer/ai/tools.ts L36-L39](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L36-L39) * **Execution**: Uses `serializeRangeToHtml` to extract content from the specified block range [apps/docs/src/renderer/ai/tools.ts L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L15-L15)
3. **`insert_content`**: * **Description**: Inserts new content (restricted HTML) at a given position. Used for writing, continuing, or generating new content [apps/docs/src/renderer/ai/tools.ts L55-L57](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L55-L57) * **Execution**: Parses the HTML fragment using `parseHtmlFragment` [apps/docs/src/renderer/ai/tools.ts L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L13-L13)  and inserts it using `insertBlocksAfter` [apps/docs/src/renderer/ai/tools.ts L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L10-L10)
4. **`replace_blocks`**: * **Description**: Replaces a block range with new content (restricted HTML) [apps/docs/src/renderer/ai/tools.ts L72-L74](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L72-L74) * **Execution**: Parses the HTML fragment and replaces the block range using `replaceBlockRange` [apps/docs/src/renderer/ai/tools.ts L14](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L14-L14)
5. **`apply_commands`**: * **Description**: Executes formatting, structure, or batch commands (e.g., text style, paragraph format, heading level, find & replace, delete/move blocks, list conversion, image properties) [apps/docs/src/renderer/ai/tools.ts L86-L88](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L86-L88) * **Execution**: Calls `executeCommands` [apps/docs/src/renderer/ai/tools.ts L6](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L6-L6)  to apply the structured commands to the document.
6. **`web_search`** & **`image_search`**: * **Description**: External tools for gathering information or assets. `web_search` returns titles/links/snippets [apps/docs/src/renderer/ai/tools.ts L102-L104](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L102-L104)  while `image_search` returns image URLs [apps/docs/src/renderer/ai/tools.ts L115-L117](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L115-L117)
7. **`insert_chart`** & **`edit_chart`**: * **Description**: Allows the AI to create or modify native Word charts (bar, line, pie) [apps/docs/src/renderer/ai/tools.ts L141-L143](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L141-L143)  `edit_chart` can update titles, categories, and series values for existing chart blocks [apps/docs/src/renderer/ai/tools.ts L177-L180](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L177-L180)

#### Command Execution Logic

The `executeCommands` function [apps/docs/src/renderer/ai/commands.ts L290-L300](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts#L290-L300)

 is the deterministic engine for structural edits. It processes a `CommandEnvelope` [apps/docs/src/renderer/ai/commands.ts L151-L153](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts#L151-L153)

* **One Transaction per Envelope**: All commands in a single AI turn are applied in one ProseMirror transaction [apps/docs/src/renderer/ai/commands.ts L10-L12](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts#L10-L12)  This ensures that one "Undo" action by the user reverts the entire set of AI changes.
* **Byte Fidelity**: The docx round-trip remains untouched; docxIndex anchors are never modified by these commands [apps/docs/src/renderer/ai/commands.ts L13-L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts#L13-L15)
* **Targeting**: Commands use a `Target` interface [apps/docs/src/renderer/ai/commands.ts L21-L33](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts#L21-L33)  that allows filtering by `nodeType`, `containsText`, `blockIndexes`, or `scope` (selection vs document).

#### Docs AI Skill Diagram

```

```

Sources:

* [apps/docs/src/renderer/ai/docs-skill.ts L1-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/docs-skill.ts#L1-L28)
* [apps/docs/src/renderer/ai/commands.ts L1-L163](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts#L1-L163)
* [apps/docs/src/renderer/ai/tools.ts L1-L189](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/tools.ts#L1-L189)
* [apps/docs/src/renderer/ai/protocol.ts L1-L24](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/protocol.ts#L1-L24)

## Shared Files Skill (files-skill.ts)

The `files-skill.ts` [apps/docs/src/renderer/ai/files-skill.ts L1-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L1-L100)

 defines a shared `AgentSkill` for handling file attachments across the suite. This skill allows the AI to list and read the content of attached local files without them leaving the machine.

### Core Components

* **`createFilesSkill` Function**: This function [apps/docs/src/renderer/ai/files-skill.ts L27-L98](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L27-L98)  creates the `AgentSkill` for file attachments. * `id: 'files'`: Identifies this as the file attachment skill [apps/docs/src/renderer/ai/files-skill.ts L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L30-L30) * `systemPrompt`: Uses `FILES_SYSTEM_PROMPT` [apps/docs/src/renderer/ai/files-skill.ts L14-L19](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L14-L19)  which instructs the AI to use `read_attachment` first and not guess content from filenames. * `tools`: Defines the `read_attachment` tool [apps/docs/src/renderer/ai/files-skill.ts L32-L47](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L32-L47) * `buildContext`: Generates a formatted list of attached files (index, name, type, size) for the AI [apps/docs/src/renderer/ai/files-skill.ts L49-L54](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L49-L54) * `executeTool`: Implements the logic for reading files via IPC [apps/docs/src/renderer/ai/files-skill.ts L56-L97](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L56-L97)

### read_attachment Tool Implementation

* **Paging**: To handle large files, the tool uses `READ_CHUNK_CHARS = 24_000` [apps/docs/src/renderer/ai/files-skill.ts L12](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L12-L12)  The AI provides an `offset` [apps/docs/src/renderer/ai/files-skill.ts L43](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L43-L43)  and the tool returns the current slice along with a notice if more content remains [apps/docs/src/renderer/ai/files-skill.ts L87-L91](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L87-L91)
* **Multimodal Images**: If the attachment is an image (png/jpg/gif/webp), the tool refuses to "read" it as text [apps/docs/src/renderer/ai/files-skill.ts L70-L76](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L70-L76)  Instead, it instructs the AI to look at the image already sent multimodally with the user message [apps/docs/src/renderer/ai/files-skill.ts L18](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L18-L18)
* **IPC Bridge**: The actual reading happens in the main process via `window.desktop.readAttachment(att.path, offset, READ_CHUNK_CHARS)` [apps/docs/src/renderer/ai/files-skill.ts L78](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L78-L78)

### File Attachment Diagram

```

```

Sources:

* [apps/docs/src/renderer/ai/files-skill.ts L1-L98](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L1-L98)
* [apps/docs/src/shared/ipc.ts L3](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/shared/ipc.ts#L3-L3)  (for `ATTACHMENT_IMAGE_EXTS`)

## Slides AI & Layout Scripting

Slides AI utilizes `slides-skill.ts` to manage presentation-specific interactions. A unique feature is the `apply_layout_script` tool, which uses a sandboxed interpreter to perform visual adjustments.

* **Outline Generation**: The AI can generate full presentation outlines using the `insert_slides` tool, which takes an array of objects containing titles and HTML content.
* **Layout Scripts**: Unlike Docs, which uses a command envelope for content, Slides uses a `layout-script` for visual manipulation (moving shapes, setting masters, animations).
* **QC & Auditing**: The system includes `layout-audit.ts` to ensure that AI-generated layout scripts do not violate presentation integrity or safety constraints.

Sources:

* [apps/slides/src/renderer/ai/slides-skill.ts L11-L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/slides/src/renderer/ai/slides-skill.ts#L11-L22)
* [apps/slides/src/renderer/ai/tools.ts L79-L81](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/slides/src/renderer/ai/tools.ts#L79-L81)

## Sheets AI & Deterministic Planner

The Sheets AI implementation relies on a `deterministic-planner` to handle complex spreadsheet logic.

* **Operation Sequence**: The planner allows the AI to submit a sequence of operations (e.g., `addSheet`, `setCellFormat`, `sortRange`) as a single JSON plan.
* **Fidelity**: This approach ensures that complex multi-step transformations (like creating a pivot table and then formatting its headers) are executed reliably without intermediate state corruption.

Sources:

* [apps/sheets/src/renderer/ai/sheets-skill.ts L1-L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/sheets/src/renderer/ai/sheets-skill.ts#L1-L22)
* [apps/sheets/src/renderer/ai/tools.ts L56-L58](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/sheets/src/renderer/ai/tools.ts#L56-L58)

## PDF & Markdown Skills

* **PDF Skill**: Focuses on content extraction and annotation. Tools include `read_pdf_page` for text retrieval and `add_pdf_annotation` for adding highlights or comments [apps/pdf/src/renderer/ai/pdf-skill.ts L1-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/ai/pdf-skill.ts#L1-L100)
* **Markdown Skill**: Tailored for GFM (GitHub Flavored Markdown). It uses block-based tools similar to Docs but restricted to Markdown-compatible elements (headers, code blocks, tables). It ensures that AI edits preserve frontmatter and byte-level formatting preferences [apps/markdown/src/renderer/ai/markdown-skill.ts L1-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/ai/markdown-skill.ts#L1-L50)

Sources:

* [apps/pdf/src/renderer/ai/pdf-skill.ts L11-L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/ai/pdf-skill.ts#L11-L22)
* [apps/markdown/src/renderer/ai/markdown-skill.ts L1-L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/ai/markdown-skill.ts#L1-L10)