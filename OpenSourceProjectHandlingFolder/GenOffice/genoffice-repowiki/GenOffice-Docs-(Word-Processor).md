# GenOffice Docs (Word Processor)

> **Relevant source files**
> * [apps/docs/src/renderer/App.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx)
> * [apps/docs/src/renderer/doc-cache.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-cache.ts)
> * [apps/docs/src/renderer/doc-dirty.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-dirty.ts)
> * [apps/docs/src/renderer/doc-state.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-state.ts)

GenOffice Docs is the word processing application within the GenOffice suite, designed to handle `.docx` files with high fidelity. It is built upon the powerful TipTap/ProseMirror editor framework, offering a rich editing experience. A core principle of GenOffice Docs is its byte-preserving round-trip capability, ensuring that documents can be opened, edited, and saved without unintended changes to the underlying `.docx` structure. The application also features a paginated view for accurate print previews and integrates advanced AI editing capabilities.

This page provides a high-level overview of the GenOffice Docs application. For detailed technical information on specific components, please refer to the linked child pages.

## Architecture Overview

GenOffice Docs (`apps/docs`) leverages a client-side editor (TipTap/ProseMirror) for user interaction and a dedicated `docx-engine` package for robust `.docx` file parsing and generation. This separation allows for a flexible and performant architecture. The editor's schema is meticulously designed to mirror the internal Block model used by the `docx-engine`, facilitating seamless data exchange and ensuring the byte-preserving round-trip.

The application's user interface is built with React components, including a comprehensive Ribbon interface and various panels for managing styles, comments, and other document features. AI capabilities are integrated throughout the editing experience, offering intelligent assistance to users.

### System Entity Map

```

```

Sources: [apps/docs/src/renderer/App.tsx L1-L122](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L1-L122)

 [apps/docs/src/renderer/doc-state.ts L19-L27](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-state.ts#L19-L27)

 [apps/docs/src/renderer/file-actions.ts L145-L149](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/file-actions.ts#L145-L149)

## Docs Editor Engine (TipTap/ProseMirror)

The core of the GenOffice Docs editing experience is powered by a custom TipTap/ProseMirror editor. This editor is configured with a specialized schema that directly reflects the `Block` model used by the `docx-engine` [apps/docs/src/renderer/editor/extensions.ts L47-L51](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/extensions.ts#L47-L51)

 This 1:1 mapping is crucial for maintaining document fidelity during the round-trip process.

The editor incorporates numerous custom extensions to support advanced Word features, including:

* **Marks:** For text formatting like bold, italic, underline, and tracking changes [apps/docs/src/renderer/editor/extensions.ts L122-L125](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/extensions.ts#L122-L125)
* **Numbering:** Handling complex list numbering schemes via `allocateListNumId` and `restartNumbering` [apps/docs/src/renderer/App.tsx L152-L158](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L152-L158)
* **Pagination Gaps:** Visualizing page breaks and footnotes accurately using `setPageGaps` [apps/docs/src/renderer/App.tsx L75](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L75-L75)
* **Track Changes:** Displaying and managing document revisions via `collectRevisions` [apps/docs/src/renderer/App.tsx L128](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L128-L128)
* **Ink:** Digital inking capabilities managed by `InkOverlay` [apps/docs/src/renderer/App.tsx L127](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L127-L127)
* **Table Sizing:** Advanced table manipulation and resizing.
* **Protected Render:** For displaying complex elements like charts and fields.

The editor also features an "active-editor" sub-editor system [apps/docs/src/renderer/editor/active-editor.ts L112-L115](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/active-editor.ts#L112-L115)

 to manage focus and state for embedded editable components like headers and footers.

For a comprehensive understanding of the editor's implementation, including its schema, extensions, and sub-editor system, see [Docs Editor Engine (TipTap/ProseMirror)](/genspark-ai/genoffice/3.1-docs-editor-engine-(tiptapprosemirror)).

Sources: [apps/docs/src/renderer/App.tsx L112-L115](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L112-L115)

 [apps/docs/src/renderer/App.tsx L122-L128](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L122-L128)

 [apps/docs/src/renderer/App.tsx L152-L158](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L152-L158)

 [apps/docs/src/renderer/editor/pagination-gaps.ts L75](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/pagination-gaps.ts#L75-L75)

## DOCX Engine (packages/docx-engine)

The `packages/docx-engine` is a pure-TypeScript library responsible for all `.docx` file operations. It acts as the backend for GenOffice Docs, handling the intricate details of the Open XML (OOXML) format.

Key functionalities of the `docx-engine` include:

* **Parsing:** Converting `word/document.xml` into a structured `Block` tree [apps/docs/src/renderer/App.tsx L20](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L20-L20)
* **Byte-level Paragraph Patching:** A mechanism that allows for minimal modifications to the `.docx` file, crucial for the round-trip fidelity.
* **Styles, Numbering, Themes:** Managing document styling via `StyleUpsert` [apps/docs/src/renderer/App.tsx L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L30-L30)  and theme definitions [apps/docs/src/renderer/App.tsx L31-L32](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L31-L32)
* **Complex Elements:** Support for `HeaderFooter` [apps/docs/src/renderer/App.tsx L24](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L24-L24)  `NoteInfo` (footnotes/endnotes) [apps/docs/src/renderer/App.tsx L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L26-L26)  and `DocProtection` [apps/docs/src/renderer/App.tsx L23](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L23-L23)

For an in-depth look at the `docx-engine`'s internal workings, including its parsing logic, patching algorithms, and handling of various document elements, refer to [DOCX Engine (packages/docx-engine)](/genspark-ai/genoffice/3.2-docx-engine-(packagesdocx-engine)).

Sources: [apps/docs/src/renderer/App.tsx L15-L33](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L15-L33)

 [apps/docs/src/renderer/doc-state.ts L5-L6](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-state.ts#L5-L6)

## Docs UI Components & Ribbon

The user interface of GenOffice Docs is built using React components. The central element of the UI is the **Ribbon** [apps/docs/src/renderer/App.tsx L88](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L88-L88)

 which organizes editing functionalities into various tabs.

Beyond the Ribbon, the application provides several specialized panels and dialogs:

* **NavPane:** For document navigation [apps/docs/src/renderer/App.tsx L129](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L129-L129)
* **CommentsPanel:** For viewing and interacting with document comments [apps/docs/src/renderer/App.tsx L39](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L39-L39)
* **ComparePanel:** To display document comparison results [apps/docs/src/renderer/App.tsx L102](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L102-L102)
* **FindPanel:** For search and replace operations [apps/docs/src/renderer/App.tsx L87](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L87-L87)
* **HeaderFooterArea:** For editing headers and footers [apps/docs/src/renderer/App.tsx L41](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L41-L41)
* **EquationModal:** A modal for inserting and editing equations [apps/docs/src/renderer/App.tsx L40](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L40-L40)
* **InkOverlay:** To display and manage ink annotations [apps/docs/src/renderer/App.tsx L127](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L127-L127)
* **Ruler:** For visual layout adjustments [apps/docs/src/renderer/App.tsx L130](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L130-L130)
* **PaginationPreview:** To show the paginated view of the document [apps/docs/src/renderer/App.tsx L42](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L42-L42)

For a detailed breakdown of the UI components, their structure, and interactions, refer to [Docs UI Components & Ribbon](/genspark-ai/genoffice/3.3-docs-ui-components-and-ribbon).

Sources: [apps/docs/src/renderer/App.tsx L39-L42](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L39-L42)

 [apps/docs/src/renderer/App.tsx L87-L88](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L87-L88)

 [apps/docs/src/renderer/App.tsx L102](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L102-L102)

 [apps/docs/src/renderer/App.tsx L127-L130](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L127-L130)

## Byte-Preserving Round-Trip

A fundamental design philosophy of GenOffice Docs is the "byte-preserving round-trip". This ensures that when a `.docx` file is opened, edited, and saved, the resulting file is as close as possible to the original at the byte level.

The application tracks document "dirtiness" through the `DocDirtyState` interface [apps/docs/src/renderer/doc-dirty.ts L6-L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-dirty.ts#L6-L30)

 which monitors specific changes to sections, numbering, styles, and headers/footers to determine if a save is necessary.

```

```

Sources: [apps/docs/src/renderer/doc-dirty.ts L6-L58](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-dirty.ts#L6-L58)

 [apps/docs/src/renderer/doc-cache.ts L4-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-cache.ts#L4-L13)

## Paginated View

GenOffice Docs provides a paginated view of the document, calculated by the logic in `pagination.ts`. This system measures blocks [apps/docs/src/renderer/App.tsx L51](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L51-L51)

 and determines line start anchors [apps/docs/src/renderer/App.tsx L48](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L48-L48)

 to slice the document into pages.

The pagination system handles:

* **Section Geometries:** Calculating columns and margins via `sectionGeoms` [apps/docs/src/renderer/App.tsx L65](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L65-L65)
* **Header/Footer Heights:** Determining space for `effectiveHfRefs` [apps/docs/src/renderer/App.tsx L47](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L47-L47)
* **Page Numbering:** Formatting and displaying page counts [apps/docs/src/renderer/App.tsx L54-L70](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L54-L70)

Sources: [apps/docs/src/renderer/App.tsx L45-L74](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L45-L74)

 [apps/docs/src/renderer/pagination.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/pagination.ts)

## AI Editing

GenOffice Docs integrates AI capabilities through the `AiPanel` [apps/docs/src/renderer/App.tsx L36](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L36-L36)

 The AI system can analyze document content, such as counting words [apps/docs/src/renderer/App.tsx L37](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L37-L37)

 and revisions [apps/docs/src/renderer/App.tsx L196](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L196-L196)

 to provide context-aware suggestions and editing tools.

The application manages AI settings [apps/docs/src/renderer/App.tsx L34](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L34-L34)

 and providers [apps/docs/src/renderer/App.tsx L35](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L35-L35)

 to facilitate these interactions.

Sources: [apps/docs/src/renderer/App.tsx L34-L37](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/App.tsx#L34-L37)

 [apps/docs/src/renderer/ai/AiPanel.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/AiPanel.tsx)