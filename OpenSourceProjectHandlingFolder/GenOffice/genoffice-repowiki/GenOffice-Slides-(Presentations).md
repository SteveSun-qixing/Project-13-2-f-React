# GenOffice Slides (Presentations)

> **Relevant source files**
> * [apps/docs/src/renderer/assets/icon-editor.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/icon-editor.png)

GenOffice Slides (`apps/slides`) is the presentation editor within the GenOffice suite, designed to handle `.pptx` files. It features an in-house parsing, rendering, and editing engine, supporting advanced functionalities like slide masters, charts, image cropping, ink annotations, HarfBuzz text shaping for precise typography, and AI-driven layout scripting. This page provides a high-level overview of the Slides application and its core components, with links to child pages for detailed technical explanations.

## PPTX Engine & Renderer

The core of GenOffice Slides' presentation processing capabilities resides in two key packages: `packages/pptx-engine` and `packages/pptx-render`.

`packages/pptx-engine` is responsible for the foundational aspects of `.pptx` file handling. This includes parsing the OOXML structure of a presentation, generating new `.pptx` content, scanning for specific elements, and managing themes, charts, tables, SmartArt, and animations. It also handles the complex logic of slide masters and placeholder resolution, ensuring that content is correctly inherited and positioned according to the presentation's design.

`packages/pptx-render` focuses on the visual representation of presentation content. It provides functionalities for building individual slides, performing advanced text layout using HarfBuzz, managing coordinate systems, applying fills, calculating metrics, rendering preset geometries, constructing a render tree, and building charts. This separation allows for a robust and efficient rendering pipeline that can accurately display complex presentation elements.

For a detailed exploration of these engines, including their internal mechanisms for parsing, rendering, and managing presentation components, refer to **[PPTX Engine & Renderer (packages/pptx-engine, pptx-render)](/genspark-ai/genoffice/5.1-pptx-engine-and-renderer-(packagespptx-engine-pptx-render))**.

**Sources:**

* `packages/pptx-engine`
* `packages/pptx-render`

## Slides Renderer UI & AI Layout Scripting

The user interface for GenOffice Slides is implemented within `apps/slides/src/renderer`. This directory contains the React components and logic that bring the presentation editor to life. Key components include `SlideCanvas` for displaying and interacting with slides, `NodeBody` and `ChartBody` for rendering specific content types, and specialized overlays like `CropOverlay` for image manipulation, `InkOverlay` for digital ink annotations, and `TextEditOverlay` for in-place text editing. The `MasterView` component allows users to edit slide masters, defining the overall look and feel of their presentations.

Beyond standard editing features, GenOffice Slides incorporates AI layout scripting. This system allows for intelligent arrangement and optimization of slide content. The AI functionality is powered by a sandboxed interpreter, with core logic defined in `layout-script-interpreter.ts`, `layout-script.ts`, and `layout-audit.ts`. This enables the application to suggest or automatically apply layout improvements, enhancing the visual appeal and clarity of presentations.

One example of a shared utility that might be used in the UI for image manipulation, such as cropping or background removal, is found in `apps/docs/src/renderer/cutout.ts`. This module provides pure functions for image cutout algorithms, which are shared with `apps/slides/src/renderer/cutout.ts` to ensure consistent behavior across applications. The `removeBackground` function [apps/docs/src/renderer/cutout.ts L116-L178](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/cutout.ts#L116-L178)

 uses a flood fill algorithm to make pixels transparent based on color tolerance.

For an in-depth look at the UI components, interaction models, and the architecture of the AI layout scripting engine, see **[Slides Renderer UI & AI Layout Scripting](/genspark-ai/genoffice/5.2-slides-renderer-ui-and-ai-layout-scripting)**.

**Sources:**

* `apps/slides/src/renderer`
* [apps/docs/src/renderer/cutout.ts L1-L179](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/cutout.ts#L1-L179)

### Slides Renderer UI Component Diagram

```

```

**Sources:**

* `apps/slides/src/renderer`
* [apps/docs/src/renderer/cutout.ts L116-L178](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/cutout.ts#L116-L178)

### AI Layout Scripting Flow

```

```

**Sources:**

* `apps/slides/src/renderer/layout-script-interpreter.ts`
* `apps/slides/src/renderer/layout-script.ts`
* `apps/slides/src/renderer/layout-audit.ts`