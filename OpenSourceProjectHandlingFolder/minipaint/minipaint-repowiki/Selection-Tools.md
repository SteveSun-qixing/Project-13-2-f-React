# Selection Tools

> **Relevant source files**
> * [src/js/core/base-selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js)
> * [src/js/tools/animation.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/animation.js)
> * [src/js/tools/crop.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js)
> * [src/js/tools/select.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js)
> * [src/js/tools/selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/selection.js)

Selection tools in miniPaint enable users to select, move, resize, and modify areas of an image or specific layers. These tools form a critical part of the image editing workflow, allowing for precise manipulation of content. This page documents the various selection tools available in miniPaint, their implementation, and how they interact with the broader system.

For information about the underlying selection system architecture, see [Selection System](/viliusle/miniPaint/2.3-selection-system).

## Selection Tools Overview

miniPaint provides three main selection-related tools, each with distinct purposes:

1. **Select Tool** - For selecting and manipulating existing layers
2. **Crop Tool** - For cropping the entire canvas
3. **Selection Tool** - For selecting specific areas within an image layer

These tools are built on a shared foundation provided by the `Base_selection_class`, which handles common selection operations like rendering selection rectangles, detecting user interactions, and managing selection states.

```

```

Sources: [src/js/core/base-selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js)

 [src/js/tools/select.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js)

 [src/js/tools/crop.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js)

 [src/js/tools/selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/selection.js)

## Core Selection Framework

The core selection framework is implemented in `Base_selection_class` and provides the foundation for all selection tools. This class handles:

1. Rendering selection rectangles with resize/rotate handles
2. Processing mouse/touch interactions for selections
3. Managing selection transformations (resize, move, rotate)
4. Handling coordinate calculations for selections

```

```

Sources: [src/js/core/base-selection.js L21-L357](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js#L21-L357)

The selection rendering system draws handles for selection manipulation, with different types of handles based on the selection:

* Corner handles for resizing width and height simultaneously
* Edge handles for resizing only width or height
* Rotation handle for rotating the selection

The `Base_selection_class` uses a coordinate system with:

* `x, y` - Top-left corner of selection
* `width, height` - Dimensions of selection
* `rotate` - Rotation angle in degrees (if applicable)

### Selection Rendering

The `draw_selection()` method renders the selection rectangle with handles. The rendering includes:

* Selection background (optional, semi-transparent)
* Selection borders (optional)
* Resize handles (corners and edges)
* Rotation handle (if enabled)
* Crop guidelines (if enabled)

The appearance of the selection adapts based on the current zoom level and handles edge cases like selections that extend beyond the canvas edges.

Sources: [src/js/core/base-selection.js L162-L357](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js#L162-L357)

### Selection User Interaction

User interactions with selections follow this sequence:

1. **Mouse/Touch Down** - Initiates selection or starts manipulation
2. **Mouse/Touch Move** - Updates selection dimensions or position
3. **Mouse/Touch Up** - Finalizes the operation

The `selected_object_actions()` method determines which part of the selection the user is interacting with (e.g., resize handle, rotation handle, or interior) and processes the corresponding action.

Sources: [src/js/core/base-selection.js L359-L554](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js#L359-L554)

## Select Tool

The Select tool (`Select_tool_class`) allows users to select, move, resize, and rotate existing layers. This is the primary tool for manipulating layers in miniPaint.

### Key Features

1. **Layer Selection** - Automatically selects the layer under the cursor
2. **Movement** - Moves selected layers with mouse or keyboard arrows
3. **Resizing** - Resizes layers via handles
4. **Rotation** - Rotates layers via the rotation handle
5. **Snap Alignment** - Snaps layers to guides, edges, or other layers

```

```

Sources: [src/js/tools/select.js L9-L152](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js#L9-L152)

 [src/js/tools/select.js L153-L216](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js#L153-L216)

 [src/js/tools/select.js L217-L292](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js#L217-L292)

### Select Tool Operation

The Select tool operates in three main modes:

1. **Moving** - When dragging from inside the selection
2. **Resizing** - When dragging a resize handle
3. **Rotating** - When dragging the rotation handle

When moving a layer, the tool implements snapping functionality to help align layers with each other or with the canvas boundaries.

The Select tool also supports keyboard shortcuts:

* Arrow keys to move the selection
* Shift+Arrow for fine movement
* Ctrl+Arrow for larger movement
* Delete key to delete the selected layer

Sources: [src/js/tools/select.js L40-L118](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js#L40-L118)

## Crop Tool

The Crop tool (`Crop_class`) allows users to crop the entire canvas. This affects all layers in the project.

### Key Features

1. **Visual Selection** - Draw a crop rectangle on the canvas
2. **Aspect Ratio Control** - Hold Ctrl/Cmd to maintain the current canvas aspect ratio
3. **Guidelines** - Visual guidelines dividing the selection into thirds

```

```

Sources: [src/js/tools/crop.js L10-L168](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js#L10-L168)

### Crop Process

When the crop is applied (through the parameters panel), the tool:

1. Verifies the selection is valid
2. Checks that no layers are rotated (rotated layers cannot be cropped)
3. Crops each layer by adjusting its position and dimensions
4. For image layers, it creates a new canvas with only the visible portion
5. Resizes the canvas to match the crop dimensions
6. Resets the selection

The crop operation is implemented as a bundle of actions to enable undo/redo functionality.

Sources: [src/js/tools/crop.js L169-L296](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js#L169-L296)

## Selection Tool

The Selection tool (`Selection_class`) allows users to select specific areas within an image layer. This is different from the Select tool, which selects entire layers.

### Key Features

1. **Area Selection** - Select rectangular areas within an image layer
2. **Delete Selection** - Delete the selected area
3. **Select All** - Select the entire image layer
4. **Clipboard Operations** - (Note: while the framework exists, clipboard operations appear to be limited)

```

```

Sources: [src/js/tools/selection.js L12-L53](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/selection.js#L12-L53)

 [src/js/tools/selection.js L124-L233](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/selection.js#L124-L233)

### Selection Operations

The Selection tool operates on image layers only and utilizes a temporary canvas to manipulate the selected area. Key operations include:

1. **Creating a selection** - Drawing a rectangular selection area
2. **Deleting a selection** - Removing the content in the selected area
3. **Select All** - Selecting the entire layer

The tool maintains a temporary canvas (`tmpCanvas`) for operations that modify the layer content.

Sources: [src/js/tools/selection.js L254-L336](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/selection.js#L254-L336)

## Technical Details

### Selection Data Structure

Selections are stored with the following properties:

| Property | Description |
| --- | --- |
| x | Left position of the selection |
| y | Top position of the selection |
| width | Width of the selection |
| height | Height of the selection |
| rotate | Rotation angle (if applicable) |

Sources: [src/js/core/base-selection.js L99-L123](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js#L99-L123)

### Selection Configuration

Each selection tool configures the `Base_selection_class` with specific settings:

| Setting | Description |
| --- | --- |
| enable_background | Whether to show a semi-transparent background |
| enable_borders | Whether to show selection borders |
| enable_controls | Whether to show resize handles |
| enable_rotation | Whether to allow rotation |
| enable_move | Whether to allow movement |
| keep_ratio | Whether to maintain aspect ratio when resizing |
| data_function | Function that returns the selection data |

Sources: [src/js/tools/select.js L26-L37](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js#L26-L37)

 [src/js/tools/crop.js L26-L36](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js#L26-L36)

 [src/js/tools/selection.js L40-L51](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/selection.js#L40-L51)

### Drag Type Constants

The selection system uses bitmask constants to identify which handle is being dragged:

```
DRAG_TYPE_TOP = 1
DRAG_TYPE_BOTTOM = 2
DRAG_TYPE_LEFT = 4
DRAG_TYPE_RIGHT = 8
```

These can be combined to represent corner handles, e.g., `DRAG_TYPE_TOP | DRAG_TYPE_LEFT` for the top-left corner.

Sources: [src/js/core/base-selection.js L13-L16](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js#L13-L16)

## Integration with Other Systems

Selection tools integrate with several other systems in miniPaint:

1. **Layer System** - Selection tools operate on and manipulate layers
2. **State Management** - Selection operations create actions for undo/redo
3. **Rendering System** - Selections trigger re-rendering of the canvas
4. **Event System** - Selection tools process mouse, touch, and keyboard events

Selection tools use the action system for operations that should be undoable, such as moving layers, resizing layers, or cropping the canvas.

Sources: [src/js/tools/select.js L238-L259](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js#L238-L259)

 [src/js/tools/crop.js L164-L295](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js#L164-L295)