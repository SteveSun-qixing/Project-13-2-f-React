# Colors Panel

> **Relevant source files**
> * [src/css/component.css](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/component.css)
> * [src/js/core/gui/gui-colors.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js)
> * [src/js/core/gui/gui-tools.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-tools.js)

The Colors Panel in miniPaint provides a comprehensive interface for selecting and managing colors. This panel offers multiple ways to define colors, including color swatches, a visual color picker, and precise numerical inputs for RGB, HSL, and hexadecimal values. The panel is accessible through the main interface's right sidebar and can also appear in dialog form for specific color-related operations.

Sources: [src/js/core/gui/gui-colors.js L166-L169](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L166-L169)

## Panel Structure and Components

The Colors Panel consists of several collapsible sections that allow users to work with colors in different ways:

1. **Color Sample** - Shows a preview of the currently selected color
2. **Color Swatches** - A grid of color presets that can be clicked to select a color
3. **Color Picker** - A gradient-based visual color picker
4. **Color Channels** - Input fields for RGB, HSL values and hexadecimal color code

Each section can be toggled on/off using dedicated buttons in the panel header.

```

```

Sources: [src/js/core/gui/gui-colors.js L12-L96](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L12-L96)

 [src/js/core/gui/gui-colors.js L202-L324](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L202-L324)

## Panel Modes

The Colors Panel operates in two modes:

1. **Sidebar Mode** - The default mode, integrated into the right sidebar of the application
2. **Dialog Mode** - A popup version used when a specific color selection is required

The implementation supports both modes through common code with mode-specific differences handled through the `uiType` property.

```

```

Sources: [src/js/core/gui/gui-colors.js L171-L176](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L171-L176)

 [src/js/core/gui/gui-colors.js L184-L194](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L184-L194)

## Color Selection Workflow

The Colors Panel provides multiple ways to select and define colors. When a user interacts with any color input method, the following sequence occurs:

1. User interacts with a color input (swatch, picker, RGB/HSL sliders, or hex input)
2. The `set_color()` method is called with the relevant color information
3. Color format conversion occurs if needed (e.g., HSL to RGB)
4. The `config.COLOR` and `config.ALPHA` values are updated
5. All UI components are refreshed to reflect the new color
6. If in sidebar mode, the color is saved to cookies for persistence

```

```

Sources: [src/js/core/gui/gui-colors.js L326-L383](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L326-L383)

 [src/js/core/gui/gui-colors.js L400-L470](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L400-L470)

## Color Format Handling

The Colors Panel works with multiple color formats and provides conversion between them:

* **Hexadecimal** (#RRGGBB)
* **RGB** (Red, Green, Blue values from 0-255)
* **Alpha** (Transparency value from 0-255)
* **HSL** (Hue from 0-360°, Saturation/Luminosity from 0-100%)
* **HSV** (Hue from 0-360°, Saturation/Value from 0-100%)

When a color is selected using any input method, the `set_color()` method handles the conversion to all other formats as needed.

### Input Types and Properties

| Input Method | Format | Range | Properties |
| --- | --- | --- | --- |
| Hex Input | #RRGGBB | N/A | Direct hexadecimal code entry |
| RGB Sliders | Individual R,G,B values | 0-255 | Separate control of each channel |
| Alpha Slider | Alpha value | 0-255 | Controls transparency |
| HSL Sliders | Individual H,S,L values | H: 0-360, S/L: 0-100 | Intuitive color adjustment |
| Color Picker | HSV representation | H: 0-360, S/V: 0-100 | Visual gradient selection |
| Swatches | Saved hex colors | N/A | Quick selection of saved colors |

Sources: [src/js/core/gui/gui-colors.js L389-L515](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L389-L515)

 [src/js/core/gui/gui-colors.js L400-L470](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L400-L470)

## UI Components Implementation

### Color Swatches

The swatches section implements a grid of color samples that can be selected. The implementation:

* Uses a jQuery plugin (`uiSwatches`)
* Supports varying grid sizes (rows/columns)
* Allows saving/loading of colors
* Has read-only mode for dialog usage

### Color Picker Gradient

The gradient color picker provides an HSV-based visual color selection:

* Implements a two-dimensional gradient for selecting saturation and value
* Manages a handle that can be dragged to select a color visually
* Uses the jQuery plugin `uiColorPickerGradient`

### Color Channels

The color channels section provides precise input methods for defining colors:

* Hex input with validation
* RGB sliders and number inputs
* Alpha channel control
* HSL sliders and number inputs
* Each slider shows a gradient preview based on the current color

```

```

Sources: [src/js/core/gui/gui-colors.js L169-L185](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L169-L185)

 [src/js/core/gui/gui-colors.js L222-L259](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L222-L259)

## Integration with Application State

The Colors Panel integrates with the wider application through the central configuration object:

* The panel updates `config.COLOR` and `config.ALPHA` when a color is selected
* These values are used by various tools when applying color-related operations
* The panel loads initial color values from the configuration
* Color preferences are persisted through cookies

When a tool that uses color is activated, it reads the current color value from the configuration, which is managed by the Colors Panel.

```

```

Sources: [src/js/core/gui/gui-colors.js L447-L457](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L447-L457)

 [src/js/core/gui/gui-colors.js L467-L469](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L467-L469)

## UI Interaction Design

The Colors Panel implements several UI enhancement features:

### Section Toggling

* Each section (swatches, picker, channels) can be toggled on/off
* Toggle state is saved in cookies for persistence
* DOM manipulation is used to add/remove sections when toggled

### Responsive Updates

* Color input fields update immediately as the user interacts
* Slider gradients are updated to reflect the current color context
* Updates are throttled for performance (using `Helper.throttle`)

### Accessibility Features

* ARIA attributes are used for button states
* Input elements have proper labels and descriptions
* Screen reader text is included for abbreviated labels (R, G, B, etc.)

Sources: [src/js/core/gui/gui-colors.js L262-L324](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L262-L324)

 [src/js/core/gui/gui-colors.js L199](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L199-L199)

## Technical Implementation Notes

### Event Handling

The Colors Panel uses jQuery event handling to respond to user interactions. For each input type:

1. Event listeners are attached to inputs during initialization
2. Input changes trigger the appropriate color update method
3. The panel ensures all inputs stay synchronized

### Performance Considerations

* The panel uses throttling for gradient rendering operations
* Complex UI updates are deferred using the `render_ui_deferred` method
* DOM manipulations are minimized and optimized

### Widget Dependencies

The panel uses several custom UI widgets defined elsewhere in the codebase:

* `uiSwatches` - For color swatch grid
* `uiColorPickerGradient` - For HSV gradient picker
* `uiRange` - For slider controls
* `uiNumberInput` - For numeric inputs

Sources: [src/js/core/gui/gui-colors.js L326-L385](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L326-L385)

 [src/js/core/gui/gui-colors.js L511-L512](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-colors.js#L511-L512)

## Related Components

The Colors Panel is part of the larger UI system in miniPaint. Other related components include:

* **Tools Panel** [Tools Panel](/viliusle/miniPaint/3.3-tools-panel) - Contains tools that use colors
* **Layer Management** [Layer Management](/viliusle/miniPaint/2.1-layer-management) - Works with layers that may have color properties
* **Configuration System** [Configuration System](/viliusle/miniPaint/2.2-configuration-system) - Stores the current color values

Understanding how these systems interact provides a complete picture of color management in miniPaint.