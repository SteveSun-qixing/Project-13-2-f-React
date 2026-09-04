# Docs Editor Engine (TipTap/ProseMirror)

> **Relevant source files**
> * [apps/docs/src/renderer/bidi-js.d.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/bidi-js.d.ts)
> * [apps/docs/src/renderer/cutout.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/cutout.ts)
> * [apps/docs/src/renderer/editor/active-editor.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/active-editor.ts)
> * [apps/docs/src/renderer/editor/comments.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/comments.ts)
> * [apps/docs/src/renderer/editor/compare.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/compare.ts)
> * [apps/docs/src/renderer/editor/convert.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/convert.ts)
> * [apps/docs/src/renderer/editor/cover-pages.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/cover-pages.ts)
> * [apps/docs/src/renderer/editor/decoration-extensions.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/decoration-extensions.ts)
> * [apps/docs/src/renderer/editor/direction.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/direction.ts)
> * [apps/docs/src/renderer/editor/equation.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/equation.ts)
> * [apps/docs/src/renderer/editor/extensions.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/extensions.ts)
> * [apps/docs/src/renderer/editor/headings.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/headings.ts)
> * [apps/docs/src/renderer/editor/hf-dom.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/hf-dom.ts)
> * [apps/docs/src/renderer/editor/indent.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/indent.ts)

This page provides a detailed technical overview of the document editor engine within `apps/docs`. The editor is built upon TipTap, which in turn leverages ProseMirror, to provide a rich text editing experience for `.docx` files. A core principle is the 1:1 mirroring of the `docx-engine`'s Block model within the TipTap schema, ensuring byte-preserving round-trip fidelity. This page covers the custom schema, various extensions for marks, numbering, pagination, track changes, equations, ink annotations, table sizing, protected content rendering, and the active-editor sub-editor system.

## TipTap Schema and Block Model Mirroring

The TipTap schema in `apps/docs` is meticulously designed to mirror the `docx-engine`'s Block model. This ensures that the editor's internal representation of the document is directly translatable to and from the `docx-engine`'s data structures, facilitating byte-preserving round-trip operations. Every top-level node in the schema carries `docxIndex` (a patch anchor for existing content, `null` for new content) and `aiChanged` (for highlighting AI-modified content) [apps/docs/src/renderer/editor/decoration-extensions.ts:9-13].

The schema defines various node types corresponding to DOCX elements:

* **`doc`**: The root document node.
* **`docParagraph`**: Represents a standard paragraph [apps/docs/src/renderer/editor/extensions.ts:113-161].
* **`docHeading`**: Represents a heading with a specific level [apps/docs/src/renderer/editor/extensions.ts:231-240].
* **`docListItem`**: Represents a list item, supporting both bulleted and numbered lists [apps/docs/src/renderer/editor/extensions.ts:242-253].
* **`docTable`**: Represents a table, containing `docTableRow` and `docTableCell` nodes [apps/docs/src/renderer/editor/extensions.ts:255-276].
* **`docProtected`**: A special node type for content that is rendered as a single, uneditable unit, such as images, equations, textboxes, and other passthrough elements [apps/docs/src/renderer/editor/extensions.ts:312-336].

Each paragraph-level node (`docParagraph`, `docHeading`, `docListItem`) includes a comprehensive set of attributes that directly map to paragraph properties (`w:pPr`) in OOXML. These attributes include alignment, line spacing, indents, space before/after, page breaks, shading, borders, tab stops, drop caps, and revision information [apps/docs/src/renderer/editor/extensions.ts:113-161].

### Node and Mark Definitions

The core schema is defined in `apps/docs/src/renderer/editor/extensions.ts` and `apps/docs/src/renderer/editor/marks.ts`.

**Paragraph-level Nodes:**

* **`docParagraph`**: [apps/docs/src/renderer/editor/extensions.ts L113-L161](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/extensions.ts#L113-L161) * Attributes: `docxIndex`, `styleId`, `aiChanged`, `bookmarks`, `hiddenBookmarks`, `commentStarts`, `commentEnds`, `align`, `lineSpacing`, `lineRule`, `lineRawTwips`, `indentLeft`, `indentRight`, `indentFirstLine`, `spaceBefore`, `spaceAfter`, `pageBreakBefore`, `bidi`, `shadingFill`, `borders`, `tabStops`, `dropCap`, `sdtShell`, `moveRevision`, `pPrChange`, `blockRevision`.
* **`docHeading`**: [apps/docs/src/renderer/editor/extensions.ts L231-L240](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/extensions.ts#L231-L240) * Extends `docParagraph` attributes, adds `level`.
* **`docListItem`**: [apps/docs/src/renderer/editor/extensions.ts L242-L253](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/extensions.ts#L242-L253) * Extends `docParagraph` attributes, adds `kind` (bullet/number), `numId`, `ilvl`.
* **`docTable`**: [apps/docs/src/renderer/editor/extensions.ts L255-L276](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/extensions.ts#L255-L276)
* **`docProtected`**: [apps/docs/src/renderer/editor/extensions.ts L312-L336](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/extensions.ts#L312-L336) * Attributes: `blockType`, `label`, `previewText`, `imageDataUrl`, `imageAlign`, `imageWrap`, `table`, `fieldDisplay`, `textboxes`, `formulaDisplay`, `chartDisplay`.

**Inline Marks:**

* **`bold`**, **`italic`**, **`underline`**, **`strike`**: Standard formatting [apps/docs/src/renderer/editor/marks.ts:15-90].
* **`link`**: Stores `href`, `rId`, and `tooltip` [apps/docs/src/renderer/editor/marks.ts:92-124].
* **`comment`**: Stores space-separated comment `ids` [apps/docs/src/renderer/editor/marks.ts:126-145].
* **`ins`** / **`del`**: Tracked revisions with `author`, `date`, and `id` [apps/docs/src/renderer/editor/marks.ts:147-209].
* **`textStyle`**: Captures `font`, `size`, `color`, `highlight`, `vertAlign`, `lang` [apps/docs/src/renderer/editor/marks.ts:271-329].

### Data Flow: Block[] to ProseMirror JSON

The `blocksToPmDoc` function [apps/docs/src/renderer/editor/convert.ts:61-80] is responsible for converting the `docx-engine`'s `Block[]` array into a ProseMirror JSON document.

**Diagram: Block Model to ProseMirror Node Conversion**

```

```

Sources:

* [apps/docs/src/renderer/editor/convert.ts L61-L80](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/convert.ts#L61-L80)
* [apps/docs/src/renderer/editor/convert.ts L82-L104](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/convert.ts#L82-L104)
* [apps/docs/src/renderer/editor/extensions.ts L113-L336](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/extensions.ts#L113-L336)

## Extensions

The editor's functionality is extended through various TipTap extensions.

### Marks and Comments

The `marks.ts` file defines all character-level formatting marks. Operations for adding and removing comments are handled in `comments.ts`.

* **`CommentMark`**: Represents comment ranges. * `addCommentToSelection(editor, id)`: Attaches a new comment ID to the current selection [apps/docs/src/renderer/editor/comments.ts:19-42]. * `removeCommentFromDoc(editor, id)`: Removes a comment ID from the document [apps/docs/src/renderer/editor/comments.ts:45-65]. * `addReplyToCommentRange(editor, parentId, newId)`: Adds a reply comment ID to the range of an existing comment [apps/docs/src/renderer/editor/comments.ts:68-88].

### Numbering and Lists

The `numbering.ts` module handles the complex logic of Word's numbering system.

* **`computeListMarkerInfos(items, defs)`**: Calculates the correct list markers for a given set of list items and numbering definitions [apps/docs/src/renderer/editor/numbering.ts:109-151].
* **`formatNumber(value, numFmt)`**: Formats numbers according to decimal, Roman, or letter formats [apps/docs/src/renderer/editor/numbering.ts:72-95].

### Pagination Gaps

The `PaginationGapsExtension` [apps/docs/src/renderer/editor/pagination-gaps.ts:1-130] renders a paginated view by inserting visual "gaps" between pages. It uses a ProseMirror plugin to manage `DecorationSet` for page gaps, calculated based on document layout.

### Track Changes and Bidi

* **`TrackChangesExtension`**: Intercepts transactions to record insertions and deletions [apps/docs/src/renderer/editor/revisions.ts:20-160].
* **`AutoDirectionExtension`**: Auto-detects paragraph direction while typing. When a text insertion gives a paragraph its first strong directional character, the paragraph's `bidi` flag follows that character [apps/docs/src/renderer/editor/direction.ts:127-182].
* **`firstStrongDir(text)`**: Logic to determine if text is RTL or LTR based on the first strong character [apps/docs/src/renderer/editor/direction.ts:20-26].

### Equations and Protected Render

Equations are handled as `docProtected` blocks for display and `docInlineMath` for inline flow.

* **`equationBlockJson(latex)`**: Converts LaTeX into a `docProtected` node representing a display equation [apps/docs/src/renderer/editor/equation.ts:33-51].
* **`renderProtectedNode(node)`**: A dispatcher in `protected-render.ts` that calls specific rendering functions for images, fields, textboxes, and charts [apps/docs/src/renderer/editor/protected-render.ts:10-100].
* **`renderTextboxSpec`**: Renders textboxes which host a nested sub-editor [apps/docs/src/renderer/editor/protected-render.ts:66-72].

### Table Sizing and Tab Stops

* **`constrainTableWidthAtCell(editor, cellPos, widthPx)`**: Adjusts column width to a specific pixel value while maintaining table constraints [apps/docs/src/renderer/editor/table-sizing.ts:10-30].
* **`TabStopExtension`**: Measures tab characters and applies `tab-size` CSS properties via inline decorations [apps/docs/src/renderer/editor/decoration-extensions.ts:136-300]. It uses a `TabLayoutView` to manage measurement and avoid infinite dispatch loops [apps/docs/src/renderer/editor/decoration-extensions.ts:186-220].

Sources:

* [apps/docs/src/renderer/editor/comments.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/comments.ts)
* [apps/docs/src/renderer/editor/direction.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/direction.ts)
* [apps/docs/src/renderer/editor/equation.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/equation.ts)
* [apps/docs/src/renderer/editor/numbering.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/numbering.ts)
* [apps/docs/src/renderer/editor/protected-render.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/protected-render.ts)
* [apps/docs/src/renderer/editor/table-sizing.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/table-sizing.ts)
* [apps/docs/src/renderer/editor/decoration-extensions.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/decoration-extensions.ts)

## Active-Editor Sub-Editor System

The `active-editor.ts` module implements a system to track which sub-editor (e.g., a nested editor within a textbox) should receive ribbon commands. This ensures that clicking a ribbon button (which steals focus) still routes the command to the correct context [apps/docs/src/renderer/editor/active-editor.ts:1-8].

**Diagram: Active Sub-Editor System**

```

```

Key functions:

* **`getActiveSubEditor()`**: Returns the sub-editor ribbon commands should target [apps/docs/src/renderer/editor/active-editor.ts:20-23].
* **`setActiveSubEditor(editor)`**: Sets the active sub-editor when a textbox gains focus [apps/docs/src/renderer/editor/active-editor.ts:26-30].
* **`notifySubEditorState(docChanged)`**: Called by sub-editors on every transaction so the ribbon re-renders [apps/docs/src/renderer/editor/active-editor.ts:41-43].
* **`subscribeSubEditorState(fn)`**: Allows the App to subscribe to state changes [apps/docs/src/renderer/editor/active-editor.ts:46-51].

Sources:

* [apps/docs/src/renderer/editor/active-editor.ts L1-L51](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/active-editor.ts#L1-L51)
* [apps/docs/src/renderer/editor/protected-render.ts L66-L72](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/protected-render.ts#L66-L72)