# Effects & Filters

> **Relevant source files**
> * [src/js/core/components/color-input.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/components/color-input.js)
> * [src/js/modules/effects/abstract/css.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/abstract/css.js)
> * [src/js/modules/effects/browser.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/browser.js)
> * [src/js/modules/effects/common/blur.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js)
> * [src/js/modules/effects/common/brightness.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/brightness.js)
> * [src/js/modules/effects/common/contrast.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/contrast.js)
> * [src/js/modules/effects/common/grayscale.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/grayscale.js)
> * [src/js/modules/effects/common/hue-rotate.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/hue-rotate.js)
> * [src/js/modules/effects/common/invert.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/invert.js)
> * [src/js/modules/effects/common/saturate.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/saturate.js)
> * [src/js/modules/effects/common/sepia.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/sepia.js)
> * [src/js/modules/effects/common/shadow.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/shadow.js)
> * [src/js/modules/effects/instagram/aden.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/instagram/aden.js)
> * [src/js/modules/image/histogram.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/histogram.js)
> * [src/js/tools/shape.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shape.js)

This document provides a technical overview of the Effects & Filters system in miniPaint. It covers the architecture, implementation, and usage of the various image effects and filters available in the application. For information about image manipulation operations like resize, trim, or crop, see [Image Manipulation](/viliusle/miniPaint/5.3-image-manipulation).

## 1. Overview

The Effects & Filters system in miniPaint allows users to apply non-destructive visual modifications to image layers. These modifications use CSS filters and custom canvas operations to transform the appearance of images while preserving the original data.

```

```

Sources: [src/js/modules/effects/abstract/css.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/abstract/css.js)

 [src/js/modules/effects/browser.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/browser.js)

 [src/js/modules/effects/common/blur.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js)

 [src/js/modules/effects/instagram/aden.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/instagram/aden.js)

## 2. Architecture

### 2.1 Base Classes

The Effects & Filters system is built around two primary base classes:

1. **Effects_common_class**: An abstract base class that provides the foundation for CSS-based effects with standardized dialogs, value conversion, and rendering.
2. **Effects_browser_class**: Manages the user interface for browsing and selecting available effects, generating thumbnails and handling user interaction.

```

```

Sources: [src/js/modules/effects/abstract/css.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/abstract/css.js)

 [src/js/modules/effects/browser.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/browser.js)

### 2.2 Effect Implementation Pattern

Most effects follow a consistent implementation pattern:

```

```

Sources: [src/js/modules/effects/abstract/css.js L16-L48](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/abstract/css.js#L16-L48)

 [src/js/modules/effects/common/blur.js L15-L27](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js#L15-L27)

## 3. Available Effects and Filters

The miniPaint application provides two main categories of effects:

1. **CSS-based effects**: Implemented using CSS filter properties applied to canvas rendering
2. **Custom canvas effects**: Implemented by direct pixel manipulation or custom rendering

### 3.1 CSS-based Effects

| Effect | Class | Parameter Range | Default Value | Description |
| --- | --- | --- | --- | --- |
| Blur | Effects_blur_class | 0-50 | 5 | Applies a gaussian blur to the image |
| Brightness | Effects_brightness_class | -100-100 | 50 | Adjusts the brightness of the image |
| Contrast | Effects_contrast_class | -100-100 | 40 | Adjusts the contrast of the image |
| Grayscale | Effects_grayscale_class | 0-100 | 100 | Converts the image to grayscale |
| Hue Rotate | Effects_hueRotate_class | 0-360 | 90 | Rotates the hue values of the image |
| Invert | Effects_invert_class | 0-100 | 100 | Inverts the colors of the image |
| Saturate | Effects_saturate_class | -100-100 | -50 | Adjusts the color saturation of the image |
| Sepia | Effects_sepia_class | 0-100 | 60 | Applies a sepia tone to the image |
| Shadow | Effects_brightness_class | Various | X:10, Y:10, Radius:5 | Adds a drop shadow to the image |

Sources: [src/js/modules/effects/common/blur.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js)

 [src/js/modules/effects/common/brightness.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/brightness.js)

 [src/js/modules/effects/common/contrast.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/contrast.js)

 [src/js/modules/effects/common/grayscale.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/grayscale.js)

 [src/js/modules/effects/common/hue-rotate.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/hue-rotate.js)

 [src/js/modules/effects/common/invert.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/invert.js)

 [src/js/modules/effects/common/saturate.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/saturate.js)

 [src/js/modules/effects/common/sepia.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/sepia.js)

 [src/js/modules/effects/common/shadow.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/shadow.js)

### 3.2 Instagram-style Filters

The system also includes Instagram-style filters (like "Aden") that apply complex combinations of effects to create specific looks. These use custom canvas operations rather than CSS filters.

Example implementation (Aden filter):

```

```

Sources: [src/js/modules/effects/instagram/aden.js L35-L59](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/instagram/aden.js#L35-L59)

## 4. Effects Browser

The Effects Browser provides a user interface for browsing and selecting available effects. It dynamically generates thumbnails with previews of all effects.

```

```

The browser implementation performs these key functions:

1. Collects all effects modules from the application
2. Creates a thumbnail grid UI
3. Generates preview canvases with the effect applied to a sample image
4. Handles click events to execute the selected effect

Sources: [src/js/modules/effects/browser.js L16-L89](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/browser.js#L16-L89)

 [src/js/modules/effects/browser.js L92-L137](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/browser.js#L92-L137)

## 5. Implementation Details

### 5.1 Effect Dialog System

When an effect is selected, a dialog is shown to allow parameter configuration. The dialog includes:

1. Controls for adjusting effect parameters (sliders, color pickers, etc.)
2. A real-time preview of the effect with current parameters
3. Confirmation/cancel buttons

The dialog implementation is handled by the `show_dialog` method in the base class:

```

```

Sources: [src/js/modules/effects/abstract/css.js L16-L48](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/abstract/css.js#L16-L48)

### 5.2 Parameter Conversion

Effects often need to convert parameter values between different contexts (UI, preview, final rendering). This is handled by the `convert_value` method which each effect overrides according to its needs.

Example from blur effect:

```

```

Sources: [src/js/modules/effects/common/blur.js L29-L39](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js#L29-L39)

 [src/js/modules/effects/abstract/css.js L65-L67](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/abstract/css.js#L65-L67)

### 5.3 Rendering Implementation

Effects are applied during rendering using the CSS filter property on the canvas context. Each effect implements:

1. `render_pre`: Sets up the filter before drawing
2. `render_post`: Cleans up after drawing

Example implementation:

```

```

Sources: [src/js/modules/effects/common/blur.js L52-L64](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js#L52-L64)

 [src/js/modules/effects/common/contrast.js L52-L65](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/contrast.js#L52-L65)

## 6. Integration with Layer System

Effects are integrated with the layer system as non-destructive filters. This means that:

1. Filters are stored as metadata with the layer
2. Original image data is preserved
3. Filters can be adjusted or removed at any time
4. Multiple filters can be combined on a single layer

```

```

The integration with the action system enables undo/redo functionality for filter application and modification.

Sources: [src/js/modules/effects/abstract/css.js L50-L54](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/abstract/css.js#L50-L54)

 [src/js/modules/effects/common/blur.js L15-L27](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/common/blur.js#L15-L27)

## 7. Adding New Effects

New effects can be added to the system by:

1. Creating a new class that extends `Effects_common_class`
2. Implementing the required methods (effect function, conversion, demo, render_pre/post)
3. Registering the effect with the application

The Effects Browser automatically discovers and includes all effect modules by searching for modules with "effects" in their path (excluding abstract/browser modules).

Sources: [src/js/modules/effects/browser.js L92-L115](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/effects/browser.js#L92-L115)