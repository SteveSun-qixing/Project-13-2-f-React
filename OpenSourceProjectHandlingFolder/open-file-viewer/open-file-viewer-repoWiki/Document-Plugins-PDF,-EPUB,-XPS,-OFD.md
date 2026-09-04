# Document Plugins: PDF, EPUB, XPS, OFD

> **Relevant source files**
> * [packages/core/src/plugins/drawing.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/drawing.ts)
> * [packages/core/src/plugins/epub.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/epub.test.ts)
> * [packages/core/src/plugins/epub.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/epub.ts)
> * [packages/core/src/plugins/ofd.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/ofd.test.ts)
> * [packages/core/src/plugins/ofd.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/ofd.ts)
> * [packages/core/src/plugins/pdf.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.test.ts)
> * [packages/core/src/plugins/pdf.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts)
> * [packages/core/src/plugins/xps.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/xps.test.ts)
> * [packages/core/src/plugins/xps.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/xps.ts)

This page covers the implementation details for document-based plugins in the Open File Viewer. These plugins handle complex paginated or structured document formats by utilizing specialized libraries (like PDF.js) or by parsing internal XML structures (EPUB, XPS, OFD) to provide a lightweight preview.

## pdfPlugin

The `pdfPlugin` provides a high-performance PDF viewing experience using [PDF.js](https://mozilla.github.io/pdf.js/). It implements a virtualized rendering pipeline that uses an `IntersectionObserver` to render pages only when they enter the viewport, conserving memory for large documents.

### Key Features

* **On-demand Rendering**: Uses `IntersectionObserver` to trigger `renderPage` and `clearPage` [packages/core/src/plugins/pdf.ts L107-L124](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts#L107-L124)
* **HiDPI Support**: Detects `window.devicePixelRatio` to scale the canvas for sharp text on Retina displays [packages/core/src/plugins/pdf.ts L142-L151](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts#L142-L151)
* **Text Layer**: Generates an invisible, selectable text layer over the canvas using absolute positioning [packages/core/src/plugins/pdf.ts L172-L200](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts#L172-L200)
* **Zoom & Fit**: Supports `fit: "width"` and `fit: "actual"` with dynamic `zoomFactor` adjustments [packages/core/src/plugins/pdf.ts L136-L139](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts#L136-L139)
* **Error Handling**: Detects `PasswordException` to show a specialized password-protected fallback [packages/core/src/plugins/pdf.ts L61-L64](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts#L61-L64)

### PDF Rendering Pipeline

The following diagram illustrates the lifecycle of a PDF document from loading to page-level virtualization.

**PDF Plugin Data Flow**

```

```

Sources: [packages/core/src/plugins/pdf.ts L33-L200](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts#L33-L200)

### Configuration Options

The plugin accepts a `PdfPluginOptions` object [packages/core/src/plugins/pdf.ts L6-L13](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts#L6-L13)

:

* `pdfjs`: Custom PDF.js module instance.
* `workerSrc`: Path to `pdf.worker.js`.
* `cMapUrl` / `cMapPacked`: Settings for CJK font support.
* `standardFontDataUrl`: Path to standard PDF fonts.

## epubPlugin

The `epubPlugin` parses `.epub` files (which are specialized ZIP archives) to extract metadata and render chapter content. It uses `JSZip` for decompression and `DOMPurify` to ensure safe rendering of HTML chapters.

### Implementation Details

1. **Package Discovery**: Locates the `.opf` file via `META-INF/container.xml` [packages/core/src/plugins/epub.ts L147-L165](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/epub.ts#L147-L165)
2. **Asset Rewriting**: Parses the manifest and rewrites internal `src` and `href` attributes to use Base64 data URIs for images and styles [packages/core/src/plugins/epub.ts L79-L80](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/epub.ts#L79-L80)
3. **Sanitization**: All chapter HTML is passed through `DOMPurify` before being injected into the `ofv-epub-reader` container [packages/core/src/plugins/epub.ts L137](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/epub.ts#L137-L137)

**EPUB Entity Mapping**

```

```

Sources: [packages/core/src/plugins/epub.ts L66-L145](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/epub.ts#L66-L145)

## ofdPlugin & xpsPlugin

These plugins provide "Lightweight Previews" for fixed-layout formats. Instead of full pixel-perfect rendering, they extract the underlying XML structure to show text and basic vector shapes.

### OFD (Open Fixed-layout Document)

* **Match Logic**: Matches `.ofd` extension or `application/ofd` MIME type [packages/core/src/plugins/ofd.ts L9-L11](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/ofd.ts#L9-L11)
* **Vector Preview**: Extracts `TextObject`, `PathObject`, and `ImageObject` from `Content.xml` to generate a lightweight SVG version of the page [packages/core/src/plugins/ofd.ts L200-L216](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/ofd.ts#L200-L216)
* **Summary**: Provides counts for XML entries, pages, and text fragments [packages/core/src/plugins/ofd.ts L146-L171](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/ofd.ts#L146-L171)

### XPS (XML Paper Specification)

* **FixedPage Parsing**: Iterates through `.fpage` files within the ZIP package [packages/core/src/plugins/xps.ts L38-L41](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/xps.ts#L38-L41)
* **Glyphs Extraction**: Extracts `UnicodeString` attributes from `Glyphs` elements to provide a readable text preview [packages/core/src/plugins/xps.ts L126-L142](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/xps.ts#L126-L142)
* **Resource Audit**: Lists image brushes, canvases, and font resources found in the package [packages/core/src/plugins/xps.ts L103-L124](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/xps.ts#L103-L124)

## Technical Comparison

| Feature | PDF | EPUB | OFD / XPS |
| --- | --- | --- | --- |
| **Engine** | PDF.js (Canvas) | Custom (HTML/CSS) | Custom (SVG/Text) |
| **Virtualization** | Yes (IntersectionObserver) | Partial (Slice 40) | Partial (Slice 80) |
| **Text Interaction** | Selectable Text Layer | Native HTML Selection | Extracted Text Blocks |
| **External Deps** | `pdfjs-dist` | `jszip`, `dompurify` | `jszip` |

Sources: [packages/core/src/plugins/pdf.ts L27-L36](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts#L27-L36)

 [packages/core/src/plugins/epub.ts L40-L55](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/epub.ts#L40-L55)

 [packages/core/src/plugins/ofd.ts L6-L12](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/ofd.ts#L6-L12)

 [packages/core/src/plugins/xps.ts L10-L16](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/xps.ts#L10-L16)