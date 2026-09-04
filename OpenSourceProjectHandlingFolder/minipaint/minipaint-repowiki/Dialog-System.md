# Dialog System

> **Relevant source files**
> * [src/css/popup.css](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/popup.css)
> * [src/css/reset.css](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/reset.css)
> * [src/js/libs/popup.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js)

The Dialog System in miniPaint provides a flexible modal interface for user input, configuration, and feedback. This centralized system allows tools and modules to create customizable popup dialogs with various input types, preview capabilities, and consistent styling.

## Purpose and Scope

This document covers the implementation and usage of the Dialog System, which handles all popup dialogs in miniPaint. The system manages dialog rendering, parameter input, event handling, and communication with the rest of the application. For information about specific tools that use dialogs, see [Tool Framework](/viliusle/miniPaint/2.4-tool-framework) and [Tools](/viliusle/miniPaint/4-tools).

## System Overview

The Dialog System is implemented as a standalone class (`Dialog_class`) in the popup.js file. It provides a centralized way to create and manage modal dialogs throughout the application.

```mermaid
flowchart TD

Tools["Tool Classes"]
Modules["File/Settings Modules"]
CoreSystems["Core Systems"]
DialogClass["Dialog_class (popup.js)"]
DialogConfig["Dialog Configuration"]
DialogRendering["HTML Generation"]
EventHandling["Event Handlers"]
ParameterProcessing["Parameter Processing"]
PreviewSystem["Preview Capability"]
DOM["DOM Elements"]

Tools --> DialogClass
Modules --> DialogClass
CoreSystems --> DialogClass
DialogClass --> DOM
DialogRendering --> DOM
DOM --> EventHandling
PreviewSystem --> DOM

subgraph subGraph1 ["Dialog System"]
    DialogClass
    DialogConfig
    DialogRendering
    EventHandling
    ParameterProcessing
    PreviewSystem
    DialogConfig --> DialogRendering
    EventHandling --> ParameterProcessing
    ParameterProcessing --> PreviewSystem
end

subgraph subGraph0 ["External Systems"]
    Tools
    Modules
    CoreSystems
end
```

Sources: [src/js/libs/popup.js L60-L674](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L60-L674)

## Dialog Implementation

The Dialog System is built around the `Dialog_class` which manages the entire dialog lifecycle from creation to destruction. When initialized, it creates a global instance accessible as `window.POP`.

### Core Components

```mermaid
classDiagram
    class Dialog_class {
        +el: HTMLElement
        +parameters: Array
        +onfinish: Function
        +oncancel: Function
        +onchange: Function
        +onload: Function
        +preview: Boolean
        +show(config)
        +hide(success)
        +get_params()
        +generateParamsHtml()
        +preview_handler()
    }
    class DialogConfig {
        +title: String
        +params: Array
        +preview: Boolean
        +on_finish: Function
        +on_cancel: Function
        +on_change: Function
        +on_load: Function
        +className: String
        +comment: String
    }
    class ParameterObject {
        +name: String
        +title: String
        +type: String
        +value: Any
        +values: Array
        +range: Array
        +step: Number
        +placeholder: String
        +html: String
        +function: Function
    }
    Dialog_class -- DialogConfig : uses
    DialogConfig -- ParameterObject : contains
```

Sources: [src/js/libs/popup.js L61-L92](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L61-L92)

 [src/js/libs/popup.js L97-L117](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L97-L117)

### Dialog Creation Process

When a dialog is requested by any part of the application, it follows this sequence:

```mermaid
sequenceDiagram
  participant Calling Code
  participant Dialog_class
  participant DOM Elements
  participant User

  Calling Code->>Dialog_class: show(config)
  Dialog_class->>Dialog_class: Store configuration
  Dialog_class->>DOM Elements: Create dialog element
  Dialog_class->>Dialog_class: Generate HTML from parameters
  Dialog_class->>DOM Elements: Populate dialog with content
  Dialog_class->>Dialog_class: Set up event handlers
  loop [Has onload callback]
    Dialog_class->>Calling Code: Execute onload callback
    Dialog_class->>Dialog_class: Initialize preview canvases
    Dialog_class->>Dialog_class: Render original image
    Dialog_class->>Dialog_class: Prepare preview handler
    DOM Elements->>User: Display dialog
    User->>DOM Elements: Interact with inputs
    DOM Elements->>Dialog_class: Trigger change events
    Dialog_class->>Calling Code: Execute onchange callback
    Calling Code->>Dialog_class: Update preview (if enabled)
    User->>DOM Elements: Click OK button
    DOM Elements->>Dialog_class: Trigger save action
    Dialog_class->>Dialog_class: Collect parameter values
    Dialog_class->>Calling Code: Execute onfinish callback
    Dialog_class->>DOM Elements: Remove dialog
    User->>DOM Elements: Click Cancel/Close button
    DOM Elements->>Dialog_class: Trigger cancel action
    Dialog_class->>Calling Code: Execute oncancel callback
    Dialog_class->>DOM Elements: Remove dialog
  end
```

Sources: [src/js/libs/popup.js L99-L127](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L99-L127)

 [src/js/libs/popup.js L345-L469](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L345-L469)

## Dialog Configuration

The dialog configuration is a JavaScript object that defines how the dialog will look and behave:

```javascript
var settings = {    title: 'Dialog Title',    comment: 'Optional comment',    preview: true,   // Enable preview    className: '',   // Optional CSS class    params: [        {name: "param1", title: "Parameter #1:", value: "111"},        {name: "param2", title: "Parameter #2:", value: "222"},    ],    on_load: function(params){...},    on_change: function(params, canvas_preview, w, h){...},    on_finish: function(params){...},    on_cancel: function(params){...},};
```

Sources: [src/js/libs/popup.js L11-L25](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L11-L25)

## Parameter Types

The dialog system supports various parameter types for different input needs:

| Parameter Type | Definition Example | Description |
| --- | --- | --- |
| Text input | `{name: "text_param", title: "Text:", value: "default"}` | Standard text input field |
| Number | `{name: "num_param", title: "Number:", value: 100}` | Numeric input field |
| Checkbox | `{name: "bool_param", title: "Enable:", value: true}` | Boolean toggle |
| Range | `{name: "range_param", title: "Amount:", value: 50, range: [0, 100], step: 1}` | Slider control with min/max values |
| Color | `{name: "color_param", title: "Color:", value: "#ff0000", type: "color"}` | Color picker |
| Select | `{name: "select_param", title: "Choose:", value: "option1", values: ["option1", "option2"]}` | Dropdown selection |
| Radio | `{name: "radio_param", title: "Mode:", value: "mode1", values: ["mode1", "mode2"]}` | Radio button group |
| Textarea | `{name: "text_area", title: "Comments:", value: "", type: "textarea"}` | Multi-line text area |
| HTML | `{html: "<b>Custom HTML content</b>"}` | Custom HTML content |
| Function | `{function: function() { return "<div>Dynamic content</div>"; }}` | Dynamic content via function |

Sources: [src/js/libs/popup.js L27-L39](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L27-L39)

 [src/js/libs/popup.js L472-L622](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L472-L622)

## Preview Functionality

The dialog system includes a powerful preview capability that allows tools to show users the effect of their parameter settings in real-time:

```mermaid
flowchart TD

LeftCanvas["Original Canvas (Before)"]
RightCanvas["Preview Canvas (After)"]
OnChangeHandler["onChange Callback"]
UserInput["User Parameter Changes"]
OriginalLayer["Layer Data"]

UserInput --> OnChangeHandler
OriginalLayer --> LeftCanvas

subgraph subGraph0 ["Preview System"]
    LeftCanvas
    RightCanvas
    OnChangeHandler
    LeftCanvas --> RightCanvas
    OnChangeHandler --> RightCanvas
end
```

When preview is enabled:

1. The original image is shown on the left preview canvas
2. A copy is shown on the right preview canvas
3. When parameters change, the `on_change` callback is invoked
4. The callback can modify the right canvas to show the effect of current parameters

Sources: [src/js/libs/popup.js L358-L465](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L358-L465)

 [src/js/libs/popup.js L234-L260](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L234-L260)

## Dialog HTML Structure

The dialog's DOM structure follows this template:

```mermaid
flowchart TD

PopupDiv["dialog element (.popup)"]
CloseButton["Close Button"]
PretitleArea["Pretitle Area"]
Comment["Comment Text"]
Title["Title (h2)"]
DialogContent["Dialog Content"]
PreviewContent["Preview Content"]
ParamsContent["Parameters Content"]
Buttons["Button Area"]
OkButton["OK Button"]
CancelButton["Cancel Button"]

subgraph subGraph0 ["Dialog HTML Structure"]
    PopupDiv
    CloseButton
    PretitleArea
    Comment
    Title
    DialogContent
    PreviewContent
    ParamsContent
    Buttons
    OkButton
    CancelButton
    PopupDiv --> CloseButton
    PopupDiv --> PretitleArea
    PopupDiv --> Comment
    PopupDiv --> Title
    PopupDiv --> DialogContent
    DialogContent --> PreviewContent
    DialogContent --> ParamsContent
    PopupDiv --> Buttons
    Buttons --> OkButton
    Buttons --> CancelButton
end
```

Sources: [src/js/libs/popup.js L46-L59](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L46-L59)

 [src/css/popup.css L8-L27](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/popup.css#L8-L27)

## Event Handling

The dialog system implements several key event handlers:

1. **Keyboard Events**: Escape key closes the dialog
2. **Mouse Events**: Enables dragging the dialog by its title bar
3. **Window Events**: Resets position on window resize
4. **Input Events**: Handles parameter changes and triggers callbacks

Dialog events are carefully managed to prevent memory leaks by storing and removing all event listeners when the dialog is closed.

Sources: [src/js/libs/popup.js L167-L231](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L167-L231)

 [src/js/libs/popup.js L405-L432](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L405-L432)

## Parameter Processing

When a dialog is submitted, the `get_params()` method collects all parameter values from the DOM and returns them to the caller:

```mermaid
flowchart TD

GetParams["get_params() Method"]
CollectInputs["Collect Input Values"]
CollectSelects["Collect Select Values"]
CollectTextareas["Collect Textarea Values"]
BuildResponse["Build Response Object"]
ReturnValues["Return Parameter Values"]

GetParams --> CollectInputs
GetParams --> CollectSelects
GetParams --> CollectTextareas
CollectInputs --> BuildResponse
CollectSelects --> BuildResponse
CollectTextareas --> BuildResponse
BuildResponse --> ReturnValues
```

The system handles various input types differently to ensure proper type conversion (numbers, booleans, etc.).

Sources: [src/js/libs/popup.js L289-L339](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L289-L339)

## Styling and Theming

The dialog system has dedicated CSS styles in `popup.css` that control its appearance. These styles integrate with the theme system to maintain consistency across the application.

Key styling features include:

* Responsive layout for different screen sizes
* Consistent input field styling
* Draggable dialog windows
* Proper scrolling for content exceeding the viewport

Sources: [src/css/popup.css L1-L271](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/popup.css#L1-L271)

 [src/css/reset.css L1-L230](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/css/reset.css#L1-L230)

## Usage Example

To use the dialog system, create a configuration object and call the `show()` method:

```javascript
// Create a dialog configurationvar config = {    title: 'Adjust Brightness',    preview: true,    params: [        {name: "brightness", title: "Brightness:", value: 0, range: [-100, 100]}    ],    on_change: function(params, preview_ctx, width, height) {        // Update preview with current brightness setting        // ...    },    on_finish: function(params) {        // Apply brightness to the actual image        // ...    }}; // Show the dialogPOP.show(config);
```

The dialog system is a crucial part of miniPaint's user interface, providing a consistent way for users to interact with tools and configure settings throughout the application.

Sources: [src/js/libs/popup.js L1-L40](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/libs/popup.js#L1-L40)