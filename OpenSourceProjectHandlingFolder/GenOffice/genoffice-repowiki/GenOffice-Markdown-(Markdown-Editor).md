# GenOffice Markdown (Markdown Editor)

> **Relevant source files**
> * [apps/docs/src/renderer/assets/file-document.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/file-document.png)
> * [apps/docs/src/renderer/assets/file-general.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/file-general.png)

The GenOffice Markdown editor is a professional-grade Markdown authoring environment designed for high-fidelity document management. Unlike standard web editors, it prioritizes **byte-level round-trip preservation**, ensuring that frontmatter, line endings (LF/CRLF), and Byte Order Marks (BOM) remain intact when saving files. Built on the TipTap framework, it provides a "What You See Is What You Get" (WYSIWYG) experience while maintaining a strict GitHub Flavored Markdown (GFM) schema.

## Architecture Overview

The Markdown app follows the standard GenOffice Electron architecture, utilizing a specialized renderer that bridges the gap between structured ProseMirror documents and raw Markdown text.

### High-Level Component Interaction

The following diagram illustrates how the editor interacts with the filesystem and the AI system while maintaining document integrity.

**Markdown Editor Data Flow**

```

```

Sources: [apps/markdown/src/renderer/editor/markdown/docText.ts L1-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/editor/markdown/docText.ts#L1-L50)

 [packages/agent-core/src/agent-loop.ts L1-L20](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/agent-core/src/agent-loop.ts#L1-L20)

---

## Key Features

### 1. Byte-Preserving Round-Trip

The core of the Markdown editor is the `DocEnvelope`. It acts as a container that separates the Markdown content from its metadata (frontmatter) and formatting characteristics (BOM, EOL). When a file is opened, the system parses these elements and stores them separately so they can be re-applied exactly during the save process, preventing "silent" file changes common in other editors.

* **Frontmatter:** Preserves YAML blocks at the start of files.
* **Fidelity:** Maintains specific newline characters used by the original author.

### 2. GFM-First Editing

The editor uses a custom TipTap schema restricted to GitHub Flavored Markdown specifications. This ensures that features like task lists, tables, and strikethroughs are rendered correctly and serialized back to standard GFM.

* **Slash Commands:** An interactive menu for inserting GFM blocks (headers, tables, code blocks).
* **Local Image Handling:** Supports referencing and rendering images stored relative to the `.md` file.

### 3. AI-Assisted Writing

The Markdown editor integrates with the GenOffice AI system via `markdown-skill.ts`. This skill is constrained to GFM-only outputs, preventing the AI from introducing formatting that the editor cannot serialize. It includes tools for structural editing, summarization, and content generation.

### 4. Professional Export

Beyond `.md` files, the application supports high-quality exports:

* **DOCX Export:** Maps GFM blocks to `docx-engine` primitives for Microsoft Word compatibility.
* **Print/PDF:** Generates clean, styled HTML for printing via `printHtml.ts`.

---

## System Integration: Natural Language to Code Entities

This diagram maps user-facing concepts to the specific code entities that implement them within the Markdown application.

**Markdown System Entity Mapping**

```

```

Sources: [apps/markdown/src/renderer/editor/markdown/docText.ts L1-L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/editor/markdown/docText.ts#L1-L100)

 [apps/markdown/src/renderer/export/docxExport.ts L1-L50](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/export/docxExport.ts#L1-L50)

 [apps/markdown/src/renderer/editor/markdown-skill.ts L1-L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/editor/markdown-skill.ts#L1-L30)

---

## Child Pages

For deep dives into the implementation details, refer to the following sub-pages:

### Markdown Editor Core & GFM Engine

Covers the technical implementation of the TipTap GFM schema, the `DocEnvelope` logic for byte-fidelity, local image resolution, and the block-based drag-and-drop system.

* **Key Files:** `apps/markdown/src/renderer/editor/markdown/docText.ts`, `apps/markdown/src/renderer/editor/extensions/*`.

### Markdown Export, UI & AI Skill

Covers the user interface components (Ribbon, Menus), the logic for converting Markdown to DOCX using the shared `docx-engine`, and the specific AI tools defined in the Markdown skill.

* **Key Files:** `apps/markdown/src/renderer/export/docxExport.ts`, `apps/markdown/src/renderer/components/Ribbon.tsx`, `apps/markdown/src/renderer/editor/markdown-skill.ts`.