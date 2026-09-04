# Layers Panel

> **Relevant source files**
> * [images/icons/arrow-down.svg](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/icons/arrow-down.svg)
> * [src/js/actions/add-layer-filter.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/add-layer-filter.js)
> * [src/js/actions/refresh-layers-gui.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/refresh-layers-gui.js)
> * [src/js/core/gui/gui-layers.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js)
> * [src/js/modules/layer/rename.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/layer/rename.js)
> * [src/js/modules/layer/visibility.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/layer/visibility.js)
> * [src/js/modules/tools/keypoints.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/tools/keypoints.js)
> * [src/js/modules/tools/sprites.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/tools/sprites.js)

The Layers Panel is a core component of the miniPaint user interface that enables users to manage and organize layers within their image editing projects. This document describes the implementation, structure, and functionality of the Layers Panel, which is primarily controlled by the `GUI_layers_class`. For information about the underlying layer data management, see [Layer Management](/viliusle/miniPaint/2.1-layer-management).

## Overview

The Layers Panel provides visual representation and controls for all layers in the current document, allowing users to:

* Add, duplicate, delete, and reorder layers
* Toggle layer visibility
* Rename layers
* Convert layers to raster format
* View and manage layer filters
* Select the active layer for editing

```

```

Sources: [src/js/core/gui/gui-layers.js L16-L25](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L16-L25)

 [src/js/core/gui/gui-layers.js L30-L40](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L30-L40)

## Implementation

The Layers Panel is implemented by the `GUI_layers_class` which is responsible for rendering the UI components and handling user interactions with layers.

```

```

Sources: [src/js/core/gui/gui-layers.js L30-L40](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L30-L40)

 [src/js/core/gui/gui-layers.js L51-L129](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L51-L129)

## Panel Structure

The Layers Panel consists of the following key components:

1. **Layer Management Buttons**: * Add Layer (`+`) * Duplicate Layer (`D`) * Convert to Raster (`R`) * Move Layer Up (↑) * Move Layer Down (↓)
2. **Layers List Container**: * Displays all layers in the document * Layers are sorted by their order, with higher order values displayed at the top * The currently selected layer is highlighted * Each layer item shows: * Visibility toggle button * Delete button * Layer name * Layers with source-atop composition mode display an arrow-down icon
3. **Filters Section**: * Displayed under a layer when it has filters applied * Shows the name of each filter * Provides a delete button for each filter

### HTML Template

The basic structure of the Layers Panel is defined by a template in the `GUI_layers_class`:

```sql
<button type="button" class="layer_add trn" id="insert_layer" title="Insert new layer">+</button>
<button type="button" class="layer_duplicate trn" id="layer_duplicate" title="Duplicate layer">D</button>
<button type="button" class="layer_raster trn" id="layer_raster" title="Convert layer to raster">R</button>

<button type="button" class="layers_arrow trn" title="Move layer down" id="layer_down">↓</button>
<button type="button" class="layers_arrow trn" title="Move layer up" id="layer_up">↑</button>

<div class="layers_list" id="layers"></div>
```

Sources: [src/js/core/gui/gui-layers.js L16-L25](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L16-L25)

 [src/js/core/gui/gui-layers.js L134-L196](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L134-L196)

## Layer Operations

The Layers Panel supports several operations on layers, which are implemented through event handlers and actions.

### Adding a Layer

When the "+" button is clicked, a new layer is created via the `Insert_layer_action`:

```

```

Sources: [src/js/core/gui/gui-layers.js L56-L60](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L56-L60)

### Duplicating a Layer

When the "D" button is clicked, the selected layer is duplicated using the `Layer_duplicate_class`:

```

```

Sources: [src/js/core/gui/gui-layers.js L62-L65](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L62-L65)

### Converting to Raster

When the "R" button is clicked, the selected layer is converted to a raster layer using the `Layer_raster_class`:

```

```

Sources: [src/js/core/gui/gui-layers.js L66-L69](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L66-L69)

### Moving Layers

The "↑" and "↓" buttons allow reordering layers with the `Reorder_layer_action`:

```

```

Sources: [src/js/core/gui/gui-layers.js L70-L81](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L70-L81)

### Toggling Visibility

Clicking the visibility icon toggles the layer's visibility using the `Toggle_layer_visibility_action`:

```

```

Sources: [src/js/core/gui/gui-layers.js L82-L87](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L82-L87)

 [src/js/modules/layer/visibility.js L11-L15](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/layer/visibility.js#L11-L15)

### Deleting a Layer

Clicking the delete button removes the layer using the `Delete_layer_action`:

```

```

Sources: [src/js/core/gui/gui-layers.js L88-L93](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L88-L93)

### Selecting a Layer

Clicking a layer name selects it as the active layer using the `Select_layer_action`:

```

```

Sources: [src/js/core/gui/gui-layers.js L94-L101](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L94-L101)

### Renaming a Layer

Double-clicking a layer name allows renaming it using the `Layer_rename_class`:

```

```

The rename dialog is triggered with validation to ensure the name doesn't contain special characters:

```

```

Sources: [src/js/core/gui/gui-layers.js L122-L128](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L122-L128)

 [src/js/modules/layer/rename.js L8-L53](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/layer/rename.js#L8-L53)

## Layer Filters

Filters applied to layers are displayed in a collapsible section below each layer. The Layers Panel allows:

1. **Viewing Filters**: Each filter is shown with its name
2. **Editing Filters**: Clicking a filter name opens the filter editing dialog
3. **Deleting Filters**: Clicking the delete button removes the filter

### Filter Display

Filters are rendered below their corresponding layer in the layers list:

```

```

### Deleting Filters

When the delete button for a filter is clicked, the filter is removed using the `Delete_layer_filter_action`:

```

```

Sources: [src/js/core/gui/gui-layers.js L102-L107](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L102-L107)

 [src/js/core/gui/gui-layers.js L174-L187](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L174-L187)

### Editing Filters

Clicking a filter name opens the filter's editing dialog:

```

```

Sources: [src/js/core/gui/gui-layers.js L108-L119](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L108-L119)

## Rendering Layers in the Panel

The `render_layers()` method is responsible for generating the HTML content for the layers list. It:

1. Retrieves all layers from `config.layers` and sorts them by order
2. Clears the existing layers list
3. Iterates through each layer, generating HTML for: * Layer item with visibility toggle, delete button, and name * Any filters applied to the layer
4. Updates the DOM with the generated HTML
5. Applies translations if necessary

```

```

The generated HTML for each layer has special styling for the currently selected layer and for layers with different composition modes.

Sources: [src/js/core/gui/gui-layers.js L134-L196](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L134-L196)

## Integration with Action System

The Layers Panel relies heavily on miniPaint's action system for operations that modify layers. Most operations are implemented as actions that:

1. Are dispatched through `app.State.do_action()`
2. Support undo/redo functionality
3. Trigger GUI updates when completed

Key actions used by the Layers Panel include:

* `Insert_layer_action`
* `Delete_layer_action`
* `Select_layer_action`
* `Reorder_layer_action`
* `Toggle_layer_visibility_action`
* `Delete_layer_filter_action`
* `Update_layer_action`
* `Refresh_layers_gui_action`

These actions ensure that all layer modifications are recorded in the undo history and that the UI is properly updated to reflect changes.

Sources: [src/js/core/gui/gui-layers.js L51-L119](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L51-L119)

 [src/js/actions/refresh-layers-gui.js L5-L29](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/refresh-layers-gui.js#L5-L29)

## Tables

### Layer Panel Button Reference

| Button | ID | Function | Description |
| --- | --- | --- | --- |
| + | insert_layer | Add new layer | Creates a new blank layer |
| D | layer_duplicate | Duplicate layer | Creates a copy of the selected layer |
| R | layer_raster | Convert to raster | Converts vector or text layers to raster |
| ↑ | layer_up | Move layer up | Increases the layer's order value |
| ↓ | layer_down | Move layer down | Decreases the layer's order value |

Sources: [src/js/core/gui/gui-layers.js L16-L24](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L16-L24)

### Layer Item Components

| Element | Purpose | User Interaction |
| --- | --- | --- |
| Visibility button | Shows/hides layer | Click to toggle |
| Delete button | Removes layer | Click to delete |
| Layer name | Identifies layer | Click to select, double-click to rename |
| Filters list | Shows applied filters | Click filter to edit, click X to delete |

Sources: [src/js/core/gui/gui-layers.js L156-L187](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L156-L187)

## Layer Panel Initialization

The Layers Panel is initialized by the `render_main_layers()` method, which:

1. Inserts the HTML template into the DOM
2. Translates the UI if necessary
3. Renders the layers list
4. Sets up event handlers

This method is called by the main GUI initialization process when miniPaint starts or when the UI needs to be refreshed.

Sources: [src/js/core/gui/gui-layers.js L42-L49](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-layers.js#L42-L49)