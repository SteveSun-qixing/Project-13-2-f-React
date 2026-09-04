# Playground & Demo System

> **Relevant source files**
> * [doc/src/api.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/api.ts)
> * [doc/src/main.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts)
> * [doc/vite.config.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/vite.config.ts)

The Playground & Demo system, primarily implemented in `doc/src/main.ts`, serves as the interactive showcase for the Open File Viewer. It demonstrates the `createViewer` lifecycle, provides real-time configuration of viewer parameters, and utilizes in-memory file generators to simulate complex Office documents without requiring external server hosting.

## Interactive Lifecycle & Viewer Management

The playground manages a singleton `FileViewer` instance. Every time a user updates settings (like theme, fit mode, or dimensions) or selects a new file, the system triggers a re-render cycle.

### Key Functions

* `renderViewer()`: The central orchestration function. It destroys the existing instance (if any) using `viewer.destroy()` and initializes a new one via `createViewer` [doc/src/main.ts L358-L418](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L358-L418)
* `createPlugins()`: A helper that instantiates the full suite of built-in plugins, including `pdfPlugin`, `officePlugin`, and `textPlugin`, while injecting the `pdfWorkerSrc` for PDF.js [doc/src/main.ts L333-L356](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L333-L356)
* `syncResponsiveViewerHeight()`: An observer-based utility that adjusts the viewer's height based on the "browser shell" container's aspect ratio or fixed inputs [doc/src/main.ts L424-L436](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L424-L436)

### Playground Data Flow

The following diagram illustrates how user interactions in the Playground UI flow into the `@open-file-viewer/core` engine.

**Playground Interaction Pipeline**

```

```

**Sources:** [doc/src/main.ts L358-L418](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L358-L418)

 [doc/src/main.ts L456-L490](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L456-L490)

## Internationalization (i18n)

The demo site features a custom, lightweight i18n system to handle English (`en`) and Chinese (`zh`) localizations.

* **Translation Dictionary**: A nested record mapping language keys to UI strings [doc/src/main.ts L49-L307](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L49-L307)
* **`applyLanguage(lang)`**: This function iterates through the DOM, finding elements with the `data-i18n` attribute. It replaces the `textContent` or `placeholder` of these elements with values from the `translations` object [doc/src/main.ts L311-L326](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L311-L326)
* **Persistence**: The selected language is stored in `localStorage` under the key `ofv-site-lang` [doc/src/main.ts L327-L328](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L327-L328)

**Sources:** [doc/src/main.ts L49-L331](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L49-L331)

## In-Memory Office Generators

To provide a "Batteries Included" demo experience without uploading sensitive user files, the playground includes several generators that create valid binary files in the browser using libraries like `JSZip`.

| Function | Output Format | Implementation Detail |
| --- | --- | --- |
| `createDocxSample` | `.docx` | Generates `word/document.xml` with namespaces and relationship files [doc/src/main.ts L511-L558](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L511-L558) |
| `createXlsxSample` | `.xlsx` | Constructs `xl/worksheets/sheet1.xml` and `xl/sharedStrings.xml` for spreadsheet testing [doc/src/main.ts L560-L638](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L560-L638) |
| `createPptxSample` | `.pptx` | Builds a minimal presentation structure including `ppt/slides/slide1.xml` [doc/src/main.ts L640-L736](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L640-L736) |
| `createZipFile` | `.zip` | Compresses a list of `ZipEntry` objects (path/content) into a Blob [doc/src/main.ts L492-L509](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L492-L509) |

**Sources:** [doc/src/main.ts L492-L736](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L492-L736)

## Code Entity Mapping

This diagram bridges the Playground's UI components to the underlying TypeScript entities and functions.

**Entity Mapping: Playground to Code**

```

```

**Sources:** [doc/src/main.ts L358-L418](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L358-L418)

 [doc/src/main.ts L511-L558](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L511-L558)

 [doc/src/main.ts L800-L850](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L800-L850)

## Build & Integration

The documentation site is built using **Vite**. The configuration includes specific aliases to ensure the playground always uses the local workspace version of the core package rather than the published npm version.

* **Aliases**: `@open-file-viewer/core` is mapped directly to `../packages/core/src/index.ts` [doc/vite.config.ts L15-L22](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/vite.config.ts#L15-L22)
* **Prism.js**: Used for syntax highlighting in the "Code" tabs of the playground. It is initialized in manual mode to allow the playground to control when highlighting occurs [doc/src/main.ts L33](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/main.ts#L33-L33)  [doc/src/api.ts L9](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/api.ts#L9-L9)

**Sources:** [doc/vite.config.ts L1-L24](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/vite.config.ts#L1-L24)

 [doc/src/api.ts L56-L65](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/doc/src/api.ts#L56-L65)