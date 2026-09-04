# Plugin Unit Tests

> **Relevant source files**
> * [packages/core/src/plugins/archive.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.test.ts)
> * [packages/core/src/plugins/cad.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.test.ts)
> * [packages/core/src/plugins/gis.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.test.ts)
> * [packages/core/src/plugins/gis.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.ts)
> * [packages/core/src/plugins/image.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.test.ts)
> * [packages/core/src/plugins/model3d.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.test.ts)
> * [packages/core/src/plugins/office.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts)
> * [packages/core/src/plugins/pdf.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.test.ts)
> * [packages/core/src/plugins/pdf.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.ts)
> * [packages/core/src/plugins/text.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.test.ts)
> * [packages/core/test-assets/pandr.zip](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/test-assets/pandr.zip)
> * [packages/core/test-assets/test.geojson](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/test-assets/test.geojson)
> * [packages/core/test-assets/test.md](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/test-assets/test.md?plain=1)

The **Open File Viewer** testing infrastructure is built on **Vitest** and **jsdom**, providing a robust environment for verifying plugin behavior, rendering accuracy, and interaction logic. Each major plugin has a corresponding `.test.ts` file that simulates file loading, DOM rendering, and user commands (zoom, rotate, etc.) to ensure stability across the monorepo.

## Overview of Testing Strategy

The test suite focuses on three primary areas:

1. **Matching Logic**: Verifying that plugins correctly claim files based on `mimeType` or `extension` [packages/core/src/plugins/gis.test.ts L163-L168](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.test.ts#L163-L168)
2. **Rendering Fidelity**: Ensuring that third-party libraries (PDF.js, Leaflet, Prism.js, etc.) are correctly initialized and that their output is correctly injected into the viewer viewport [packages/core/src/plugins/pdf.test.ts L29-L35](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.test.ts#L29-L35)
3. **Command Handling**: Validating that plugins respond to toolbar actions like `setZoom` or `rotate` by updating the DOM or internal state [packages/core/src/plugins/image.test.ts L46-L56](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.test.ts#L46-L56)

### Test Data Flow

The following diagram illustrates how a unit test orchestrates the flow from raw binary assets to a verified DOM state.

**Unit Test Execution Flow**

```

```

Sources: [packages/core/src/plugins/office.test.ts L97-L102](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts#L97-L102)

 [packages/core/src/plugins/pdf.test.ts L22-L27](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.test.ts#L22-L27)

---

## Plugin Test Implementations

### Document & Office Plugins

The `office.test.ts` and `pdf.test.ts` files use extensive mocking to simulate complex dependencies like `docx-preview`, `mammoth`, and `pdfjs-dist`.

* **PDF Testing**: Mocks `pdfjs-dist` to verify that `getDocument` is called with correct parameters (CMap URLs, worker paths) and that canvas elements are created for each page [packages/core/src/plugins/pdf.test.ts L88-L96](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.test.ts#L88-L96)
* **Office Testing**: Uses `xlsx` to generate in-memory workbooks and verifies that the viewer renders sheet tabs, formula metadata, and handles parsing failures gracefully [packages/core/src/plugins/office.test.ts L82-L116](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts#L82-L116)

### GIS & CAD Plugins

These tests focus on spatial data parsing and layer management.

* **GIS Testing**: Verifies that `gisPlugin` correctly loads Leaflet, renders GeoJSON features, and binds tooltips to map markers [packages/core/src/plugins/gis.test.ts L110-L132](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.test.ts#L110-L132)  It also checks for "helpful fallbacks," such as warning users that a raw `.shp` file requires its accompanying `.dbf` [packages/core/src/plugins/gis.test.ts L170-L188](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.test.ts#L170-L188)
* **CAD Testing**: Simulates DXF file rendering as SVG and validates that layer toggles correctly hide/show specific entities in the DOM [packages/core/src/plugins/cad.test.ts L59-L87](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.test.ts#L59-L87)

### Archive Plugin

The `archive.test.ts` file tests the recursive nature of the viewer. It creates `JSZip` instances in-memory and verifies that clicking an item in the sidebar triggers a nested rendering pipeline for the inner file [packages/core/src/plugins/archive.test.ts L13-L56](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.test.ts#L13-L56)

---

## Common Test Patterns

### Mocking Third-Party Modules

Because plugins rely on heavy external libraries, `vi.mock` is used to prevent actual network requests or heavy computations during unit tests.

| Plugin | Mocked Entity | Purpose |
| --- | --- | --- |
| `officePlugin` | `docx-preview` | Verifies DOCX rendering calls [packages/core/src/plugins/office.test.ts L41-L43](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts#L41-L43) |
| `pdfPlugin` | `pdfjs-dist` | Simulates PDF document loading [packages/core/src/plugins/pdf.test.ts L20-L21](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.test.ts#L20-L21) |
| `imagePlugin` | `heic2any` | Tests HEIC to JPEG conversion [packages/core/src/plugins/image.test.ts L5-L9](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.test.ts#L5-L9) |
| `gisPlugin` | `leaflet` | Verifies map initialization and layer addition [packages/core/src/plugins/gis.test.ts L17-L59](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.test.ts#L17-L59) |

### DOM Verification and Interaction

Tests utilize a `waitFor` utility to handle the asynchronous nature of plugin rendering.

**Command Delegation Test Pattern**

```

```

Sources: [packages/core/src/plugins/image.test.ts L17-L60](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.test.ts#L17-L60)

 [packages/core/src/plugins/pdf.test.ts L46-L100](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.test.ts#L46-L100)

---

## Test Assets

The `packages/core/test-assets` directory contains static files used for integration and smoke tests:

* `pandr.zip`: A complex Shapefile dataset (DBF, PRJ, SHP, etc.) used to test archive navigation and GIS parsing [packages/core/test-assets/pandr.zip L1-L31](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/test-assets/pandr.zip#L1-L31)
* `test.geojson`: A standard FeatureCollection with Polygon and Point data [packages/core/test-assets/test.geojson L1-L36](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/test-assets/test.geojson#L1-L36)
* `test.md`: A Markdown file used to verify Prism.js highlighting and DOMPurify sanitization [packages/core/src/plugins/text.test.ts L11-L31](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.test.ts#L11-L31)

### Sanitization Checks

The `text.test.ts` file specifically tests security constraints, ensuring that Markdown rendering strips dangerous HTML attributes like `onerror` or `<script>` tags [packages/core/src/plugins/text.test.ts L11-L31](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.test.ts#L11-L31)

Sources:

* [packages/core/src/plugins/office.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/office.test.ts)
* [packages/core/src/plugins/pdf.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/pdf.test.ts)
* [packages/core/src/plugins/image.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.test.ts)
* [packages/core/src/plugins/archive.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/archive.test.ts)
* [packages/core/src/plugins/text.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/text.test.ts)
* [packages/core/src/plugins/gis.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.test.ts)
* [packages/core/src/plugins/cad.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.test.ts)
* [packages/core/test-assets/pandr.zip](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/test-assets/pandr.zip)
* [packages/core/test-assets/test.geojson](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/test-assets/test.geojson)