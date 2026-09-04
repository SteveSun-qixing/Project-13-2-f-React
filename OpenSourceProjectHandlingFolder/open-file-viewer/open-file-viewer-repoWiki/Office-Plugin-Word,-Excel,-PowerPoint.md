# Office Plugin: Word, Excel, PowerPoint

> **Relevant source files**
> * [packages/core/src/plugins/office.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts)
> * [packages/core/src/plugins/office.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts)

The `officePlugin` provides comprehensive support for Microsoft Office, OpenDocument, and Apple iWork formats. It utilizes a combination of specialized rendering libraries and custom windowed rendering logic to handle large spreadsheets and complex document structures.

## Overview and Matching Logic

The plugin identifies supported files through a combination of file extensions and MIME types. It categorizes files into three primary groups: Word-like, Sheet-like, and Presentation-like.

### Supported Extensions and MIME Types

| Category | Extensions | MIME Types |
| --- | --- | --- |
| **Word** | docx, docm, doc, dotx, dotm, dot, rtf, odt, fodt, wps | `application/msword`, `application/rtf`, `application/vnd.oasis.opendocument.text`, etc. |
| **Sheet** | xlsx, xls, xlsm, xlsb, xlt, xltx, xltm, csv, tsv, ods, fods, numbers, et | `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, etc. |
| **Presentation** | pptx, pptm, ppt, pps, ppsx, ppsm, potx, potm, odp, fodp, key, dps | `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, etc. |

The `match` function evaluates the `PreviewFile` properties against these sets [packages/core/src/plugins/office.ts L112-L119](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L112-L119)

### Plugin Data Flow

The following diagram illustrates how the `officePlugin` routes different file formats to their respective internal rendering functions.

**Office Rendering Pipeline**

```

```

Sources: [packages/core/src/plugins/office.ts L109-L160](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L109-L160)

## Word Processing: DOCX and ODT

### DOCX Rendering

DOCX files are rendered using `docx-preview`. To ensure the document fits the viewer width, the plugin implements a `fitDocxPages` scaling mechanism.

1. **Rendering**: The `renderDocx` function calls `docx-preview`'s `renderAsync` [packages/core/src/plugins/office.ts L128](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L128-L128)
2. **Scaling**: A `ResizeObserver` is attached to the viewport. It calculates the ratio between the viewport width and the DOCX page width (defaulting to 794px if not detectable). It then applies a CSS `transform: scale()` and adjusts the container height to prevent layout shifts [packages/core/src/plugins/office.ts L155](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L155-L155)

### OpenDocument (ODT)

ODT files are processed by extracting the `content.xml` from the ODT ZIP package using `JSZip`. The XML is then transformed into a readable HTML structure through `renderOpenDocumentXml`, which handles basic styling for headings, paragraphs, and lists [packages/core/src/plugins/office.ts L131-L134](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L131-L134)

## Spreadsheet Rendering: Excel and ODS

Spreadsheet rendering is powered by the `xlsx` (SheetJS) library but includes a custom UI for tab management and windowed performance optimization.

### Windowed Rendering

To maintain performance with large workbooks, the plugin uses "windowed rendering" constants:

* `SHEET_WINDOW_ROWS`: 200 [packages/core/src/plugins/office.ts L11](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L11-L11)
* `SHEET_WINDOW_COLUMNS`: 80 [packages/core/src/plugins/office.ts L12](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L12-L12)

If a sheet exceeds these dimensions, the plugin renders only the top-left window and provides a summary of the total dimensions (e.g., "4 行 x 2 列") to the user [packages/core/src/plugins/office.test.ts L112](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts#L112-L112)

### Implementation Details

* **Tab System**: Workbooks with multiple sheets generate a tab list (`.ofv-tabs`) where each button has `role="tab"` [packages/core/src/plugins/office.test.ts L106-L109](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts#L106-L109)
* **Formula Metadata**: Formula cells are identified and the original formula is stored in the `title` attribute of the cell, allowing users to hover and see the calculation (e.g., `=SUM(B2:B3)`) [packages/core/src/plugins/office.test.ts L114-L115](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts#L114-L115)
* **Error Handling**: Parsing failures (e.g., corrupted ZIP structures in `.xlsx`) are caught locally within the plugin. Instead of crashing the viewer, it renders a localized error message within the `ofv-office` panel [packages/core/src/plugins/office.test.ts L158-L160](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts#L158-L160)

Sources: [packages/core/src/plugins/office.ts L11-L12](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L11-L12)

 [packages/core/src/plugins/office.test.ts L82-L116](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts#L82-L116)

 [packages/core/src/plugins/office.test.ts L141-L161](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts#L141-L161)

## Presentations: PPTX and ODP

### PPTX Rendering

The plugin utilizes `@aiden0z/pptx-renderer` to render modern PowerPoint files. The `renderPptx` function initializes the renderer and mounts it into a dedicated container within the office panel [packages/core/src/plugins/office.ts L142](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L142-L142)

### ODP and Presentation Insights

For OpenDocument Presentations (ODP), the plugin performs "Insight Extraction". It parses the XML to calculate:

* Slide count
* Image count
* Animation and transition counts
* Sample text extraction from slides [packages/core/src/plugins/office.ts L77-L97](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L77-L97)

## Legacy Binary and Packaged Formats

### Legacy Office Binary (DOC, XLS, PPT)

For legacy binary formats that cannot be fully rendered in the browser, the plugin falls back to a **Text Extraction** strategy:

1. **Binary Sniffing**: The `isLegacyOfficeBinary` function checks for the `0xD0CF11E0` (Compound File Binary Format) signature.
2. **Extraction**: It attempts to extract readable ASCII or UTF-16 strings from the binary blob [packages/core/src/plugins/office.ts L147-L148](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L147-L148)
3. **UI**: The extracted text is displayed in a pre-formatted block with a warning that the view is a "Text Extraction" only.

### Packaged Office Detection (iWork/WPS)

Formats like Apple Numbers (`.numbers`) or Keynote (`.key`) are often ZIP packages. The `renderPackagedOfficePreview` function uses `JSZip` to look for internal preview images (e.g., `Preview.pdf` or `preview.jpg`) or metadata files (`buildVersionHistory.plist`) to provide at least a partial view or metadata summary [packages/core/src/plugins/office.ts L137](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L137-L137)

## Code Entity Map

The following diagram maps high-level office concepts to specific functions and variables in `office.ts`.

**Office Plugin Entity Mapping**

```

```

Sources: [packages/core/src/plugins/office.ts L11-L13](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L11-L13)

 [packages/core/src/plugins/office.ts L44-L73](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L44-L73)

 [packages/core/src/plugins/office.ts L123-L148](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts#L123-L148)