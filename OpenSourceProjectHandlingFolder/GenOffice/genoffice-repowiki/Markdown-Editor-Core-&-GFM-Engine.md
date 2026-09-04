# Markdown Editor Core & GFM Engine

> **Relevant source files**
> * [apps/docs/src/renderer/assets/file-document.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/file-document.png)
> * [apps/docs/src/renderer/bidi-js.d.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/bidi-js.d.ts)

The Markdown editor in GenOffice is built on the TipTap/ProseMirror framework, specifically optimized for **GitHub Flavored Markdown (GFM)** compatibility. Unlike traditional editors that may lose formatting or metadata during a save-load cycle, this engine implements a **DocEnvelope** system to ensure byte-preserving round-trips for frontmatter, end-of-line (EOL) characters, and Byte Order Marks (BOM).

## DocEnvelope & Round-Trip Fidelity

The core of the Markdown persistence logic resides in the `DocEnvelope` structure. It manages the separation of YAML frontmatter from the Markdown content body, ensuring that user-defined metadata is preserved even if the editor does not natively support those specific fields.

### Data Flow: Load and Save

When a file is opened, the `loadDoc` function parses the raw bytes. It detects the EOL sequence (`\n` vs `\rn`) and BOM to maintain consistency upon saving.

1. **Parsing**: The `parseDoc` function identifies the frontmatter boundary (typically `---`).
2. **Envelope Creation**: A `DocEnvelope` object is created, storing the raw frontmatter string and the content string separately.
3. **Editor Initialization**: The content string is passed to the TipTap editor, while the frontmatter is sent to the `FrontmatterPanel`.
4. **Serialization**: On save, the `serializeDoc` function recombines the frontmatter and the editor's Markdown output using the preserved EOL characters.

| Feature | Implementation Detail |
| --- | --- |
| **Frontmatter** | Preserved as raw text to avoid re-ordering or key loss [apps/markdown/src/renderer/docText.ts L10-L45](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/docText.ts#L10-L45) |
| **EOL Preservation** | Detects `\r\n` or `\n` and enforces it during serialization [apps/markdown/src/renderer/docText.ts L60-L85](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/docText.ts#L60-L85) |
| **BOM Handling** | Detects UTF-8 BOM and re-attaches it if present in the source [apps/markdown/src/renderer/docText.ts L50-L55](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/markdown/src/renderer/docText.ts#L50-L55) |

**Sources:** `apps/markdown/src/renderer/docText.ts`

## TipTap GFM Schema & Extensions

The editor uses a customized TipTap schema to support GFM features such as task lists, tables, and fenced code blocks.

### Core Extensions

The editor composition includes several specialized extensions:

* **CodeBlockLowlight**: Provides syntax highlighting for code blocks using `lowlight`.
* **TaskList & TaskItem**: Implements GFM checkboxes.
* **Table**: Uses the TipTap table suite for complex grid layouts.
* **Local Image Handling**: A custom `Image` extension that handles local file paths via Electron IPC, ensuring images are rendered correctly in the preview without compromising security.

### Diagram: Markdown Editor Entity Mapping

This diagram maps the logical Markdown components to their implementation classes within the TipTap framework.

```

```

**Sources:** `apps/markdown/src/renderer/editor/CodeBlockView.tsx`, `apps/markdown/src/renderer/docText.ts`

## Slash Command System

The Markdown editor features a "Slash Command" menu (`/`) that allows users to insert blocks quickly.

### Implementation

The system is powered by the `Suggestion` utility from TipTap.

* **Trigger**: The `/` character triggers a search.
* **Menu Rendering**: The `SlashMenu` component is rendered via a ProseMirror `Decoration`.
* **Command Execution**: Each item in the menu maps to a TipTap command (e.g., `insertTable`, `setBlockquote`).

**Sources:** `apps/markdown/src/renderer/editor/slashCommand.ts`

## Specialized Editor Features

### Code Block View

Code blocks are not just plain text areas. The `CodeBlockView` component provides a custom NodeView that includes:

* **Language Selector**: A dropdown to change syntax highlighting.
* **Copy Button**: One-click clipboard functionality.
* **Themed Highlighting**: Integration with the app's dark/light themes.

### Block Drag Handle

To improve UX, the editor implements a floating drag handle. This allows users to reorder paragraphs, lists, or code blocks by dragging them vertically. It calculates the position based on the `Selection` and the current node's bounding box.

### AI Highlight Extension

The `aiHighlight` extension is a custom ProseMirror mark used by the AI writing assistant. It allows the agent to "highlight" specific ranges of text for replacement or feedback without modifying the actual document content until the user accepts the change.

### Diagram: AI Interaction Flow

This diagram illustrates how the AI Highlight extension bridges the AI Agent's output to the editor's visual state.

```

```

**Sources:** `apps/markdown/src/renderer/editor/aiHighlight.ts`, `apps/markdown/src/renderer/editor/markdown-skill.ts`

## Local Image Handling

Markdown files often reference images via relative paths. The editor handles this by:

1. **Path Resolution**: Intercepting the image `src`.
2. **IPC Request**: Requesting the local file as a Base64 string or a custom protocol URL from the Electron main process.
3. **Rendering**: Updating the `<img>` tag in the NodeView to display the local asset.

**Sources:** `apps/markdown/src/renderer/editor/LocalImageExtension.ts`