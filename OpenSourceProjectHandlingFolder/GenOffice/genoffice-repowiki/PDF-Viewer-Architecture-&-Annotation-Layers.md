# PDF Viewer Architecture & Annotation Layers

> **Relevant source files**
> * [apps/docs/src/renderer/assets/file-pdf.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/file-pdf.png)
> * [apps/docs/src/renderer/assets/send-stop.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/send-stop.png)

This page provides a detailed technical overview of the PDF viewer and editor within GenOffice, focusing on its architecture and annotation capabilities. We will explore the core components in `apps/pdf/src/renderer`, including `App.tsx`, the various annotation layers (`DrawLayer`, `FormLayer`, `LinkLayer`), dialogs for stamps, signatures, and properties, and utility modules like `annotations.ts`, `stamps.ts`, `search.ts`, `print.ts`, and the `useAutosave` hook.

## Core Application Structure (App.tsx)

The `App.tsx` file [apps/pdf/src/renderer/App.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/App.tsx#L1-L1000)

 serves as the main entry point for the PDF renderer application. It orchestrates the loading, rendering, and interaction with PDF documents. It utilizes `pdf.js` for PDF rendering and `pdf-lib` for PDF manipulation, particularly for annotations.

The `App` component manages the overall state of the PDF viewer, including:

* **Document Loading**: Handles the initial loading of a PDF file, parsing it, and preparing it for display.
* **Page Rendering**: Manages the rendering of individual PDF pages, often using a virtualized list for performance with large documents.
* **Zoom and Navigation**: Implements functionality for zooming in/out and navigating between pages.
* **Tool Management**: Controls the currently active tool (e.g., hand, text selection, annotation tools).
* **Annotation State**: Maintains the state of all annotations on the document, including freehand drawings, form fields, and links.
* **Dialog Management**: Renders and manages various dialogs for user interaction, such as `StampDialog`, `SignatureDialog`, and `PropertiesDialog`.

Sources:

* [apps/pdf/src/renderer/App.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/App.tsx#L1-L1000)

## Annotation Layers

The PDF viewer supports multiple layers for different types of annotations, allowing users to interact with the document in various ways. These layers are typically rendered on top of the base PDF content.

### DrawLayer (Freehand Ink)

The `DrawLayer` component [apps/pdf/src/renderer/components/DrawLayer.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/DrawLayer.tsx#L1-L1000)

 enables freehand drawing and highlighting on the PDF document. It's designed to be a transparent overlay that captures pointer events for drawing.

**Implementation Details**:

* **`InkOverlayProps`**: Defines the properties passed to the `DrawLayer`, including the active `tool` (pen, highlighter, eraser), `color`, `width`, `zoom` level, existing `annotations`, and callbacks for `onAdd` and `onRemove` annotations [apps/docs/src/renderer/components/InkOverlay.tsx L25-L34](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L25-L34)
* **Coordinate System**: Strokes are stored at 100% zoom, and pointer coordinates are divided by the current zoom factor to ensure consistent geometry regardless of the display zoom [apps/docs/src/renderer/components/InkOverlay.tsx L14-L18](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L14-L18)
* **Anchoring**: In the `docs` application, strokes are anchored to the nearest body paragraph using `data-idx` attributes. This ensures that strokes move with their associated content during reflows [apps/docs/src/renderer/components/InkOverlay.tsx L19-L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L19-L22)  The `measureAnchors` function [apps/docs/src/renderer/components/InkOverlay.tsx L41-L55](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L41-L55)  identifies the top-left positions of these anchor points. `pickAnchor` [apps/docs/src/renderer/components/InkOverlay.tsx L58-L77](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L58-L77)  determines the appropriate anchor for a new stroke.
* **Drawing Logic**: * `onPointerDown` [apps/docs/src/renderer/components/InkOverlay.tsx L138-L151](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L138-L151)  initiates a drawing or erasing action. * `onPointerMove` [apps/docs/src/renderer/components/InkOverlay.tsx L153-L165](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L153-L165)  continuously records points for the stroke or performs erasing. * `onPointerUp` [apps/docs/src/renderer/components/InkOverlay.tsx L167-L183](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L167-L183)  finalizes the stroke, calculates its anchor, and adds it to the annotations.
* **Eraser**: The eraser tool uses `strokeHitTest` [apps/docs/src/renderer/editor/ink.ts L154-L162](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L154-L162)  to detect and remove strokes within a certain `ERASER_RADIUS` [apps/docs/src/renderer/components/InkOverlay.tsx L39](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L39-L39)
* **SVG Rendering**: Strokes are rendered as SVG `<path>` elements using `strokePathD` [apps/docs/src/renderer/editor/ink.ts L165-L172](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L165-L172)  for efficient and scalable display.
* **`InkAnnotation` Structure**: An `InkAnnotation` can contain either a `stroke` (editable vector points) or an `image` (for annotations restored from a document without a readable payload) [apps/docs/src/renderer/editor/ink.ts L37-L49](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L37-L49)
* **Serialization**: `encodeInkPayload` [apps/docs/src/renderer/editor/ink.ts L58-L66](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L58-L66)  and `decodeInkPayload` [apps/docs/src/renderer/editor/ink.ts L69-L90](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L69-L90)  handle the serialization and deserialization of ink strokes to/from a JSON payload, which is stored in the `wp:docPr descr` attribute for round-trip editing.
* **Rasterization**: For saving, vector strokes are rasterized into transparent PNG images using `rasterizeStroke` [apps/docs/src/renderer/editor/ink.ts L188-L215](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L188-L215)  to be embedded in the document.

```

```

**Diagram: DrawLayer Component Flow**

Sources:

* [apps/docs/src/renderer/components/InkOverlay.tsx L14-L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L14-L22)
* [apps/docs/src/renderer/components/InkOverlay.tsx L25-L34](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L25-L34)
* [apps/docs/src/renderer/components/InkOverlay.tsx L39](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L39-L39)
* [apps/docs/src/renderer/components/InkOverlay.tsx L41-L55](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L41-L55)
* [apps/docs/src/renderer/components/InkOverlay.tsx L58-L77](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L58-L77)
* [apps/docs/src/renderer/components/InkOverlay.tsx L138-L151](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L138-L151)
* [apps/docs/src/renderer/components/InkOverlay.tsx L153-L165](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L153-L165)
* [apps/docs/src/renderer/components/InkOverlay.tsx L167-L183](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/components/InkOverlay.tsx#L167-L183)
* [apps/pdf/src/renderer/components/DrawLayer.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/DrawLayer.tsx#L1-L1000)
* [apps/docs/src/renderer/editor/ink.ts L37-L49](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L37-L49)
* [apps/docs/src/renderer/editor/ink.ts L58-L66](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L58-L66)
* [apps/docs/src/renderer/editor/ink.ts L69-L90](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L69-L90)
* [apps/docs/src/renderer/editor/ink.ts L154-L162](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L154-L162)
* [apps/docs/src/renderer/editor/ink.ts L165-L172](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L165-L172)
* [apps/docs/src/renderer/editor/ink.ts L188-L215](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L188-L215)

### FormLayer (Form Fields)

The `FormLayer` component [apps/pdf/src/renderer/components/FormLayer.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/FormLayer.tsx#L1-L1000)

 is responsible for rendering and managing interactive PDF form fields (AcroForm fields). It allows users to fill out text fields, select radio buttons, check checkboxes, and interact with dropdowns.

**Implementation Details**:

* **Field Rendering**: It iterates through the form fields extracted from the PDF and renders appropriate HTML input elements (e.g., `<input type="text">`, `<input type="checkbox">`, `<select>`) overlaid on the PDF content.
* **State Management**: Manages the values of the form fields and updates the underlying PDF document model when a user interacts with them.
* **Event Handling**: Captures input events from the form fields and propagates changes to the application state.
* **`pdf-lib` Integration**: Likely uses `pdf-lib` to read existing form fields and to update their values when changes are made by the user.

Sources:

* [apps/pdf/src/renderer/components/FormLayer.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/FormLayer.tsx#L1-L1000)

### LinkLayer (Hyperlinks)

The `LinkLayer` component [apps/pdf/src/renderer/components/LinkLayer.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/LinkLayer.tsx#L1-L1000)

 handles the display and interaction of hyperlinks within the PDF document. These can be internal links (to other pages within the PDF) or external URLs.

**Implementation Details**:

* **Link Extraction**: Extracts link annotations (e.g., `LinkAnnotationObject`) from the PDF document.
* **Overlay Elements**: Renders transparent overlay elements (e.g., `<a>` tags or `<div>`s with click handlers) at the positions of the links.
* **Navigation**: * For external links, it uses `window.open` or a secure IPC channel (`safeExternalUrl`) to open the URL in the system's default browser. * For internal links, it triggers navigation within the PDF viewer to the specified page or destination.

Sources:

* [apps/pdf/src/renderer/components/LinkLayer.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/LinkLayer.tsx#L1-L1000)

## Dialogs

The PDF viewer includes several dialogs for specific user interactions.

### StampDialog

The `StampDialog` component [apps/pdf/src/renderer/components/StampDialog.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/StampDialog.tsx#L1-L1000)

 provides an interface for users to select and apply predefined or custom stamps to the PDF document.

**Implementation Details**:

* **Stamp Selection**: Displays a gallery of available stamps (e.g., "Approved", "Draft", custom images).
* **Placement**: Allows users to click on the PDF to place the selected stamp.
* **Custom Stamps**: May support uploading custom image files to be used as stamps.
* **`stamps.ts` Integration**: Relies on the `stamps.ts` utility module for managing stamp data and rendering.

Sources:

* [apps/pdf/src/renderer/components/StampDialog.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/StampDialog.tsx#L1-L1000)

### SignatureDialog

The `SignatureDialog` component [apps/pdf/src/renderer/components/SignatureDialog.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/SignatureDialog.tsx#L1-L1000)

 facilitates the process of adding digital or drawn signatures to the PDF.

**Implementation Details**:

* **Signature Input**: Offers options for creating a signature, such as: * Drawing a signature using a mouse or stylus. * Typing a signature (and applying a signature-like font). * Uploading an image of a signature.
* **Placement**: Allows users to position and resize the signature on the document.
* **Persistence**: Stores the created signature for future use.

Sources:

* [apps/pdf/src/renderer/components/SignatureDialog.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/SignatureDialog.tsx#L1-L1000)

### PropertiesDialog

The `PropertiesDialog` component [apps/pdf/src/renderer/components/PropertiesDialog.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/PropertiesDialog.tsx#L1-L1000)

 displays and allows editing of the PDF document's metadata and properties.

**Implementation Details**:

* **Metadata Display**: Shows information like title, author, subject, keywords, creation date, and modification date.
* **Editing**: Provides input fields for users to modify editable properties.
* **`pdf-lib` Integration**: Uses `pdf-lib` to read and update the document's info dictionary.

Sources:

* [apps/pdf/src/renderer/components/PropertiesDialog.tsx L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/components/PropertiesDialog.tsx#L1-L1000)

## Utility Modules

### annotations.ts

The `annotations.ts` module [apps/pdf/src/renderer/annotations.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/annotations.ts#L1-L1000)

 likely contains functions and types related to managing various annotation types within the PDF viewer.

**Key Responsibilities**:

* **Annotation Data Structures**: Defines interfaces and types for different annotation objects (e.g., text annotations, highlight annotations, freehand annotations).
* **Serialization/Deserialization**: Provides utilities to convert annotation data to and from a format suitable for storage or `pdf-lib` manipulation.
* **Annotation Management**: Functions for adding, removing, updating, and querying annotations.
* **Rendering Logic**: May contain helper functions for determining how annotations should be rendered on the canvas or as HTML overlays.

Sources:

* [apps/pdf/src/renderer/annotations.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/annotations.ts#L1-L1000)

### stamps.ts

The `stamps.ts` module [apps/pdf/src/renderer/stamps.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/stamps.ts#L1-L1000)

 manages the collection of available stamps and their properties.

**Key Responsibilities**:

* **Predefined Stamps**: Defines a list of standard stamps (e.g., "Approved", "Confidential").
* **Custom Stamp Storage**: Handles the storage and retrieval of user-defined custom stamps.
* **Stamp Rendering**: Provides data or functions to render stamp previews in the `StampDialog` and the actual stamp image on the PDF.
* **Image Processing**: May include utilities for resizing or converting stamp images.

Sources:

* [apps/pdf/src/renderer/stamps.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/stamps.ts#L1-L1000)

### search.ts

The `search.ts` module [apps/pdf/src/renderer/search.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/search.ts#L1-L1000)

 implements the text search functionality within the PDF document.

**Key Responsibilities**:

* **Text Extraction**: Utilizes `pdf.js` to extract text content from PDF pages.
* **Search Algorithm**: Implements a search algorithm to find occurrences of a given query string.
* **Highlighting**: Provides functionality to highlight search results on the rendered PDF pages.
* **Navigation**: Enables navigation between search results.

Sources:

* [apps/pdf/src/renderer/search.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/search.ts#L1-L1000)

### print.ts

The `print.ts` module [apps/pdf/src/renderer/print.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/print.ts#L1-L1000)

 handles the printing functionality for the PDF document.

**Key Responsibilities**:

* **Print Preparation**: Prepares the PDF document for printing, potentially flattening annotations or adjusting page scaling.
* **Print Dialog Integration**: Interacts with the browser's or Electron's print dialog.
* **Page Range/Options**: Manages print options such as page range, orientation, and scaling.

Sources:

* [apps/pdf/src/renderer/print.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/print.ts#L1-L1000)

### useAutosave Hook

The `useAutosave` hook [apps/pdf/src/renderer/hooks.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/hooks.ts#L1-L1000)

 provides automatic saving capabilities for the PDF document, ensuring that user changes are periodically persisted.

**Implementation Details**:

* **Debouncing**: Typically uses a debouncing mechanism to avoid saving too frequently, triggering a save operation only after a period of inactivity.
* **Change Detection**: Monitors changes to the PDF document's state (e.g., added annotations, form field updates).
* **IPC Communication**: Communicates with the Electron main process via IPC to perform the actual file saving operation, ensuring file system access is handled securely.
* **Error Handling**: Includes logic to handle potential errors during the autosave process.

```

```

**Diagram: `useAutosave` Hook Flow**

Sources:

* [apps/pdf/src/renderer/hooks.ts L1-L1000](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/pdf/src/renderer/hooks.ts#L1-L1000)