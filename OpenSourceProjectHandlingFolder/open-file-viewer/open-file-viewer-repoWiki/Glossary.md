# Glossary

> **Relevant source files**
> * [README.md](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/README.md?plain=1)
> * [packages/core/src/detect.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/detect.ts)
> * [packages/core/src/plugins/office.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.ts)
> * [packages/core/src/plugins/pdf.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.test.ts)
> * [packages/core/src/plugins/pdf.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts)
> * [packages/core/src/style.css](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/style.css)
> * [packages/core/src/types.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/types.ts)
> * [packages/core/src/viewer.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/viewer.test.ts)
> * [packages/core/src/viewer.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/viewer.ts)

This glossary defines technical terms, abbreviations, CSS class names, and domain concepts used within the Open File Viewer codebase. It serves as a reference for onboarding engineers to understand the implementation details and data flow across the monorepo.

## Core System Terms

| Term | Definition | Code Pointer |
| --- | --- | --- |
| **PreviewSource** | The raw input for a file, which can be a `File`, `Blob`, `string` (URL), or `ArrayBuffer`. | `packages/core/src/types.ts:1-1` |
| **PreviewFile** | A normalized object containing the source, filename, extension, and MIME type used throughout the plugin pipeline. | `packages/core/src/types.ts:27-35` |
| **PreviewPlugin** | A contract defining how a file is matched and rendered. Consists of a `name`, a `match` function, and a `render` function. | `packages/core/src/types.ts:137-141` |
| **PreviewInstance** | The object returned by a plugin's `render` function, providing hooks for `resize`, `command` handling, and `destroy` cleanup. | `packages/core/src/types.ts:128-133` |
| **PreviewContext** | The state provided to plugins during rendering, including the `viewport` DOM element, file metadata, and toolbar controllers. | `packages/core/src/types.ts:117-126` |
| **PreviewCommand** | Standardized actions dispatched from the toolbar to the active plugin instance (e.g., `zoom-in`, `rotate-right`). | `packages/core/src/types.ts:135-135` |

**Sources:** `packages/core/src/types.ts:1-152`

## CSS Design System (BEM-ish)

The viewer uses a `.ofv-` prefix for all structural and component classes to avoid global namespace collisions.

### Structural Classes

* `.ofv-root`: The top-level container that holds the entire viewer. It defines CSS variables for themes. `packages/core/src/style.css:1-22`
* `.ofv-host`: A relative-positioned wrapper inside the root that manages the flex layout of the toolbar and viewport. `packages/core/src/style.css:45-55`
* `.ofv-viewport`: The main rendering area where plugin-generated content is injected. `packages/core/src/style.css:57-68`
* `.ofv-toolbar`: The container for navigation and action buttons. `packages/core/src/style.css:70-82`

### State & Feedback Classes

* `.ofv-status`: An absolute-positioned overlay used for "Loading..." or error messages. `packages/core/src/style.css:203-214`
* `.ofv-theme-dark`: Applied to `.ofv-root` to override CSS variables for dark mode. `packages/core/src/style.css:24-33`
* `.ofv-center`: A utility class to flex-center content within the viewport. `packages/core/src/style.css:197-201`

**Sources:** `packages/core/src/style.css:1-342`

## Code Entity Mapping: Data Normalization

The following diagram shows how raw user input is transformed into internal entities before reaching the plugin rendering stage.

### Input to Render Flow

```

```

**Sources:** `packages/core/src/viewer.ts:19-138`, `packages/core/src/types.ts:27-141`

## Domain Concepts

### Extension Matching

The system uses a hardcoded `extensionMimeMap` to resolve MIME types when only a filename or URL is provided. This is critical for plugins that rely on `file.mimeType` in their `match()` logic.

* **File:** `packages/core/src/detect.ts:3-230`

### Office Rendering Strategies

The `officePlugin` handles a wide variety of formats using specific sub-renderers:

* **renderDocx**: Uses `docx-preview` for `.docx` files. `packages/core/src/plugins/office.ts:128-128`
* **renderSheet**: Uses `xlsx` (SheetJS) to render spreadsheets in a windowed table. `packages/core/src/plugins/office.ts:140-140`
* **Legacy Binary**: For `.doc` or `.xls`, the system attempts text extraction or package sniffing. `packages/core/src/plugins/office.ts:147-148`

### PDF Virtualization

The `pdfPlugin` implements an `IntersectionObserver` pattern to render pages only when they enter the viewport, minimizing memory usage for large documents.

* **Implementation:** `packages/core/src/plugins/pdf.ts:97-127`
* **Text Layer:** Generates a transparent `ofv-pdf-text-layer` on top of the canvas for text selection. `packages/core/src/plugins/pdf.ts:171-190`

### Lifecycle Orchestration

The `createViewer` function manages the `renderToken` to prevent race conditions during rapid file switching.

```

```

**Sources:** `packages/core/src/viewer.ts:93-138`, `packages/core/src/plugins/office.ts:109-161`, `packages/core/src/plugins/pdf.ts:27-170`