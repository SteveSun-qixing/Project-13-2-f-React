# Engineering & Specialized Plugins

> **Relevant source files**
> * [packages/core/src/plugins/asset.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.test.ts)
> * [packages/core/src/plugins/asset.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.ts)
> * [packages/core/src/plugins/cad.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.test.ts)
> * [packages/core/src/plugins/cad.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.ts)
> * [packages/core/src/plugins/drawing.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/drawing.ts)
> * [packages/core/src/plugins/gis.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.test.ts)
> * [packages/core/src/plugins/gis.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.ts)
> * [packages/core/src/plugins/image.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/image.test.ts)
> * [packages/core/src/plugins/model3d.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.test.ts)
> * [packages/core/src/plugins/model3d.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.ts)
> * [packages/core/src/plugins/ofd.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/ofd.ts)

This page covers the implementation and technical details of specialized plugins within the Open File Viewer ecosystem. These plugins handle complex data types including Engineering (CAD), 3D Models, Geographic Information Systems (GIS), Vector Drawings, and various Binary Assets.

## 1. Engineering (CAD) Plugin

The `cadPlugin` provides structural inspection and rendering for engineering drawing formats. It distinguishes between vector-based formats like DXF (which are rendered directly as SVG) and binary or complex formats (DWG, STEP, IGES, IFC) which receive structural summaries and conversion guidance.

### Implementation Details

* **DXF Rendering**: Parses text-based DXF files to extract entities (LINE, CIRCLE, ARC, TEXT, POLYLINE, etc.) and maps them to SVG elements. It supports layer management, allowing users to toggle visibility of specific drawing layers [packages/core/src/plugins/cad.ts L96-L108](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.ts#L96-L108)
* **Structural Summaries**: For formats like STEP and IFC, the plugin parses the file to count entities and identify key BIM/CAD structures (e.g., `IFCPROJECT`, `CARTESIAN_POINT`) [packages/core/src/plugins/cad.ts L113-L197](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.ts#L113-L197)
* **Binary Probing**: For DWG files, it performs a signature check to identify the AutoCAD version (e.g., `AC1027` for AutoCAD 2013) and probes for keyword clues like layers and external references [packages/core/src/plugins/cad.ts L210-L244](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.ts#L210-L244)

### CAD Data Flow

The following diagram illustrates how the `cadPlugin` processes different engineering formats.

**CAD Plugin Logic Flow**

```

```

Sources: [packages/core/src/plugins/cad.ts L62-L111](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.ts#L62-L111)

 [packages/core/src/plugins/cad.ts L210-L217](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/cad.ts#L210-L217)

---

## 2. 3D Model Plugin

The `model3dPlugin` utilizes **Three.js** to provide an interactive 3D viewing experience for formats including GLB, GLTF, OBJ, STL, FBX, and more.

### Key Components

* **Scene Setup**: Initializes a `THREE.Scene` with a neutral background, `HemisphereLight`, and `DirectionalLight` [packages/core/src/plugins/model3d.ts L75-L101](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.ts#L75-L101)
* **OrbitControls**: Integrates `OrbitControls` for intuitive rotation, panning, and zooming [packages/core/src/plugins/model3d.ts L94-L96](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.ts#L94-L96)
* **Auto-Framing**: Uses `frameObject` to calculate the bounding box of the loaded model and position the camera so the entire model is visible [packages/core/src/plugins/model3d.ts L119](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.ts#L119-L119)
* **Measurement & Stats**: Includes a measurement panel showing the model's physical dimensions (X, Y, Z) and a material panel detailing mesh and texture counts [packages/core/src/plugins/model3d.ts L120-L122](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.ts#L120-L122)

### Command Integration

The plugin implements the `PreviewInstance` interface to delegate toolbar commands (zoom, rotate) directly to the Three.js camera and object [packages/core/src/plugins/model3d.ts L147-L181](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.ts#L147-L181)

Sources: [packages/core/src/plugins/model3d.ts L56-L145](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.ts#L56-L145)

 [packages/core/src/plugins/model3d.ts L1110-L1122](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/model3d.ts#L1110-L1122)

---

## 3. GIS Plugin

The `gisPlugin` renders geographic data using **Leaflet**. It supports GeoJSON, TopoJSON, KML, GPX, and Shapefile (SHP).

### Processing Pipeline

1. **Format Conversion**: Uses dynamic imports (`@mapbox/togeojson`, `topojson-client`, `shpjs`) to normalize various inputs into a standard GeoJSON format [packages/core/src/plugins/gis.ts L49-L61](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.ts#L49-L61)
2. **Map Initialization**: Injects Leaflet CSS and creates a map instance with OpenStreetMap tiles [packages/core/src/plugins/gis.ts L131-L151](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.ts#L131-L151)
3. **Feature Rendering**: Maps GeoJSON features to Leaflet layers. Points are rendered as `circleMarker` with custom styling [packages/core/src/plugins/gis.ts L154-L175](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.ts#L154-L175)
4. **Interactivity**: Binds tooltips to features based on properties like `name` or `title` and implements hover highlights [packages/core/src/plugins/gis.ts L176-L197](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.ts#L176-L197)

### Specialized Handling: Shapefiles

The plugin includes a specific check for `.shp` files. Since Shapefiles require sidecar files (.dbf, .shx), the plugin displays a fallback message advising the user to upload a `.zip` containing the full set [packages/core/src/plugins/gis.ts L108-L129](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.ts#L108-L129)

Sources: [packages/core/src/plugins/gis.ts L39-L106](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.ts#L39-L106)

 [packages/core/src/plugins/gis.ts L154-L184](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/gis.ts#L154-L184)

---

## 4. Drawing Plugin

The `drawingPlugin` handles vector drawing formats from popular web-based tools: **draw.io (Diagrams.net)**, **Excalidraw**, and **tldraw**.

### Implementation Strategy

Instead of embedding heavy third-party editors, the plugin implements lightweight "summary + preview" logic:

* **Excalidraw**: Parses the JSON to extract elements and renders them into an SVG stage [packages/core/src/plugins/drawing.ts L169-L215](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/drawing.ts#L169-L215)
* **draw.io**: Handles compressed XML (using `pako` for inflation) and extracts shapes and connections [packages/core/src/plugins/drawing.ts L30-L31](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/drawing.ts#L30-L31)
* **Summary Panel**: Generates an `ofv-drawing-summary` containing object counts, type distributions, and coordinate bounds [packages/core/src/plugins/drawing.ts L60-L77](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/drawing.ts#L60-L77)

Sources: [packages/core/src/plugins/drawing.ts L13-L46](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/drawing.ts#L13-L46)

 [packages/core/src/plugins/drawing.ts L169-L180](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/drawing.ts#L169-L180)

---

## 5. Asset Plugin

The `assetPlugin` acts as a specialized binary inspector for files that are typically considered "assets" or "data containers."

### Supported Sub-systems

| Asset Category | Format Support | Implementation Detail |
| --- | --- | --- |
| **Fonts** | TTF, OTF, WOFF, WOFF2, EOT | Uses `FontFace` API for live samples; parses `sfnt` tables for metadata [packages/core/src/plugins/asset.ts L163-L206](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.ts#L163-L206) |
| **Databases** | SQLite (.db, .sqlite) | Parses the SQLite header to extract page size, encoding, and `sqlite_schema` [packages/core/src/plugins/asset.ts L84-L86](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.ts#L84-L86) |
| **WASM** | .wasm | Inspects section headers (Imports, Exports, Custom sections) [packages/core/src/plugins/asset.ts L78-L80](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.ts#L78-L80) |
| **Big Data** | Parquet, Avro | Extracts schema information and container metadata [packages/core/src/plugins/asset.ts L87-L92](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.ts#L87-L92) |
| **Design** | PSD, PSB, AI, EPS | Extracts canvas dimensions, color modes, and DSC (Document Structuring Conventions) headers [packages/core/src/plugins/asset.ts L81-L83](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.ts#L81-L83) |

### Binary Inspection Flow

The `assetPlugin` provides a universal `createHexPreview` as a fallback, ensuring users can always see the raw file signature [packages/core/src/plugins/asset.ts L99-L102](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.ts#L99-L102)

**Asset Inspection Architecture**

```

```

Sources: [packages/core/src/plugins/asset.ts L43-L113](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.ts#L43-L113)

 [packages/core/src/plugins/asset.ts L163-L181](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/asset.ts#L163-L181)