# Slides Renderer UI & AI Layout Scripting

> **Relevant source files**
> * [apps/docs/src/renderer/ai/continuation.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/continuation.ts)

This page details the client-side rendering components and the AI layout scripting capabilities within the `apps/slides/src/renderer` directory. It covers core UI elements like `SlideCanvas`, `NodeBody`, and various overlays, as well as the action modules that enable user interaction. A significant focus is placed on the AI layout-script sandboxed interpreter, explaining its design, security model, and functionality.

## Core UI Components

The `apps/slides/src/renderer` directory houses the React components responsible for rendering slides and handling user interactions.

### SlideCanvas

The `SlideCanvas` component is the primary rendering surface for a slide. It orchestrates the display of all slide elements, including shapes, text, images, and charts. It manages the coordinate system and scaling, ensuring elements are rendered correctly regardless of zoom level.

Sources: `apps/slides/src/renderer/SlideCanvas.tsx`

### NodeBody

`NodeBody` is a generic component responsible for rendering the content of a slide node. This could be text, an image, or a shape. It acts as a container and applies styling and positioning based on the node's properties.

Sources: `apps/slides/src/renderer/NodeBody.tsx`

### ChartBody

The `ChartBody` component specifically handles the rendering of chart elements within a slide. It leverages the `pptx-render` package to interpret chart data and draw the visual representation.

Sources: `apps/slides/src/renderer/ChartBody.tsx`

### Overlays

Several overlay components provide interactive features and visual feedback on top of the `SlideCanvas`.

#### CropOverlay

The `CropOverlay` allows users to interactively crop images. It provides visual handles and feedback during the cropping process.

Sources: `apps/slides/src/renderer/CropOverlay.tsx`

#### InkOverlay

The `InkOverlay` enables freehand drawing and annotation on slides. It captures user input (mouse or touch) to create strokes and renders them on a transparent layer. The underlying implementation for ink strokes and their rasterization is shared with `apps/docs/src/renderer/editor/ink.ts` [apps/docs/src/renderer/editor/ink.ts L1-L215](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/editor/ink.ts#L1-L215)

 The `removeBackground` function, used for image cutout, is also shared with `apps/docs/src/renderer/cutout.ts` [apps/docs/src/renderer/cutout.ts L1-L178](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/cutout.ts#L1-L178)

Sources:

* `apps/slides/src/renderer/InkOverlay.tsx`
* `apps/docs/src/renderer/editor/ink.ts`
* `apps/docs/src/renderer/cutout.ts`

#### TextEditOverlay

The `TextEditOverlay` provides an editable text area when a text box is selected, allowing users to modify text content directly on the slide.

Sources: `apps/slides/src/renderer/TextEditOverlay.tsx`

### MasterView

The `MasterView` component is responsible for displaying and editing slide masters. Slide masters define the default layout and styling for slides, ensuring consistency across a presentation.

Sources: `apps/slides/src/renderer/MasterView.tsx`

## Action Modules

The `apps/slides/src/renderer/actions` directory contains various modules that encapsulate specific functionalities and user interactions. These modules typically expose functions that modify the slide state or trigger specific operations.

### Arrange Actions

The `arrange` module handles operations related to the arrangement of slide elements, such as bringing elements to the front, sending them to the back, aligning, and distributing.

Sources: `apps/slides/src/renderer/actions/arrange.ts`

### Animation Actions

The `animation` module manages the application and modification of animations to slide elements.

Sources: `apps/slides/src/renderer/actions/animation.ts`

### Table Actions

The `table` module provides functionalities for inserting, editing, and formatting tables on slides.

Sources: `apps/slides/src/renderer/actions/table.ts`

### Style Actions

The `style` module deals with applying and managing styles for various slide elements, including colors, fonts, and effects.

Sources: `apps/slides/src/renderer/actions/style.ts`

### Insert Actions

The `insert` module handles the insertion of new elements onto a slide, such as text boxes, images, shapes, and charts.

Sources: `apps/slides/src/renderer/actions/insert.ts`

### Clipboard Actions

The `clipboard` module manages copy, cut, and paste operations for slide elements.

Sources: `apps/slides/src/renderer/actions/clipboard.ts`

## AI Layout Scripting

The GenOffice Slides application incorporates an AI-powered layout scripting feature that allows the AI to adjust slide layouts. This is achieved through a sandboxed interpreter designed for security and controlled execution.

### AI Layout Scripting Architecture

The AI layout scripting system involves three key files: `layout-script-interpreter.ts`, `layout-script.ts`, and `layout-audit.ts`.

```

```

**Diagram: AI Layout Scripting Flow**

Sources:

* `apps/slides/src/renderer/ai/layout-script-interpreter.ts`
* `apps/slides/src/renderer/ai/layout-script.ts`
* `apps/slides/src/renderer/ai/layout-audit.ts`
* `SECURITY.md:25-66`

### layout-script-interpreter.ts

This file contains the core of the sandboxed interpreter. It parses AI-generated scripts using Acorn and evaluates them within a highly constrained environment. The interpreter is designed to prevent malicious scripts from accessing sensitive renderer capabilities.

**Security Model:**
The interpreter's security model is critical. It operates under strict limitations to ensure that AI-generated scripts cannot compromise the application or user data. Key aspects include:

* **No `eval` or `Function`:** Scripts are not passed to `eval`, `Function`, a VM context, a worker, or the JavaScript engine as executable source [SECURITY.md L29-L32](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L29-L32)
* **Constrained Lexical Scope:** Identifiers resolve only within interpreter-owned lexical scopes, seeded with documented data and callables. There are no ambient globals, module loaders, DOM, network, IPC bridge, timers, process APIs, or dynamic code primitives [SECURITY.md L41-L43](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L41-L43)
* **Property Access Control:** Property reads are dispatched by value type. Data objects expose only their own JSON fields. Arrays, strings, and regular expressions expose a small allowlist of methods. Host prototypes and function properties are never traversed [SECURITY.md L44-L48](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L44-L48)
* **Function Call Restrictions:** Calls accept only interpreter-created functions or explicit built-ins. Host functions obtained through a constructor/prototype chain cannot be represented [SECURITY.md L49-L51](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L49-L51)
* **Data Sanitization:** Inputs and values crossing into edit primitives are recursively copied as JSON-like, prototype-free data [SECURITY.md L52-L53](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L52-L53)
* **Resource Limits:** Execution has statement/expression and call-depth limits to bound runaway loops or recursion [SECURITY.md L57-L58](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L57-L58)
* **Error Handling:** Errors discard all buffered operations [SECURITY.md L53-L54](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L53-L54)

**Capabilities:**
By design, the script can:

* Read prototype-free JSON copies of `els` (elements) and `canvas` properties.
* Perform bounded arithmetic and control flow.
* Use explicitly implemented string, array, regular expression, and `Math` helpers.
* Call specific allowed functions like `setBox`, `moveBy`, `resizeBy`, `setText`, `setStyle`, `setFill`, `setStroke`, and `log` [SECURITY.md L36-L38](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L36-L38)
* Every edit primitive validates its arguments (e.g., element existence, read-only flags, finite numbers, hex colors) and writes only into an operation buffer. This buffer is then applied through the same command pipeline as manual user edits [SECURITY.md L38-L40](https://github.com/genspark-ai/genoffice/blob/d5558b6b/SECURITY.md?plain=1#L38-L40)

Sources:

* `apps/slides/src/renderer/ai/layout-script-interpreter.ts`
* `SECURITY.md:25-66`

### layout-script.ts

This file defines the structure and available functions that the AI model can use to generate layout scripts. It acts as the interface between the AI's intent and the interpreter's capabilities. It essentially provides the "API" for the AI to interact with the slide layout.

Sources: `apps/slides/src/renderer/ai/layout-script.ts`

### layout-audit.ts

The `layout-audit.ts` file is responsible for logging and auditing the operations performed by the AI layout scripts. This is crucial for debugging, understanding AI behavior, and ensuring that the scripts are performing as expected within the defined security boundaries.

Sources: `apps/slides/src/renderer/ai/layout-audit.ts`

### Agent Continuation

In the context of long-running AI tasks, the `DOCS_CONTINUE_INSTRUCTION` [apps/docs/src/renderer/ai/continuation.ts L3-L4](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/continuation.ts#L3-L4)

 and `DOCS_AGENT_MAX_TURNS` [apps/docs/src/renderer/ai/continuation.ts L1](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/ai/continuation.ts#L1-L1)

 constants guide the agent to complete outstanding work without repeating finished steps, maintaining state across up to 50 turns.

```

```

**Diagram: Slides Renderer UI & AI Layout Scripting Components**

Sources:

* `apps/slides/src/renderer/SlideCanvas.tsx`
* `apps/slides/src/renderer/NodeBody.tsx`
* `apps/slides/src/renderer/ChartBody.tsx`
* `apps/slides/src/renderer/CropOverlay.tsx`
* `apps/slides/src/renderer/InkOverlay.tsx`
* `apps/slides/src/renderer/TextEditOverlay.tsx`
* `apps/slides/src/renderer/MasterView.tsx`
* `apps/slides/src/renderer/ai/layout-script-interpreter.ts`
* `apps/slides/src/renderer/ai/layout-script.ts`
* `apps/slides/src/renderer/ai/layout-audit.ts`
* `apps/docs/src/renderer/ai/continuation.ts`