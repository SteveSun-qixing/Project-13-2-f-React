# Markdown Export, UI & AI Skill

> **Relevant source files**
> * [apps/docs/src/renderer/ai/AiPanel.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx)
> * [apps/docs/src/renderer/ai/commands.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts)
> * [apps/docs/src/renderer/ai/files-skill.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts)

This page covers the export infrastructure, user interface components, and AI capabilities of the GenOffice Markdown editor. The system is designed to provide high-fidelity document conversion (Markdown to DOCX), a modern editing interface with context-aware menus, and an AI assistant that adheres to GitHub Flavored Markdown (GFM) constraints.

## Export Infrastructure

The Markdown app provides two primary export paths: conversion to Microsoft Word (`.docx`) and HTML-based printing.

### DOCX Export Logic

The `docxExport.ts` module maps the TipTap/ProseMirror GFM schema to the structured `Block` tree required by the `@genoffice/docx-engine`.

* **Mapping Strategy**: It iterates through the ProseMirror document, converting Markdown-specific nodes (like `codeBlock`, `taskList`, and `taskItem`) into standard OOXML-compatible blocks [apps/markdown/src/renderer/export/docxExport.ts L10-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/export/docxExport.ts#L10-L50)
* **Table Conversion**: Tables are mapped to `docTable` blocks, preserving alignment and cell structures [apps/markdown/src/renderer/export/docxExport.ts L80-L120](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/export/docxExport.ts#L80-L120)
* **Style Preservation**: Heading levels (1-6) and character marks (bold, italic, strike, code) are translated into corresponding `docx-engine` run properties [apps/markdown/src/renderer/export/docxExport.ts L150-L180](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/export/docxExport.ts#L150-L180)

### Print to HTML

The `printHtml.ts` utility generates a standalone HTML document from the editor content for the Electron print pipeline. It injects GitHub-like CSS to ensure that the printed output matches the visual style of the editor [apps/markdown/src/renderer/export/printHtml.ts L5-L25](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/export/printHtml.ts#L5-L25)

## UI Components

The Markdown UI follows the GenOffice suite's Ribbon-based architecture but is tailored for a block-based editing experience.

### Ribbon and Panels

* **Ribbon**: Provides tabs for Home (formatting), Insert (tables, images, links), and Export [apps/markdown/src/renderer/components/Ribbon.tsx L1-L40](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/components/Ribbon.tsx#L1-L40)
* **FrontmatterPanel**: A specialized sidebar for editing YAML frontmatter. It ensures that metadata is preserved during the round-trip process by interacting with the `DocEnvelope` [apps/markdown/src/renderer/components/FrontmatterPanel.tsx L10-L60](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/components/FrontmatterPanel.tsx#L10-L60)

### Contextual Menus

The editor utilizes several floating menus to facilitate GFM editing:

* **SlashMenu**: Triggered by the `/` key, allowing users to insert blocks (headings, tables, code blocks) via keyboard navigation [apps/markdown/src/renderer/editor/SlashMenu.tsx L5-L45](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/editor/SlashMenu.tsx#L5-L45)
* **TableMenu**: A floating bubble menu that appears when the cursor is inside a table, providing actions for adding/deleting rows and columns [apps/markdown/src/renderer/editor/TableMenu.tsx L12-L55](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/editor/TableMenu.tsx#L12-L55)

### AI Component Integration

The `AiPanel.tsx` (shared logic adapted for Markdown) hosts the `AgentLoop`. It manages the chat transcript, tool execution status, and document snapshots for rollbacks [apps/docs/src/renderer/ai/AiPanel.tsx L60-L76](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L60-L76)

## AI Skill and Tools

The Markdown AI assistant is governed by `markdown-skill.ts`, which enforces GFM-only editing rules to prevent the model from generating incompatible OOXML structures.

### Markdown Skill (markdown-skill.ts)

This skill defines the system prompt and the available tools for the AI agent when operating on a `.md` file.

* **GFM Enforcement**: The system prompt explicitly instructs the model to use GFM syntax and avoid complex Word-style formatting that cannot be represented in Markdown [apps/markdown/src/renderer/ai/markdown-skill.ts L15-L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/ai/markdown-skill.ts#L15-L30)
* **Block Tools**: Includes tools for `insert_blocks`, `delete_blocks`, and `replace_text` [apps/markdown/src/renderer/ai/markdown-skill.ts L40-L85](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/ai/markdown-skill.ts#L40-L85)

### Search and Files Skills

* **Search Skill**: Integrates with `packages/ai-search` to allow the agent to perform web and image searches via the Genspark API [apps/markdown/src/renderer/ai/search-skill.ts L5-L20](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/ai/search-skill.ts#L5-L20)
* **Files Skill**: Enables the agent to read local attachments. It uses a paging mechanism (`read_attachment`) to handle large files by reading them in chunks of 24,000 characters [apps/docs/src/renderer/ai/files-skill.ts L12-L35](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L12-L35)

### AI Data Flow: Natural Language to Code Entities

The following diagram bridges the user's natural language request to the internal execution of Markdown-specific tools.

**Diagram: AI Tool Execution Flow**

```

```

**Sources:** [apps/markdown/src/renderer/ai/markdown-skill.ts L27-L97](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/ai/markdown-skill.ts#L27-L97)

 [apps/docs/src/renderer/ai/AiPanel.tsx L4-L14](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L4-L14)

 [apps/docs/src/renderer/ai/files-skill.ts L77-L90](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L77-L90)

## Implementation Details

### Attachment Handling

Attachments are managed via the `createFilesSkill`. When a user attaches a file, the `AttachmentMeta` is stored in the renderer, and the `read_attachment` tool triggers an IPC call to the main process for secure local parsing [apps/docs/src/renderer/ai/files-skill.ts L27-L54](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L27-L54)

| Feature | Implementation File | Role |
| --- | --- | --- |
| **Markdown Skill** | `markdown-skill.ts` | Defines GFM-specific tools and prompts. |
| **Attachment Reading** | `files-skill.ts` | Paginates through local file text for AI context. |
| **Tool UI** | `AiPanel.tsx` | Renders `ToolActivity` chips and handles expansion. |
| **DOCX Mapping** | `docxExport.ts` | Converts GFM ProseMirror nodes to `docx-engine` Blocks. |

### Command Envelope Extraction

The AI agent communicates edits through a JSON envelope. The `parseCommandEnvelope` function extracts these commands from the model's markdown response, ensuring that only valid JSON within code fences is processed [apps/docs/src/renderer/ai/commands.ts L175-L193](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts#L175-L193)

**Diagram: Export and UI Interaction**

```

```

**Sources:** [apps/markdown/src/renderer/export/docxExport.ts L1-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/export/docxExport.ts#L1-L50)

 [apps/markdown/src/renderer/components/Ribbon.tsx L5-L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/components/Ribbon.tsx#L5-L30)

 [apps/markdown/src/renderer/components/FrontmatterPanel.tsx L15-L40](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/components/FrontmatterPanel.tsx#L15-L40)

### Sources:

* [apps/docs/src/renderer/ai/AiPanel.tsx L4-L167](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx#L4-L167)
* [apps/docs/src/renderer/ai/commands.ts L1-L210](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/commands.ts#L1-L210)
* [apps/docs/src/renderer/ai/files-skill.ts L1-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/files-skill.ts#L1-L100)
* [apps/markdown/src/renderer/ai/markdown-skill.ts L1-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/ai/markdown-skill.ts#L1-L100)
* [apps/markdown/src/renderer/export/docxExport.ts L1-L200](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/export/docxExport.ts#L1-L200)
* [apps/markdown/src/renderer/export/printHtml.ts L1-L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/export/printHtml.ts#L1-L30)
* [apps/markdown/src/renderer/components/Ribbon.tsx L1-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/components/Ribbon.tsx#L1-L50)
* [apps/markdown/src/renderer/components/FrontmatterPanel.tsx L1-L60](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/components/FrontmatterPanel.tsx#L1-L60)