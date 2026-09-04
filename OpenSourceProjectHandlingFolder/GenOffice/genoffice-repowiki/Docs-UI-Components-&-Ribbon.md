# Docs UI Components & Ribbon

> **Relevant source files**
> * [apps/docs/src/renderer/components/CommentsPanel.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/CommentsPanel.tsx)
> * [apps/docs/src/renderer/components/ComparePanel.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ComparePanel.tsx)
> * [apps/docs/src/renderer/components/ContextMenu.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ContextMenu.tsx)
> * [apps/docs/src/renderer/components/EquationModal.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/EquationModal.tsx)
> * [apps/docs/src/renderer/components/FindPanel.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/FindPanel.tsx)
> * [apps/docs/src/renderer/components/HeaderFooterArea.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/HeaderFooterArea.tsx)
> * [apps/docs/src/renderer/components/InkOverlay.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx)
> * [apps/docs/src/renderer/components/MarginDialog.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/MarginDialog.tsx)
> * [apps/docs/src/renderer/components/NavPane.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/NavPane.tsx)
> * [apps/docs/src/renderer/components/PaginationPreview.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PaginationPreview.tsx)
> * [apps/docs/src/renderer/components/PictureDialogs.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PictureDialogs.tsx)
> * [apps/docs/src/renderer/components/PrintDialog.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PrintDialog.tsx)
> * [apps/docs/src/renderer/components/PromptModal.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PromptModal.tsx)
> * [apps/docs/src/renderer/components/Ribbon.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx)
> * [apps/docs/src/renderer/components/Ruler.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ruler.tsx)
> * [apps/docs/src/renderer/components/icons.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/icons.tsx)
> * [apps/docs/src/renderer/components/modal-keys.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/modal-keys.ts)
> * [apps/docs/src/renderer/components/ribbon-design-tab.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ribbon-design-tab.tsx)
> * [apps/docs/src/renderer/components/ribbon-format-state.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ribbon-format-state.ts)
> * [apps/docs/src/renderer/components/ribbon-insert-tab.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ribbon-insert-tab.tsx)
> * [apps/docs/src/renderer/components/ribbon-layout-tab.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ribbon-layout-tab.tsx)
> * [apps/docs/src/renderer/components/ribbon-references-tab.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ribbon-references-tab.tsx)
> * [apps/docs/src/renderer/components/ribbon-tabs.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ribbon-tabs.tsx)
> * [apps/docs/src/renderer/components/toast-bus.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/toast-bus.ts)
> * [apps/docs/src/renderer/components/toast.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/toast.tsx)

This page details the user interface components within the `apps/docs/src/renderer/components/` directory, focusing on the Ribbon and its various tabs, as well as other key UI panels and dialogs. These components provide the interactive elements for the GenOffice Docs word processor, allowing users to create, edit, and format documents.

## Ribbon

The Ribbon is the primary interface element for interacting with the document editor. It is implemented by the `Ribbon` component [apps/docs/src/renderer/components/Ribbon.tsx L99-L206](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L99-L206)

 and organizes document editing functionalities into logical tabs.

### Ribbon Structure

The `Ribbon` component receives numerous props, including the `editor` instance (a TipTap `Editor` object), document-related data (`hasDoc`, `blocks`, `section`), and various callback functions for handling user actions (e.g., `onSave`, `onToggleAi`, `onZoom`).

The Ribbon's tabs are defined in `ribbon-tabs.tsx` and its sub-files. Each tab groups related functionalities.

#### Home Tab

Contains common text formatting, paragraph styling, and clipboard operations.

* **Clipboard:** Standard operations. `clipboard` function in [apps/docs/src/renderer/components/ContextMenu.tsx L140-L168](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ContextMenu.tsx#L140-L168)  handles these actions.
* **Font Group:** Bold, Italic, Underline, etc. For example, `editor.chain().focus().toggleBold().run()` toggles bold formatting.
* **Paragraph Group:** Bullets, alignment, and spacing. `stepParagraphIndent` [apps/docs/src/renderer/components/ribbon-tabs.tsx L32](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ribbon-tabs.tsx#L32-L32)  (referenced via import) adjusts indentation.

#### Insert Tab

Implemented in `ribbon-insert-tab.tsx`, providing options for adding elements.

* **Tables:** Imported from `@tiptap/pm/tables` [apps/docs/src/renderer/components/Ribbon.tsx L6-L18](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L6-L18)
* **Pictures:** Handled by `PictureDialogs`.
* **Comments:** Managed by the `CommentsPanel`.
* **Symbols:** The `EquationModal` [apps/docs/src/renderer/components/EquationModal.tsx L77-L164](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/EquationModal.tsx#L77-L164)  and `EquationGallery` [apps/docs/src/renderer/components/EquationModal.tsx L167-L198](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/EquationModal.tsx#L167-L198)  facilitate equation insertion.

#### Design & Layout Tabs

* **Design:** Focuses on aesthetics like `watermark` and `pageColor`.
* **Layout:** Manages page setup. `onInsertSectionBreak` [apps/docs/src/renderer/components/Ribbon.tsx L127](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L127-L127)  handles section transitions. `MarginDialog` [apps/docs/src/renderer/components/MarginDialog.tsx L40-L116](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/MarginDialog.tsx#L40-L116)  provides precise margin control.

#### Review Tab

* **Tracking:** `onTrackChanges` [apps/docs/src/renderer/components/Ribbon.tsx L185](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L185-L185)  and `onRevisionDisplay` [apps/docs/src/renderer/components/Ribbon.tsx L187](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L187-L187)
* **Compare:** `onCompare` [apps/docs/src/renderer/components/Ribbon.tsx L193](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L193-L193)  triggers the `ComparePanel`.

#### View Tab

* **Show Group:** Toggles `Ruler` [apps/docs/src/renderer/components/Ruler.tsx](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ruler.tsx)  `NavPane` [apps/docs/src/renderer/components/NavPane.tsx L8-L32](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/NavPane.tsx#L8-L32)  and `PaginationPreview` [apps/docs/src/renderer/components/PaginationPreview.tsx L137-L187](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PaginationPreview.tsx#L137-L187)

#### AI Tab

* **AI Actions:** `onAiPreset` [apps/docs/src/renderer/components/Ribbon.tsx L159](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L159-L159)  triggers pre-defined instructions for the AI assistant.

### Ribbon Data Flow

The Ribbon acts as a central dispatcher for user actions. It receives the `editor` instance and uses its commands to modify the document state.

```

```

Title: Ribbon Component Interaction with Editor and Application State
Sources:

* [apps/docs/src/renderer/components/Ribbon.tsx L99-L206](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L99-L206)
* [apps/docs/src/renderer/components/Ribbon.tsx L127](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L127-L127)
* [apps/docs/src/renderer/components/Ribbon.tsx L159](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L159-L159)
* [apps/docs/src/renderer/components/ContextMenu.tsx L140-L168](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ContextMenu.tsx#L140-L168)

## NavPane

The `NavPane` component [apps/docs/src/renderer/components/NavPane.tsx L8-L32](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/NavPane.tsx#L8-L32)

 displays a hierarchical outline of headings.

* It uses `collectHeadings(doc)` [apps/docs/src/renderer/components/NavPane.tsx L10](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/NavPane.tsx#L10-L10)  to find heading nodes.
* Clicking an item triggers `dom?.scrollIntoView({ behavior: 'smooth', block: 'start' })` [apps/docs/src/renderer/components/NavPane.tsx L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/NavPane.tsx#L22-L22)

## CommentsPanel

The `CommentsPanel` component [apps/docs/src/renderer/components/CommentsPanel.tsx L49-L266](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/CommentsPanel.tsx#L49-L266)

 manages document threads.

* **Anchor Scanning:** `collectAnchorTexts` [apps/docs/src/renderer/components/CommentsPanel.tsx L21-L30](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/CommentsPanel.tsx#L21-L30)  orientation comments by reading `.doc-comment` spans from the DOM.
* **Navigation:** `jumpTo(id)` [apps/docs/src/renderer/components/CommentsPanel.tsx L32-L43](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/CommentsPanel.tsx#L32-L43)  scrolls to the anchor and applies the `doc-comment-flash` CSS class.
* **Interaction:** Supports `onReply`, `onResolve`, and `onDelete` callbacks [apps/docs/src/renderer/components/CommentsPanel.tsx L65-L72](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/CommentsPanel.tsx#L65-L72)

## ComparePanel

The `ComparePanel` component [apps/docs/src/renderer/components/ComparePanel.tsx L11-L82](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ComparePanel.tsx#L11-L82)

 displays differences between two document versions.

* It summarizes entries using `summarize(entries)` [apps/docs/src/renderer/components/ComparePanel.tsx L21](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ComparePanel.tsx#L21-L21)
* Identical stretches are collapsed into a "Same Run" indicator [apps/docs/src/renderer/components/ComparePanel.tsx L64-L66](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ComparePanel.tsx#L64-L66)

## FindPanel

The `FindPanel` component [apps/docs/src/renderer/components/FindPanel.tsx L71-L219](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/FindPanel.tsx#L71-L219)

 provides search and replace.

* **Logic:** `findMatches` [apps/docs/src/renderer/components/FindPanel.tsx L29-L62](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/FindPanel.tsx#L29-L62)  flattens textblocks to find matches spanning marks.
* **Highlighting:** Dispatches metadata to `searchPluginKey` [apps/docs/src/renderer/components/FindPanel.tsx L85](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/FindPanel.tsx#L85-L85)
* **Debouncing:** Uses `SCAN_DEBOUNCE_MS` (150ms) to prevent UI lag during typing [apps/docs/src/renderer/components/FindPanel.tsx L69](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/FindPanel.tsx#L69-L69)

## HeaderFooterArea

The `HeaderFooterArea` component [apps/docs/src/renderer/components/HeaderFooterArea.tsx L76-L215](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/HeaderFooterArea.tsx#L76-L215)

 handles page margins content.

* **Sentinels:** Uses `{PAGE}` and `{NUMPAGES}` as visible tokens for `PAGE_MARK` and `TOTAL_PAGES_MARK` [apps/docs/src/renderer/components/HeaderFooterArea.tsx L20-L21](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/HeaderFooterArea.tsx#L20-L21)
* **Editing:** Double-click triggers `setEditing(true)` [apps/docs/src/renderer/components/HeaderFooterArea.tsx L182](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/HeaderFooterArea.tsx#L182-L182)  switching to a `contentEditable` surface that preserves paragraph styling [apps/docs/src/renderer/components/HeaderFooterArea.tsx L145-L149](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/HeaderFooterArea.tsx#L145-L149)

## InkOverlay

The `InkOverlay` component [apps/docs/src/renderer/components/InkOverlay.tsx L79-L213](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L79-L213)

 provides a drawing layer.

* **Anchoring:** Strokes are anchored to body paragraphs using `pickAnchor` [apps/docs/src/renderer/components/InkOverlay.tsx L58-L77](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L58-L77)
* **Geometry:** Coordinates are stored relative to the paragraph's top-left at 100% zoom [apps/docs/src/renderer/components/InkOverlay.tsx L176-L180](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L176-L180)
* **Eraser:** Uses `strokeHitTest` with `ERASER_RADIUS` (6px) [apps/docs/src/renderer/components/InkOverlay.tsx L39-L124](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L39-L124)

## PaginationPreview & PrintDialog

### PaginationPreview

The `PaginationPreview` component [apps/docs/src/renderer/components/PaginationPreview.tsx L137-L307](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PaginationPreview.tsx#L137-L307)

 is a read-only snapshot of the document's printed form.

* **Pruning:** For large documents, it uses `prunedCloneHtml` [apps/docs/src/renderer/components/PaginationPreview.tsx L80-L109](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PaginationPreview.tsx#L80-L109)  to replace off-screen blocks with `pv-prune-spacer` elements to prevent OOM [apps/docs/src/renderer/components/PaginationPreview.tsx L55-L57](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PaginationPreview.tsx#L55-L57)
* **Layout:** Uses `sliceWithLineSplit` and `sectionGeoms` [apps/docs/src/renderer/components/PaginationPreview.tsx L21-L23](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PaginationPreview.tsx#L21-L23)  to determine exact page boundaries.

### PrintDialog

The `PrintDialog` component [apps/docs/src/renderer/components/PrintDialog.tsx L22-L202](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PrintDialog.tsx#L22-L202)

 leverages the pagination preview.

* **Cloning:** It clones `.pv-page` elements from the preview for the print layout [apps/docs/src/renderer/components/PrintDialog.tsx L95](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PrintDialog.tsx#L95-L95)
* **Range:** Supports `all`, `current`, and `custom` ranges via `parsePrintRange` [apps/docs/src/renderer/components/PrintDialog.tsx L65-L70](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PrintDialog.tsx#L65-L70)

## ContextMenu

The `EditorContextMenu` component [apps/docs/src/renderer/components/ContextMenu.tsx L53-L212](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ContextMenu.tsx#L53-L212)

 provides local actions.

* **Clipboard:** Implements `cut`, `copy`, and `paste` (preferring HTML) [apps/docs/src/renderer/components/ContextMenu.tsx L140-L168](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ContextMenu.tsx#L140-L168)
* **AI:** Offers `Synonyms` and `Translate` (targeting `TRANSLATE_TARGETS`) [apps/docs/src/renderer/components/ContextMenu.tsx L41-L49](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ContextMenu.tsx#L41-L49)

```

```

Title: Mapping User Interaction to Docs UI Components
Sources:

* [apps/docs/src/renderer/components/ContextMenu.tsx L53](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ContextMenu.tsx#L53-L53)
* [apps/docs/src/renderer/components/FindPanel.tsx L71](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/FindPanel.tsx#L71-L71)
* [apps/docs/src/renderer/components/InkOverlay.tsx L79](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L79-L79)
* [apps/docs/src/renderer/components/PaginationPreview.tsx L137](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PaginationPreview.tsx#L137-L137)

Sources:

* [apps/docs/src/renderer/components/CommentsPanel.tsx L49-L266](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/CommentsPanel.tsx#L49-L266)
* [apps/docs/src/renderer/components/ComparePanel.tsx L11-L82](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ComparePanel.tsx#L11-L82)
* [apps/docs/src/renderer/components/ContextMenu.tsx L53-L212](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/ContextMenu.tsx#L53-L212)
* [apps/docs/src/renderer/components/EquationModal.tsx L77-L164](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/EquationModal.tsx#L77-L164)
* [apps/docs/src/renderer/components/FindPanel.tsx L71-L219](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/FindPanel.tsx#L71-L219)
* [apps/docs/src/renderer/components/HeaderFooterArea.tsx L76-L215](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/HeaderFooterArea.tsx#L76-L215)
* [apps/docs/src/renderer/components/InkOverlay.tsx L79-L213](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L79-L213)
* [apps/docs/src/renderer/components/MarginDialog.tsx L40-L116](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/MarginDialog.tsx#L40-L116)
* [apps/docs/src/renderer/components/NavPane.tsx L8-L32](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/NavPane.tsx#L8-L32)
* [apps/docs/src/renderer/components/PaginationPreview.tsx L137-L307](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PaginationPreview.tsx#L137-L307)
* [apps/docs/src/renderer/components/PictureDialogs.tsx L48-L218](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PictureDialogs.tsx#L48-L218)
* [apps/docs/src/renderer/components/PrintDialog.tsx L22-L202](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/PrintDialog.tsx#L22-L202)
* [apps/docs/src/renderer/components/Ribbon.tsx L99-L206](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/Ribbon.tsx#L99-L206)