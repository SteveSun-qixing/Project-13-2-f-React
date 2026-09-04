# Plugin Reference

> **Relevant source files**
> * [packages/core/src/index.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/index.ts)
> * [packages/core/src/plugins/render-smoke.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts)
> * [packages/core/src/plugins/utils.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/utils.ts)

The functionality of `@open-file-viewer/core` is entirely modular, driven by a collection of built-in plugins. Each plugin is a self-contained unit responsible for identifying specific file types and rendering them into the viewer's viewport. These plugins are exported individually, allowing developers to include only the necessary renderers to optimize bundle size. [packages/core/src/index.ts L2-L18](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/index.ts#L2-L18)

### Plugin Ecosystem Overview

The following diagram illustrates the relationship between the `createViewer` orchestrator and the categorized plugin groups.

**Plugin Architecture & Category Mapping**

```

```

Sources: [packages/core/src/index.ts L1-L18](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/index.ts#L1-L18)

 [packages/core/src/plugins/render-smoke.test.ts L5-L21](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L5-L21)

---

### Document Plugins: PDF, EPUB, XPS, OFD

These plugins handle fixed-layout and reflowable digital documents. The `pdfPlugin` utilizes PDF.js for high-fidelity rendering, supporting features like password-protected files, text selection layers, and HiDPI scaling. Other plugins in this group handle specialized formats like EPUB for e-books and OFD (Open Fixed-layout Document).

For details, see [Document Plugins: PDF, EPUB, XPS, OFD](/xushanpei/open-file-viewer/3.1-document-plugins:-pdf-epub-xps-ofd).

### Office Plugin: Word, Excel, PowerPoint

The `officePlugin` is a comprehensive renderer for Microsoft Office and OpenDocument formats. It leverages `docx-preview` for Word documents and a custom windowed rendering engine for large Excel spreadsheets to maintain performance. It also supports PowerPoint presentations via `@aiden0z/pptx-renderer`.

For details, see [Office Plugin: Word, Excel, PowerPoint](/xushanpei/open-file-viewer/3.2-office-plugin:-word-excel-powerpoint).

### Media Plugins: Image, Video, Audio

These plugins provide interactive playback and viewing for multimedia files. The `imagePlugin` includes support for modern formats like HEIC (via `heic2any`) and features pan/zoom capabilities. The `videoPlugin` supports standard HTML5 video as well as adaptive streaming via HLS.js and MPEG-TS.

For details, see [Media Plugins: Image, Video, Audio](/xushanpei/open-file-viewer/3.3-media-plugins:-image-video-audio).

### Text & Code Plugin

The `textPlugin` is the most versatile renderer, handling everything from plain text and Markdown to source code with syntax highlighting. It uses an internal `langMap` to associate file extensions with Prism.js languages and includes specialized views for structured data like CSV and TSV.

For details, see [Text & Code Plugin](/xushanpei/open-file-viewer/3.4-text-and-code-plugin).

### Engineering & Specialized Plugins

This category covers complex data types including CAD drawings (DXF, DWG), 3D models (GLB, STL, OBJ) rendered via Three.js, and Geographic Information System (GIS) data displayed on Leaflet maps. It also includes the `assetPlugin` for inspecting binary assets like SQLite databases or Parquet files.

For details, see [Engineering & Specialized Plugins](/xushanpei/open-file-viewer/3.5-engineering-and-specialized-plugins).

### Archive & Email Plugins

The `archivePlugin` allows users to browse the contents of ZIP, RAR, and 7z files through a sidebar tree navigation, enabling nested file previews. The `emailPlugin` parses and renders EML and MSG files, including header metadata and body content.

For details, see [Archive & Email Plugins](/xushanpei/open-file-viewer/3.6-archive-and-email-plugins).

---

### Shared Plugin Utilities

Plugins share a set of utility functions for common tasks such as reading file buffers, escaping HTML, and creating standard UI components like panels and meta-data rows.

| Function | Purpose |
| --- | --- |
| `readArrayBuffer` | Normalizes `PreviewFile` source into an `ArrayBuffer`. |
| `readTextFile` | Extracts string content from various source types. |
| `createPanel` | Generates a `div` with the `.ofv-panel` class. |
| `resolveFormat` | Determines the file format based on extension or MIME. |

**Utility Data Flow**

```

```

Sources: [packages/core/src/plugins/utils.ts L3-L18](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/utils.ts#L3-L18)

 [packages/core/src/plugins/utils.ts L20-L35](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/utils.ts#L20-L35)

 [packages/core/src/plugins/utils.ts L37-L41](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/utils.ts#L37-L41)

 [packages/core/src/plugins/utils.ts L76-L81](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/utils.ts#L76-L81)