# Drawing Tools

> **Relevant source files**
> * [src/js/tools/brush.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/brush.js)
> * [src/js/tools/gradient.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/gradient.js)
> * [src/js/tools/pencil.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pencil.js)

## Purpose and Scope

This document covers the implementation and functionality of drawing tools in miniPaint. Drawing tools allow users to create freeform content on the canvas. This page focuses on brush, pencil, and gradient tools which form the foundation of content creation in the application. For information about shape-based drawing tools, see [Shape Tools](/viliusle/miniPaint/4.3-shape-tools). For selection tools, see [Selection Tools](/viliusle/miniPaint/4.2-selection-tools).

## Overview

Drawing tools in miniPaint allow users to create vector-based content through mouse or touch interactions. Each drawing tool inherits from the base tool class and implements specific rendering methods to achieve different drawing effects and appearances.

```

```

Sources: [src/js/tools/brush.js L6-L12](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/brush.js#L6-L12)

 [src/js/tools/pencil.js L6-L12](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pencil.js#L6-L12)

 [src/js/tools/gradient.js L7-L16](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/gradient.js#L7-L16)

## Common Architecture

Drawing tools follow a consistent pattern for handling user interactions and rendering content:

1. **Event Registration**: Tools register mouse, touch, and pointer event handlers in their `load()` method
2. **Action Methods**: Implement `mousedown`, `mousemove`, and `mouseup` methods to handle drawing interactions
3. **Layer Creation**: Create a dedicated vector layer when drawing begins
4. **Data Storage**: Store drawing data as coordinate arrays with size information
5. **Rendering**: Implement custom `render()` methods for drawing to the canvas

```

```

Sources: [src/js/tools/brush.js L22-L61](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/brush.js#L22-L61)

 [src/js/tools/pencil.js L18-L30](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pencil.js#L18-L30)

 [src/js/tools/gradient.js L18-L20](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/gradient.js#L18-L20)

## Brush Tool

The brush tool provides smooth, pressure-sensitive drawing with anti-aliased edges. It creates vector-based content stored as coordinate points.

### Implementation

The brush tool is implemented in the `Brush_class` which extends `Base_tools_class`. Key aspects include:

* **Pressure Sensitivity**: Detects and responds to pen pressure on compatible devices
* **Speed-based Size**: Adjusts line width based on drawing speed when pressure isn't available
* **Vector Storage**: Stores drawing data as coordinate points with size information
* **Stabilized Rendering**: Uses curve smoothing algorithms for natural-looking lines

### Input Handling

The brush tool handles multiple input methods:

1. **Pointer Events**: Primary method for pressure-sensitive input (pen/stylus)
2. **Mouse Events**: Standard drawing without pressure
3. **Touch Events**: Mobile device support with multi-touch capabilities

```

```

Sources: [src/js/tools/brush.js L22-L73](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/brush.js#L22-L73)

 [src/js/tools/brush.js L83-L195](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/brush.js#L83-L195)

### Data Format

Brush data is stored in a nested array structure:

* Outer array: Contains groups of points (each group represents a continuous stroke)
* Inner arrays: Individual points as [x, y, size] where size can vary with pressure

### Rendering Process

Two rendering methods are available:

1. **Pressure-variable rendering**: Draws lines with varying thickness based on stored size data
2. **Stabilized rendering**: Applies smoothing algorithm for natural curves

The stabilized rendering method uses a multi-pass smoothing algorithm that:

1. Calculates midpoints between consecutive points
2. Recursively smooths the resulting point set
3. Renders using quadratic curve commands

Sources: [src/js/tools/brush.js L339-L411](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/brush.js#L339-L411)

 [src/js/tools/brush.js L421-L489](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/brush.js#L421-L489)

## Pencil Tool

The pencil tool creates aliased (non-anti-aliased) lines for pixel-precise drawing. It produces sharp, blocky lines compared to the brush's smooth strokes.

### Implementation

The pencil tool is implemented in the `Pencil_class` which extends `Base_tools_class`. Key aspects include:

* **Aliased Rendering**: Creates sharp, pixel-perfect lines without anti-aliasing
* **Simple Line Algorithm**: Draws lines pixel-by-pixel rather than using canvas stroke operations
* **Optional Pressure**: Supports pressure sensitivity but maintains pixel-precise rendering

### Data Format

Pencil data is stored in a flat array of points, with null values indicating breaks between strokes:

* Each point is stored as [x, y, size]
* A null entry indicates lifting the pencil (starting a new stroke)

### Rendering Process

The pencil uses a custom line drawing algorithm:

1. For each line segment, calculates the pixel path between endpoints
2. Renders each pixel as a small rectangle
3. Maintains sharp edges by avoiding anti-aliasing

```

```

Sources: [src/js/tools/pencil.js L159-L233](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pencil.js#L159-L233)

 [src/js/tools/pencil.js L245-L257](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pencil.js#L245-L257)

## Gradient Tool

The gradient tool creates gradient fills, either linear or radial, defining the color transition based on the drag operation.

### Implementation

The gradient tool is implemented in the `Gradient_class` which extends `Base_tools_class`. Key aspects include:

* **Two Modes**: Supports both linear and radial gradient types
* **Two-Color System**: Creates gradients between two selected colors
* **Alpha Support**: Supports transparency in the gradient
* **Drag-to-Define**: Uses mouse drag to define gradient size, direction, and radius

### Creation Process

1. Initial click sets the gradient's starting point
2. Dragging defines the gradient's size and direction
3. For radial gradients, drag defines the radius from center

### Rendering Process

The gradient tool uses the Canvas API's gradient functions:

* `createLinearGradient()` for linear gradients
* `createRadialGradient()` for radial gradients

The rendering process handles:

1. Color conversion to RGBA format
2. Alpha channel application
3. Gradient stop positioning
4. Canvas filling

Sources: [src/js/tools/gradient.js L22-L125](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/gradient.js#L22-L125)

 [src/js/tools/gradient.js L127-L181](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/gradient.js#L127-L181)

## Layer Management

Drawing tools interact with the layer system to create and update content. Each tool:

1. Creates a dedicated vector layer when drawing begins
2. Updates layer data during the drawing operation
3. Adjusts layer dimensions based on drawing bounds when complete
4. Manages layer properties like position and dimensions

### Layer Creation

When drawing starts, tools create a new layer with specific properties:

```

```

Sources: [src/js/tools/brush.js L197-L236](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/brush.js#L197-L236)

 [src/js/tools/pencil.js L57-L101](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pencil.js#L57-L101)

 [src/js/tools/gradient.js L22-L56](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/gradient.js#L22-L56)

### Dimension Calculation

After drawing is complete, tools recalculate the layer dimensions to optimize storage and rendering:

1. Find the minimum and maximum x/y coordinates used in the drawing
2. Update layer position (x, y) based on minimum values
3. Update layer dimensions (width, height) based on coordinate range
4. Adjust coordinate data to be relative to the new layer position

This ensures that layers only occupy the space they need on the canvas.

Sources: [src/js/tools/brush.js L516-L566](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/brush.js#L516-L566)

 [src/js/tools/pencil.js L262-L302](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pencil.js#L262-L302)

## Summary

Drawing tools form the foundation of content creation in miniPaint. The tools follow a consistent architecture while implementing specialized rendering techniques to achieve different artistic effects. By working with the layer system and state management, drawing tools provide a vector-based drawing experience that supports undo/redo and maintains high-quality output.

* **Brush**: Smooth, anti-aliased strokes with pressure sensitivity and curve smoothing
* **Pencil**: Aliased, pixel-perfect lines for precise drawing
* **Gradient**: Linear and radial color transitions

All drawing tools are implemented as JavaScript classes that extend the base tool class and work within the application's layer-based architecture and state management system.