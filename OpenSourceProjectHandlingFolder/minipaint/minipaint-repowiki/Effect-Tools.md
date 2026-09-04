# Effect Tools

> **Relevant source files**
> * [images/icons/magic_erase.svg](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/icons/magic_erase.svg)
> * [src/js/modules/effects/abstract/css.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/abstract/css.js)
> * [src/js/modules/effects/common/blur.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js)
> * [src/js/modules/effects/common/brightness.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/brightness.js)
> * [src/js/modules/effects/common/contrast.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/contrast.js)
> * [src/js/modules/effects/common/grayscale.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/grayscale.js)
> * [src/js/modules/effects/common/hue-rotate.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/hue-rotate.js)
> * [src/js/modules/effects/common/invert.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/invert.js)
> * [src/js/modules/effects/common/saturate.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/saturate.js)
> * [src/js/modules/effects/common/sepia.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/sepia.js)
> * [src/js/modules/effects/common/shadow.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/shadow.js)
> * [src/js/tools/blur.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/blur.js)
> * [src/js/tools/bulge_pinch.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/bulge_pinch.js)
> * [src/js/tools/clone.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/clone.js)
> * [src/js/tools/desaturate.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/desaturate.js)
> * [src/js/tools/erase.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/erase.js)
> * [src/js/tools/fill.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/fill.js)
> * [src/js/tools/magic_erase.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/magic_erase.js)
> * [src/js/tools/sharpen.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/sharpen.js)

## Purpose and Scope

This document covers the effect tools available in miniPaint and how they modify images. Effect tools allow users to apply various effects to specific areas of an image by clicking and dragging. This is distinct from layer-wide effects and filters covered in [Effects & Filters](/viliusle/miniPaint/5.2-effects-and-filters), which apply to entire layers.

## Overview of Effect Tools

Effect tools in miniPaint are specialized tools that modify the appearance of images by applying visual transformations to specific areas. These tools work directly on the pixel data of raster layers and require the targeted layer to be an image type layer.

```

```

Sources: [src/js/tools/blur.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/blur.js)

 [src/js/tools/sharpen.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/sharpen.js)

 [src/js/tools/desaturate.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/desaturate.js)

 [src/js/tools/clone.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/clone.js)

 [src/js/tools/bulge_pinch.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/bulge_pinch.js)

 [src/js/tools/magic_erase.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/magic_erase.js)

 [src/js/tools/erase.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/erase.js)

 [src/js/tools/fill.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/fill.js)

## Common Effect Tool Workflow

All effect tools in miniPaint follow a similar workflow pattern when applied to an image:

```

```

Sources: [src/js/tools/blur.js L37-L76](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/blur.js#L37-L76)

 [src/js/tools/sharpen.js L37-L76](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/sharpen.js#L37-L76)

 [src/js/tools/desaturate.js L37-L76](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/desaturate.js#L37-L76)

## Available Effect Tools

### Blur Tool

The Blur tool applies a localized blurring effect to the image where the user clicks or drags.

**Key properties:**

* **Parameters**: Size (radius), Strength (blur intensity)
* **Implementation**: Uses the StackBlur algorithm from the ImageFilters library
* **Method**: Creates a circular area of effect and processes image data within that area

**Code example:**

```

```

Sources: [src/js/tools/blur.js L107-L137](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/blur.js#L107-L137)

### Sharpen Tool

The Sharpen tool enhances the clarity and definition of the image by increasing contrast between adjacent pixels.

**Key properties:**

* **Parameters**: Size (radius)
* **Implementation**: Uses the Sharpen filter from ImageFilters library
* **Method**: Applies sharpening with a circular brush shape

**Implementation detail:**
The sharpening effect uses a lower intensity setting when the user is dragging (mousemove) compared to a simple click to prevent over-sharpening:

```

```

Sources: [src/js/tools/sharpen.js L107-L137](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/sharpen.js#L107-L137)

### Desaturate Tool

The Desaturate tool removes color from the image, creating grayscale areas where applied.

**Key properties:**

* **Parameters**: Size (radius), Anti-aliasing (smooths edges)
* **Implementation**: Uses the GrayScale filter from ImageFilters library
* **Method**: Converts colored pixels to grayscale values within a circular area

Sources: [src/js/tools/desaturate.js L108-L132](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/desaturate.js#L108-L132)

### Clone Tool

The Clone tool copies pixels from one area of the image to another, allowing for duplication or repair of image regions.

**Key properties:**

* **Parameters**: Size (brush size), Anti-aliasing (edge smoothing), Source layer (current or previous)
* **Special interaction**: Requires setting a source point (using right-click or long press) before cloning
* **Implementation**: Copies pixel data from source to destination with optional anti-aliasing

**Workflow:**

1. User right-clicks (or long presses on touch devices) to set source point
2. User left-clicks and drags to clone from source to destination
3. The source point moves relative to the destination as the user drags

Sources: [src/js/tools/clone.js L275-L332](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/clone.js#L275-L332)

### Bulge/Pinch Tool

The Bulge/Pinch tool creates distortion effects, either pushing pixels outward (bulge) or pulling them inward (pinch).

**Key properties:**

* **Parameters**: Radius, Power (intensity), Mode (bulge or pinch)
* **Implementation**: Uses WebGL-based effects from the glfx.js library
* **Method**: Applies a bulgePinch effect with either positive (bulge) or negative (pinch) power

Sources: [src/js/tools/bulge_pinch.js L84-L115](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/bulge_pinch.js#L84-L115)

### Magic Erase Tool

The Magic Erase tool removes areas of similar color, similar to a "magic wand" selection followed by erasure.

**Key properties:**

* **Parameters**: Power (sensitivity to color variations), Anti-aliasing, Contiguous (whether to affect only connected pixels)
* **Implementation**: Uses a flood-fill algorithm to identify similar colors
* **Method**: Sets matching pixels to transparent

Sources: [src/js/tools/magic_erase.js L111-L211](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/magic_erase.js#L111-L211)

### Erase Tool

The Erase tool removes pixels by setting them to transparent where the user clicks or drags.

**Key properties:**

* **Parameters**: Size, Shape (circle or rectangle), Strict (hard or soft edges for circle mode)
* **Implementation**: Uses globalCompositeOperation = 'destination-out' for transparency
* **Method**: Creates either a rectangular or circular eraser effect

Sources: [src/js/tools/erase.js L134-L203](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/erase.js#L134-L203)

### Fill Tool

The Fill tool changes the color of an area with similar colors to a new color (similar to the "paint bucket" in other programs).

**Key properties:**

* **Parameters**: Power (color similarity threshold), Anti-aliasing, Contiguous
* **Implementation**: Uses a flood-fill algorithm or global color matching
* **Method**: Replaces colors in the target area with the current foreground color

Sources: [src/js/tools/fill.js L135-L227](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/fill.js#L135-L227)

## Implementation Details

### Effect Tool Base Structure

All effect tools extend the `Base_tools_class` and share a common pattern:

```

```

Sources: [src/js/tools/blur.js L9-L29](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/blur.js#L9-L29)

 [src/js/tools/sharpen.js L9-L29](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/sharpen.js#L9-L29)

 [src/js/tools/desaturate.js L9-L29](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/desaturate.js#L9-L29)

### Temporary Canvas Pattern

Most effect tools use a temporary canvas to process changes before committing them to the layer:

1. **Creation**: Create a temporary canvas in the mousedown handler
2. **Processing**: Apply effects to this canvas during mousemove
3. **Commit**: Save the final state to the layer via the Actions system in mouseup
4. **Cleanup**: Release resources by nullifying the temporary canvas

This pattern provides immediate visual feedback while preventing permanent changes until the operation is complete.

```

```

Sources: [src/js/tools/blur.js L37-L105](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/blur.js#L37-L105)

 [src/js/tools/clone.js L172-L273](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/clone.js#L172-L273)

### Layer Validation

Effect tools include consistent validation to ensure they're used on appropriate layers:

```

```

Sources: [src/js/tools/blur.js L44-L51](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/blur.js#L44-L51)

 [src/js/tools/clone.js L187-L202](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/clone.js#L187-L202)

 [src/js/tools/magic_erase.js L58-L66](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/magic_erase.js#L58-L66)

### State Management Integration

Effect tools use the action system to manage changes, enabling undo/redo functionality:

```

```

This pattern bundles the canvas update into a single named action that appears in the user's action history.

Sources: [src/js/tools/blur.js L94-L98](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/blur.js#L94-L98)

 [src/js/tools/desaturate.js L95-L99](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/desaturate.js#L95-L99)

 [src/js/tools/clone.js L262-L266](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/clone.js#L262-L266)

## Layer Filters vs. Effect Tools

While effect tools apply localized changes to specific areas of an image, layer filters apply effects to entire layers non-destructively.

```

```

Sources: [src/js/modules/effects/abstract/css.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/abstract/css.js)

 [src/js/modules/effects/common/blur.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js)

 [src/js/modules/effects/common/shadow.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/shadow.js)

### Key Differences:

| Feature | Effect Tools | Layer Filters |
| --- | --- | --- |
| Application | Applied to specific areas | Applied to entire layer |
| Persistence | Permanently modifies pixels | Non-destructive, can be removed |
| Interface | Direct canvas interaction | Dialog with parameters |
| Implementation | Uses canvas API directly | Uses CSS filters |
| Preview | Immediate feedback | Dialog preview |

Sources: [src/js/tools/blur.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/blur.js)

 [src/js/modules/effects/common/blur.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js)

## Performance Considerations

Effect tools can be resource-intensive, especially on large images or with large brush sizes. The implementation includes several optimizations:

1. **Temporary Canvases**: Processing only occurs on a small section of the image
2. **Cleanup**: Resources are explicitly released after use
3. **Working Flags**: Prevent multiple simultaneous operations
4. **Adaptive Processing**: Some tools (like sharpen) reduce intensity during dragging operations

For tools like Magic Erase and Fill that can process large areas:

```

```

Sources: [src/js/tools/fill.js L55-L132](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/fill.js#L55-L132)

 [src/js/tools/magic_erase.js L54-L97](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/magic_erase.js#L54-L97)

## Common Limitations

* Most effect tools cannot be applied to vector layers without rasterizing first
* Effects cannot be applied to rotated layers (must be rasterized)
* Certain effects (like Clone) have additional restrictions for resized layers
* Fill and Magic Erase tools prevent multiple simultaneous operations to avoid performance issues

Sources: [src/js/tools/clone.js L187-L217](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/clone.js#L187-L217)

 [src/js/tools/fill.js L55-L71](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/fill.js#L55-L71)