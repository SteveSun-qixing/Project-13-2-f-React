# Architecture

> **Relevant source files**
> * [dist/bundle.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/dist/bundle.js)
> * [dist/bundle.js.LICENSE.txt](https://github.com/viliusle/miniPaint/blob/6d0b95e5/dist/bundle.js.LICENSE.txt)
> * [dist/bundle.js.map](https://github.com/viliusle/miniPaint/blob/6d0b95e5/dist/bundle.js.map)
> * [images/test-collection.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/test-collection.json)
> * [manifest-disabled.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/manifest-disabled.json)
> * [package-lock.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package-lock.json)
> * [package.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package.json)
> * [src/css/layout.css](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/layout.css)
> * [src/js/config-menu.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config-menu.js)
> * [src/js/config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js)
> * [src/js/core/base-gui.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js)
> * [src/js/core/base-layers.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js)
> * [src/js/core/gui/gui-preview.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-preview.js)
> * [src/js/modules/file/open.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/file/open.js)
> * [src/js/modules/image/palette.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/palette.js)
> * [src/js/tools/pick_color.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pick_color.js)
> * [src/js/tools/shapes/bezier_curve.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/bezier_curve.js)
> * [src/js/tools/shapes/polygon.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/polygon.js)
> * [webpack.config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/webpack.config.js)

This document describes the high-level architecture of miniPaint, explaining the core components and their interactions. It provides developers with a technical understanding of how the image editing system is designed and how data flows through the application.

## Core Architectural Components

miniPaint follows a component-based architecture built around a central configuration object. The system consists of several key components, each with specific responsibilities.

```mermaid
flowchart TD

config["config.js (Central Configuration)"]
BaseLayer["Base_layers_class (Layer Management)"]
BaseGUI["Base_gui_class (UI Management)"]
BaseTools["Base_tools_class (Tool Framework)"]
BaseSelection["Base_selection_class (Selection Framework)"]
State["app.State (Action System)"]
GUIPreview["GUI_preview_class"]
GUITools["GUI_tools_class"]
GUILayers["GUI_layers_class"]
GUIColors["GUI_colors_class"]
GUIMenu["GUI_menu_class"]
GUIDetails["GUI_details_class"]
DrawingTools["Drawing Tools (brush, pencil, etc.)"]
SelectionTools["Selection/Crop Tools"]
ShapeTools["Shape Tools"]
EffectTools["Effects & Filters"]

config --> BaseLayer
config --> BaseGUI
config --> BaseTools
config --> BaseSelection
config --> State
BaseGUI --> GUIPreview
BaseGUI --> GUITools
BaseGUI --> GUILayers
BaseGUI --> GUIColors
BaseGUI --> GUIMenu
BaseGUI --> GUIDetails
BaseTools --> DrawingTools
BaseTools --> SelectionTools
BaseTools --> ShapeTools
BaseTools --> EffectTools
GUITools --> BaseTools

subgraph Tools ["Tools"]
    DrawingTools
    SelectionTools
    ShapeTools
    EffectTools
end

subgraph subGraph2 ["GUI Components"]
    GUIPreview
    GUITools
    GUILayers
    GUIColors
    GUIMenu
    GUIDetails
end

subgraph subGraph1 ["Core Systems"]
    BaseLayer
    BaseGUI
    BaseTools
    BaseSelection
    State
end

subgraph subGraph0 ["Central State"]
    config
end
```

Sources: [src/js/config.js L1-L512](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js#L1-L512)

 [src/js/core/base-layers.js L1-L36](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L1-L36)

 [src/js/core/base-gui.js L1-L26](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L1-L26)

### Configuration System

The heart of miniPaint is the centralized configuration system in `config.js`. It serves as a shared state repository for the entire application, managing everything from canvas dimensions to active tools and layers.

Key properties in the configuration object include:

* `WIDTH` and `HEIGHT`: Canvas dimensions
* `ZOOM`: Current zoom level
* `layers`: Array of all image layers
* `layer`: Currently active layer
* `TOOL`: Currently active tool
* `need_render`: Flag indicating whether rendering is needed

All components access this central configuration to maintain a consistent application state.

```mermaid
flowchart TD

settings["Application Settings<br>(WIDTH, HEIGHT, ZOOM, etc.)"]
layers["Layers Array"]
activeLayer["Active Layer (layer)"]
activeTool["Active Tool (TOOL)"]
renderFlags["Render Flags<br>(need_render, need_render_changed_params)"]
Core["Core Systems"]

Core --> settings
Core --> layers
Core --> activeLayer
Core --> activeTool
Core --> renderFlags

subgraph subGraph0 ["Configuration Object (config.js)"]
    settings
    layers
    activeLayer
    activeTool
    renderFlags
end
```

Sources: [src/js/config.js L1-L33](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js#L1-L33)

 [src/js/app.js L7-L10](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/app.js#L7-L10)

### Layer Management System

The layer management system, implemented in `Base_layers_class`, is responsible for managing and rendering layers to the canvas. It's a singleton class that handles layer creation, deletion, modification, and rendering.

```mermaid
flowchart TD

render["render()"]
layerOps["Layer Operations<br>(insert, delete, select, move)"]
renderObjects["render_objects()"]
renderObject["render_object()"]
layer["Layer Object"]
id["id: Unique identifier"]
name["name: Display name"]
type["type: Layer type<br>(image, text, shape)"]
data["data: Layer content"]
visible["visible: Visibility flag"]
opacity["opacity: Layer opacity (0-100)"]
order["order: Rendering order"]
filters["filters: Applied effects"]
renderFunction["render_function: Rendering method"]

layerOps --> layer

subgraph subGraph1 ["Layer Structure"]
    layer
    id
    name
    type
    data
    visible
    opacity
    order
    filters
    renderFunction
    layer --> id
    layer --> name
    layer --> type
    layer --> data
    layer --> visible
    layer --> opacity
    layer --> order
    layer --> filters
    layer --> renderFunction
end

subgraph subGraph0 ["Layer Management (Base_layers_class)"]
    render
    layerOps
    renderObjects
    renderObject
    render --> renderObjects
    renderObjects --> renderObject
end
```

Sources: [src/js/core/base-layers.js L19-L44](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L19-L44)

 [src/js/core/base-layers.js L127-L214](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L127-L214)

 [src/js/core/base-layers.js L370-L411](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L370-L411)

The rendering process follows these steps:

1. Check if rendering is needed (`config.need_render`)
2. Prepare the canvas with `pre_render()`
3. Get sorted layers with `get_sorted_layers()`
4. Render each visible layer with `render_objects()`
5. Apply filters with `pre_render_object()` and `after_render_object()`
6. Render UI elements like grid, guides, and selection
7. Clean up with `after_render()`

Sources: [src/js/core/base-layers.js L127-L214](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L127-L214)

 [src/js/core/base-layers.js L278-L341](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L278-L341)

### Tools System

The tools system is built around the `Base_tools_class` framework, which provides a common interface for all tools. Each tool (brush, pencil, selection, etc.) inherits from this base class and implements specific behaviors.

```mermaid
classDiagram
    class Base_tools_class {
        +load()
        +mousedown()
        +mousemove()
        +mouseup()
        +render_overlay()
    }
    class Brush_class {
        +mousedown()
        +mousemove()
        +mouseup()
    }
    class Pencil_class {
    }
    class Selection_class {
    }
    class Shape_class {
    }
    class Text_class {
    }
    class Tool_Instance {
        name: String
        attributes: Object
        on_update: Function
        on_leave: Function
    }
    class config_TOOLS {
    }
    Base_tools_class <|-- Brush_class : defines
    Base_tools_class <|-- Pencil_class : implements
    Base_tools_class <|-- Selection_class
    Base_tools_class <|-- Shape_class
    Base_tools_class <|-- Text_class
    config_TOOLS -- Tool_Instance
    Base_tools_class -- Tool_Instance
```

Sources: [src/js/config.js L82-L508](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js#L82-L508)

 [src/js/tools/pick_color.js L7-L106](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pick_color.js#L7-L106)

Tools typically override these methods to implement specific behavior:

* `load()`: Called when the tool is activated
* `mousedown()`, `mousemove()`, `mouseup()`: Handle mouse interactions
* `render_overlay()`: Draw tool-specific UI elements

When a tool is used, it may create or modify layers through the action system, maintaining a clean separation between user interaction and state changes.

Sources: [src/js/tools/pick_color.js L32-L75](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pick_color.js#L32-L75)

 [src/js/tools/shapes/bezier_curve.js L27-L64](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/bezier_curve.js#L27-L64)

### GUI System

The GUI system, managed by `Base_gui_class` and various subcomponents, handles the user interface. It's responsible for rendering UI elements, handling user interactions, and updating the display in response to state changes.

```mermaid
flowchart TD

gui["Base_gui_class"]
preview["GUI_preview_class<br>(Canvas preview)"]
tools["GUI_tools_class<br>(Tools panel)"]
layers["GUI_layers_class<br>(Layers panel)"]
colors["GUI_colors_class<br>(Color picker)"]
menu["GUI_menu_class<br>(Main menu)"]
details["GUI_details_class<br>(Layer details)"]
User["User"]
config["config.js"]
render["render()"]

User --> gui
gui --> config
config --> render

subgraph subGraph0 ["GUI System (Base_gui_class)"]
    gui
    preview
    tools
    layers
    colors
    menu
    details
    gui --> preview
    gui --> tools
    gui --> layers
    gui --> colors
    gui --> menu
    gui --> details
end
```

Sources: [src/js/core/base-gui.js L25-L69](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L25-L69)

 [src/js/core/base-gui.js L136-L147](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L136-L147)

 [src/js/core/gui/gui-preview.js L30-L66](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-preview.js#L30-L66)

The GUI components include:

* `GUI_preview_class`: Shows a small preview of the entire canvas
* `GUI_tools_class`: Displays and manages the tools panel
* `GUI_layers_class`: Shows and manages the layers panel
* `GUI_colors_class`: Handles color selection
* `GUI_menu_class`: Manages the main menu
* `GUI_details_class`: Shows details for the selected layer or tool

Sources: [src/js/core/gui/gui-preview.js L30-L66](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-preview.js#L30-L66)

 [src/js/core/base-gui.js L60-L68](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L60-L68)

### State Management and Action System

miniPaint uses an action-based state management system. Instead of directly modifying the application state, changes are encapsulated in action objects that can be executed, undone, and redone.

```mermaid
flowchart TD

User["User"]
Tool["Tool Class"]
Action["Action Object"]
app.State["app.State.do_action()"]
Config["config.js"]
Render["Base_layers.render()"]
Insert["Insert_layer_action"]
Delete["Delete_layer_action"]
Update["Update_layer_action"]
Bundle["Bundle_action"]

Action --> Insert
Action --> Delete
Action --> Update
Action --> Bundle

subgraph subGraph1 ["Action Types"]
    Insert
    Delete
    Update
    Bundle
end

subgraph subGraph0 ["Action Flow"]
    User
    Tool
    Action
    app.State
    Config
    Render
    User --> Tool
    Tool --> Action
    Tool --> app.State
    app.State --> Action
    Action --> Config
    Config --> Render
end
```

Sources: [src/js/core/base-layers.js L488-L491](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L488-L491)

 [src/js/core/base-layers.js L537-L548](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L537-L548)

 [src/js/modules/file/open.js L145-L150](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/file/open.js#L145-L150)

The action system provides several benefits:

1. **Undo/Redo Support**: Actions can be undone and redone
2. **Atomic Changes**: Complex operations can be grouped into atomic units
3. **State Consistency**: All state changes follow a consistent pattern
4. **Debugging**: State changes are explicit and traceable

Actions are dispatched using `app.State.do_action()`, which executes the action and records it for undo/redo functionality.

Sources: [src/js/core/base-layers.js L488-L491](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L488-L491)

 [src/js/core/base-layers.js L537-L548](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L537-L548)

## Data Flow

The overall data flow in miniPaint follows this pattern:

```mermaid
sequenceDiagram
  participant User
  participant Base_gui_class
  participant Tool Class
  participant app.Actions
  participant config.js
  participant Base_layers_class
  participant canvas_minipaint

  User->>Base_gui_class: Interact with UI
  Base_gui_class->>Tool Class: Activate tool
  User->>Tool Class: Mouse/keyboard input
  Tool Class->>app.Actions: Create action
  Tool Class->>app.Actions: Dispatch via app.State.do_action()
  app.Actions->>config.js: Modify state (config.layers, etc.)
  config.js->>Base_layers_class: Trigger render (config.need_render = true)
  Base_layers_class->>canvas_minipaint: Render content
  canvas_minipaint->>Base_gui_class: Update display
  Base_gui_class->>User: Visual feedback
```

Sources: [src/js/core/base-layers.js L127-L214](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L127-L214)

 [src/js/tools/pick_color.js L58-L74](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pick_color.js#L58-L74)

 [src/js/modules/file/open.js L145-L150](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/file/open.js#L145-L150)

This data flow ensures that:

1. All state changes are properly tracked
2. The UI stays in sync with the underlying data
3. The rendering system efficiently updates the canvas when needed

## Rendering Pipeline

The rendering process is a critical part of miniPaint, responsible for converting layer data into pixels on the canvas:

```mermaid
flowchart TD

Start["Render Start"]
NeedRender["config.need_render?"]
RequestAnimation["Request next frame"]
PreRender["pre_render()"]
GetLayers["get_sorted_layers()"]
RenderObjects["render_objects()"]
ForEachLayer["For each layer:"]
LayerVisible["Layer visible?"]
NextLayer["Next layer"]
PreRenderObject["pre_render_object()"]
RenderObject["render_object()"]
AfterRenderObject["after_render_object()"]
LayersComplete["All layers done?"]
RenderGrid["Draw grid"]
RenderSelection["Draw selection"]
RenderOverlay["Render tool overlay"]
RenderPreview["Render preview"]
AfterRender["after_render()"]
End["Render End"]

Start --> NeedRender
NeedRender --> RequestAnimation
NeedRender --> PreRender
PreRender --> GetLayers
GetLayers --> RenderObjects
RenderObjects --> ForEachLayer
ForEachLayer --> LayerVisible
LayerVisible --> NextLayer
LayerVisible --> PreRenderObject
PreRenderObject --> RenderObject
RenderObject --> AfterRenderObject
AfterRenderObject --> NextLayer
NextLayer --> LayersComplete
LayersComplete --> ForEachLayer
LayersComplete --> RenderGrid
RenderGrid --> RenderSelection
RenderSelection --> RenderOverlay
RenderOverlay --> RenderPreview
RenderPreview --> AfterRender
AfterRender --> RequestAnimation
RequestAnimation --> End
```

Sources: [src/js/core/base-layers.js L127-L214](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L127-L214)

 [src/js/core/base-layers.js L278-L341](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L278-L341)

 [src/js/core/base-layers.js L370-L411](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L370-L411)

The rendering pipeline includes these key steps:

1. Check if rendering is needed (`config.need_render`)
2. Prepare the canvas (`pre_render()`)
3. Get layers in the correct order (`get_sorted_layers()`)
4. For each visible layer: * Apply pre-render filters (`pre_render_object()`) * Render the layer content (`render_object()`) * Apply post-render filters (`after_render_object()`)
5. Render UI elements (grid, selection, tool overlay)
6. Update the preview panel
7. Clean up (`after_render()`)
8. Request the next animation frame

Sources: [src/js/core/base-layers.js L127-L214](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L127-L214)

 [src/js/core/base-layers.js L344-L361](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L344-L361)

## Layer Structure

Layers are the fundamental building blocks of miniPaint. Each layer is an object with specific properties that determine its appearance and behavior:

| Property | Description | Example |
| --- | --- | --- |
| `id` | Unique identifier | `1`, `2`, `3` |
| `name` | Display name | `"Background"`, `"Text Layer"` |
| `type` | Layer type | `"image"`, `"text"`, `"shape"` |
| `data` | Layer content (varies by type) | Image data, text content, shape points |
| `x`, `y` | Position | `0`, `100` |
| `width`, `height` | Dimensions | `800`, `600` |
| `visible` | Visibility flag | `true`, `false` |
| `opacity` | Transparency (0-100) | `100`, `50` |
| `order` | Rendering order | `1`, `2` |
| `composition` | Blend mode | `"source-over"`, `"multiply"` |
| `filters` | Applied effects | Array of filter objects |
| `render_function` | Rendering method | `["text", "render"]` |

Sources: [src/js/core/base-layers.js L19-L44](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L19-L44)

 [images/test-collection.json L16-L164](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/test-collection.json#L16-L164)

Different layer types have different data structures. For example:

* **Image layers** store image data or a link to an image
* **Text layers** store text content and formatting properties
* **Shape layers** store points and shape-specific properties

Sources: [images/test-collection.json L16-L59](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/test-collection.json#L16-L59)

 [images/test-collection.json L53-L107](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/test-collection.json#L53-L107)

## Initialization Process

When miniPaint starts, it follows this initialization sequence:

```mermaid
flowchart TD

Start["Application Start"]
LoadModules["Load modules"]
LoadDefaults["Load default values"]
RenderMainGUI["Render main GUI"]
PrepareCanvas["Prepare canvas"]
InitLayers["Initialize layers"]
SetEvents["Set up event handlers"]
LoadTranslations["Load translations"]
Ready["Application Ready"]

Start --> LoadModules
LoadModules --> LoadDefaults
LoadDefaults --> RenderMainGUI
RenderMainGUI --> PrepareCanvas
PrepareCanvas --> InitLayers
InitLayers --> SetEvents
SetEvents --> LoadTranslations
LoadTranslations --> Ready
```

Sources: [src/js/core/base-gui.js L72-L77](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L72-L77)

 [src/js/core/base-gui.js L136-L152](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L136-L152)

 [src/js/core/base-layers.js L74-L96](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L74-L96)

During initialization:

1. Modules are dynamically loaded
2. Default configuration values are established
3. The main GUI components are rendered
4. The canvas is prepared
5. The layer system is initialized
6. Event handlers are set up
7. Translations are loaded

Sources: [src/js/core/base-gui.js L79-L89](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L79-L89)

 [src/js/core/base-gui.js L91-L133](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L91-L133)

 [src/js/core/base-gui.js L164-L229](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L164-L229)

## Conclusion

miniPaint's architecture follows a component-based design with a central configuration object, a sophisticated layer system, a flexible tools framework, and a comprehensive GUI system. The action-based state management supports undo/redo functionality and maintains a clean separation between user interaction and state changes.

This architecture provides a solid foundation for rich image editing capabilities within a web browser, with a clear separation of concerns and a well-defined data flow.

Sources: [src/js/config.js L1-L512](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js#L1-L512)

 [src/js/core/base-layers.js L1-L884](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L1-L884)

 [src/js/core/base-gui.js L1-L600](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-gui.js#L1-L600)