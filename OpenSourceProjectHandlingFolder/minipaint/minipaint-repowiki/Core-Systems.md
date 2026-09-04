# Core Systems

> **Relevant source files**
> * [images/test-collection.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/test-collection.json)
> * [src/js/config-menu.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config-menu.js)
> * [src/js/config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js)
> * [src/js/core/base-layers.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js)
> * [src/js/core/base-selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js)
> * [src/js/core/base-tools.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-tools.js)
> * [src/js/core/gui/gui-preview.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-preview.js)
> * [src/js/modules/file/open.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/file/open.js)
> * [src/js/tools/animation.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/animation.js)
> * [src/js/tools/crop.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js)
> * [src/js/tools/select.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js)
> * [src/js/tools/selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/selection.js)
> * [src/js/tools/shapes/bezier_curve.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/bezier_curve.js)
> * [src/js/tools/shapes/polygon.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/polygon.js)

The Core Systems of miniPaint form the foundational architecture that powers the web-based image editor. This page outlines the essential systems that provide the underlying functionality for the application's features. These systems include the central configuration manager, layer management, selection framework, tool system, state management, and dialog system.

For information about the User Interface built on top of these core systems, see [User Interface](/viliusle/miniPaint/3-user-interface). For details about specific tools and their implementation, see [Tools](/viliusle/miniPaint/4-tools).

## System Architecture Overview

The miniPaint core systems are designed with a modular architecture that separates concerns while maintaining clear communication paths between components.

```mermaid
flowchart TD

Config["config.js<br>(Central Configuration)"]
BaseLayers["Base_layers_class<br>(Layer Management)"]
BaseSelection["Base_selection_class<br>(Selection Framework)"]
BaseTools["Base_tools_class<br>(Tool Framework)"]
State["Action System<br>(State Management)"]
Dialog["Dialog System<br>(User Input)"]
GUI["Base_gui_class<br>(UI Management)"]
Tools["Tool Implementations"]
Effects["Effects & Filters"]
FileOps["File Operations"]

GUI --> Config
GUI --> BaseLayers
GUI --> BaseTools
GUI --> Dialog
Tools --> BaseTools
Tools --> Config
Effects --> BaseLayers
FileOps --> BaseLayers

subgraph subGraph2 ["Tools & Features"]
    Tools
    Effects
    FileOps
end

subgraph subGraph1 ["User Interface"]
    GUI
end

subgraph subGraph0 ["Core Systems"]
    Config
    BaseLayers
    BaseSelection
    BaseTools
    State
    Dialog
    Config --> BaseLayers
    Config --> BaseSelection
    Config --> BaseTools
    State --> Config
    BaseLayers --> State
    BaseTools --> State
    BaseSelection --> State
    Dialog --> Config
end
```

Sources: [src/js/config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js)

 [src/js/core/base-layers.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js)

 [src/js/core/base-selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js)

 [src/js/core/base-tools.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-tools.js)

## Configuration System

The configuration system acts as the central state container for the entire application. It stores global settings, application state, and the array of layers that make up the image being edited.

### Key Components of the Configuration System

```mermaid
classDiagram
    class config {
        +Boolean TRANSPARENCY
        +String TRANSPARENCY_TYPE
        +String LANG
        +Number WIDTH
        +Number HEIGHT
        +Number ZOOM
        +Boolean SNAP
        +Array layers
        +Object layer
        +Boolean need_render
        +Object mouse
        +Array guides
        +Object TOOL
    }
    class Layer {
        +int id
        +String name
        +String type
        +Number x
        +Number y
        +Number width
        +Number height
        +Boolean visible
        +Number opacity
        +Array filters
        +Function render_function
    }
    class ActiveLayer {
        «Current selected layer»
    }
    config -- Layer
    config -- ActiveLayer
```

The configuration object (`config.js`) is imported throughout the application and serves as the central truth for:

* Canvas dimensions (`WIDTH`, `HEIGHT`)
* Current zoom level (`ZOOM`)
* List of layers (`layers`)
* Currently active layer (`layer`)
* Currently selected tool (`TOOL`)
* Mouse information (`mouse`)
* Rendering states (`need_render`)
* Application settings (transparency, snap, etc.)

The configuration system doesn't use setters/getters - components directly modify the configuration properties, which allows for simple integration but requires careful management to maintain consistency.

Sources: [src/js/config.js L1-L513](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js#L1-L513)

## Layer Management

The Layer Management system is responsible for organizing, rendering, and manipulating the layers that make up an image. Each layer represents a content element (image, shape, text, etc.) with its own properties and can be independently edited.

### Layer Structure

Each layer in miniPaint is represented as an object with the following key properties:

```mermaid
classDiagram
    class Layer {
        +int id
        +int parent_id
        +String name
        +String type
        +Object link
        +Number x
        +Number y
        +Number width
        +Number height
        +Number width_original
        +Number height_original
        +Boolean visible
        +Boolean is_vector
        +Number opacity
        +Number order
        +String composition
        +Number rotate
        +Object data
        +Object params
        +String color
        +Array filters
        +Array render_function
    }
```

### Layer Management System Architecture

```mermaid
flowchart TD

BaseLayers["Base_layers_class"]
LayerArray["config.layers[]"]
ActiveLayer["config.layer"]
RenderEngine["render()"]
Insert["insert()"]
Delete["delete()"]
Move["move()"]
Toggle["toggle_visibility()"]
Select["select()"]
Convert["convert_layer_to_canvas()"]
Actions["app.Actions"]

BaseLayers --> Insert
BaseLayers --> Delete
BaseLayers --> Move
BaseLayers --> Toggle
BaseLayers --> Select
BaseLayers --> Convert
Actions --> LayerArray
BaseLayers --> Actions

subgraph subGraph2 ["Layer Actions"]
    Actions
end

subgraph subGraph1 ["Key Operations"]
    Insert
    Delete
    Move
    Toggle
    Select
    Convert
end

subgraph subGraph0 ["Layer Management System"]
    BaseLayers
    LayerArray
    ActiveLayer
    RenderEngine
    BaseLayers --> LayerArray
    BaseLayers --> ActiveLayer
    BaseLayers --> RenderEngine
    RenderEngine --> LayerArray
end
```

The `Base_layers_class` is a singleton class that provides methods to manipulate layers. Key functionalities include:

* **Layer Creation**: Adding new layers via `insert()` method
* **Layer Rendering**: The `render()` method processes each layer according to its type and properties
* **Layer Selection**: Activating a specific layer with the `select()` method
* **Layer Management**: Methods for deleting, hiding, moving, and manipulating layers
* **Canvas Interaction**: Converting layers to canvas for saving or exporting

The rendering process follows this sequence:

1. Prepare canvas (`pre_render()`)
2. Get sorted layers by order (`get_sorted_layers()`)
3. Apply zoom view transformations
4. Render each layer through `render_objects()`
5. Add overlay elements like grid and guides
6. Complete render (`after_render()`)

The actual rendering of individual layers occurs in the `render_object()` method, which handles different layer types and applies filters.

Sources: [src/js/core/base-layers.js L45-L884](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L45-L884)

## Selection System

The Selection System provides functionality for selecting, manipulating, and transforming elements on the canvas. It handles user interactions for selecting objects and supports operations like resizing, moving, and rotating selections.

### Selection Framework Components

```mermaid
classDiagram
    class Base_selection_class {
        -Object settings
        -Function data_function
        -Boolean is_drag
        -Object mouse_lock
        -Object click_details
        +constructor(ctx, settings, key)
        +set_selection(x, y, width, height)
        +reset_selection()
        +get_selection()
        +draw_selection()
        -selected_object_actions(e)
    }
    class SelectionData {
        +Number x
        +Number y
        +Number width
        +Number height
    }
    class SelectionTypes {
        «Enumeration»
        DRAG_TYPE_TOP
        DRAG_TYPE_BOTTOM
        DRAG_TYPE_LEFT
        DRAG_TYPE_RIGHT
    }
    Base_selection_class -- SelectionData : manages
    Base_selection_class -- SelectionTypes : uses
```

The Selection System is primarily implemented through the `Base_selection_class` which:

1. Manages selection coordinates and dimensions
2. Renders selection indicators (handles, borders, etc.)
3. Processes mouse events for manipulating selections
4. Supports different selection modes through configuration

Key features include:

* **Visual Indicators**: Drawing borders, resize handles, and rotation controls
* **Interactive Controls**: Handling mouse events for resizing and moving
* **Custom Settings**: Configurable behavior based on the type of selection
* **Rotation Support**: Ability to rotate selected elements

The selection system interacts with the active tool and layer through the configuration object, adapting its behavior based on what's being selected.

Sources: [src/js/core/base-selection.js L21-L558](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js#L21-L558)

 [src/js/tools/select.js L9-L578](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js#L9-L578)

 [src/js/tools/crop.js L10-L307](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js#L10-L307)

 [src/js/tools/selection.js L12-L309](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/selection.js#L12-L309)

## Tool Framework

The Tool Framework provides a standardized base for all tools in miniPaint. It creates a consistent structure for tools to handle mouse events, render their effects, and interact with the application state.

### Tool System Architecture

```mermaid
classDiagram
    class Base_tools_class {
        +Base_layers Base_layers
        +Base_gui Base_gui
        +Helper Helper
        +Boolean is_drag
        +Array mouse_last_click_pos
        +Array mouse_click_pos
        +Number speed_average
        +constructor(save_mouse)
        +dragStart(event)
        +dragMove(event)
        +dragEnd(event)
        +events()
        +prepare()
        +set_mouse_info(event)
        +get_mouse_info(event)
        +getParams()
    }
    class Tool {
        «Interface»
        +String name
        +load()
        +mousedown(event)
        +mousemove(event)
        +mouseup(event)
        +render(ctx, layer)
    }
    class DrawingTool {
        +mousemove(event)
        +render(ctx, layer)
    }
    class SelectionTool {
        +selected_object_actions(event)
        +render(ctx, layer)
    }
    class ShapeTool {
        +shape_mousedown(event)
        +shape_mousemove(event)
        +render(ctx, layer)
    }
    class EffectTool {
        +apply(ctx, layer)
        +render(ctx, layer)
    }
    Base_tools_class <|-- DrawingTool
    Base_tools_class <|-- SelectionTool
    Base_tools_class <|-- ShapeTool
    Base_tools_class <|-- EffectTool
```

The `Base_tools_class` provides:

1. **Event Management**: Standard methods for handling mouse and touch events
2. **Mouse Tracking**: Keeping track of mouse positions and state
3. **Parameter Access**: Methods to retrieve tool parameters
4. **Helper Functions**: Utilities for drawing and manipulating the canvas

Tools extend this base class and implement specific behaviors for different editing functions. The system follows these key patterns:

* **Common Interface**: All tools share the same structure and event methods
* **Event Delegation**: Base class handles event listening and delegates to specific tools
* **Parameter Inheritance**: Tools inherit parameter management from the base class
* **State Management**: Tools work with the global configuration and can trigger state changes

The tool framework is tightly integrated with:

* Configuration system to access tool settings
* Layer management to modify and create layers
* Selection system for tools that require selection handling

Sources: [src/js/core/base-tools.js L15-L392](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-tools.js#L15-L392)

 [src/js/tools/shapes/bezier_curve.js L7-L672](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/bezier_curve.js#L7-L672)

 [src/js/tools/shapes/polygon.js L7-L368](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/polygon.js#L7-L368)

## State Management

miniPaint uses an action-based state management system that enables operations like undo/redo. This system encapsulates changes to the application state into discrete actions that can be executed and reversed.

### Action System Architecture

```mermaid
flowchart TD

State["app.State"]
ActionStack["Action Stack"]
UndoStack["Undo Stack"]
RedoStack["Redo Stack"]
BaseAction["Base Action"]
BundleAction["Bundle Action"]
LayerActions["Layer Actions"]
ConfigActions["Config Actions"]
SelectionActions["Selection Actions"]
BaseLayers["Base_layers_class"]
Config["config.js"]

State --> BaseAction
LayerActions --> Config
ConfigActions --> Config
BaseLayers --> State

subgraph subGraph2 ["System Integration"]
    BaseLayers
    Config
end

subgraph Actions ["Actions"]
    BaseAction
    BundleAction
    LayerActions
    ConfigActions
    SelectionActions
    BaseAction --> BundleAction
    BaseAction --> LayerActions
    BaseAction --> ConfigActions
    BaseAction --> SelectionActions
    BundleAction --> BaseAction
end

subgraph subGraph0 ["State Management"]
    State
    ActionStack
    UndoStack
    RedoStack
    State --> ActionStack
    State --> UndoStack
    State --> RedoStack
end
```

Key components of the State Management system:

1. **Action Interface**: Actions implement a standard interface with `do()` and `undo()` methods
2. **Action State**: The system maintains stacks for undo and redo operations
3. **Bundle Actions**: Multiple actions can be grouped into bundle actions for atomic operations
4. **Integration Points**: Core systems use the action system to make state changes

Examples of actions in the codebase:

* Layer management: `Insert_layer_action`, `Delete_layer_action`, `Update_layer_action`
* Selection: `Set_selection_action`, `Reset_selection_action`
* Configuration: `Update_config_action`

The action system allows for:

* History tracking
* Undoing/redoing operations
* Composite operations that modify multiple aspects of the state
* Predictable state changes throughout the application

The integration can be seen throughout the codebase, with methods like `Base_layers.insert()` and `Base_layers.delete()` using actions to modify the application state.

Sources: [src/js/core/base-layers.js L486-L541](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L486-L541)

 [src/js/core/base-layers.js L574-L595](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L574-L595)

 [src/js/tools/crop.js L163-L296](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js#L163-L296)

## Dialog System

The Dialog System provides a framework for creating modal interfaces for user input and configuration. It handles everything from simple prompts to complex configuration dialogs.

### Dialog System Overview

```mermaid
flowchart TD

Dialog["Dialog_class (popup.js)"]
ParamTypes["Parameter Types"]
EventHandlers["Event Handlers"]
FileOpen["File_open_class"]
Tools["Tool Classes"]
Effects["Effect Classes"]
Text["Text Input"]
Select["Select Dropdown"]
Checkbox["Checkbox"]
Range["Range Slider"]
Color["Color Picker"]
File["File Input"]
OnLoad["on_load()"]
OnFinish["on_finish()"]
OnCancel["on_cancel()"]
OnChange["on_change()"]

FileOpen --> Dialog
Tools --> Dialog
Effects --> Dialog
ParamTypes --> Text
ParamTypes --> Select
ParamTypes --> Checkbox
ParamTypes --> Range
ParamTypes --> Color
ParamTypes --> File
EventHandlers --> OnLoad
EventHandlers --> OnFinish
EventHandlers --> OnCancel
EventHandlers --> OnChange

subgraph subGraph3 ["Event Callbacks"]
    OnLoad
    OnFinish
    OnCancel
    OnChange
end

subgraph subGraph2 ["Parameter Types"]
    Text
    Select
    Checkbox
    Range
    Color
    File
end

subgraph subGraph1 ["Dialog Integration"]
    FileOpen
    Tools
    Effects
end

subgraph subGraph0 ["Dialog System Components"]
    Dialog
    ParamTypes
    EventHandlers
    Dialog --> ParamTypes
    Dialog --> EventHandlers
end
```

The Dialog System provides:

1. **Modal Interfaces**: Creating popup dialogs for user input
2. **Parameterized Inputs**: Supporting various input types (text, select, checkbox, etc.)
3. **Event Callbacks**: Allowing custom handling for dialog events (load, finish, cancel)
4. **Dynamic Content**: Supporting custom HTML content in dialogs

The dialog system is used throughout the application for:

* File operations (open, save, import)
* Tool configuration
* Effect parameter adjustment
* Application settings

Examples in the codebase include:

* The webcam capture dialog in `open.js`
* Data URL import dialog
* Tool configuration dialogs

The dialog system integrates with the rest of the application by allowing components to define parameter specifications and callback functions to handle user input.

Sources: [src/js/modules/file/open.js L116-L173](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/file/open.js#L116-L173)

 [src/js/modules/file/open.js L201-L211](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/file/open.js#L201-L211)

## Interaction Between Core Systems

The core systems interact in specific ways to create the complete functionality of miniPaint:

```mermaid
sequenceDiagram
  participant User
  participant Tool System
  participant Layer Management
  participant State Management
  participant Configuration

  User->>Tool System: Interacts with tool
  Tool System->>State Management: Creates action
  State Management->>Configuration: Updates configuration
  State Management->>Layer Management: Modifies layers
  Layer Management->>Configuration: Updates layer data
  Configuration-->>Layer Management: Triggers render
  Layer Management-->>User: Displays result
```

Key interactions:

1. **Tool System → State Management**: Tools create actions that represent user intent
2. **State Management → Configuration**: Actions update the application state in the configuration
3. **Layer Management ↔ Configuration**: Layers are stored in the configuration and rendered based on it
4. **Selection System ↔ Tool System**: Selection tool works with the selection framework
5. **Dialog System → All Systems**: Dialogs can trigger changes in any system through callback functions

These interactions create a cohesive system where:

* User actions are translated into state changes
* State changes are tracked for undo/redo
* The visual representation updates in response to state changes
* Complex operations are broken down into simpler, composable parts

Sources: [src/js/core/base-layers.js L486-L541](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js#L486-L541)

 [src/js/tools/select.js L153-L259](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/select.js#L153-L259)

 [src/js/tools/crop.js L163-L296](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/crop.js#L163-L296)

## Summary

The Core Systems of miniPaint provide a robust foundation for the application's functionality:

1. **Configuration System**: Central state container that connects different components
2. **Layer Management**: Handles layer operations and rendering
3. **Selection System**: Provides selection and transformation capabilities
4. **Tool Framework**: Standardizes tool behavior and event handling
5. **State Management**: Enables undoable operations through an action system
6. **Dialog System**: Provides interfaces for user input and configuration

Together, these systems create a modular, maintainable architecture that separates concerns while allowing the components to work together effectively.

Sources: [src/js/config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js)

 [src/js/core/base-layers.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-layers.js)

 [src/js/core/base-selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-selection.js)

 [src/js/core/base-tools.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-tools.js)