# Configuration System

> **Relevant source files**
> * [images/test-collection.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/test-collection.json)
> * [src/js/config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js)
> * [src/js/core/gui/gui-information.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-information.js)
> * [src/js/libs/helpers.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/helpers.js)
> * [src/js/modules/file/new.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/file/new.js)
> * [src/js/modules/image/information.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/information.js)
> * [src/js/modules/image/size.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/size.js)
> * [src/js/modules/image/translate.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/translate.js)
> * [src/js/modules/tools/settings.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/tools/settings.js)
> * [src/js/tools/shapes/bezier_curve.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/bezier_curve.js)
> * [src/js/tools/shapes/polygon.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/polygon.js)

The Configuration System in miniPaint provides centralized state management through a global configuration object. This system stores and manages application settings, canvas properties, tool parameters, and runtime state. It serves as the shared data store that connects the various components of the application.

For information about user settings persistence, see [Settings Module](/viliusle/miniPaint/5.4-settings).

## Overview

The miniPaint Configuration System centers around a single global `config` object defined in `config.js`. This object stores all application state and settings, enabling different components to share data without direct coupling.

```mermaid
flowchart TD

config["config.js (Global Object)"]
layers["Layer Management"]
tools["Tool Framework"]
selection["Selection System"]
state["State Management"]
gui["UI Management"]
information["Information Panel"]
fileOps["File Open/Save"]
imageOps["Image Operations"]
cookieStorage["Cookie Storage"]
userSettings["User Settings"]

config --> layers
config --> tools
config --> selection
config --> state
config --> gui
config --> information
config --> fileOps
config --> imageOps
userSettings --> config

subgraph subGraph4 ["Settings Management"]
    cookieStorage
    userSettings
    userSettings --> cookieStorage
end

subgraph subGraph3 ["File Operations"]
    fileOps
    imageOps
end

subgraph subGraph2 ["UI Components"]
    gui
    information
end

subgraph subGraph1 ["Core Systems"]
    layers
    tools
    selection
    state
end

subgraph subGraph0 ["Configuration System"]
    config
end
```

Sources: [src/js/config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js)

 [src/js/modules/tools/settings.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/tools/settings.js)

 [src/js/libs/helpers.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/helpers.js)

## Configuration Object Structure

The global configuration object contains several categories of data that serve different purposes:

```mermaid
classDiagram
    class config {
        +VisualSettings
        +CanvasDimensions
        +StateVariables
        +LayerManagement
        +ToolConfiguration
        +UserPreferences
        +ExternalServices
    }
    class VisualSettings {
        +TRANSPARENCY: boolean
        +TRANSPARENCY_TYPE: string
        +COLOR: string
        +ALPHA: number
        +themes: string[]
    }
    class CanvasDimensions {
        +WIDTH: number
        +HEIGHT: number
        +visible_width: number
        +visible_height: number
        +ZOOM: number
    }
    class StateVariables {
        +need_render: boolean
        +need_render_changed_params: boolean
        +mouse: object
        +mouse_lock: any
    }
    class LayerManagement {
        +layers: Layer[]
        +layer: Layer
    }
    class ToolConfiguration {
        +TOOLS: Tool[]
        +TOOL: Tool
    }
    class UserPreferences {
        +LANG: string
        +SNAP: boolean
        +guides_enabled: boolean
        +ruler_active: boolean
    }
    class ExternalServices {
        +pixabay_key: string
        +google_webfonts_key: string
    }
    config *-- VisualSettings
    config *-- CanvasDimensions
    config *-- StateVariables
    config *-- LayerManagement
    config *-- ToolConfiguration
    config *-- UserPreferences
    config *-- ExternalServices
```

Sources: [src/js/config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js)

## Configuration Default Values

The configuration object is initialized with default values that establish the initial state of the application. Some key default values include:

| Category | Property | Default Value | Description |
| --- | --- | --- | --- |
| Visual Settings | TRANSPARENCY | false | Whether transparency is enabled |
| Visual Settings | TRANSPARENCY_TYPE | 'squares' | Type of transparency pattern |
| Visual Settings | COLOR | '#008000' | Default color |
| Canvas | WIDTH | null | Canvas width in pixels |
| Canvas | HEIGHT | null | Canvas height in pixels |
| Canvas | ZOOM | 1 | Initial zoom level |
| User Preferences | LANG | 'en' | Language setting |
| User Preferences | SNAP | true | Whether snap to grid is enabled |
| State | layers | [] | Array to store all layers |
| State | need_render | false | Flag to trigger re-rendering |

Sources: [src/js/config.js L3-L32](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js#L3-L32)

## Tool Configuration

The configuration system stores detailed definitions for all available tools, including their parameters and attributes. Each tool configuration includes:

* Name and title
* Default parameters
* Event handlers (on_activate, on_leave, etc.)
* Visibility settings

```sql
config.TOOLS = [  {    name: 'select',    title: 'Select object tool',    attributes: {      auto_select: true,    },  },  // More tools defined...];
```

This allows for consistent tool behavior and parameter management throughout the application.

Sources: [src/js/config.js L82-L508](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/config.js#L82-L508)

## Accessing and Modifying Configuration

### Direct Access

Throughout the codebase, components directly access the configuration object to read values:

```javascript
// Reading configuration valuesvar width = config.WIDTH;var currentLayer = config.layer;var isSnapEnabled = config.SNAP;
```

### State Management Integration

For configuration changes that should support undo/redo functionality, the State Management system is used:

```mermaid
sequenceDiagram
  participant Application Component
  participant Action Bundle
  participant app.State
  participant config object

  Application Component->>Action Bundle: Create bundle action
  Application Component->>Action Bundle: Add Update_config_action
  Application Component->>app.State: do_action(action_bundle)
  app.State->>config object: Update configuration values
  app.State->>app.State: Store action for undo/redo
```

Sources: [src/js/modules/file/new.js L97-L118](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/file/new.js#L97-L118)

 [src/js/modules/image/size.js L98-L106](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/size.js#L98-L106)

## Settings Persistence

The configuration system works with the Settings module to persist user preferences between sessions:

```mermaid
flowchart TD

config["config object"]
ToolsSettings["Tools_settings_class"]
Helper["Helper_class"]
cookies["Browser Cookies"]
Component["Application Component"]

Component --> ToolsSettings
ToolsSettings --> Component
Component --> ToolsSettings
ToolsSettings --> config

subgraph subGraph1 ["Settings Management"]
    ToolsSettings
    Helper
    cookies
    ToolsSettings --> Helper
    Helper --> cookies
    cookies --> Helper
    Helper --> ToolsSettings
    ToolsSettings --> Helper
    Helper --> cookies
end

subgraph subGraph0 ["Configuration System"]
    config
end
```

The `Tools_settings_class` provides methods to save and retrieve settings:

```javascript
// Get a setting with fallback to defaultsvar theme = this.Tools_settings.get_setting('theme'); // Save a setting (persists to cookies)this.Tools_settings.save_setting('theme', params.theme); // Update config with new settingconfig.TRANSPARENCY = this.get_setting('transparency');
```

Sources: [src/js/modules/tools/settings.js L67-L94](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/tools/settings.js#L67-L94)

 [src/js/modules/tools/settings.js L102-L166](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/tools/settings.js#L102-L166)

 [src/js/libs/helpers.js L71-L101](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/helpers.js#L71-L101)

## Unit Conversion System

The configuration system includes functionality for converting between different unit systems:

```mermaid
flowchart TD

config["Configuration<br>(resolution setting)"]
helper["Helper_class"]
toolsSettings["Tools_settings_class"]
component["Component requiring units"]

component --> helper
helper --> component

subgraph subGraph0 ["Unit Conversion System"]
    config
    helper
    toolsSettings
    helper --> toolsSettings
    toolsSettings --> config
    config --> toolsSettings
    toolsSettings --> helper
end
```

The Helper class provides methods for converting between pixels and user-defined units:

* `get_user_unit(data, type, resolution)` - Converts pixels to user units
* `get_internal_unit(data, type, resolution)` - Converts user units to pixels

Supported unit types include:

* pixels
* inches
* centimeters
* millimeters

Sources: [src/js/libs/helpers.js L672-L714](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/helpers.js#L672-L714)

 [src/js/modules/image/size.js L32-L34](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/size.js#L32-L34)

 [src/js/modules/image/size.js L94-L95](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/size.js#L94-L95)

## Configuration System Uses

### Layer Management

The configuration system stores the array of all layers (`config.layers`) and the currently selected layer (`config.layer`). Changes to layers are often applied through the State Management system.

### Canvas Dimensions

Canvas dimensions are stored in `config.WIDTH` and `config.HEIGHT`. These values are accessed throughout the application for rendering, tool operations, and information display.

### User Interface

The configuration provides values for the UI to display, such as:

* Canvas dimensions and zoom level
* Current tool parameters
* Layer properties
* Mouse coordinates

### Tool State

The currently active tool is referenced by `config.TOOL`, which points to one of the tool definitions in the `config.TOOLS` array. This provides a consistent way to access the current tool's parameters.

Sources: [src/js/core/gui/gui-information.js L84-L85](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/gui/gui-information.js#L84-L85)

 [src/js/modules/image/information.js L47-L48](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/information.js#L47-L48)

 [src/js/tools/shapes/bezier_curve.js L91-L110](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/bezier_curve.js#L91-L110)

## Best Practices

When working with the configuration system, keep these guidelines in mind:

1. **State Changes**: For changes that should support undo/redo, use the State Management system rather than directly modifying the configuration.
2. **Settings Persistence**: Use the `Tools_settings_class` methods to save and retrieve user settings.
3. **Unit Conversion**: Always use the Helper class methods for unit conversions to ensure consistency.
4. **Rendering Updates**: Set `config.need_render = true` when changes require the canvas to be redrawn.

Sources: [src/js/modules/tools/settings.js L83-L93](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/tools/settings.js#L83-L93)

 [src/js/modules/image/size.js L134-L136](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/size.js#L134-L136)

 [src/js/tools/shapes/bezier_curve.js L431](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/shapes/bezier_curve.js#L431-L431)