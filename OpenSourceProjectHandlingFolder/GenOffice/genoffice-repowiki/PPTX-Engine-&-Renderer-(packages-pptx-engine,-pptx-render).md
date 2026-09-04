# PPTX Engine & Renderer (packages/pptx-engine, pptx-render)

> **Relevant source files**
> * [apps/docs/src/renderer/assets/icon-translate.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/icon-translate.png)

This page details the implementation of the PowerPoint (PPTX) engine (`packages/pptx-engine`) and its associated renderer (`packages/pptx-render`). The `pptx-engine` package is responsible for parsing, generating, and scanning PPTX files, handling aspects like themes, charts, tables, SmartArt, animations, slide masters, and placeholder resolution. The `pptx-render` package focuses on rendering these parsed structures, including building slides, text layout, coordinate systems, fills, metrics, preset geometries, render tree construction, and chart rendering.

## PPTX Engine (packages/pptx-engine)

The `pptx-engine` package is a pure-TypeScript library designed to interact with the Open XML (OOXML) structure of `.pptx` files. It provides functionalities to read existing presentations, extract their components, and potentially generate new or modified presentations.

### Core Functionality

The engine's core functionality revolves around:

* **Parsing**: Deconstructing the OOXML structure into a more manageable in-memory representation.
* **Generation**: Constructing or modifying the OOXML structure for saving.
* **Scanning**: Analyzing the presentation content for specific features or properties.
* **Theme Handling**: Extracting and applying presentation themes, including colors and fonts.
* **Chart and Table Processing**: Understanding and representing chart and table data and their visual properties.
* **SmartArt**: Handling SmartArt graphics.
* **Animations**: Parsing animation definitions.
* **Slide Masters and Layouts**: Managing the hierarchical structure of slide masters and their associated layouts.
* **Placeholder Resolution**: Identifying and resolving content placeholders on slides.

### Data Flow and Key Structures

When a PPTX file is loaded, `pptx-engine` parses the various XML parts (e.g., `ppt/presentation.xml`, `ppt/slides/slide1.xml`, `ppt/slideMasters/slideMaster1.xml`, `ppt/slideLayouts/slideLayout1.xml`, `ppt/theme/theme1.xml`) into a structured data model. This model represents slides, shapes, text, images, and other presentation elements.

**Presentation Structure:**
A presentation is composed of slides, which in turn are based on slide layouts, which are derived from slide masters. This inheritance chain is crucial for resolving properties like background, fonts, and placeholder positions.

**Shapes and Placeholders:**
Shapes are fundamental building blocks. Placeholders are special types of shapes that indicate where content (text, charts, images) should be inserted. The engine resolves these placeholders, applying properties inherited from the master and layout.

**Themes:**
Themes define the overall look and feel, including color schemes (`ThemeColors`) and font schemes (`ThemeFonts`). These are applied throughout the presentation.
Sources: [apps/docs/src/renderer/doc-style-css.ts L1-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L1-L13)

### Implementation Details

The engine uses a parsing strategy to navigate the XML structure. For each relevant XML part, it extracts attributes and child elements to populate its internal data structures.

**Example: Theme Colors and Fonts**
The `docThemeCss` function in the `docs` app demonstrates how theme fonts and colors are consumed to generate CSS rules for rendering. While this example is from `docs`, the underlying `ThemeFonts` and `ThemeColors` types are defined in `@genoffice/docx-engine` [apps/docs/src/renderer/doc-style-css.ts L1](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L1-L1)

 indicating a shared approach to theme handling across document types. A similar mechanism exists in `pptx-engine` to extract and apply these theme properties.

```

```

Sources: [apps/docs/src/renderer/doc-style-css.ts L1-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L1-L13)

### Diagram: PPTX Engine Data Flow (Parsing)

```

```

Title: "PPTX Engine Parsing Data Flow"
Sources: [apps/docs/scripts/generate-corpus.ts L91-L140](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/scripts/generate-corpus.ts#L91-L140)

## PPTX Renderer (packages/pptx-render)

The `pptx-render` package takes the structured data model produced by `pptx-engine` and translates it into a visual representation suitable for display. This involves layout calculations, coordinate transformations, applying fills, and constructing a renderable tree.

### Core Functionality

* **`build-slide`**: Orchestrates the rendering of an entire slide, combining elements from the slide, its layout, and its master.
* **`text-layout`**: Handles the complex task of laying out text within bounding boxes, considering font metrics, line breaks, and text properties (bold, italic, size, color).
* **`coords`**: Manages coordinate systems and transformations, converting between OOXML's EMUs (English Metric Units) and screen pixels, and handling scaling and positioning.
* **`fill`**: Applies various types of fills (solid colors, gradients, textures, images) to shapes.
* **`metrics`**: Provides font and character metrics necessary for accurate text layout and bounding box calculations.
* **`preset-geometry`**: Renders standard shapes (rectangles, circles, arrows) based on their predefined geometries.
* **`render-tree`**: Constructs an abstract render tree, which is a hierarchical representation of all visual elements on a slide, ready to be drawn by a graphics library.
* **`build-chart`**: Renders charts based on the parsed chart data.

### Text Layout and Metrics

Accurate text layout is critical for presentations. `pptx-render` needs to:

1. **Determine Font Metrics**: Get the ascent, descent, x-height, and width of individual characters and glyphs for a given font and size.
2. **Line Breaking**: Decide where lines should break to fit within a given width, respecting word boundaries.
3. **Vertical Alignment**: Position lines vertically within a text box, considering line spacing and paragraph properties.

The `lineHeightFactor` and `cssLineHeight` functions illustrate the kind of calculations needed for precise text rendering, especially when dealing with CJK (Chinese, Japanese, Korean) characters which often have different line height requirements.
Sources: [apps/docs/src/renderer/doc-style-css.ts L2-L3](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L2-L3)

 [apps/docs/src/renderer/doc-style-css.ts L37-L53](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L37-L53)

 [apps/docs/src/renderer/doc-style-css.ts L109](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L109-L109)

### Coordinate System

OOXML uses EMUs (English Metric Units), where 914400 EMUs = 1 inch. The renderer converts these to pixels for screen display, taking into account DPI and scaling factors.

### Render Tree Construction

The `render-tree` module produces a tree structure where each node represents a visual element (a shape, a text run, an image). This tree is traversed by the graphics layer to draw the elements onto a canvas.

### Diagram: PPTX Renderer Process

```

```

Title: "PPTX Renderer Process"
Sources: [apps/docs/src/renderer/doc-style-css.ts L1-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L1-L13)

### Bridging Natural Language to Code Entities

The following diagram illustrates how the high-level concepts discussed map to specific packages and their internal modules.

```

```

Title: "Natural Language Concepts to Code Entities Mapping"
Sources: [apps/docs/src/renderer/doc-style-css.ts L1-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/doc-style-css.ts#L1-L13)